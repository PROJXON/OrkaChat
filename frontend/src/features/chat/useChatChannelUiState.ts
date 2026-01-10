import * as React from 'react';
import type { ChannelMember, ChannelMeta } from './useChannelRoster';

export function useChatChannelUiState() {
  const [channelMeta, setChannelMeta] = React.useState<ChannelMeta | null>(null);
  // Track which channel the current roster belongs to so UI doesn't briefly show stale counts
  // during the first render after switching channels (effects run after paint).
  const [channelRosterChannelId, setChannelRosterChannelId] = React.useState<string>('');
  const [channelMembers, setChannelMembers] = React.useState<ChannelMember[]>([]);
  // Best-effort cached count to avoid flashing "0" before roster loads.
  const [channelMembersActiveCountHint, setChannelMembersActiveCountHint] = React.useState<number | null>(null);

  const [channelMembersOpen, setChannelMembersOpen] = React.useState<boolean>(false);
  const [channelSettingsOpen, setChannelSettingsOpen] = React.useState<boolean>(true);
  const [channelActionBusy, setChannelActionBusy] = React.useState<boolean>(false);

  const [channelNameEditOpen, setChannelNameEditOpen] = React.useState<boolean>(false);
  const [channelNameDraft, setChannelNameDraft] = React.useState<string>('');

  const [channelAboutOpen, setChannelAboutOpen] = React.useState<boolean>(false);
  const [channelAboutEdit, setChannelAboutEdit] = React.useState<boolean>(false);
  const [channelAboutDraft, setChannelAboutDraft] = React.useState<string>('');

  const [channelPasswordEditOpen, setChannelPasswordEditOpen] = React.useState<boolean>(false);
  const [channelPasswordDraft, setChannelPasswordDraft] = React.useState<string>('');

  return {
    channelMeta,
    setChannelMeta,
    channelRosterChannelId,
    setChannelRosterChannelId,
    channelMembers,
    setChannelMembers,
    channelMembersActiveCountHint,
    setChannelMembersActiveCountHint,
    channelMembersOpen,
    setChannelMembersOpen,
    channelSettingsOpen,
    setChannelSettingsOpen,
    channelActionBusy,
    setChannelActionBusy,
    channelNameEditOpen,
    setChannelNameEditOpen,
    channelNameDraft,
    setChannelNameDraft,
    channelAboutOpen,
    setChannelAboutOpen,
    channelAboutEdit,
    setChannelAboutEdit,
    channelAboutDraft,
    setChannelAboutDraft,
    channelPasswordEditOpen,
    setChannelPasswordEditOpen,
    channelPasswordDraft,
    setChannelPasswordDraft,
  };
}

