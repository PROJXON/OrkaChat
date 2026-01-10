import * as React from 'react';
import { Animated, Platform, Text, View } from 'react-native';
import { MediaViewerModal } from '../../../components/MediaViewerModal';
import { AiConsentModal } from './AiConsentModal';
import { AiHelperModal } from './AiHelperModal';
import { AttachPickerModal } from './AttachPickerModal';
import { ChannelAboutModal } from './ChannelAboutModal';
import { ChannelMembersModal } from './ChannelMembersModal';
import { ChannelNameModal } from './ChannelNameModal';
import { ChannelPasswordModal } from './ChannelPasswordModal';
import { CiphertextModal } from './CiphertextModal';
import { GroupMembersModal } from './GroupMembersModal';
import { GroupNameModal } from './GroupNameModal';
import { InfoModal } from './InfoModal';
import { MessageActionMenuModal } from './MessageActionMenuModal';
import { ReactionInfoModal } from './ReactionInfoModal';
import { ReactionPickerModal } from './ReactionPickerModal';
import { ReportModal } from './ReportModal';
import { SummaryModal } from './SummaryModal';
import { TtlPickerModal } from './TtlPickerModal';
import { InAppCameraModal } from '../../../components/InAppCameraModal';

export type ChatScreenOverlaysProps = {
  isDark: boolean;
  styles: any;
  insets: { top: number; bottom: number };

  // AI summary + consent
  aiSummary: { open: boolean; loading: boolean; text: string; close: () => void };
  aiConsentGate: { open: boolean; onProceed: (run: (a: 'summary' | 'helper') => void) => void; onCancel: () => void };
  runAiAction: (a: 'summary' | 'helper') => void;

  attach: {
    open: boolean;
    setOpen: (v: boolean) => void;
    pickFromLibrary: () => Promise<void> | void;
    openCamera: () => Promise<void> | void;
    pickDocument: () => Promise<void> | void;
  };

  camera: {
    open: boolean;
    setOpen: (v: boolean) => void;
    showAlert: (title: string, body: string) => void;
    onCaptured: (cap: any) => void;
  };

  // AI helper
  aiHelper: any;
  copyToClipboard: (text: string) => Promise<void>;
  setInput: (t: string) => void;

  // Reporting
  report: any;
  cdnMedia: any;

  // Message actions + reactions
  messageActionMenu: any;
  myUserId: string | null | undefined;
  myPublicKey: string | null | undefined;
  displayName: string;
  isDm: boolean;
  encryptedPlaceholder: string;
  normalizeUser: (v: unknown) => string;
  mediaUrlByPath: Record<string, string>;
  dmThumbUriByPath: Record<string, string>;
  quickReactions: string[];
  blockedSubsSet: Set<string>;
  onBlockUserSub?: (blockedSub: string, label?: string) => void | Promise<void>;
  uiConfirm: any;
  messageOps: any;

  reactionPickerOpen: boolean;
  reactionPickerTarget: any;
  emojis: string[];
  closeReactionPicker: () => void;

  cipher: { open: boolean; text: string; setOpen: (v: boolean) => void; setText: (t: string) => void };

  reactionInfo: any;
  nameBySub: Record<string, string>;

  // Info modal
  info: { infoOpen: boolean; infoTitle: string; infoBody: string; setInfoOpen: (v: boolean) => void };

  // TTL picker
  ttl: {
    ttlPickerOpen: boolean;
    TTL_OPTIONS: Array<{ label: string; seconds: number }>;
    ttlIdx: number;
    ttlIdxDraft: number;
    setTtlIdxDraft: (v: number) => void;
    setTtlPickerOpen: (v: boolean) => void;
    setTtlIdx: (v: number) => void;
  };

  // Group
  groupNameEditOpen: boolean;
  groupActionBusy: boolean;
  groupNameDraft: string;
  setGroupNameDraft: (v: string) => void;
  groupNameModalActions: any;

  groupMembersOpen: boolean;
  groupMeta: any;
  groupAddMembersDraft: string;
  setGroupAddMembersDraft: (v: string) => void;
  groupMembersModalActions: any;
  groupAddMembersInputRef: React.RefObject<any>;
  groupMembersVisible: any[];
  kickCooldownUntilBySub: Record<string, number>;
  avatarUrlByPath: Record<string, string>;
  groupKick: (memberSub: string) => void;
  groupUpdate: (op: any, args: any) => Promise<void> | void;

  // Channel
  channelMembersOpen: boolean;
  channelMembersVisible: any[];
  channelMeta: any;
  channelActionBusy: boolean;
  channelMembersModalActions: any;
  channelUpdate: (op: any, args: any) => Promise<void> | void;
  channelKick: (memberSub: string) => void;

  channelAboutOpen: boolean;
  channelAboutEdit: boolean;
  channelAboutDraft: string;
  setChannelAboutDraft: (v: string) => void;
  setChannelAboutEdit: (v: boolean) => void;
  channelAboutModalActions: any;
  requestOpenLink: (url: string) => void;

  channelNameEditOpen: boolean;
  channelNameDraft: string;
  setChannelNameDraft: (v: string) => void;
  channelNameModalActions: any;

  channelPasswordEditOpen: boolean;
  channelPasswordDraft: string;
  setChannelPasswordDraft: (v: string) => void;
  channelPasswordModalActions: any;

  // Viewer
  viewer: any;
  dmFileUriByPath: Record<string, string>;

  // Confirm link modal (React node)
  confirmLinkModal: React.ReactNode;

  // Toast
  toast: { message: string; kind?: 'success' | 'error' } | null;
  toastAnim: any;
};

export function ChatScreenOverlays(props: ChatScreenOverlaysProps): React.JSX.Element {
  const {
    isDark,
    styles,
    insets,
    aiSummary,
    aiConsentGate,
    runAiAction,
    attach,
    camera,
    aiHelper,
    copyToClipboard,
    setInput,
    report,
    cdnMedia,
    messageActionMenu,
    myUserId,
    myPublicKey,
    displayName,
    isDm,
    encryptedPlaceholder,
    normalizeUser,
    mediaUrlByPath,
    dmThumbUriByPath,
    quickReactions,
    blockedSubsSet,
    onBlockUserSub,
    uiConfirm,
    messageOps,
    reactionPickerOpen,
    reactionPickerTarget,
    emojis,
    closeReactionPicker,
    cipher,
    reactionInfo,
    nameBySub,
    info,
    ttl,
    groupNameEditOpen,
    groupActionBusy,
    groupNameDraft,
    setGroupNameDraft,
    groupNameModalActions,
    groupMembersOpen,
    groupMeta,
    groupAddMembersDraft,
    setGroupAddMembersDraft,
    groupMembersModalActions,
    groupAddMembersInputRef,
    groupMembersVisible,
    kickCooldownUntilBySub,
    avatarUrlByPath,
    groupKick,
    groupUpdate,
    channelMembersOpen,
    channelMembersVisible,
    channelMeta,
    channelActionBusy,
    channelMembersModalActions,
    channelUpdate,
    channelKick,
    channelAboutOpen,
    channelAboutEdit,
    channelAboutDraft,
    setChannelAboutDraft,
    setChannelAboutEdit,
    channelAboutModalActions,
    requestOpenLink,
    channelNameEditOpen,
    channelNameDraft,
    setChannelNameDraft,
    channelNameModalActions,
    channelPasswordEditOpen,
    channelPasswordDraft,
    setChannelPasswordDraft,
    channelPasswordModalActions,
    viewer,
    dmFileUriByPath,
    confirmLinkModal,
    toast,
    toastAnim,
  } = props;

  return (
    <>
      <SummaryModal
        visible={aiSummary.open}
        isDark={isDark}
        styles={styles}
        loading={aiSummary.loading}
        text={aiSummary.text}
        onClose={aiSummary.close}
      />

      <AiConsentModal
        visible={aiConsentGate.open}
        isDark={isDark}
        styles={styles}
        onProceed={() => aiConsentGate.onProceed(runAiAction)}
        onCancel={aiConsentGate.onCancel}
      />

      <AttachPickerModal
        visible={attach.open}
        isDark={isDark}
        styles={styles}
        onClose={() => attach.setOpen(false)}
        onPickLibrary={() => {
          attach.setOpen(false);
          setTimeout(() => void attach.pickFromLibrary(), 0);
        }}
        onPickCamera={() => {
          attach.setOpen(false);
          setTimeout(() => void attach.openCamera(), 0);
        }}
        onPickFile={() => {
          attach.setOpen(false);
          setTimeout(() => void attach.pickDocument(), 0);
        }}
      />

      <InAppCameraModal
        visible={camera.open}
        onClose={() => camera.setOpen(false)}
        onAlert={camera.showAlert}
        onCaptured={(cap) => {
          camera.setOpen(false);
          camera.onCaptured(cap);
        }}
      />

      <AiHelperModal
        visible={aiHelper.open}
        isDark={isDark}
        styles={styles}
        thread={aiHelper.thread}
        answer={aiHelper.answer}
        suggestions={aiHelper.suggestions}
        instruction={aiHelper.instruction}
        loading={aiHelper.loading}
        mode={aiHelper.mode}
        onChangeInstruction={aiHelper.setInstruction}
        onChangeMode={aiHelper.setMode}
        onSubmit={aiHelper.submit}
        onResetThread={aiHelper.resetHelperThread}
        onClose={aiHelper.closeHelper}
        onCopySuggestion={(s: string) => void copyToClipboard(s)}
        onUseSuggestion={(s: string) => {
          setInput(s);
          aiHelper.closeHelper();
        }}
        scrollRef={aiHelper.scrollRef}
        scrollContentRef={aiHelper.scrollContentRef}
        lastTurnRef={aiHelper.lastTurnRef}
        lastTurnLayoutRef={aiHelper.lastTurnLayoutRef}
        scrollViewportHRef={aiHelper.scrollViewportHRef}
        scrollContentHRef={aiHelper.scrollContentHRef}
        lastAutoScrollAtRef={aiHelper.lastAutoScrollAtRef}
        lastAutoScrollContentHRef={aiHelper.lastAutoScrollContentHRef}
        autoScrollRetryRef={aiHelper.autoScrollRetryRef}
        autoScrollIntentRef={aiHelper.autoScrollIntentRef}
        autoScroll={aiHelper.autoScroll}
      />

      <ReportModal
        visible={!!report?.reportOpen}
        isDark={isDark}
        styles={styles}
        submitting={!!report?.reportSubmitting}
        notice={report?.reportNotice}
        reportKind={report?.reportKind}
        reportCategory={report?.reportCategory}
        reportTargetMessage={report?.reportTargetMessage}
        reportTargetUserSub={report?.reportTargetUserSub}
        reportTargetUserLabel={report?.reportTargetUserLabel}
        reportDetails={report?.reportDetails}
        cdnMedia={cdnMedia}
        onClose={report?.closeReportModal}
        onSubmit={report?.submitReport}
        onToggleKind={(next) => {
          if (next) {
            // Switch to reporting the user (hydrate from the message if needed)
            if (report?.reportTargetUserSub) {
              report?.setReportKind?.('user');
              return;
            }
            const sub = report?.reportTargetMessage?.userSub ? String(report.reportTargetMessage.userSub) : '';
            if (sub) {
              report?.setReportTargetUserSub?.(sub);
              report?.setReportTargetUserLabel?.(String(report?.reportTargetMessage?.user || '').trim());
              report?.setReportKind?.('user');
              return;
            }
            report?.setReportNotice?.({ type: 'error', message: 'Cannot report user: no user was found for this report.' });
            report?.setReportKind?.('message');
            return;
          }
          // Switch back to reporting the message (if we have one)
          if (report?.reportTargetMessage) report?.setReportKind?.('message');
        }}
        onSelectCategory={(key) => report?.setReportCategory?.(key)}
        onChangeDetails={(t) => report?.setReportDetails?.(t)}
      />

      <MessageActionMenuModal
        visible={!!messageActionMenu?.open}
        isDark={isDark}
        styles={styles}
        insets={{ top: insets.top, bottom: insets.bottom }}
        anchor={messageActionMenu?.anchor}
        anim={messageActionMenu?.anim}
        measuredH={messageActionMenu?.measuredH ?? 0}
        measuredHRef={messageActionMenu?.measuredHRef}
        onMeasuredH={messageActionMenu?.onMeasuredH}
        target={messageActionMenu?.target}
        myUserId={myUserId}
        myPublicKey={myPublicKey}
        displayName={displayName}
        isDm={isDm}
        encryptedPlaceholder={encryptedPlaceholder}
        normalizeUser={normalizeUser}
        mediaUrlByPath={mediaUrlByPath}
        dmThumbUriByPath={dmThumbUriByPath}
        quickReactions={quickReactions}
        blockedSubsSet={blockedSubsSet}
        onBlockUserSub={onBlockUserSub}
        uiConfirm={uiConfirm}
        showAlert={camera.showAlert}
        close={messageActionMenu?.closeMenu}
        sendReaction={messageOps.sendReaction}
        openReactionPicker={messageOps.openReactionPicker}
        setCipherText={messageOps.setCipherText}
        setCipherOpen={messageOps.setCipherOpen}
        beginReply={messageOps.beginReply}
        beginInlineEdit={messageOps.beginInlineEdit}
        setInlineEditAttachmentMode={messageOps.setInlineEditAttachmentMode}
        handlePickMedia={messageOps.handlePickMedia}
        clearPendingMedia={messageOps.clearPendingMedia}
        deleteForMe={messageOps.deleteForMe}
        sendDeleteForEveryone={messageOps.sendDeleteForEveryone}
        openReportForMessage={messageOps.openReportModalForMessage}
      />

      <ReactionPickerModal
        visible={reactionPickerOpen}
        isDark={isDark}
        styles={styles}
        target={reactionPickerTarget}
        myUserId={myUserId}
        emojis={emojis}
        onPick={(emoji) => {
          if (reactionPickerTarget) messageOps.sendReaction(reactionPickerTarget, emoji);
          closeReactionPicker();
        }}
        onClose={closeReactionPicker}
      />

      <CiphertextModal
        visible={cipher.open}
        isDark={isDark}
        styles={styles}
        text={cipher.text}
        onClose={() => cipher.setOpen(false)}
      />

      <ReactionInfoModal
        visible={reactionInfo.open}
        isDark={isDark}
        styles={styles}
        emoji={reactionInfo.emoji}
        subsSorted={reactionInfo.subsSorted}
        myUserId={myUserId}
        nameBySub={nameBySub}
        onRemoveMine={() => {
          if (!reactionInfo.target || !reactionInfo.emoji) return;
          messageOps.sendReaction(reactionInfo.target, reactionInfo.emoji);
          reactionInfo.closeReactionInfo();
        }}
        onClose={() => {
          reactionInfo.closeReactionInfo();
        }}
      />

      <InfoModal
        visible={info.infoOpen}
        isDark={isDark}
        styles={styles}
        title={info.infoTitle}
        body={info.infoBody}
        onClose={() => info.setInfoOpen(false)}
      />

      <TtlPickerModal
        visible={ttl.ttlPickerOpen}
        isDark={isDark}
        styles={styles}
        options={ttl.TTL_OPTIONS}
        draftIdx={ttl.ttlIdxDraft}
        onSelectIdx={ttl.setTtlIdxDraft}
        onCancel={() => {
          // Discard changes unless explicitly confirmed.
          ttl.setTtlIdxDraft(ttl.ttlIdx);
          ttl.setTtlPickerOpen(false);
        }}
        onDone={() => {
          // Commit selection only on explicit confirmation.
          ttl.setTtlIdx(ttl.ttlIdxDraft);
          ttl.setTtlPickerOpen(false);
        }}
      />

      <GroupNameModal
        visible={groupNameEditOpen}
        isDark={isDark}
        styles={styles}
        busy={groupActionBusy}
        draft={groupNameDraft}
        onChangeDraft={setGroupNameDraft}
        onDefault={groupNameModalActions.onDefault}
        onSave={groupNameModalActions.onSave}
        onCancel={groupNameModalActions.onCancel}
      />

      <GroupMembersModal
        visible={groupMembersOpen}
        isDark={isDark}
        styles={styles}
        busy={groupActionBusy}
        meIsAdmin={!!groupMeta?.meIsAdmin}
        addMembersDraft={groupAddMembersDraft}
        onChangeAddMembersDraft={setGroupAddMembersDraft}
        onAddMembers={groupMembersModalActions.onAddMembers}
        addMembersInputRef={groupAddMembersInputRef}
        members={groupMembersVisible as any}
        mySub={typeof myUserId === 'string' && myUserId.trim() ? myUserId.trim() : ''}
        kickCooldownUntilBySub={kickCooldownUntilBySub}
        avatarUrlByPath={avatarUrlByPath}
        onKick={(memberSub) => groupKick(memberSub)}
        onUnban={(memberSub) => void groupUpdate('unban', { memberSub })}
        onToggleAdmin={({ memberSub, isAdmin }) => void groupUpdate(isAdmin ? 'demoteAdmin' : 'promoteAdmin', { memberSub })}
        onBan={groupMembersModalActions.onBan}
        onClose={groupMembersModalActions.onClose}
      />

      <ChannelMembersModal
        visible={channelMembersOpen}
        isDark={isDark}
        styles={styles}
        members={channelMembersVisible as any}
        mySub={typeof myUserId === 'string' ? myUserId : ''}
        meIsAdmin={!!channelMeta?.meIsAdmin}
        actionBusy={channelActionBusy}
        kickCooldownUntilBySub={kickCooldownUntilBySub}
        avatarUrlByPath={avatarUrlByPath}
        onBan={channelMembersModalActions.onBan}
        onUnban={(memberSub) => void channelUpdate('unban', { memberSub })}
        onKick={(memberSub) => channelKick(memberSub)}
        onToggleAdmin={channelMembersModalActions.onToggleAdmin}
        onClose={channelMembersModalActions.onClose}
      />

      {confirmLinkModal}

      <ChannelAboutModal
        visible={channelAboutOpen}
        isDark={isDark}
        styles={styles}
        title={channelMeta?.name ? `${channelMeta.name}` : 'About'}
        edit={channelAboutEdit}
        draft={String(channelAboutDraft || '')}
        busy={channelActionBusy}
        canEdit={!!channelMeta?.meIsAdmin}
        onChangeDraft={(v) => setChannelAboutDraft(String(v || '').slice(0, 4000))}
        onOpenUrl={requestOpenLink}
        onRequestClose={channelAboutModalActions.onRequestClose}
        onBackdropPress={channelAboutModalActions.onBackdropPress}
        onPreview={() => setChannelAboutEdit(false)}
        onSave={channelAboutModalActions.onSave}
        onCancelEdit={channelAboutModalActions.onCancelEdit}
        onGotIt={channelAboutModalActions.onGotIt}
        onEdit={() => setChannelAboutEdit(true)}
      />

      <ChannelNameModal
        visible={channelNameEditOpen}
        isDark={isDark}
        styles={styles}
        busy={channelActionBusy}
        draft={channelNameDraft}
        onChangeDraft={setChannelNameDraft}
        onSave={channelNameModalActions.onSave}
        onCancel={channelNameModalActions.onCancel}
      />

      <ChannelPasswordModal
        visible={channelPasswordEditOpen}
        isDark={isDark}
        styles={styles}
        busy={channelActionBusy}
        draft={channelPasswordDraft}
        onChangeDraft={setChannelPasswordDraft}
        onSave={channelPasswordModalActions.onSave}
        onCancel={channelPasswordModalActions.onCancel}
      />

      <MediaViewerModal
        open={viewer.open}
        viewerState={viewer.state as any}
        setViewerState={viewer.setState as any}
        dmFileUriByPath={dmFileUriByPath}
        saving={viewer.saving}
        onSave={() => void viewer.saveToDevice()}
        onClose={viewer.close}
      />

      {toast ? (
        <Animated.View
          style={[
            styles.toastWrap,
            ...(Platform.OS === 'web' ? [{ pointerEvents: 'none' as const }] : []),
            {
              bottom: Math.max(16, insets.bottom + 12),
              opacity: toastAnim,
              transform: [
                {
                  translateY: toastAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [12, 0],
                  }),
                },
              ],
            },
          ]}
          pointerEvents={Platform.OS === 'web' ? undefined : 'none'}
        >
          <View
            style={[
              styles.toast,
              isDark ? styles.toastDark : null,
              toast.kind === 'error' ? (isDark ? styles.toastErrorDark : styles.toastError) : null,
            ]}
          >
            <Text style={styles.toastText}>{toast.message}</Text>
          </View>
        </Animated.View>
      ) : null}
    </>
  );
}

