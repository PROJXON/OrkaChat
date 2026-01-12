import React from 'react';
import { Linking, Platform, StyleProp, Text, TextStyle } from 'react-native';
import { useUiPromptOptional } from '../providers/UiPromptProvider';

type Segment =
  | { kind: 'text'; text: string; bold?: boolean; italic?: boolean }
  | { kind: 'mention'; text: string }
  | { kind: 'link'; text: string; url: string };

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
  const looksLikeDomain = /^(?:www\.)?[a-z0-9-]+(?:\.[a-z0-9-]+)+(?::\d{2,5})?(?:\/[^\s]*)?$/i.test(s0);
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

function insertSoftBreaksForUrlDisplay(s: string): string {
  // Helps prevent awkward wraps like "google.co" + "\n" + "m" by adding break opportunities
  // after common URL punctuation.
  // Zero-width space is generally safe for display and does not change the URL we open.
  const str = String(s || '');
  // RN-web can wrap very aggressively when we add break opportunities after lots of characters
  // (especially '.' and '-'). Keep web breakpoints focused on URL structure separators.
  const re = Platform.OS === 'web' ? /([/?&=#])/g : /([/.?&=#:_-])/g;
  return str.replace(re, '$1\u200B');
}

async function _defaultConfirmAndOpenUrl(url: string): Promise<void> {
  // Legacy no-op: kept only to preserve call sites in older builds.
  // In current app flows, RichText is always rendered under UiPromptProvider so this shouldn't run.
  void url;
}

function parseInline(text: string, opts: { enableMentions: boolean }): Segment[] {
  const s = String(text || '');
  if (!s) return [];

  // Parse markdown links, bare URLs, bold/italic, mentions.
  const out: Segment[] = [];
  // Note: bare-domain links are handled via tryNormalizeUrlCandidate in post-processing.
  // Allow pasted URLs that are wrapped with a newline (common in some UIs) to still be detected as a single link.
  // We later strip any embedded newlines from the matched token before normalizing/opening.
  const urlRe = /\b(?:https?:\/\/)?(?:www\.)?[^\s<>()]+\.[^\s<>()]+(?:\n[^\s<>()]+)*/gi;
  const mdLinkRe = /\[([^\]]+)\]\(((?:https?:\/\/)[^\s<>()]+)\)/gi;
  const mentionRe = /(^|[^a-zA-Z0-9_.-])@([a-zA-Z0-9_.-]{2,32})/g;

  const pushStyledText = (t: string, style?: { bold?: boolean; italic?: boolean }) => {
    if (!t) return;
    out.push({ kind: 'text', text: t, bold: style?.bold, italic: style?.italic });
  };

  const processPlain = (chunk: string, style?: { bold?: boolean; italic?: boolean }) => {
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
        else pushStyledText(p.text || p.url, style);
        continue;
      }

      const body = p.text;
      if (!body) continue;

      // Split by bare URLs
      let lastUrl = 0;
      urlRe.lastIndex = 0;
      while ((m = urlRe.exec(body)) !== null) {
        const matchRaw = m[0] || '';
        const match = matchRaw.replace(/\n+/g, '');
        const idx = m.index;
        if (idx > lastUrl) {
          const before = body.slice(lastUrl, idx);
          // Apply bold/italic + mentions inside non-url text
          processEmphasisAndMentions(before, style);
        }
        const safe = tryNormalizeUrlCandidate(match);
        if (safe) out.push({ kind: 'link', text: match, url: safe });
        else processEmphasisAndMentions(match, style);
        lastUrl = idx + match.length;
      }
      if (lastUrl < body.length) {
        processEmphasisAndMentions(body.slice(lastUrl), style);
      }
    }
  };

  const processEmphasisAndMentions = (chunk: string, style?: { bold?: boolean; italic?: boolean }) => {
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
        pushStyledText(body, { bold, italic });
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
        if (atIdx > last) pushStyledText(body.slice(last, atIdx), { bold, italic });
        // Push mention token
        const mentionText = `@${uname}`;
        out.push({ kind: 'mention', text: mentionText });
        last = startIdx + String(m[0]).length;
      }
      if (last < body.length) pushStyledText(body.slice(last), { bold, italic });
    }
  };

  processPlain(s);

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
  onOpenUrl,
}: {
  text: string;
  isDark: boolean;
  style?: StyleProp<TextStyle>;
  enableMentions?: boolean;
  variant?: 'incoming' | 'outgoing' | 'neutral';
  mentionStyle?: StyleProp<TextStyle>;
  linkStyle?: StyleProp<TextStyle>;
  onOpenUrl?: (url: string) => void | Promise<void>;
}): React.JSX.Element {
  const ui = useUiPromptOptional();

  const confirmAndOpenUrl = React.useCallback(
    async (url: string): Promise<void> => {
      const safe = tryNormalizeUrlCandidate(url);
      if (!safe) return;
      const domain = getDomain(safe);
      const title = 'Open External Link?';
      const body = domain ? `${domain}\n\n${safe}` : safe;

      // Prefer our themed, app-wide prompt if available.
      if (ui) {
        const ok = await ui.confirm(title, body, { confirmText: 'Open', cancelText: 'Cancel' });
        if (!ok) return;
        try {
          await Linking.openURL(safe);
        } catch {
          // ignore
        }
        return;
      }

      // Fallback: legacy behavior for isolated renders outside UiPromptProvider.
      if (Platform.OS === 'web') {
         
        const ok = typeof window !== 'undefined' ? window.confirm(`${title}\n\n${body}`) : false;
        if (!ok) return;
      }
      try {
        await Linking.openURL(safe);
      } catch {
        // ignore
      }
    },
    [ui],
  );

  const segments = React.useMemo(
    () =>
      parseInline(text, {
        enableMentions: enableMentions !== false,
      }),
    [text, enableMentions],
  );

  const v = variant || 'neutral';
  const baseLink: TextStyle =
    v === 'outgoing'
      ? { color: 'rgba(255,255,255,0.95)', textDecorationLine: 'underline', fontWeight: '700' }
      : { color: isDark ? '#9dd3ff' : '#0b62d6', textDecorationLine: 'underline', fontWeight: '700' };
  const baseMention: TextStyle = { fontWeight: '900' };

  return (
    <Text style={style}>
      {segments.map((seg, idx) => {
        if (seg.kind === 'link') {
          const displayText = tryNormalizeUrlCandidate(seg.text) ? insertSoftBreaksForUrlDisplay(seg.text) : seg.text;
          return (
            <Text
              key={`l:${idx}`}
              style={[baseLink, linkStyle]}
              onPress={() => {
                if (typeof onOpenUrl === 'function') void Promise.resolve(onOpenUrl(seg.url)).catch(() => {});
                else void confirmAndOpenUrl(seg.url);
              }}
              accessibilityRole="link"
              accessibilityLabel={`Open link ${seg.url}`}
            >
              {displayText}
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
        return (
          <Text
            key={`t:${idx}`}
            style={[seg.bold ? { fontWeight: '900' } : null, seg.italic ? { fontStyle: 'italic' } : null]}
          >
            {seg.text}
          </Text>
        );
      })}
    </Text>
  );
}
