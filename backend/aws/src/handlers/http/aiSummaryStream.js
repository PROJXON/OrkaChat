// HTTP API (payload v2) Lambda: POST /ai/summary (STREAMING VARIANT)
//
// IMPORTANT DEPLOYMENT NOTE:
// - True streaming (SSE / chunked) requires an integration that supports response streaming:
//   - API Gateway REST API with response streaming enabled, OR
//   - Lambda Function URL InvokeMode=RESPONSE_STREAM, OR
//   - ALB + Lambda response streaming (where supported)
// - API Gateway HTTP APIs historically buffer responses and will NOT stream to clients.
//
// This handler is intentionally separate from `aiSummary.js` so you can wire it to a streaming-capable endpoint.
//
// Env:
// - OPENAI_API_KEY
// - OPENAI_MODEL (optional, default: gpt-4o-mini)
// - AI_SUMMARY_TABLE (optional but recommended for caching/throttling)
// - SUMMARY_THROTTLE_SECONDS (optional, default: 30)
// - AI_SUMMARY_MAX_PER_MINUTE (optional, default: 3)
// - AI_SUMMARY_MAX_PER_DAY (optional, default: 40)
// - AI_SUMMARY_TTL_DAYS (optional, default: 7)
//
// SSE protocol:
// - data: {"delta":"..."}\n\n  (append-only chunks)
// - data: {"done":true}\n\n   (end)
//
// NOTE: This is a demo-quality summarizer. It receives plaintext message history from the client.
//
// In Lambda response-streaming mode, `awslambda` is available as a global.
// eslint-disable-next-line no-undef
exports.handler = awslambda.streamifyResponse(async (event, responseStream) => {
  // eslint-disable-next-line no-undef
  const stream = awslambda.HttpResponseStream.from(responseStream, {
    statusCode: 200,
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      // CORS (adjust to your needs)
      'Access-Control-Allow-Origin': '*',
    },
  });

  const writeSse = (obj) => {
    try {
      stream.write(`data: ${JSON.stringify(obj)}\n\n`);
    } catch {
      // ignore write failures
    }
  };

  const endSse = () => {
    try {
      writeSse({ done: true });
      stream.end();
    } catch {
      // ignore
    }
  };

  try {
    // Support both HTTP API v2 and REST API shapes.
    const method = event.requestContext?.http?.method || event.httpMethod;
    if (method !== 'POST') {
      // In SSE, surface errors as a final delta and end.
      writeSse({ delta: 'Method not allowed' });
      return endSse();
    }

    if (!process.env.OPENAI_API_KEY) {
      writeSse({ delta: 'Server misconfigured: OPENAI_API_KEY not configured' });
      return endSse();
    }

    // Support both:
    // - HTTP API JWT authorizer: requestContext.authorizer.jwt.claims.sub
    // - REST API Cognito authorizer: requestContext.authorizer.claims.sub
    // - Lambda authorizer / custom: requestContext.authorizer.sub / principalId
    const sub =
      event.requestContext?.authorizer?.jwt?.claims?.sub ||
      event.requestContext?.authorizer?.claims?.sub ||
      event.requestContext?.authorizer?.sub ||
      event.requestContext?.authorizer?.principalId;
    if (!sub) {
      writeSse({ delta: 'Unauthorized' });
      return endSse();
    }

    let body = {};
    try {
      body = JSON.parse(event.body || '{}');
    } catch {
      writeSse({ delta: 'Invalid JSON body' });
      return endSse();
    }

    const convoId = String(body.conversationId || '');
    const peer = body.peer ? String(body.peer) : null;
    const messages = Array.isArray(body.messages) ? body.messages : [];

    // Optional caching/throttling (same logic as aiSummary.js), but for streaming we only use it
    // to fast-return the cached summary as a single "delta".
    const { DynamoDBClient, GetItemCommand, PutItemCommand } = require('@aws-sdk/client-dynamodb');
    const crypto = require('crypto');
    const { enforceAiQuota } = require('./lib/aiquota');
    const ddb = new DynamoDBClient({});

    const tableName = process.env.AI_SUMMARY_TABLE;
    const throttleSeconds = Number(process.env.SUMMARY_THROTTLE_SECONDS || 30);
    const ttlDays = Number(process.env.AI_SUMMARY_TTL_DAYS || 7);

    const transcript = messages
      .slice(-80)
      .map((m) => {
        const u = String(m.user || 'anon');
        const t = String(m.text || '').trim();
        return t ? `${u}: ${t}` : null;
      })
      .filter(Boolean)
      .join('\n');

    const transcriptHash = crypto.createHash('sha256').update(transcript).digest('hex');

    if (tableName && convoId) {
      try {
        const now = Date.now();
        const cached = await ddb.send(
          new GetItemCommand({
            TableName: tableName,
            Key: { sub: { S: sub }, conversationId: { S: convoId } },
          }),
        );
        if (cached.Item) {
          const cachedHash = cached.Item.transcriptHash?.S || '';
          const cachedSummary = cached.Item.summary?.S || '';
          const lastRequestedAt = Number(cached.Item.lastRequestedAt?.N || '0');

          if (cachedSummary && cachedHash === transcriptHash) {
            writeSse({ delta: cachedSummary });
            return endSse();
          }
          if (cachedSummary && throttleSeconds > 0 && now - lastRequestedAt < throttleSeconds * 1000) {
            writeSse({ delta: cachedSummary });
            return endSse();
          }
        }
      } catch (err) {
        console.error('AI cache get failed (continuing without cache)', err);
      }
    }

    if (tableName) {
      try {
        await enforceAiQuota({
          ddb,
          tableName,
          sub,
          route: 'summary',
          maxPerMinute: Number(process.env.AI_SUMMARY_MAX_PER_MINUTE || 3),
          maxPerDay: Number(process.env.AI_SUMMARY_MAX_PER_DAY || 40),
        });
      } catch (err) {
        if (err?.name === 'RateLimitExceeded') {
          writeSse({ delta: 'AI limit reached (summary). Please try again later.' });
          return endSse();
        }
        console.error('AI summary quota check failed (continuing without quota)', err);
      }
    }

    const system =
      'You are a helpful assistant that summarizes chat conversations. Be concise and concrete.';
    const userPrompt =
      `Summarize the following chat conversation.\n` +
      `ConversationId: ${convoId}\n` +
      (peer ? `Peer: ${peer}\n` : '') +
      `\nMessages:\n${transcript}\n\n` +
      `Return EXACTLY this format:\n` +
      `- First: 3-6 sentences of summary text (no heading like "Summary:" and no title line)\n` +
      `- Then a blank line\n` +
      `- Then the line: Key Takeaways\n` +
      `- Then 3-7 bullet points, each starting with "- "\n` +
      `Do NOT include any extra headings.\n`;

    const model = process.env.OPENAI_MODEL || 'gpt-4o-mini';

    // Ask OpenAI to stream tokens.
    const resp = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        temperature: 0.3,
        stream: true,
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: userPrompt },
        ],
      }),
    });

    if (!resp.ok || !resp.body) {
      const t = await resp.text().catch(() => '');
      console.error('OpenAI error', resp.status, t);
      writeSse({ delta: 'AI provider error' });
      return endSse();
    }

    // OpenAI streams SSE lines: "data: {...}\n\n" ending with "data: [DONE]\n\n"
    const reader = resp.body.getReader();
    const decoder = new TextDecoder();
    let buf = '';
    let full = '';

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buf += decoder.decode(value, { stream: true });

      while (true) {
        const idx = buf.indexOf('\n\n');
        if (idx < 0) break;
        const rawEvent = buf.slice(0, idx);
        buf = buf.slice(idx + 2);

        const lines = rawEvent
          .split('\n')
          .map((l) => l.trimEnd())
          .filter(Boolean);

        for (const line of lines) {
          if (!line.startsWith('data:')) continue;
          const dataStr = line.slice('data:'.length).trim();
          if (!dataStr) continue;
          if (dataStr === '[DONE]') {
            // Best-effort cache put at end.
            if (tableName && convoId) {
              try {
                const ttlSeconds = Number.isFinite(ttlDays)
                  ? Math.max(0, Math.floor(ttlDays * 24 * 60 * 60))
                  : 0;
                const expiresAt = ttlSeconds > 0 ? Math.floor(Date.now() / 1000) + ttlSeconds : undefined;
                await ddb.send(
                  new PutItemCommand({
                    TableName: tableName,
                    Item: {
                      sub: { S: sub },
                      conversationId: { S: convoId },
                      transcriptHash: { S: transcriptHash },
                      summary: { S: full },
                      updatedAt: { S: new Date().toISOString() },
                      lastRequestedAt: { N: String(Date.now()) },
                      ...(expiresAt ? { expiresAt: { N: String(expiresAt) } } : {}),
                    },
                  }),
                );
              } catch (err) {
                console.error('AI cache put failed (continuing)', err);
              }
            }
            return endSse();
          }

          try {
            const j = JSON.parse(dataStr);
            const delta = j?.choices?.[0]?.delta?.content;
            if (typeof delta === 'string' && delta) {
              full += delta;
              writeSse({ delta });
            }
          } catch {
            // ignore parse failures
          }
        }
      }
    }

    // If we fall out without [DONE], still end.
    return endSse();
  } catch (err) {
    console.error('aiSummaryStream error', err);
    writeSse({ delta: 'Internal error' });
    return endSse();
  }
});

