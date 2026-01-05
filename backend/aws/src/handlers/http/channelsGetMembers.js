// HTTP API (payload v2) Lambda: GET /channels/members?channelId=...
// Returns channel metadata + member list for UI (admins/statuses) + online counts.
//
// Notes:
// - Global is a system channel and is NOT supported here.
// - Caller must be an active member.
//
// Env:
// - CHANNELS_TABLE (required)
// - CHANNEL_MEMBERS_TABLE (required)
// - USERS_TABLE (required): used to hydrate displayName/avatar for members
// - CONNECTIONS_TABLE (optional): used to estimate online count (best-effort)
//
// Auth: JWT (Cognito)
const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const {
  DynamoDBDocumentClient,
  GetCommand,
  QueryCommand,
  BatchGetCommand,
} = require('@aws-sdk/lib-dynamodb');

const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({}));

const safeString = (v) => (typeof v === 'string' ? String(v).trim() : '');
const json = (statusCode, bodyObj) => ({
  statusCode,
  headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
  body: JSON.stringify(bodyObj),
});

async function queryOnlineUserSubsByConversation(conversationId) {
  const table = safeString(process.env.CONNECTIONS_TABLE);
  if (!table) return { onlineUserSubs: null, onlineConnections: 0 };

  // Prefer the newer index that projects userSub (so we can dedupe).
  try {
    const resp = await ddb.send(
      new QueryCommand({
        TableName: table,
        IndexName: 'byConversationWithUser',
        KeyConditionExpression: 'conversationId = :c',
        ExpressionAttributeValues: { ':c': conversationId },
        ProjectionExpression: 'userSub, connectionId',
      })
    );
    const recs = resp.Items || [];
    const userSubs = new Set(recs.map((r) => safeString(r.userSub)).filter(Boolean));
    return { onlineUserSubs: userSubs, onlineConnections: recs.length };
  } catch {
    // Fallback: count connections joined to this conversationId
    try {
      const resp = await ddb.send(
        new QueryCommand({
          TableName: table,
          IndexName: 'byConversation',
          KeyConditionExpression: 'conversationId = :c',
          ExpressionAttributeValues: { ':c': conversationId },
          ProjectionExpression: 'connectionId',
        })
      );
      const items = resp.Items || [];
      return { onlineUserSubs: null, onlineConnections: items.length };
    } catch {
      return { onlineUserSubs: null, onlineConnections: 0 };
    }
  }
}

exports.handler = async (event) => {
  const method = event.requestContext?.http?.method;
  if (method !== 'GET') return json(405, { message: 'Method not allowed' });

  const callerSub = safeString(event.requestContext?.authorizer?.jwt?.claims?.sub);
  if (!callerSub) return json(401, { message: 'Unauthorized' });

  const channelsTable = safeString(process.env.CHANNELS_TABLE);
  const membersTable = safeString(process.env.CHANNEL_MEMBERS_TABLE);
  const usersTable = safeString(process.env.USERS_TABLE);
  if (!channelsTable) return json(500, { message: 'CHANNELS_TABLE not configured' });
  if (!membersTable) return json(500, { message: 'CHANNEL_MEMBERS_TABLE not configured' });
  if (!usersTable) return json(500, { message: 'USERS_TABLE not configured' });

  const qs = event.queryStringParameters || {};
  const channelId = safeString(qs.channelId);
  if (!channelId) return json(400, { message: 'channelId is required' });
  const includeBanned = String(qs.includeBanned || '').toLowerCase() === '1' || String(qs.includeBanned || '').toLowerCase() === 'true';

  try {
    const [chResp, myResp] = await Promise.all([
      ddb.send(new GetCommand({ TableName: channelsTable, Key: { channelId } })),
      ddb.send(new GetCommand({ TableName: membersTable, Key: { channelId, memberSub: callerSub } })),
    ]);
    const channel = chResp.Item;
    if (!channel || (typeof channel.deletedAt === 'number' && channel.deletedAt > 0)) return json(404, { message: 'Channel not found' });

    const myMember = myResp.Item;
    if (!myMember) return json(403, { message: 'Forbidden' });
    const myStatus = safeString(myMember.status);
    if (myStatus !== 'active') return json(403, { message: 'Forbidden' });
    const isAdmin = !!myMember.isAdmin;

    const memResp = await ddb.send(
      new QueryCommand({
        TableName: membersTable,
        KeyConditionExpression: 'channelId = :c',
        ExpressionAttributeValues: { ':c': channelId },
        Limit: 200,
      })
    );

    const rows = (memResp.Items || [])
      .map((it) => ({
        memberSub: safeString(it.memberSub),
        status: safeString(it.status) || 'active',
        isAdmin: !!it.isAdmin,
        joinedAt: typeof it.joinedAt === 'number' ? it.joinedAt : undefined,
        leftAt: typeof it.leftAt === 'number' ? it.leftAt : undefined,
        bannedAt: typeof it.bannedAt === 'number' ? it.bannedAt : undefined,
      }))
      .filter((m) => m.memberSub);

    const visibleRows = rows.filter((m) => {
      if (m.status === 'banned') return isAdmin && includeBanned;
      return m.status === 'active' || (isAdmin && m.status === 'left');
    });

    const subs = Array.from(new Set(visibleRows.map((m) => m.memberSub)));
    let profilesBySub = new Map();
    try {
      const resp = await ddb.send(
        new BatchGetCommand({
          RequestItems: {
            [usersTable]: {
              Keys: subs.map((s) => ({ userSub: s })),
              ProjectionExpression: 'userSub, displayName, usernameLower, avatarBgColor, avatarTextColor, avatarImagePath',
            },
          },
        })
      );
      const items = resp.Responses?.[usersTable] || [];
      profilesBySub = new Map(
        items.map((it) => [
          safeString(it.userSub),
          {
            displayName: safeString(it.displayName || it.usernameLower || it.userSub) || 'anon',
            usernameLower: it.usernameLower ? safeString(it.usernameLower) : undefined,
            avatarBgColor: it.avatarBgColor ? safeString(it.avatarBgColor) : undefined,
            avatarTextColor: it.avatarTextColor ? safeString(it.avatarTextColor) : undefined,
            avatarImagePath: it.avatarImagePath ? safeString(it.avatarImagePath) : undefined,
          },
        ])
      );
    } catch {
      // ignore
    }

    const conversationId = `ch#${channelId}`;
    const { onlineUserSubs, onlineConnections } = await queryOnlineUserSubsByConversation(conversationId);
    const activeSubs = new Set(rows.filter((m) => m.status === 'active').map((m) => m.memberSub));
    const onlineMemberCount =
      onlineUserSubs instanceof Set
        ? Array.from(onlineUserSubs).filter((s) => activeSubs.has(s)).length
        : null;

    const members = visibleRows.map((m) => {
      const prof = profilesBySub.get(m.memberSub) || {};
      return {
        memberSub: m.memberSub,
        status: m.status,
        isAdmin: !!m.isAdmin,
        joinedAt: m.joinedAt,
        leftAt: m.leftAt,
        bannedAt: m.bannedAt,
        displayName: prof.displayName,
        usernameLower: prof.usernameLower,
        avatarBgColor: prof.avatarBgColor,
        avatarTextColor: prof.avatarTextColor,
        avatarImagePath: prof.avatarImagePath,
        isOnline:
          onlineUserSubs instanceof Set
            ? onlineUserSubs.has(m.memberSub)
            : undefined,
      };
    });

    return json(200, {
      channel: {
        channelId,
        conversationId,
        name: safeString(channel.name),
        nameLower: safeString(channel.nameLower),
        isPublic: !!channel.isPublic,
        hasPassword: !!channel.hasPassword,
        aboutText: typeof channel.aboutText === 'string' ? String(channel.aboutText) : '',
        aboutVersion: typeof channel.aboutVersion === 'number' && Number.isFinite(channel.aboutVersion) ? channel.aboutVersion : 0,
        activeMemberCount: typeof channel.activeMemberCount === 'number' ? channel.activeMemberCount : undefined,
        createdAt: typeof channel.createdAt === 'number' ? channel.createdAt : undefined,
        createdBySub: channel.createdBySub ? safeString(channel.createdBySub) : undefined,
      },
      me: { status: myStatus, isAdmin },
      online: {
        connections: onlineConnections,
        members: typeof onlineMemberCount === 'number' ? onlineMemberCount : undefined,
      },
      members,
    });
  } catch (err) {
    console.error('channelsGetMembers error', err);
    return json(500, { message: 'Internal error' });
  }
};

