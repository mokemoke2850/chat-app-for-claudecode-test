import { use, useMemo, useState, Suspense } from 'react';
import { Box, CircularProgress, IconButton, Tab, Tabs, Typography } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import type { CalendarEvent, Channel } from '@chat-app/shared';
import ChannelSettingsForm from './ChannelSettingsForm';
import PinnedMessages from './PinnedMessages';
import { MembersContent, type MembersData } from './ChannelMembersDialog';
import { ChannelFilesTab } from '../../pages/FilesPage';
import { api } from '../../api/client';

type TabKey = 'summary' | 'pins' | 'members' | 'files' | 'events';

interface Props {
  channel: Channel;
  currentUserId: number;
  userRole: string;
  onClose: () => void;
  onTopicUpdated: (channel: Channel) => void;
  pinRefreshKey?: number;
  onUnpin: (messageId: number) => void;
}

function formatStartsAt(startsAt: string): string {
  const d = new Date(startsAt);
  if (isNaN(d.getTime())) return startsAt;
  return d.toLocaleString([], {
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function ChannelEventsList({ promise }: { promise: Promise<{ events: CalendarEvent[] }> }) {
  const { events } = use(promise);
  if (events.length === 0) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', p: 2 }}>
        <Typography variant="body2" color="text.secondary">
          予定はありません
        </Typography>
      </Box>
    );
  }
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
      {events.map((event) => (
        <Box
          key={event.id}
          sx={{
            display: 'flex',
            flexDirection: 'column',
            gap: 0.25,
            p: 1,
            border: '1px solid var(--border)',
            borderRadius: 1,
            background: 'var(--surface)',
          }}
        >
          <Typography variant="body2" fontWeight={600}>
            {event.title}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            📅 {formatStartsAt(event.startsAt)}
          </Typography>
          {event.location && (
            <Typography variant="caption" color="text.secondary">
              📍 {event.location}
            </Typography>
          )}
          {event.attendees.length > 0 && (
            <Typography variant="caption" color="text.secondary">
              👥 {event.attendees.length}人参加
            </Typography>
          )}
        </Box>
      ))}
    </Box>
  );
}

/**
 * チャンネル右側 320px の折り畳み可能ペイン。
 *
 * 概要 / ピン留め / ファイル / 予定 / メンバー の 5 タブを集約。
 * 開閉状態の永続化は呼び出し元 (ChatPage) で `localStorage["contextRail.open"]` に保存する。
 *
 * - Step 5a: 概要 / ピン留め / メンバーの 3 タブを集約。
 * - Step 5b: ファイル / 予定タブを追加（予定タブは「準備中」プレースホルダ）。
 * - Step 5c-1: 概要タブの編集系を ChannelSettingsForm に切り出し / 予定タブを実機データ化
 *   （`api.calendar.events.list({ channelIds: [channel.id] })` で CalendarEvent[] を取得）。
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

  // 予定タブが選択されている間だけ Promise を生成して ChannelEventsList に渡す
  const eventsPromise = useMemo<Promise<{ events: CalendarEvent[] }> | null>(() => {
    if (tab !== 'events') return null;
    return api.calendar.events.list({ channelIds: [channel.id] });
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
        <Tab value="files" label="ファイル" sx={{ minHeight: 36, fontSize: 13 }} />
        <Tab value="events" label="予定" sx={{ minHeight: 36, fontSize: 13 }} />
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
            <ChannelSettingsForm
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

        {tab === 'files' && (
          <Suspense
            fallback={
              <Box sx={{ display: 'flex', justifyContent: 'center', p: 2 }}>
                <CircularProgress size={20} />
              </Box>
            }
          >
            <ChannelFilesTab channelId={channel.id} />
          </Suspense>
        )}

        {tab === 'events' && eventsPromise && (
          <Suspense
            fallback={
              <Box sx={{ display: 'flex', justifyContent: 'center', p: 2 }}>
                <CircularProgress size={20} />
              </Box>
            }
          >
            <ChannelEventsList promise={eventsPromise} />
          </Suspense>
        )}

        {tab === 'members' && membersPromise && (
          <Suspense
            fallback={
              <Box sx={{ display: 'flex', justifyContent: 'center', p: 2 }}>
                <CircularProgress size={20} />
              </Box>
            }
          >
            <MembersContent
              membersPromise={membersPromise}
              channelId={channel.id}
              currentUserId={currentUserId}
            />
          </Suspense>
        )}
      </Box>
    </Box>
  );
}
