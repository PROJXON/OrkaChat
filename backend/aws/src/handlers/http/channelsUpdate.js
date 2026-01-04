// HTTP API (payload v2) Lambda: POST /channels/update
// Admin-only updates for channels (membership/admin roles + channel settings).
//
// Body:
// - { channelId: string, op: string, ... }
// Ops:
// - setName: { name: string }
// - setPublic: { isPublic: boolean }
// - setPassword: { password: string }
// - clearPassword: {}
// - promoteAdmin: { memberSub: string }
// - demoteAdmin: { memberSub: string }
// - ban: { memberSub: string }
// - unban: { memberSub: string }
// - deleteChannel: {}
//
// Env:
// - CHANNELS_TABLE (required)
// - CHANNEL_MEMBERS_TABLE (required)
// - CHANNELS_NAME_GSI (optional, default "byNameLower")
//
// Auth: JWT (Cognito)
const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const {
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  UpdateCommand,
  QueryCommand,
  ScanCommand,
} = require('@aws-sdk/lib-dynamodb');

// NOTE (AWS Console copy/paste): if this file is pasted into Lambda root as `index.js`,
// change this to: require('./lib/channels') and add `lib/channels.js` next to index.js.
const { hashPassword, validateChannelName } = require('./lib/channels');

const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({}));

const safeString = (v) => (typeof v === 'string' ? String(v).trim() : '');
const json = (statusCode, bodyObj) => ({
  statusCode,
  headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
  body: JSON.stringify(bodyObj),
});

async function nameLowerExists({ channelsTable, nameLower, gsiName }) {
  if (!channelsTable || !nameLower) return false;
  const idx = safeString(gsiName) || 'byNameLower';
  try {
    const resp = await ddb.send(
      new QueryCommand({
        TableName: channelsTable,
        IndexName: idx,
        KeyConditionExpression: 'nameLower = :n',
        ExpressionAttributeValues: { ':n': nameLower },
        Limit: 1,
      })
    );
    const it = resp.Items?.[0];
    if (!it) return false;
    if (typeof it.deletedAt === 'number' && Number.isFinite(it.deletedAt) && it.deletedAt > 0) return false;
    return true;
  } catch {
    const resp = await ddb.send(
      new ScanCommand({
        TableName: channelsTable,
        FilterExpression: 'nameLower = :n AND attribute_not_exists(deletedAt)',
        ExpressionAttributeValues: { ':n': nameLower },
        Limit: 1,
      })
    );
    return !!resp.Items?.[0];
  }
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
  const op = safeString(body.op);
  if (!channelId) return json(400, { message: 'channelId is required' });
  if (!op) return json(400, { message: 'op is required' });

  const nowMs = Date.now();

  try {
    const [chResp, myResp] = await Promise.all([
      ddb.send(new GetCommand({ TableName: channelsTable, Key: { channelId } })),
      ddb.send(new GetCommand({ TableName: membersTable, Key: { channelId, memberSub: callerSub } })),
    ]);
    const channel = chResp.Item;
    if (!channel || (typeof channel.deletedAt === 'number' && channel.deletedAt > 0)) return json(404, { message: 'Channel not found' });
    const my = myResp.Item;
    if (!my) return json(403, { message: 'Forbidden' });
    if (safeString(my.status) !== 'active') return json(403, { message: 'Forbidden' });
    if (!my.isAdmin) return json(403, { message: 'Admin required' });

    const gsiName = safeString(process.env.CHANNELS_NAME_GSI) || 'byNameLower';

    if (op === 'setName') {
      const name = safeString(body.name);
      const v = validateChannelName(name);
      if (!v.ok) return json(400, { message: v.message });
      const { name: displayName, nameLower } = v;
      const currentLower = safeString(channel.nameLower);
      if (nameLower !== currentLower) {
        const exists = await nameLowerExists({ channelsTable, nameLower, gsiName });
        if (exists) return json(409, { message: 'Channel name already exists' });
      }
      await ddb.send(
        new UpdateCommand({
          TableName: channelsTable,
          Key: { channelId },
          UpdateExpression: 'SET #n = :n, nameLower = :nl, updatedAt = :u',
          ExpressionAttributeNames: { '#n': 'name' },
          ExpressionAttributeValues: { ':n': displayName, ':nl': nameLower, ':u': nowMs },
        })
      );
    } else if (op === 'setPublic') {
      const isPublic = body.isPublic === true;
      await ddb.send(
        new UpdateCommand({
          TableName: channelsTable,
          Key: { channelId },
          UpdateExpression: 'SET isPublic = :p, updatedAt = :u',
          ExpressionAttributeValues: { ':p': isPublic, ':u': nowMs },
        })
      );
    } else if (op === 'setPassword') {
      const password = safeString(body.password);
      if (!password) return json(400, { message: 'password is required' });
      const passwordHash = hashPassword(password);
      if (!passwordHash) return json(500, { message: 'Password hashing failed' });
      await ddb.send(
        new UpdateCommand({
          TableName: channelsTable,
          Key: { channelId },
          UpdateExpression: 'SET hasPassword = :hp, passwordHash = :ph, updatedAt = :u',
          ExpressionAttributeValues: { ':hp': true, ':ph': passwordHash, ':u': nowMs },
        })
      );
    } else if (op === 'clearPassword') {
      await ddb.send(
        new UpdateCommand({
          TableName: channelsTable,
          Key: { channelId },
          UpdateExpression: 'SET hasPassword = :hp, updatedAt = :u REMOVE passwordHash',
          ExpressionAttributeValues: { ':hp': false, ':u': nowMs },
        })
      );
    } else if (op === 'promoteAdmin' || op === 'demoteAdmin') {
      const memberSub = safeString(body.memberSub);
      if (!memberSub) return json(400, { message: 'memberSub is required' });
      await ddb.send(
        new UpdateCommand({
          TableName: membersTable,
          Key: { channelId, memberSub },
          UpdateExpression: 'SET isAdmin = :a, updatedAt = :u',
          ConditionExpression: 'attribute_exists(memberSub) AND #s = :active',
          ExpressionAttributeNames: { '#s': 'status' },
          ExpressionAttributeValues: { ':a': op === 'promoteAdmin', ':u': nowMs, ':active': 'active' },
        })
      );
    } else if (op === 'ban' || op === 'unban') {
      const memberSub = safeString(body.memberSub);
      if (!memberSub) return json(400, { message: 'memberSub is required' });
      if (memberSub === callerSub) return json(400, { message: 'Cannot ban yourself' });

      const targetResp = await ddb.send(new GetCommand({ TableName: membersTable, Key: { channelId, memberSub } }));
      const target = targetResp.Item || null;
      const prevStatus = safeString(target?.status);

      if (op === 'ban') {
        if (!target) {
          await ddb.send(
            new PutCommand({
              TableName: membersTable,
              Item: {
                channelId,
                memberSub,
                status: 'banned',
                isAdmin: false,
                bannedAt: nowMs,
                updatedAt: nowMs,
              },
            })
          );
        } else {
          await ddb.send(
            new UpdateCommand({
              TableName: membersTable,
              Key: { channelId, memberSub },
              UpdateExpression: 'SET #s = :s, isAdmin = :a, bannedAt = :t, updatedAt = :u REMOVE leftAt',
              ExpressionAttributeNames: { '#s': 'status' },
              ExpressionAttributeValues: { ':s': 'banned', ':a': false, ':t': nowMs, ':u': nowMs },
            })
          );
        }

        if (prevStatus === 'active') {
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
        }
      } else {
        // unban => move to left (user can re-join via /channels/join if public)
        if (!target) return json(404, { message: 'Not found' });
        await ddb.send(
          new UpdateCommand({
            TableName: membersTable,
            Key: { channelId, memberSub },
            UpdateExpression: 'SET #s = :s, isAdmin = :a, leftAt = :t, updatedAt = :u REMOVE bannedAt',
            ExpressionAttributeNames: { '#s': 'status' },
            ConditionExpression: '#s = :banned',
            ExpressionAttributeValues: { ':s': 'left', ':a': false, ':t': nowMs, ':u': nowMs, ':banned': 'banned' },
          })
        );
      }
    } else if (op === 'deleteChannel') {
      await ddb.send(
        new UpdateCommand({
          TableName: channelsTable,
          Key: { channelId },
          UpdateExpression: 'SET deletedAt = :d, isPublic = :p, updatedAt = :u',
          ExpressionAttributeValues: { ':d': nowMs, ':p': false, ':u': nowMs },
        })
      );
    } else {
      return json(400, { message: `Unknown op: ${op}` });
    }

    return json(200, { ok: true });
  } catch (err) {
    console.error('channelsUpdate error', err);
    if (String(err?.name || '').includes('ConditionalCheckFailed')) return json(404, { message: 'Not found' });
    return json(500, { message: 'Internal error' });
  }
};

