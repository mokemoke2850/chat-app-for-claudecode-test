// Issue #152 — 日程調整 (Poll) 一覧 Drawer
// CalendarPage の右側からスライドインし、選択チャンネルの polls を PollHeatmap で列挙する

import { Suspense, use, useMemo, useState } from 'react';
import {
  Box,
  CircularProgress,
  Divider,
  Drawer,
  IconButton,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';

import { PollHeatmap } from './PollHeatmap';
import { api } from '../../api/client';
import type { CalendarEvent, CalendarPoll, Channel, User } from '@chat-app/shared';

const pollsCache = new Map<string, Promise<{ polls: CalendarPoll[] }>>();

function getOrCreatePollsPromise(
  channelId: number,
  version: number,
): Promise<{ polls: CalendarPoll[] }> {
  const key = `${channelId}@${version}`;
  let cached = pollsCache.get(key);
  if (!cached) {
    cached = api.calendar.polls.list(channelId);
    pollsCache.set(key, cached);
  }
  return cached;
}

interface Props {
  open: boolean;
  channelsPromise: Promise<{ channels: Channel[] }>;
  usersPromise: Promise<{ users: User[] }>;
  currentUserId: number;
  onClose: () => void;
  onConfirmed: (event: CalendarEvent) => void;
}

interface ContentProps {
  pollsPromise: Promise<{ polls: CalendarPoll[] }>;
  users: User[];
  currentUserId: number;
  onConfirmed: (event: CalendarEvent) => void;
  refresh: () => void;
}

function PollListContent({
  pollsPromise,
  users,
  currentUserId,
  onConfirmed,
  refresh,
}: ContentProps) {
  const { polls } = use(pollsPromise);
  if (polls.length === 0) {
    return (
      <Box sx={{ py: 6, textAlign: 'center', color: 'text.secondary' }}>
        <Typography>このチャンネルには日程調整がありません</Typography>
      </Box>
    );
  }
  return (
    <Stack spacing={2}>
      {polls.map((p) => (
        <PollHeatmap
          key={p.id}
          poll={p}
          users={users}
          currentUserId={currentUserId}
          isOrganizer={p.organizerId === currentUserId}
          onVoteUpdated={refresh}
          onConfirmed={(ev) => {
            refresh();
            onConfirmed(ev);
          }}
        />
      ))}
    </Stack>
  );
}

interface InnerProps {
  channelsPromise: Promise<{ channels: Channel[] }>;
  usersPromise: Promise<{ users: User[] }>;
  currentUserId: number;
  onConfirmed: (event: CalendarEvent) => void;
}

function PollDrawerInner({
  channelsPromise,
  usersPromise,
  currentUserId,
  onConfirmed,
}: InnerProps) {
  const { channels } = use(channelsPromise);
  const { users } = use(usersPromise);

  const [channelId, setChannelId] = useState<number>(() => channels[0]?.id ?? 0);
  const [version, setVersion] = useState(0);

  const pollsPromise = useMemo(
    () => (channelId > 0 ? getOrCreatePollsPromise(channelId, version) : null),
    [channelId, version],
  );

  const refresh = () => {
    for (const key of Array.from(pollsCache.keys())) {
      if (key.startsWith(`${channelId}@`)) pollsCache.delete(key);
    }
    setVersion((v) => v + 1);
  };

  return (
    <>
      <TextField
        select
        size="small"
        label="チャンネル"
        value={channelId === 0 ? '' : channelId}
        onChange={(e) => setChannelId(Number(e.target.value))}
        fullWidth
        sx={{ mb: 2 }}
        inputProps={{ 'aria-label': 'poll-drawer-channel' }}
      >
        {channels.map((c) => (
          <MenuItem key={c.id} value={c.id}>
            # {c.name}
          </MenuItem>
        ))}
      </TextField>

      {pollsPromise ? (
        <Suspense
          fallback={
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
              <CircularProgress size={24} />
            </Box>
          }
        >
          <PollListContent
            pollsPromise={pollsPromise}
            users={users}
            currentUserId={currentUserId}
            onConfirmed={onConfirmed}
            refresh={refresh}
          />
        </Suspense>
      ) : (
        <Typography color="text.secondary">チャンネルを選択してください</Typography>
      )}
    </>
  );
}

export function PollListDrawer({
  open,
  channelsPromise,
  usersPromise,
  currentUserId,
  onClose,
  onConfirmed,
}: Props) {
  return (
    <Drawer
      anchor="right"
      open={open}
      onClose={onClose}
      PaperProps={{ sx: { width: 480, maxWidth: '100%' } }}
      data-testid="poll-list-drawer"
    >
      <Box sx={{ display: 'flex', alignItems: 'center', p: 2, gap: 1 }}>
        <Typography sx={{ flexGrow: 1, fontSize: 16, fontWeight: 600 }}>日程調整</Typography>
        <IconButton size="small" onClick={onClose} aria-label="poll-drawer-close">
          <CloseIcon fontSize="small" />
        </IconButton>
      </Box>
      <Divider />
      <Box sx={{ p: 2, flexGrow: 1, overflow: 'auto' }}>
        <Suspense
          fallback={
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
              <CircularProgress size={24} />
            </Box>
          }
        >
          <PollDrawerInner
            channelsPromise={channelsPromise}
            usersPromise={usersPromise}
            currentUserId={currentUserId}
            onConfirmed={onConfirmed}
          />
        </Suspense>
      </Box>
    </Drawer>
  );
}
