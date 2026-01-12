import * as React from 'react';
import { Text, type TextStyle } from 'react-native';

export function useMentions(opts: {
  enabled: boolean;
  input: string;
  setInput: (next: string) => void;
  inputRef: React.MutableRefObject<string>;
  textInputRef: React.RefObject<{ focus?: () => void } | null>;
  messages: Array<{ userSub?: string; userLower?: string; user?: string }>;
  myUserId: string | null | undefined;
  mentionTextStyle: TextStyle;
}) {
  const { enabled, input, setInput, inputRef, textInputRef, messages, myUserId, mentionTextStyle } =
    opts;

  const mentionQuery = React.useMemo(() => {
    if (!enabled) return null;
    const s = String(input || '');
    const at = s.lastIndexOf('@');
    if (at < 0) return null;
    // Only autocomplete the trailing token.
    const tail = s.slice(at + 1);
    if (tail.includes(' ') || tail.includes('\n') || tail.includes('\t')) return null;
    // Require the '@' to be at start or preceded by whitespace/punctuation.
    if (at > 0 && /[a-zA-Z0-9_.-]/.test(s[at - 1])) return null;
    const q = tail.trim().toLowerCase();
    if (q.length > 32) return null;
    return { at, q };
  }, [enabled, input]);

  // Avoid suggesting the current user in mention autocomplete.
  // We infer usernameLower from recent messages sent by this user (best-effort).
  const myUsernameLowerForMentions = React.useMemo(() => {
    const mySub = typeof myUserId === 'string' ? String(myUserId).trim() : '';
    if (!mySub) return '';
    for (const m of messages.slice(0, 300)) {
      if (!m) continue;
      if (m.userSub && String(m.userSub) === mySub && typeof m.userLower === 'string') {
        const u = String(m.userLower).trim().toLowerCase();
        if (u && u !== 'system') return u;
      }
    }
    return '';
  }, [messages, myUserId]);

  const mentionSuggestions = React.useMemo(() => {
    if (!mentionQuery) return [];
    const q = mentionQuery.q;
    const seen = new Set<string>();
    const candidates: string[] = [];
    for (const m of messages.slice(0, 200)) {
      const u = typeof m.userLower === 'string' ? String(m.userLower) : '';
      if (!u || u === 'system') continue;
      if (myUsernameLowerForMentions && u === myUsernameLowerForMentions) continue;
      if (q && !u.startsWith(q)) continue;
      if (seen.has(u)) continue;
      seen.add(u);
      candidates.push(u);
      if (candidates.length >= 6) break;
    }
    return candidates;
  }, [mentionQuery, messages, myUsernameLowerForMentions]);

  // Render helper: bold @mentions in chat text (local rendering only).
  // This does NOT affect backend mention detection or push behavior.
  const renderTextWithMentions = React.useCallback(
    (text: string) => {
      const s = String(text || '');
      if (!enabled) return s;
      if (!s || !s.includes('@')) return s;
      const re = /(^|[^a-zA-Z0-9_.-])@([a-zA-Z0-9_.-]{2,32})/g;
      const out: Array<{ key: string; text: string; mention: boolean }> = [];
      let last = 0;
      let m: RegExpExecArray | null;
      while ((m = re.exec(s)) !== null) {
        const prefix = String(m[1] || '');
        const uname = String(m[2] || '');
        const atIdx = m.index + prefix.length; // index of '@'
        if (atIdx > last)
          out.push({ key: `t:${last}`, text: s.slice(last, atIdx), mention: false });
        out.push({ key: `m:${atIdx}`, text: `@${uname}`, mention: true });
        last = m.index + String(m[0]).length;
      }
      if (last < s.length) out.push({ key: `t:${last}`, text: s.slice(last), mention: false });
      return out.map((p) =>
        p.mention ? (
          <Text key={p.key} style={mentionTextStyle}>
            {p.text}
          </Text>
        ) : (
          <Text key={p.key}>{p.text}</Text>
        ),
      );
    },
    [enabled, mentionTextStyle],
  );

  const insertMention = React.useCallback(
    (usernameLower: string) => {
      const mq = mentionQuery;
      if (!mq) return;
      const s = String(inputRef.current || input || '');
      const before = s.slice(0, mq.at);
      const next = `${before}@${String(usernameLower).toLowerCase()} `;
      setInput(next);
      inputRef.current = next;
      try {
        textInputRef.current?.focus?.();
      } catch {
        // ignore
      }
    },
    [mentionQuery, input, setInput, inputRef, textInputRef],
  );

  return { mentionSuggestions, insertMention, renderTextWithMentions };
}
