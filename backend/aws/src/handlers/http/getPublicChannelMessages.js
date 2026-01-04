// Public, unauthenticated history endpoint for browsing public channels (guest read-only).
//
// IMPORTANT:
// - This handler ONLY allows reading channels that are isPublic=true in CHANNELS_TABLE.
// - Wire it to an API Gateway route that has NO authorizer (public).
//
// Env:
// - MESSAGES_TABLE (required): PK conversationId (String), SK createdAt (Number)
// - CHANNELS_TABLE (required): PK channelId
//
// Query:
// - conversationId: must be "ch#<channelId>"
// - limit: optional (default 50, max 200)
// - before: optional cursor (createdAt ms)
// - cursor=1: optional cursor metadata response
//
const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, QueryCommand, GetCommand } = require('@aws-sdk/lib-dynamodb');

const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({}));

const safeString = (v) => (typeof v === 'string' ? String(v).trim() : '');

const parseChannelConversationId = (conversationId) => {
  const c = safeString(conversationId);
  if (!c.startsWith('ch#')) return null;
  const channelId = c.slice('ch#'.length).trim();
  if (!channelId) return null;
  return { channelId, conversationId: `ch#${channelId}` };
};

exports.handler = async (event) => {
  try {
    const params = event.queryStringParameters || {};
    const limit = Math.min(parseInt(params.limit || '50', 10) || 50, 200);
    const conversationIdRaw = params.conversationId;
    const parsed = parseChannelConversationId(conversationIdRaw);
    if (!parsed) {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify({ message: 'conversationId must be ch#<channelId>' }),
      };
    }

    const beforeRaw = params.before;
    const before =
      typeof beforeRaw === 'string' && beforeRaw.trim().length
        ? Number(beforeRaw)
        : typeof beforeRaw === 'number'
          ? Number(beforeRaw)
          : null;
    const useCursorResponse =
      String(params.cursor || '').toLowerCase() === '1' ||
      String(params.cursor || '').toLowerCase() === 'true' ||
      String(params.v || '').toLowerCase() === '2';

    const channelsTable = safeString(process.env.CHANNELS_TABLE);
    if (!channelsTable) return { statusCode: 500, body: 'CHANNELS_TABLE not configured' };

    const ch = await ddb.send(new GetCommand({ TableName: channelsTable, Key: { channelId: parsed.channelId } }));
    const channel = ch.Item;
    if (!channel || (typeof channel.deletedAt === 'number' && channel.deletedAt > 0) || !channel.isPublic) {
      return {
        statusCode: 403,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify({ message: 'Public history not allowed for this channel' }),
      };
    }

    const conversationId = parsed.conversationId;

    const queryInput = {
      TableName: process.env.MESSAGES_TABLE,
      KeyConditionExpression: 'conversationId = :c',
      ExpressionAttributeValues: { ':c': conversationId },
      ScanIndexForward: false,
      Limit: limit,
    };

    if (typeof before === 'number' && Number.isFinite(before) && before > 0) {
      queryInput.KeyConditionExpression = 'conversationId = :c AND createdAt < :b';
      queryInput.ExpressionAttributeValues[':b'] = before;
    }

    const resp = await ddb.send(new QueryCommand(queryInput));
    const nowSec = Math.floor(Date.now() / 1000);

    const items = (resp.Items || [])
      .filter((it) => !(typeof it.expiresAt === 'number' && it.expiresAt <= nowSec))
      .map((it) => ({
        conversationId: it.conversationId,
        createdAt: Number(it.createdAt),
        messageId: String(it.messageId ?? it.createdAt),
        kind: typeof it.kind === 'string' ? String(it.kind) : undefined,
        systemKind: typeof it.systemKind === 'string' ? String(it.systemKind) : undefined,
        actorSub: typeof it.actorSub === 'string' ? String(it.actorSub) : undefined,
        actorUser: typeof it.actorUser === 'string' ? String(it.actorUser) : undefined,
        targetSub: typeof it.targetSub === 'string' ? String(it.targetSub) : undefined,
        targetUser: typeof it.targetUser === 'string' ? String(it.targetUser) : undefined,
        text: typeof it.text === 'string' ? String(it.text) : '',
        user: it.user ? String(it.user) : 'anon',
        userLower: it.userLower ? String(it.userLower) : undefined,
        userSub: it.userSub ? String(it.userSub) : undefined,
        avatarBgColor: it.avatarBgColor ? String(it.avatarBgColor) : undefined,
        avatarTextColor: it.avatarTextColor ? String(it.avatarTextColor) : undefined,
        avatarImagePath: it.avatarImagePath ? String(it.avatarImagePath) : undefined,
        editedAt: typeof it.editedAt === 'number' ? it.editedAt : undefined,
        deletedAt: typeof it.deletedAt === 'number' ? it.deletedAt : undefined,
        deletedBySub: it.deletedBySub ? String(it.deletedBySub) : undefined,
        mentions: Array.isArray(it.mentions) ? it.mentions.map(String).filter(Boolean) : undefined,
        replyToCreatedAt: typeof it.replyToCreatedAt === 'number' ? it.replyToCreatedAt : undefined,
        replyToMessageId: typeof it.replyToMessageId === 'string' ? it.replyToMessageId : undefined,
        replyToUserSub: typeof it.replyToUserSub === 'string' ? it.replyToUserSub : undefined,
        replyToPreview: typeof it.replyToPreview === 'string' ? it.replyToPreview : undefined,
        reactions: it.reactions
          ? Object.fromEntries(
              Object.entries(it.reactions).map(([emoji, setVal]) => {
                const subs =
                  setVal && typeof setVal === 'object' && setVal instanceof Set
                    ? Array.from(setVal).map(String)
                    : Array.isArray(setVal)
                      ? setVal.map(String)
                      : [];
                return [emoji, { count: subs.length, userSubs: subs }];
              })
            )
          : undefined,
        reactionUsers:
          it.reactionUsers && typeof it.reactionUsers === 'object'
            ? Object.fromEntries(Object.entries(it.reactionUsers).map(([sub, name]) => [String(sub), String(name)]))
            : undefined,
        ttlSeconds: typeof it.ttlSeconds === 'number' ? it.ttlSeconds : undefined,
        expiresAt: typeof it.expiresAt === 'number' ? it.expiresAt : undefined,
      }))
      .filter((it) => !it.deletedAt);

    const hasMore = !!resp.LastEvaluatedKey;
    const nextCursor =
      resp.LastEvaluatedKey && typeof resp.LastEvaluatedKey.createdAt === 'number'
        ? Number(resp.LastEvaluatedKey.createdAt)
        : items.length
          ? Number(items[items.length - 1].createdAt)
          : null;

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify(
        useCursorResponse
          ? { items, hasMore, nextCursor: typeof nextCursor === 'number' && Number.isFinite(nextCursor) ? nextCursor : null }
          : items
      ),
    };
  } catch (err) {
    console.error('getPublicChannelMessages error', err);
    return { statusCode: 500, body: 'Internal error' };
  }
};

