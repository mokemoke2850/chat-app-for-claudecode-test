import { useMemo, useState, Suspense } from 'react';
import { Box, CircularProgress, IconButton, Tab, Tabs, Typography } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import type { Channel } from '@chat-app/shared';
import ChannelTopicBar from './ChannelTopicBar';
import PinnedMessages from './PinnedMessages';
import { MembersContent, type MembersData } from './ChannelMembersDialog';
import { api } from '../../api/client';

type TabKey = 'summary' | 'pins' | 'members';

interface Props {
  channel: Channel;
  currentUserId: number;
  userRole: string;
  onClose: () => void;
  onTopicUpdated: (channel: Channel) => void;
  pinRefreshKey?: number;
  onUnpin: (messageId: number) => void;
}

/**
 * Step 5a: チャンネル右側 320px の折り畳み可能ペイン。
 * 概要 / ピン留め / メンバーの 3 タブを集約する。ファイル / 予定タブは Step 5b で追加予定。
 *
 * 既存の `ChannelTopicBar` / `PinnedMessages` / `ChannelMembersDialog#MembersContent` を再利用する形で実装。
 * 開閉状態の永続化は呼び出し元 (ChatPage) で `localStorage["contextRail.open"]` に保存する。
 */
export default function ContextRail({
  channel,
  currentUserId,
  userRole,
  onClose,
  onTopicUpdated,
  pinRefreshKey = 0,
  onUnpin,
}: Props) {
  const [tab, setTab] = useState<TabKey>('summary');

  // メンバータブが選択されている間だけ Promise を生成して MembersContent に渡す
  const membersPromise = useMemo<Promise<MembersData> | null>(() => {
    if (tab !== 'members') return null;
    return Promise.all([api.auth.users(), api.channels.getMembers(channel.id)]);
  }, [tab, channel.id]);

  return (
    <Box
      data-testid="context-rail"
      sx={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        borderLeft: '1px solid var(--border)',
        background: 'var(--surface)',
        minHeight: 0,
      }}
    >
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 1,
          px: 1.5,
          py: 1,
          borderBottom: '1px solid var(--border)',
        }}
      >
        <Typography sx={{ flexGrow: 1, fontWeight: 600, fontSize: 14 }}>#{channel.name}</Typography>
        <IconButton size="small" aria-label="閉じる" onClick={onClose}>
          <CloseIcon fontSize="small" />
        </IconButton>
      </Box>

      <Tabs
        value={tab}
        onChange={(_, v: TabKey) => setTab(v)}
        variant="fullWidth"
        sx={{ minHeight: 36, borderBottom: '1px solid var(--border)' }}
      >
        <Tab value="summary" label="概要" sx={{ minHeight: 36, fontSize: 13 }} />
        <Tab value="pins" label="ピン留め" sx={{ minHeight: 36, fontSize: 13 }} />
        <Tab value="members" label="メンバー" sx={{ minHeight: 36, fontSize: 13 }} />
      </Tabs>

      <Box sx={{ flex: 1, overflow: 'auto', p: 1.5, minHeight: 0 }}>
        {tab === 'summary' && (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            {channel.topic && <Typography variant="body2">{channel.topic}</Typography>}
            {channel.description && (
              <Typography variant="body2" color="text.secondary">
                {channel.description}
              </Typography>
            )}
            <ChannelTopicBar
              channel={channel}
              currentUserId={currentUserId}
              userRole={userRole}
              onTopicUpdated={onTopicUpdated}
            />
          </Box>
        )}

        {tab === 'pins' && (
          <PinnedMessages
            channelId={channel.id}
            currentUserId={currentUserId}
            refreshKey={pinRefreshKey}
            onUnpin={onUnpin}
          />
        )}

        {tab === 'members' && membersPromise && (
          <Suspense
            fallback={
              <Box sx={{ display: 'flex', justifyContent: 'center', p: 2 }}>
                <CircularProgress size={20} />
              </Box>
            }
          >
            <MembersContent membersPromise={membersPromise} channelId={channel.id} />
          </Suspense>
        )}
      </Box>
    </Box>
  );
}
