// HTTP API (payload v2) Lambda: POST /channels/leave
// Leave a channel (membership -> left). Global is not leaveable (system channel).
//
// Env:
// - CHANNELS_TABLE (required)
// - CHANNEL_MEMBERS_TABLE (required)
//
// Auth: JWT (Cognito). Reads sub from requestContext.authorizer.jwt.claims.sub
const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, GetCommand, UpdateCommand, QueryCommand } = require('@aws-sdk/lib-dynamodb');

const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({}));

const safeString = (v) => (typeof v === 'string' ? String(v).trim() : '');
const json = (statusCode, bodyObj) => ({
  statusCode,
  headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
  body: JSON.stringify(bodyObj),
});

function publicRankSk(activeMemberCount, channelId) {
  const CAP = 999_999_999_999;
  const c = Math.max(0, Math.floor(Number(activeMemberCount) || 0));
  const r = Math.max(0, CAP - c);
  const left = String(r).padStart(12, '0');
  const id = safeString(channelId);
  return `${left}#${id}`;
}

exports.handler = async (event) => {
  const method = event.requestContext?.http?.method;
  if (method !== 'POST') return json(405, { message: 'Method not allowed' });

  const callerSub = safeString(event.requestContext?.authorizer?.jwt?.claims?.sub);
  if (!callerSub) return json(401, { message: 'Unauthorized' });

  const channelsTable = safeString(process.env.CHANNELS_TABLE);
  const membersTable = safeString(process.env.CHANNEL_MEMBERS_TABLE);
  if (!channelsTable) return json(500, { message: 'CHANNELS_TABLE not configured' });
  if (!membersTable) return json(500, { message: 'CHANNEL_MEMBERS_TABLE not configured' });

  let body = {};
  try {
    body = JSON.parse(event.body || '{}');
  } catch {
    return json(400, { message: 'Invalid JSON body' });
  }

  const channelId = safeString(body.channelId);
  if (!channelId) return json(400, { message: 'channelId is required' });

  const nowMs = Date.now();

  try {
    const chResp = await ddb.send(new GetCommand({ TableName: channelsTable, Key: { channelId } }));
    const channel = chResp.Item || null;
    const isPublic = !!channel?.isPublic;
    const currentCount = typeof channel?.activeMemberCount === 'number' ? channel.activeMemberCount : 0;
    const nextCount = Math.max(0, currentCount - 1);

    const memResp = await ddb.send(
      new GetCommand({
        TableName: membersTable,
        Key: { channelId, memberSub: callerSub },
      })
    );
    const mem = memResp.Item || null;
    const status = safeString(mem?.status);
    if (!mem) return json(404, { message: 'Not a member' });
    if (status !== 'active') return json(200, { ok: true, left: false });

    // Server-side "last admin can't leave" enforcement:
    // If caller is an active admin and there are other active members, require at least one other active admin.
    if (mem && mem.isAdmin) {
      try {
        const resp = await ddb.send(
          new QueryCommand({
            TableName: membersTable,
            KeyConditionExpression: 'channelId = :c',
            ExpressionAttributeValues: { ':c': channelId },
            ProjectionExpression: 'memberSub, #s, isAdmin, joinedAt',
            ExpressionAttributeNames: { '#s': 'status' },
            Limit: 200,
          })
        );
        const rows = Array.isArray(resp.Items) ? resp.Items : [];
        const active = rows.filter((r) => safeString(r?.status) === 'active');
        const othersActive = active.filter((r) => safeString(r?.memberSub) !== callerSub);
        const othersActiveAdmins = othersActive.filter((r) => !!r.isAdmin);
        if (othersActive.length > 0 && othersActiveAdmins.length === 0) {
          return json(400, { message: 'You are the last admin. Promote someone else before leaving.' });
        }
      } catch {
        // If the query fails, do not block leaving (best-effort); client may still warn.
      }
    }

    await ddb.send(
      new UpdateCommand({
        TableName: membersTable,
        Key: { channelId, memberSub: callerSub },
        UpdateExpression: 'SET #s = :s, leftAt = :t, updatedAt = :u',
        ExpressionAttributeNames: { '#s': 'status' },
        ConditionExpression: '#s = :active',
        ExpressionAttributeValues: { ':s': 'left', ':t': nowMs, ':u': nowMs, ':active': 'active' },
      })
    );

    await ddb
      .send(
        new UpdateCommand({
          TableName: channelsTable,
          Key: { channelId },
          UpdateExpression: isPublic
            ? 'SET activeMemberCount = if_not_exists(activeMemberCount, :z) + :dec, publicIndexPk = :pk, publicRankSk = :sk, updatedAt = :u'
            : 'SET activeMemberCount = if_not_exists(activeMemberCount, :z) + :dec, updatedAt = :u',
          ExpressionAttributeValues: isPublic
            ? { ':z': 0, ':dec': -1, ':u': nowMs, ':pk': 'public', ':sk': publicRankSk(nextCount, channelId) }
            : { ':z': 0, ':dec': -1, ':u': nowMs },
        })
      )
      .catch(() => {});

    return json(200, { ok: true, left: true });
  } catch (err) {
    console.error('channelsLeave error', err);
    if (String(err?.name || '').includes('ConditionalCheckFailed')) return json(200, { ok: true, left: false });
    return json(500, { message: 'Internal error' });
  }
};

