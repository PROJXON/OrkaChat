// Simple DynamoDB-backed per-user quota counters for AI routes.
//
// This is intended as a safety rail against abuse / runaway spend, not as a perfect billing system.
//
// Requires DynamoDB permissions on the quota table:
// - dynamodb:UpdateItem
//
// Table key schema expected:
// - partition key: sub (S)
// - sort key: conversationId (S)
//
// We reuse the existing AI helper/summary cache tables by writing special conversationId values
// prefixed with "__quota__#...".
//
// NOTE: We write an `expiresAt` attribute for TTL cleanup if TTL is enabled on the table.
// If TTL is NOT enabled, items will still work but may accumulate slowly.

const { UpdateItemCommand } = require('@aws-sdk/client-dynamodb');

function safeInt(v, fallback) {
  const n = Number(v);
  if (!Number.isFinite(n)) return fallback;
  return Math.floor(n);
}

function utcDayKey(ms) {
  const d = new Date(ms);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}${m}${day}`; // YYYYMMDD
}

function epochMinute(ms) {
  return Math.floor(ms / 60000); // integer minute since epoch
}

function secondsUntilNextUtcDay(ms) {
  const d = new Date(ms);
  const next = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + 1, 0, 0, 0, 0);
  return Math.max(1, Math.ceil((next - ms) / 1000));
}

function secondsUntilNextMinute(ms) {
  const next = (Math.floor(ms / 60000) + 1) * 60000;
  return Math.max(1, Math.ceil((next - ms) / 1000));
}

async function incrementCounterOrThrow({ ddb, tableName, sub, key, max, ttlSeconds, retryAfterSeconds }) {
  // Disable if max is unset/invalid or <= 0.
  const m = safeInt(max, 0);
  if (m <= 0) return;

  const now = Date.now();
  const expiresAt = Math.floor(now / 1000) + Math.max(60, safeInt(ttlSeconds, 0));

  try {
    await ddb.send(
      new UpdateItemCommand({
        TableName: tableName,
        Key: {
          sub: { S: String(sub) },
          conversationId: { S: String(key) },
        },
        ExpressionAttributeNames: {
          '#c': 'count',
        },
        ExpressionAttributeValues: {
          ':inc': { N: '1' },
          ':max': { N: String(m) },
          ':u': { S: new Date(now).toISOString() },
          ':e': { N: String(expiresAt) },
        },
        // Allow increment only if current count is below max.
        ConditionExpression: 'attribute_not_exists(#c) OR #c < :max',
        UpdateExpression: 'ADD #c :inc SET updatedAt = :u, expiresAt = :e',
      })
    );
  } catch (err) {
    if (err && (err.name === 'ConditionalCheckFailedException' || err.Code === 'ConditionalCheckFailedException')) {
      const e = new Error('Rate limit exceeded');
      e.name = 'RateLimitExceeded';
      e.retryAfterSeconds = safeInt(retryAfterSeconds, 30);
      throw e;
    }
    throw err;
  }
}

/**
 * Enforce a per-user quota using DynamoDB conditional counters.
 *
 * @param {object} args
 * @param {import('@aws-sdk/client-dynamodb').DynamoDBClient} args.ddb
 * @param {string} args.tableName
 * @param {string} args.sub
 * @param {string} args.route - short route label, used for the counter key (e.g. "helper" or "summary")
 * @param {number} args.maxPerMinute
 * @param {number} args.maxPerDay
 */
async function enforceAiQuota({ ddb, tableName, sub, route, maxPerMinute, maxPerDay }) {
  if (!ddb || !tableName || !sub) return;

  const now = Date.now();
  const minuteKey = `__quota__#${route}#min#${epochMinute(now)}`;
  const dayKey = `__quota__#${route}#day#${utcDayKey(now)}`;

  // Minute counter (keep a small buffer window so late retries still hit the same item)
  await incrementCounterOrThrow({
    ddb,
    tableName,
    sub,
    key: minuteKey,
    max: maxPerMinute,
    ttlSeconds: 2 * 60 * 60, // 2h
    retryAfterSeconds: secondsUntilNextMinute(now),
  });

  // Day counter
  await incrementCounterOrThrow({
    ddb,
    tableName,
    sub,
    key: dayKey,
    max: maxPerDay,
    ttlSeconds: 3 * 24 * 60 * 60, // 3d
    retryAfterSeconds: secondsUntilNextUtcDay(now),
  });
}

module.exports = { enforceAiQuota };

