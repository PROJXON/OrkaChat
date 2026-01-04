// HTTP API (payload v2) Lambda: POST /channels/leave
// Leave a channel (membership -> left). Global is not leaveable (system channel).
//
// Env:
// - CHANNELS_TABLE (required)
// - CHANNEL_MEMBERS_TABLE (required)
//
// Auth: JWT (Cognito). Reads sub from requestContext.authorizer.jwt.claims.sub
const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, GetCommand, UpdateCommand } = require('@aws-sdk/lib-dynamodb');

const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({}));

const safeString = (v) => (typeof v === 'string' ? String(v).trim() : '');
const json = (statusCode, bodyObj) => ({
  statusCode,
  headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
  body: JSON.stringify(bodyObj),
});

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
          UpdateExpression: 'SET activeMemberCount = if_not_exists(activeMemberCount, :z) + :dec, updatedAt = :u',
          ExpressionAttributeValues: { ':z': 0, ':dec': -1, ':u': nowMs },
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

