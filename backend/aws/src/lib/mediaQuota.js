// DynamoDB-backed per-user media quota counters (bytes/day).
//
// This is meant as a safety rail against runaway media spend, not as a perfect billing system.
//
// Table key schema expected:
// - partition key: sub (S)
// - sort key: conversationId (S)
//
// We store counters under synthetic conversationId values prefixed with "__quota__#...".
// Uses DynamoDB conditional writes so the check+increment is atomic.

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

function secondsUntilNextUtcDay(ms) {
  const d = new Date(ms);
  const next = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + 1, 0, 0, 0, 0);
  return Math.max(1, Math.ceil((next - ms) / 1000));
}

async function addBytesOrThrow({ ddb, tableName, sub, key, addBytes, maxBytesPerDay }) {
  const max = safeInt(maxBytesPerDay, 0);
  const add = safeInt(addBytes, 0);
  if (!ddb || !tableName || !sub) return;
  if (max <= 0) return; // disabled
  if (add <= 0) return;
  if (add > max) {
    const e = new Error('Media quota exceeded');
    e.name = 'MediaQuotaExceeded';
    e.retryAfterSeconds = secondsUntilNextUtcDay(Date.now());
    throw e;
  }

  const now = Date.now();
  const expiresAt = Math.floor(now / 1000) + 3 * 24 * 60 * 60; // 3d
  const maxMinusAdd = Math.max(0, max - add);

  try {
    await ddb.send(
      new UpdateItemCommand({
        TableName: tableName,
        Key: {
          sub: { S: String(sub) },
          conversationId: { S: String(key) },
        },
        ExpressionAttributeNames: {
          '#b': 'bytes',
        },
        ExpressionAttributeValues: {
          ':inc': { N: String(add) },
          ':maxMinus': { N: String(maxMinusAdd) },
          ':u': { S: new Date(now).toISOString() },
          ':e': { N: String(expiresAt) },
        },
        // Allow increment only if current bytes is <= (max - addBytes).
        ConditionExpression: 'attribute_not_exists(#b) OR #b <= :maxMinus',
        UpdateExpression: 'ADD #b :inc SET updatedAt = :u, expiresAt = :e',
      })
    );
  } catch (err) {
    if (err && (err.name === 'ConditionalCheckFailedException' || err.Code === 'ConditionalCheckFailedException')) {
      const e = new Error('Media quota exceeded');
      e.name = 'MediaQuotaExceeded';
      e.retryAfterSeconds = secondsUntilNextUtcDay(now);
      throw e;
    }
    throw err;
  }
}

/**
 * Enforce a per-user bytes/day quota for media referenced in messages.
 *
 * @param {object} args
 * @param {import('@aws-sdk/client-dynamodb').DynamoDBClient} args.ddb
 * @param {string} args.tableName
 * @param {string} args.sub
 * @param {string} args.route - short label used in the key (e.g. "dm" or "channel")
 * @param {number} args.addBytes - bytes to add for this request
 * @param {number} args.maxBytesPerDay
 */
async function enforceMediaBytesPerDay({ ddb, tableName, sub, route, addBytes, maxBytesPerDay }) {
  if (!ddb || !tableName || !sub) return;
  const now = Date.now();
  const dayKey = `__quota__#media#${String(route || 'all')}#bytes#day#${utcDayKey(now)}`;
  await addBytesOrThrow({ ddb, tableName, sub, key: dayKey, addBytes, maxBytesPerDay });
}

module.exports = { enforceMediaBytesPerDay };

