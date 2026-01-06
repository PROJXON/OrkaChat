import React from 'react';
import { Alert, Linking, Platform, StyleProp, Text, TextStyle } from 'react-native';

type Segment =
  | { kind: 'text'; text: string; bold?: boolean; italic?: boolean }
  | { kind: 'code'; text: string }
  | { kind: 'mention'; text: string }
  | { kind: 'link'; text: string; url: string }
  | { kind: 'spoiler'; text: string; spoilerIdx: number; revealed: boolean; bold?: boolean; italic?: boolean };

function stripTrailingPunct(s: string): string {
  // Remove common trailing punctuation from URL-like tokens.
  return String(s || '').replace(/[),.;!?]+$/g, '');
}

function tryParseHttpUrl(raw: string): string | null {
  const s0 = stripTrailingPunct(String(raw || '').trim());
  if (!s0) return null;
  try {
    const u = new URL(s0);
    const scheme = u.protocol.replace(':', '').toLowerCase();
    if (scheme !== 'https' && scheme !== 'http') return null;
    return u.toString();
  } catch {
    return null;
  }
}

function tryNormalizeUrlCandidate(raw: string): string | null {
  const s0 = stripTrailingPunct(String(raw || '').trim());
  if (!s0) return null;
  // If it already parses as http/https, accept it.
  const direct = tryParseHttpUrl(s0);
  if (direct) return direct;

  // Heuristic: bare domains / www.* (exclude emails).
  if (s0.includes('@')) return null;
  const looksLikeDomain =
    /^(?:www\.)?[a-z0-9-]+(?:\.[a-z0-9-]+)+(?::\d{2,5})?(?:\/[^\s]*)?$/i.test(s0);
  if (!looksLikeDomain) return null;
  // Default to https.
  return tryParseHttpUrl(`https://${s0}`);
}

function getDomain(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return '';
  }
}

async function defaultConfirmAndOpenUrl(url: string): Promise<void> {
  const safe = tryNormalizeUrlCandidate(url);
  if (!safe) return;
  const domain = getDomain(safe);
  const title = 'Open External Link?';
  const body = domain ? `${domain}\n\n${safe}` : safe;

  if (Platform.OS === 'web') {
    // eslint-disable-next-line no-alert
    const ok = typeof window !== 'undefined' ? window.confirm(`${title}\n\n${body}`) : false;
    if (!ok) return;
    try {
      await Linking.openURL(safe);
    } catch {
      // ignore
    }
    return;
  }

  // Open/Cancel order (as requested).
  await new Promise<void>((resolve) => {
    Alert.alert(title, body, [
      {
        text: 'Open',
        style: 'default',
        onPress: () => {
          void Linking.openURL(safe).catch(() => {});
          resolve();
        },
      },
      { text: 'Cancel', style: 'cancel', onPress: () => resolve() },
    ]);
  });
}

function parseInline(text: string, opts: { enableMentions: boolean; spoilerBaseIdx: number; revealedSpoilers: Set<number> }): Segment[] {
  const s = String(text || '');
  if (!s) return [];

  // 0) Inline code spans: split on `...` and treat the inner text as literal (no spoilers/links/bold/italic parsing).
  // This is important for help text like: `*text*` -> *text* (otherwise our emphasis parser eats the asterisks).
  const codeParts: Array<{ kind: 'text' | 'code'; text: string }> = [];
  let i = 0;
  while (i < s.length) {
    const start = s.indexOf('`', i);
    if (start < 0) {
      codeParts.push({ kind: 'text', text: s.slice(i) });
      break;
    }
    const end = s.indexOf('`', start + 1);
    if (end < 0) {
      codeParts.push({ kind: 'text', text: s.slice(i) });
      break;
    }
    if (start > i) codeParts.push({ kind: 'text', text: s.slice(i, start) });
    const inner = s.slice(start + 1, end);
    codeParts.push({ kind: 'code', text: inner });
    i = end + 1;
  }

  // 1) Within non-code parts: parse spoilers, markdown links, bare URLs, bold/italic, mentions.
  const out: Segment[] = [];
  // Note: bare-domain links are handled via tryNormalizeUrlCandidate in post-processing.
  const urlRe = /\b(?:https?:\/\/)?(?:www\.)?[^\s<>()]+\.[^\s<>()]+/gi;
  const mdLinkRe = /\[([^\]]+)\]\(((?:https?:\/\/)[^\s<>()]+)\)/gi;
  const mentionRe = /(^|[^a-zA-Z0-9_.-])@([a-zA-Z0-9_.-]{2,32})/g;

  const pushStyledText = (t: string, style?: { bold?: boolean; italic?: boolean }, spoiler?: { idx: number; revealed: boolean }) => {
    if (!t) return;
    if (spoiler) {
      out.push({ kind: 'spoiler', text: t, spoilerIdx: spoiler.idx, revealed: spoiler.revealed, bold: style?.bold, italic: style?.italic });
    } else {
      out.push({ kind: 'text', text: t, bold: style?.bold, italic: style?.italic });
    }
  };

  const processPlain = (chunk: string, style?: { bold?: boolean; italic?: boolean }, spoiler?: { idx: number; revealed: boolean }) => {
    const str = String(chunk || '');
    if (!str) return;

    // First, markdown links [label](url)
    let last = 0;
    let m: RegExpExecArray | null;
    mdLinkRe.lastIndex = 0;
    const pieces: Array<{ kind: 'text' | 'link'; text: string; url?: string }> = [];
    while ((m = mdLinkRe.exec(str)) !== null) {
      const full = m[0];
      const label = m[1] || '';
      const url = m[2] || '';
      const idx = m.index;
      if (idx > last) pieces.push({ kind: 'text', text: str.slice(last, idx) });
      pieces.push({ kind: 'link', text: label, url });
      last = idx + full.length;
    }
    if (last < str.length) pieces.push({ kind: 'text', text: str.slice(last) });

    // Then for text pieces: bare URLs, bold/italic, mentions.
    for (const p of pieces) {
      if (p.kind === 'link' && p.url) {
        const safe = tryNormalizeUrlCandidate(p.url);
        if (safe) out.push({ kind: 'link', text: p.text || safe, url: safe });
        else pushStyledText(p.text || p.url, style, spoiler);
        continue;
      }

      const body = p.text;
      if (!body) continue;

      // Split by bare URLs
      let lastUrl = 0;
      urlRe.lastIndex = 0;
      while ((m = urlRe.exec(body)) !== null) {
        const match = m[0] || '';
        const idx = m.index;
        if (idx > lastUrl) {
          const before = body.slice(lastUrl, idx);
          // Apply bold/italic + mentions inside non-url text
          processEmphasisAndMentions(before, style, spoiler);
        }
        const safe = tryNormalizeUrlCandidate(match);
        if (safe) out.push({ kind: 'link', text: match, url: safe });
        else processEmphasisAndMentions(match, style, spoiler);
        lastUrl = idx + match.length;
      }
      if (lastUrl < body.length) {
        processEmphasisAndMentions(body.slice(lastUrl), style, spoiler);
      }
    }
  };

  const processEmphasisAndMentions = (chunk: string, style?: { bold?: boolean; italic?: boolean }, spoiler?: { idx: number; revealed: boolean }) => {
    const str = String(chunk || '');
    if (!str) return;

    // Very small emphasis parser: **bold** and *italic* (non-nested, best-effort).
    const tokens: Array<{ text: string; bold?: boolean; italic?: boolean }> = [];
    let i = 0;
    while (i < str.length) {
      const boldStart = str.indexOf('**', i);
      const italicStart = str.indexOf('*', i);

      // Choose nearest marker (bold has priority if same index).
      let next = -1;
      let kind: 'bold' | 'italic' | null = null;
      if (boldStart >= 0 && (italicStart < 0 || boldStart <= italicStart)) {
        next = boldStart;
        kind = 'bold';
      } else if (italicStart >= 0) {
        next = italicStart;
        kind = 'italic';
      }

      if (next < 0 || !kind) {
        tokens.push({ text: str.slice(i) });
        break;
      }
      if (next > i) tokens.push({ text: str.slice(i, next) });

      if (kind === 'bold') {
        const end = str.indexOf('**', next + 2);
        if (end < 0) {
          tokens.push({ text: str.slice(next) });
          break;
        }
        tokens.push({ text: str.slice(next + 2, end), bold: true });
        i = end + 2;
      } else {
        const end = str.indexOf('*', next + 1);
        if (end < 0) {
          tokens.push({ text: str.slice(next) });
          break;
        }
        // Avoid treating "**" as italic opener.
        if (str[next + 1] === '*') {
          tokens.push({ text: str.slice(next, next + 2) });
          i = next + 2;
        } else {
          tokens.push({ text: str.slice(next + 1, end), italic: true });
          i = end + 1;
        }
      }
    }

    for (const t of tokens) {
      const bold = !!(style?.bold || t.bold);
      const italic = !!(style?.italic || t.italic);
      const body = t.text;
      if (!body) continue;

      if (!opts.enableMentions) {
        pushStyledText(body, { bold, italic }, spoiler);
        continue;
      }

      // Split mentions while preserving prefix char
      mentionRe.lastIndex = 0;
      let last = 0;
      let m: RegExpExecArray | null;
      while ((m = mentionRe.exec(body)) !== null) {
        const prefix = m[1] || '';
        const uname = m[2] || '';
        const startIdx = m.index;
        const atIdx = startIdx + prefix.length;
        if (atIdx > last) pushStyledText(body.slice(last, atIdx), { bold, italic }, spoiler);
        // Push mention token
        const mentionText = `@${uname}`;
        if (spoiler) {
          // Mentions inside spoilers still render as mention style when revealed.
          out.push({ kind: 'spoiler', text: mentionText, spoilerIdx: spoiler.idx, revealed: spoiler.revealed, bold, italic });
        } else {
          out.push({ kind: 'mention', text: mentionText });
        }
        last = startIdx + String(m[0]).length;
      }
      if (last < body.length) pushStyledText(body.slice(last), { bold, italic }, spoiler);
    }
  };

  // Spoilers: split on ||...|| within non-code chunks only.
  let spoilerIdx = opts.spoilerBaseIdx;
  const processTextWithSpoilers = (chunk: string) => {
    const str = String(chunk || '');
    if (!str) return;
    const spoilerParts: Array<{ kind: 'text' | 'spoiler'; text: string; idx?: number }> = [];
    let j = 0;
    while (j < str.length) {
      const start = str.indexOf('||', j);
      if (start < 0) {
        spoilerParts.push({ kind: 'text', text: str.slice(j) });
        break;
      }
      const end = str.indexOf('||', start + 2);
      if (end < 0) {
        spoilerParts.push({ kind: 'text', text: str.slice(j) });
        break;
      }
      if (start > j) spoilerParts.push({ kind: 'text', text: str.slice(j, start) });
      const inner = str.slice(start + 2, end);
      spoilerParts.push({ kind: 'spoiler', text: inner, idx: spoilerIdx++ });
      j = end + 2;
    }

    for (const p of spoilerParts) {
      if (p.kind === 'spoiler' && typeof p.idx === 'number') {
        const revealed = opts.revealedSpoilers.has(p.idx);
        // Note: we still parse inner formatting, but render as spoiler segments so taps reveal them.
        processPlain(p.text, undefined, { idx: p.idx, revealed });
      } else {
        processPlain(p.text);
      }
    }
  };

  for (const part of codeParts) {
    if (part.kind === 'code') {
      if (part.text) out.push({ kind: 'code', text: part.text });
      continue;
    }
    processTextWithSpoilers(part.text);
  }

  return out;
}

export function RichText({
  text,
  isDark,
  style,
  enableMentions,
  variant,
  mentionStyle,
  linkStyle,
  spoilerStyle,
  spoilerHiddenText,
  onOpenUrl,
}: {
  text: string;
  isDark: boolean;
  style?: StyleProp<TextStyle>;
  enableMentions?: boolean;
  variant?: 'incoming' | 'outgoing' | 'neutral';
  mentionStyle?: StyleProp<TextStyle>;
  linkStyle?: StyleProp<TextStyle>;
  spoilerStyle?: StyleProp<TextStyle>;
  spoilerHiddenText?: string;
  onOpenUrl?: (url: string) => void | Promise<void>;
}): React.JSX.Element {
  const [revealed, setRevealed] = React.useState<Set<number>>(new Set());
  const segments = React.useMemo(
    () =>
      parseInline(text, {
        enableMentions: enableMentions !== false,
        spoilerBaseIdx: 0,
        revealedSpoilers: revealed,
      }),
    [text, enableMentions, revealed]
  );

  const v = variant || 'neutral';
  const baseLink: TextStyle =
    v === 'outgoing'
      ? { color: 'rgba(255,255,255,0.95)', textDecorationLine: 'underline', fontWeight: '800' }
      : { color: isDark ? '#9dd3ff' : '#0b62d6', textDecorationLine: 'underline', fontWeight: '800' };
  const baseMention: TextStyle = { fontWeight: '900' };
  const baseCode: TextStyle = {
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : Platform.OS === 'android' ? 'monospace' : 'monospace',
    backgroundColor: isDark ? '#1c1c22' : '#f2f2f7',
    borderRadius: 6,
    paddingHorizontal: 5,
    paddingVertical: 2,
  };
  const baseSpoilerHidden: TextStyle =
    v === 'outgoing'
      ? {
          // Solid mask so you can't "see through" it on blue bubbles.
          backgroundColor: '#0b0b0f',
          color: '#0b0b0f',
          borderRadius: 6,
          paddingHorizontal: 4,
          paddingVertical: 1,
        }
      : isDark
        ? {
            backgroundColor: '#0b0b0f',
            color: '#0b0b0f',
            borderRadius: 6,
            paddingHorizontal: 4,
            paddingVertical: 1,
          }
        : {
            backgroundColor: '#111',
            color: '#111',
            borderRadius: 6,
            paddingHorizontal: 4,
            paddingVertical: 1,
          };

  return (
    <Text style={style}>
      {segments.map((seg, idx) => {
        if (seg.kind === 'code') {
          return (
            <Text key={`c:${idx}`} style={baseCode}>
              {seg.text}
            </Text>
          );
        }
        if (seg.kind === 'link') {
          return (
            <Text
              key={`l:${idx}`}
              style={[baseLink, linkStyle]}
              onPress={() => {
                if (typeof onOpenUrl === 'function') void Promise.resolve(onOpenUrl(seg.url)).catch(() => {});
                else void defaultConfirmAndOpenUrl(seg.url);
              }}
              accessibilityRole="link"
              accessibilityLabel={`Open link ${seg.url}`}
            >
              {seg.text}
            </Text>
          );
        }
        if (seg.kind === 'mention') {
          return (
            <Text key={`m:${idx}`} style={[baseMention, mentionStyle]}>
              {seg.text}
            </Text>
          );
        }
        if (seg.kind === 'spoiler') {
          const shown = seg.revealed;
          const display = shown ? seg.text : (spoilerHiddenText || 'Spoiler');
          return (
            <Text
              key={`s:${seg.spoilerIdx}:${idx}`}
              style={[
                ...(shown ? [] : [baseSpoilerHidden]),
                spoilerStyle,
                seg.bold ? { fontWeight: '900' } : null,
                seg.italic ? { fontStyle: 'italic' } : null,
              ]}
              onPress={() => {
                setRevealed((prev) => {
                  const next = new Set(prev);
                  if (next.has(seg.spoilerIdx)) next.delete(seg.spoilerIdx);
                  else next.add(seg.spoilerIdx);
                  return next;
                });
              }}
              accessibilityRole="button"
              accessibilityLabel={shown ? 'Hide spoiler' : 'Reveal spoiler'}
            >
              {shown ? display : ` ${display} `}
            </Text>
          );
        }
        return (
          <Text
            key={`t:${idx}`}
            style={[
              seg.bold ? { fontWeight: '900' } : null,
              seg.italic ? { fontStyle: 'italic' } : null,
            ]}
          >
            {seg.text}
          </Text>
        );
      })}
    </Text>
  );
}

