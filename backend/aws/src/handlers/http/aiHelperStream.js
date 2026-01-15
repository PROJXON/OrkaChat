// HTTP API (payload v2) Lambda: POST /ai/helper (STREAMING VARIANT)
//
// IMPORTANT DEPLOYMENT NOTE:
// - True streaming (SSE / chunked) requires an integration that supports response streaming:
//   - API Gateway REST API with response streaming enabled, OR
//   - Lambda Function URL InvokeMode=RESPONSE_STREAM
// - API Gateway HTTP APIs historically buffer responses and will NOT stream to clients.
//
// This handler is intentionally separate from `aiHelper.js` so you can wire it to a streaming-capable endpoint.
//
// Env:
// - OPENAI_API_KEY
// - OPENAI_MODEL (optional, default: gpt-4o-mini)
// - AI_HELPER_TABLE (optional but recommended for caching/throttling)
// - HELPER_THROTTLE_SECONDS (optional, default: 15)
// - AI_HELPER_MAX_PER_MINUTE (optional, default: 10)
// - AI_HELPER_MAX_PER_DAY (optional, default: 250)
// - AI_HELPER_TTL_DAYS (optional, default: 7)
//
// SSE protocol:
// - data: {"delta":"..."}\n\n               (append-only chunks for the assistant answer)
// - data: {"final":{...}}\n\n               (final JSON payload with answer/suggestions/thread)
// - data: {"done":true}\n\n                (end)
//
// NOTE: This is a demo-quality assistant. It receives plaintext message history from the client.
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
      'Access-Control-Allow-Origin': '*',
    },
  });

  const writeSse = (obj) => {
    try {
      stream.write(`data: ${JSON.stringify(obj)}\n\n`);
    } catch {
      // ignore
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

  const safeString = (v) => String(v ?? '').trim();
  const clampText = (s, maxLen) => {
    const t = safeString(s);
    if (!t) return '';
    return t.length > maxLen ? `${t.slice(0, maxLen)}…` : t;
  };

  // Incrementally extract the value of the JSON string field `"answer"` from the model's streamed JSON.
  // We decode common JSON escapes so the UI shows real text while streaming.
  const makeAnswerStreamExtractor = () => {
    // Simple pattern matcher for `"answer"` across chunk boundaries.
    const target = '"answer"';
    let matchIdx = 0;
    let stage = 'seekKey'; // seekKey -> seekColon -> seekValueQuote -> captureValue -> done
    let esc = false;
    let unicodeHex = '';
    let inUnicode = false;

    const decodeEscaped = (c) => {
      switch (c) {
        case '"':
          return '"';
        case '\\':
          return '\\';
        case '/':
          return '/';
        case 'b':
          return '\b';
        case 'f':
          return '\f';
        case 'n':
          return '\n';
        case 'r':
          return '\r';
        case 't':
          return '\t';
        default:
          return c; // best-effort
      }
    };

    return {
      push: (chunk) => {
        if (!chunk) return '';
        let out = '';
        for (let i = 0; i < chunk.length; i++) {
          const ch = chunk[i];

          if (stage === 'done') break;

          if (stage === 'seekKey') {
            // Match `"answer"` literally.
            if (ch === target[matchIdx]) {
              matchIdx += 1;
              if (matchIdx >= target.length) {
                stage = 'seekColon';
                matchIdx = 0;
              }
            } else {
              // Allow overlap if the current char could be the start of the target.
              matchIdx = ch === target[0] ? 1 : 0;
            }
            continue;
          }

          if (stage === 'seekColon') {
            if (ch === ':') stage = 'seekValueQuote';
            continue;
          }

          if (stage === 'seekValueQuote') {
            if (ch === '"') stage = 'captureValue';
            continue;
          }

          if (stage === 'captureValue') {
            if (inUnicode) {
              unicodeHex += ch;
              if (unicodeHex.length >= 4) {
                const code = parseInt(unicodeHex, 16);
                if (Number.isFinite(code)) out += String.fromCharCode(code);
                inUnicode = false;
                unicodeHex = '';
              }
              continue;
            }

            if (esc) {
              esc = false;
              if (ch === 'u') {
                inUnicode = true;
                unicodeHex = '';
                continue;
              }
              out += decodeEscaped(ch);
              continue;
            }

            if (ch === '\\') {
              esc = true;
              continue;
            }
            if (ch === '"') {
              stage = 'done';
              continue;
            }
            out += ch;
          }
        }
        return out;
      },
    };
  };

  const sanitizeThread = (raw) => {
    if (!Array.isArray(raw)) return [];
    const out = [];
    for (const item of raw) {
      if (!item || typeof item !== 'object') continue;
      const role = item.role === 'assistant' ? 'assistant' : item.role === 'user' ? 'user' : null;
      if (!role) continue;
      const text = clampText(item.text ?? item.content ?? '', 1200);
      if (!text) continue;
      out.push({ role, text });
      if (out.length >= 24) break;
    }
    return out;
  };

  const normalizeSuggestions = (raw) => {
    if (!Array.isArray(raw)) return [];
    const out = [];
    for (const x of raw) {
      if (!x) continue;
      if (typeof x === 'string') out.push(x.trim());
      else if (typeof x === 'object' && x.text) out.push(String(x.text).trim());
      if (out.length >= 3) break;
    }
    return out.filter(Boolean);
  };

  const ensureExactlyThreeSuggestions = (suggestions, instruction) => {
    const base = Array.isArray(suggestions)
      ? suggestions.map((s) => safeString(s)).filter(Boolean).slice(0, 3)
      : [];
    if (base.length === 3) return base;
    const isQuestion =
      /\?\s*$/.test(String(instruction || '')) ||
      /\b(what|why|how|when|where|who|which)\b/i.test(String(instruction || ''));
    const candidatePool = isQuestion
      ? [
          'Can you clarify what you mean?',
          'What outcome do you want from this conversation?',
          'Do you want a short reply or a more detailed one?',
        ]
      : ['Sounds good.', 'Got it - thanks!', 'Can you tell me a bit more?'];
    const out = base.slice();
    for (const c of candidatePool) {
      const s = safeString(c);
      if (!s) continue;
      if (out.some((x) => x.toLowerCase() === s.toLowerCase())) continue;
      out.push(s);
      if (out.length >= 3) break;
    }
    while (out.length < 3) out.push('Okay.');
    return out.slice(0, 3);
  };

  try {
    // Support both HTTP API v2 and REST API shapes.
    const method = event.requestContext?.http?.method || event.httpMethod;
    if (method !== 'POST') {
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

    const convoId = safeString(body.conversationId || '') || 'global';
    const peer = body.peer ? safeString(body.peer) : null;
    const instruction = safeString(body.instruction || '');
    const messages = Array.isArray(body.messages) ? body.messages : [];
    const resetThread = Boolean(body.resetThread);
    const clientThread = sanitizeThread(body.thread);
    const wantReplies = Boolean(body.wantReplies);

    if (!instruction) {
      writeSse({ delta: 'instruction is required' });
      return endSse();
    }

    const { DynamoDBClient, GetItemCommand, PutItemCommand } = require('@aws-sdk/client-dynamodb');
    const crypto = require('crypto');
    const { enforceAiQuota } = require('./lib/aiquota');
    const ddb = new DynamoDBClient({});

    const tableName = process.env.AI_HELPER_TABLE;
    const throttleSeconds = Number(process.env.HELPER_THROTTLE_SECONDS || 15);
    const ttlDays = Number(process.env.AI_HELPER_TTL_DAYS || 7);

    const transcript = messages
      .slice(-80)
      .map((m) => {
        const u = safeString(m.user || 'anon') || 'anon';
        const t = safeString(m.text || '');
        return t ? `${u}: ${t.slice(0, 500)}` : null;
      })
      .filter(Boolean)
      .join('\n');

    const requestHash = crypto
      .createHash('sha256')
      .update(`${convoId}\n${peer || ''}\n${wantReplies ? 'wantReplies:1' : 'wantReplies:0'}\n${instruction}\n${transcript}`)
      .digest('hex');
    const cacheKey = `${convoId}#helper#${requestHash.slice(0, 24)}`;
    const threadKey = `${convoId}#helperThread${peer ? `#${peer}` : ''}`;

    if (tableName) {
      try {
        const now = Date.now();
        const cached = await ddb.send(
          new GetItemCommand({
            TableName: tableName,
            Key: { sub: { S: sub }, conversationId: { S: cacheKey } },
          }),
        );
        if (cached.Item) {
          const cachedJson = cached.Item.resultJson?.S || '';
          const lastRequestedAt = Number(cached.Item.lastRequestedAt?.N || '0');
          if (cachedJson && throttleSeconds > 0 && now - lastRequestedAt < throttleSeconds * 1000) {
            // Emit cached result as a single final payload.
            try {
              writeSse({ final: JSON.parse(cachedJson) });
            } catch {
              writeSse({ delta: cachedJson });
            }
            return endSse();
          }
        }
      } catch (err) {
        console.error('AI helper cache get failed (continuing without cache)', err);
      }
    }

    let thread = clientThread;
    if (resetThread) thread = [];
    if (!thread.length && tableName && !resetThread) {
      try {
        const stored = await ddb.send(
          new GetItemCommand({
            TableName: tableName,
            Key: { sub: { S: sub }, conversationId: { S: threadKey } },
          }),
        );
        const storedJson = stored.Item?.threadJson?.S || '';
        if (storedJson) thread = sanitizeThread(JSON.parse(storedJson));
      } catch (err) {
        console.error('AI helper thread load failed (continuing without thread)', err);
      }
    }

    if (tableName) {
      try {
        await enforceAiQuota({
          ddb,
          tableName,
          sub,
          route: 'helper',
          maxPerMinute: Number(process.env.AI_HELPER_MAX_PER_MINUTE || 10),
          maxPerDay: Number(process.env.AI_HELPER_MAX_PER_DAY || 250),
        });
      } catch (err) {
        if (err?.name === 'RateLimitExceeded') {
          writeSse({ delta: 'AI limit reached (helper). Please try again later.' });
          return endSse();
        }
        console.error('AI helper quota check failed (continuing without quota)', err);
      }
    }

    const system =
      'You are a helpful AI assistant for a chat app. Use the conversation context when relevant. ' +
      'If the user question is not related to the conversation, answer it normally. ' +
      'Be safe, helpful, and concise.';

    const chatContext =
      `ConversationId: ${convoId}\n` +
      (peer ? `Peer: ${peer}\n` : '') +
      `\nRecent chat messages (oldest → newest):\n${transcript || '(no messages provided)'}\n`;

    const formatInstruction =
      `User request:\n${instruction}\n\n` +
      `Return STRICT JSON with this shape:\n` +
      `{\n` +
      `  "answer": "short explanation or guidance (1-6 sentences)",\n` +
      `  "suggestions": ["reply option 1", "reply option 2", "reply option 3"]\n` +
      `}\n` +
      `Rules:\n` +
      `- Always include "answer".\n` +
      `- If the user is NOT explicitly asking for reply drafting, set "suggestions" to [].\n` +
      `- If the user IS explicitly asking for reply drafting, "suggestions" MUST be an array of EXACTLY 3 short, sendable messages.\n` +
      `- The user request ${wantReplies ? 'DOES' : 'does NOT'} ask for reply options; follow that.\n`;

    const openAiMessages = [
      { role: 'system', content: system },
      { role: 'user', content: chatContext },
      ...thread.map((t) => ({ role: t.role, content: t.text })),
      { role: 'user', content: formatInstruction },
    ];

    const model = process.env.OPENAI_MODEL || 'gpt-4o-mini';

    const resp = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        temperature: 0.5,
        stream: true,
        response_format: { type: 'json_object' },
        messages: openAiMessages,
      }),
    });

    if (!resp.ok || !resp.body) {
      const t = await resp.text().catch(() => '');
      console.error('OpenAI error', resp.status, t);
      writeSse({ delta: 'AI provider error' });
      return endSse();
    }

    const reader = resp.body.getReader();
    const decoder = new TextDecoder();
    let buf = '';
    let fullJsonStr = '';
    const answerExtractor = makeAnswerStreamExtractor();

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
            break;
          }
          try {
            const j = JSON.parse(dataStr);
            const delta = j?.choices?.[0]?.delta?.content;
            if (typeof delta === 'string' && delta) {
              fullJsonStr += delta;
              // Emit only the decoded "answer" portion (not the full JSON) so the UI looks like
              // the non-streaming endpoint while still providing "typed" UX.
              const answerDelta = answerExtractor.push(delta);
              if (answerDelta) writeSse({ delta: answerDelta });
            }
          } catch {
            // ignore
          }
        }
      }
    }

    // Parse final JSON.
    let answer = '';
    let suggestions = [];
    try {
      const parsed = JSON.parse(String(fullJsonStr || '{}'));
      answer = safeString(parsed?.answer || '');
      suggestions = normalizeSuggestions(parsed?.suggestions);
    } catch {
      answer = safeString(fullJsonStr || '');
      suggestions = [];
    }
    suggestions = wantReplies ? ensureExactlyThreeSuggestions(suggestions, instruction) : [];

    const nextThread = sanitizeThread([
      ...thread,
      { role: 'user', text: clampText(instruction, 1200) },
      { role: 'assistant', text: clampText(answer || '', 1600) },
    ]);

    const finalPayload = { answer, suggestions, thread: nextThread };
    writeSse({ final: finalPayload });

    if (tableName) {
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
              conversationId: { S: threadKey },
              threadJson: { S: JSON.stringify(nextThread) },
              updatedAt: { S: new Date().toISOString() },
              ...(expiresAt ? { expiresAt: { N: String(expiresAt) } } : {}),
            },
          }),
        );

        await ddb.send(
          new PutItemCommand({
            TableName: tableName,
            Item: {
              sub: { S: sub },
              conversationId: { S: cacheKey },
              requestHash: { S: requestHash },
              resultJson: { S: JSON.stringify(finalPayload) },
              updatedAt: { S: new Date().toISOString() },
              lastRequestedAt: { N: String(Date.now()) },
              ...(expiresAt ? { expiresAt: { N: String(expiresAt) } } : {}),
            },
          }),
        );
      } catch (err) {
        console.error('AI helper cache put failed (continuing)', err);
      }
    }

    return endSse();
  } catch (err) {
    console.error('aiHelperStream error', err);
    writeSse({ delta: 'Internal error' });
    return endSse();
  }
});

