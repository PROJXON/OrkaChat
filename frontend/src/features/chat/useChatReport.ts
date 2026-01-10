import * as React from 'react';
import { fetchAuthSession } from '@aws-amplify/auth';
import type { ChatMessage } from './types';

export function useChatReport(opts: { apiUrl: string | null | undefined; activeConversationId: string }) {
  const { apiUrl, activeConversationId } = opts;

  const [reportOpen, setReportOpen] = React.useState(false);
  const [reportKind, setReportKind] = React.useState<'message' | 'user'>('message');
  const [reportTargetMessage, setReportTargetMessage] = React.useState<ChatMessage | null>(null);
  const [reportTargetUserSub, setReportTargetUserSub] = React.useState<string>('');
  const [reportTargetUserLabel, setReportTargetUserLabel] = React.useState<string>('');
  const [reportNotice, setReportNotice] = React.useState<null | { type: 'error' | 'success'; message: string }>(null);
  const [reportCategory, setReportCategory] = React.useState<string>('spam');
  const [reportDetails, setReportDetails] = React.useState<string>('');
  const [reportSubmitting, setReportSubmitting] = React.useState<boolean>(false);

  const openReportModalForMessage = React.useCallback((target: ChatMessage) => {
    if (!target) return;
    setReportKind('message');
    setReportTargetMessage(target);
    setReportTargetUserSub('');
    setReportTargetUserLabel('');
    setReportCategory('spam');
    setReportDetails('');
    setReportSubmitting(false);
    setReportNotice(null);
    setReportOpen(true);
  }, []);

  const openReportModalForUser = React.useCallback((userSub: string, label?: string) => {
    const sub = String(userSub || '').trim();
    if (!sub) return;
    setReportKind('user');
    setReportTargetMessage(null);
    setReportTargetUserSub(sub);
    setReportTargetUserLabel(String(label || '').trim());
    setReportCategory('spam');
    setReportDetails('');
    setReportSubmitting(false);
    setReportNotice(null);
    setReportOpen(true);
  }, []);

  const closeReportModal = React.useCallback(() => {
    if (reportSubmitting) return;
    setReportOpen(false);
    setReportTargetMessage(null);
    setReportTargetUserSub('');
    setReportTargetUserLabel('');
    setReportCategory('spam');
    setReportDetails('');
    setReportNotice(null);
  }, [reportSubmitting]);

  const submitReport = React.useCallback(async () => {
    if (!apiUrl) {
      setReportNotice({ type: 'error', message: 'Report failed: API_URL is not configured.' });
      return;
    }
    if (reportSubmitting) return;

    const { tokens } = await fetchAuthSession().catch(() => ({ tokens: undefined }));
    const idToken = tokens?.idToken?.toString();
    if (!idToken) {
      setReportNotice({ type: 'error', message: 'Please sign in to report content.' });
      return;
    }

    const details = reportDetails.trim();
    const category = String(reportCategory || '').trim() || 'other';
    const nowTargetMsg = reportTargetMessage;
    const nowUserSub = reportTargetUserSub;

    const messagePreview = (() => {
      const t = nowTargetMsg;
      if (!t) return '';
      if ((t as any).deletedAt) return '';
      if (typeof (t as any).decryptedText === 'string' && String((t as any).decryptedText).trim()) {
        return String((t as any).decryptedText).trim();
      }
      if (typeof (t as any).text === 'string' && String((t as any).text).trim()) return String((t as any).text).trim();
      return '';
    })();

    const payload =
      reportKind === 'user'
        ? {
            kind: 'user',
            reportedUserSub: nowUserSub || undefined,
            reason: `user_report:${category}`,
            details: details ? details.slice(0, 900) : undefined,
            conversationId: activeConversationId || undefined,
          }
        : {
            kind: 'message',
            conversationId: activeConversationId,
            messageCreatedAt: (nowTargetMsg as any)?.createdAt,
            reportedUserSub: typeof (nowTargetMsg as any)?.userSub === 'string' ? (nowTargetMsg as any).userSub : undefined,
            reason: `user_report:${category}`,
            details: details ? details.slice(0, 900) : undefined,
            messagePreview: messagePreview ? messagePreview.slice(0, 400) : undefined,
          };

    // Validate required fields client-side so we can show a friendly message.
    if (reportKind === 'message') {
      if (!(payload as any).conversationId || !(payload as any).messageCreatedAt) {
        setReportNotice({ type: 'error', message: 'Report failed: missing message reference.' });
        return;
      }
    } else {
      if (!(payload as any).reportedUserSub && !(payload as any).details) {
        setReportNotice({ type: 'error', message: 'Report failed: missing user. Try again or add an optional note.' });
        return;
      }
    }

    setReportSubmitting(true);
    try {
      const resp = await fetch(`${apiUrl.replace(/\/$/, '')}/reports`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${idToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!resp.ok) {
        const text = await resp.text().catch(() => '');
        throw new Error(text || `Report failed (${resp.status})`);
      }
      setReportNotice({ type: 'success', message: 'Thanks - we’ll review this.' });
      // Give the user a moment to see the confirmation, then close.
      setTimeout(() => {
        setReportOpen(false);
      }, 650);
    } catch (e: any) {
      setReportNotice({ type: 'error', message: e?.message ?? 'Report failed: unknown error.' });
    } finally {
      setReportSubmitting(false);
    }
  }, [
    apiUrl,
    activeConversationId,
    reportCategory,
    reportDetails,
    reportKind,
    reportSubmitting,
    reportTargetMessage,
    reportTargetUserSub,
  ]);

  return {
    reportOpen,
    setReportOpen,
    reportKind,
    setReportKind,
    reportTargetMessage,
    setReportTargetMessage,
    reportTargetUserSub,
    setReportTargetUserSub,
    reportTargetUserLabel,
    setReportTargetUserLabel,
    reportNotice,
    setReportNotice,
    reportCategory,
    setReportCategory,
    reportDetails,
    setReportDetails,
    reportSubmitting,
    openReportModalForMessage,
    openReportModalForUser,
    closeReportModal,
    submitReport,
  };
}

