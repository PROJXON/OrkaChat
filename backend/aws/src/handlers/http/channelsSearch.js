// HTTP API (payload v2) Lambda: GET /channels/search?q=...
// Public-safe search/list endpoint for channels.
//
// Behavior:
// - If called WITHOUT JWT (public route): returns public channels only.
// - If called WITH JWT: returns public channels + any channels the caller is an active member of (including private).
//
// Env:
// - CHANNELS_TABLE (required): PK channelId
// - CHANNEL_MEMBERS_TABLE (optional): PK channelId, SK memberSub (needed to include private member channels)
// - CHANNEL_MEMBERS_BY_MEMBER_GSI (optional, default "byMemberSub"): GSI with PK memberSub to list a user's channels
//
const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const {
  DynamoDBDocumentClient,
  ScanCommand,
  QueryCommand,
  BatchGetCommand,
} = require('@aws-sdk/lib-dynamodb');

// NOTE (AWS Console copy/paste): if this file is pasted into Lambda root as `index.js`,
// change this to: require('./lib/channels') and add `lib/channels.js` next to index.js.
const { normalizeChannelKey } = require('./lib/channels');

const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({}));

const safeString = (v) => (typeof v === 'string' ? String(v).trim() : '');

const json = (statusCode, bodyObj) => ({
  statusCode,
  headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
  body: JSON.stringify(bodyObj),
});

function normalizeQuery(q) {
  const s = safeString(q).toLowerCase();
  if (!s) return '';
  // match the stored nameLower canonical key
  return normalizeChannelKey(s);
}

exports.handler = async (event) => {
  const method = event.requestContext?.http?.method;
  if (method !== 'GET') return json(405, { message: 'Method not allowed' });

  const channelsTable = safeString(process.env.CHANNELS_TABLE);
  if (!channelsTable) return json(500, { message: 'CHANNELS_TABLE not configured' });

  const callerSub = safeString(event.requestContext?.authorizer?.jwt?.claims?.sub);
  const membersTable = safeString(process.env.CHANNEL_MEMBERS_TABLE);

  const qs = event.queryStringParameters || {};
  const q = normalizeQuery(qs.q);
  const limitRaw = Number(qs.limit ?? 50);
  const limit = Number.isFinite(limitRaw) ? Math.max(1, Math.min(100, Math.floor(limitRaw))) : 50;

  try {
    // 1) Public channels (scan; acceptable for v1)
    const filterParts = ['attribute_not_exists(deletedAt)', 'isPublic = :p'];
    const values = { ':p': true };
    if (q) {
      filterParts.push('contains(nameLower, :q)');
      values[':q'] = q;
    }
    const publicResp = await ddb.send(
      new ScanCommand({
        TableName: channelsTable,
        FilterExpression: filterParts.join(' AND '),
        ExpressionAttributeValues: values,
        Limit: limit,
      })
    );

    const publicChannels = (publicResp.Items || []).map((it) => ({
      channelId: safeString(it.channelId),
      name: safeString(it.name),
      nameLower: safeString(it.nameLower),
      isPublic: !!it.isPublic,
      hasPassword: !!it.hasPassword,
      activeMemberCount: typeof it.activeMemberCount === 'number' ? it.activeMemberCount : undefined,
    })).filter((c) => c.channelId && c.name);

    // 2) Private/member channels (only for authed callers)
    let memberChannels = [];
    if (callerSub && membersTable) {
      try {
        const gsi = safeString(process.env.CHANNEL_MEMBERS_BY_MEMBER_GSI) || 'byMemberSub';
        const memResp = await ddb.send(
          new QueryCommand({
            TableName: membersTable,
            IndexName: gsi,
            KeyConditionExpression: 'memberSub = :u',
            ExpressionAttributeValues: { ':u': callerSub },
            ProjectionExpression: 'channelId, #s',
            ExpressionAttributeNames: { '#s': 'status' },
            Limit: 200,
          })
        );
        const channelIds = (memResp.Items || [])
          .filter((m) => safeString(m?.status) === 'active')
          .map((m) => safeString(m?.channelId))
          .filter(Boolean);

        const unique = Array.from(new Set(channelIds)).slice(0, 100);
        if (unique.length) {
          const resp = await ddb.send(
            new BatchGetCommand({
              RequestItems: {
                [channelsTable]: {
                  Keys: unique.map((id) => ({ channelId: id })),
                },
              },
            })
          );
          const items = resp.Responses?.[channelsTable] || [];
          memberChannels = items
            .filter((it) => !(typeof it.deletedAt === 'number' && Number.isFinite(it.deletedAt) && it.deletedAt > 0))
            .filter((it) => (q ? safeString(it.nameLower).includes(q) : true))
            .map((it) => ({
              channelId: safeString(it.channelId),
              name: safeString(it.name),
              nameLower: safeString(it.nameLower),
              isPublic: !!it.isPublic,
              hasPassword: !!it.hasPassword,
              activeMemberCount: typeof it.activeMemberCount === 'number' ? it.activeMemberCount : undefined,
              isMember: true,
            }))
            .filter((c) => c.channelId && c.name);
        }
      } catch {
        // ignore; still return public channels
      }
    }

    const byId = new Map();
    for (const c of publicChannels) byId.set(c.channelId, { ...c, isMember: false });
    for (const c of memberChannels) byId.set(c.channelId, { ...byId.get(c.channelId), ...c, isMember: true });

    return json(200, { channels: Array.from(byId.values()).filter((c) => c.channelId) });
  } catch (err) {
    console.error('channelsSearch error', err);
    return json(500, { message: 'Internal error' });
  }
};

