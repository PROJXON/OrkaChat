// Cognito Trigger: Post confirmation
// Purpose: create/update a Users table row for the newly confirmed user.
//
// Env:
// - USERS_TABLE (required)
// - STATS_TABLE (optional): PK statKey. If present, increments { statKey:"app", userCount } on first insert.
//
// Users table expected schema:
// - PK: userSub (String)
// - GSI: byUsernameLower (PK usernameLower String)
//
// Stored attributes (minimum):
// - userSub
// - displayName
// - usernameLower
// - emailLower (optional)
// - createdAt, updatedAt (Number)

const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, PutCommand, UpdateCommand } = require('@aws-sdk/lib-dynamodb');

const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({}));

exports.handler = async (event) => {
  const table = process.env.USERS_TABLE;
  if (!table) return event;
  const statsTable = process.env.STATS_TABLE;

  const attrs = event.request?.userAttributes || {};
  const userSub = String(attrs.sub || '');
  const preferred = String(attrs.preferred_username || '');
  const email = String(attrs.email || '');

  if (!userSub) return event;

  const displayName = (preferred || email || userSub).trim();
  const usernameLower = displayName.toLowerCase();
  const emailLower = email ? email.trim().toLowerCase() : undefined;

  const nowMs = Date.now();
  let inserted = false;
  try {
    await ddb.send(
      new PutCommand({
        TableName: table,
        Item: {
          userSub,
          displayName,
          usernameLower,
          ...(emailLower ? { emailLower } : {}),
          createdAt: nowMs,
          updatedAt: nowMs,
        },
        // Prevent double-counting if the trigger replays.
        ConditionExpression: 'attribute_not_exists(userSub)',
      })
    );
    inserted = true;
  } catch (e) {
    // If already exists, don't increment stats.
    if (!String(e?.name || '').includes('ConditionalCheckFailed')) throw e;
  }

  // Best-effort: increment global user count.
  if (inserted && statsTable) {
    try {
      await ddb.send(
        new UpdateCommand({
          TableName: statsTable,
          Key: { statKey: 'app' },
          UpdateExpression: 'SET userCount = if_not_exists(userCount, :z) + :inc, createdAt = if_not_exists(createdAt, :u), updatedAt = :u',
          ExpressionAttributeValues: { ':z': 0, ':inc': 1, ':u': nowMs },
        })
      );
    } catch {
      // ignore
    }
  }

  return event;
};


