import { use, useState, Suspense, useEffect } from 'react';
import {
  Box,
  CircularProgress,
  Divider,
  IconButton,
  List,
  Tooltip,
  Typography,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import type { Channel, Message } from '@chat-app/shared';
import { api } from '../../api/client';
import { useSocket } from '../../contexts/SocketContext';
import { useAuth } from '../../contexts/AuthContext';
import { useSnackbar } from '../../contexts/SnackbarContext';
import CreateChannelDialog from './CreateChannelDialog';
import ChannelMembersDialog from './ChannelMembersDialog';
import ChannelSearchBox from './ChannelSearchBox';
import ChannelItem from './ChannelItem';
import DmNavigationItems from './DmNavigationItems';

const PINS_STORAGE_KEY_PREFIX = 'channel_pins';

/**
 * React 19 の concurrent モードではコミット前に同じコンポーネントが複数回インスタンス化される
 * 場合があり、useState イニシャライザが多重実行されると API が多重発行される。
 * モジュールレベルキャッシュで 1 回しかフェッチしないようにする。
 */
let _channelsPromise: Promise<{ channels: Channel[] }> | null = null;

function getOrCreateChannelsPromise(): Promise<{ channels: Channel[] }> {
  if (!_channelsPromise) {
    _channelsPromise = api.channels.list();
  }
  return _channelsPromise;
}

/** テスト用: モジュールレベルのチャンネルキャッシュをリセットする */
export function resetChannelsCache(): void {
  _channelsPromise = null;
}

/** @deprecated テスト用エイリアス。resetChannelsCache() を使うこと */
export const _resetChannelsPromiseForTest = resetChannelsCache;

interface Props {
  activeChannelId: number | null;
  onSelect: (id: number, name: string, channel?: Channel) => void;
}

function getPinsKey(userId: number): string {
  return `${PINS_STORAGE_KEY_PREFIX}_${userId}`;
}

function loadPins(userId: number): number[] {
  try {
    return JSON.parse(localStorage.getItem(getPinsKey(userId)) ?? '[]') as number[];
  } catch {
    return [];
  }
}

function savePins(userId: number, pins: number[]): void {
  localStorage.setItem(getPinsKey(userId), JSON.stringify(pins));
}

interface ChannelListContentProps {
  channelsPromise: Promise<{ channels: Channel[] }>;
  activeChannelId: number | null;
  onSelect: (id: number, name: string, channel?: Channel) => void;
}

function ChannelListContent({
  channelsPromise,
  activeChannelId,
  onSelect,
}: ChannelListContentProps) {
  const { channels: initialChannels } = use(channelsPromise);
  const [channels, setChannels] = useState<Channel[]>(initialChannels);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [membersDialogChannel, setMembersDialogChannel] = useState<Channel | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const socket = useSocket();
  const { user } = useAuth();
  const { showSuccess, showError } = useSnackbar();
  const [pinnedIds, setPinnedIds] = useState<number[]>(() => loadPins(user?.id ?? 0));
  const [hoveredId, setHoveredId] = useState<number | null>(null);
  const [dmUnreadCount, setDmUnreadCount] = useState(0);

  // 非アクティブチャンネルの new_message を受信して unreadCount をインクリメント
  useEffect(() => {
    if (!socket) return;

    const handleNewMessage = (message: Message) => {
      if (message.channelId === activeChannelId) return;
      setChannels((prev) =>
        prev.map((ch) =>
          ch.id === message.channelId ? { ...ch, unreadCount: ch.unreadCount + 1 } : ch,
        ),
      );
    };

    socket.on('new_message', handleNewMessage);
    return () => {
      socket.off('new_message', handleNewMessage);
    };
  }, [socket, activeChannelId]);

  // mention_updated を受信して mentionCount を更新
  useEffect(() => {
    if (!socket) return;

    const handleMentionUpdated = (data: { channelId: number; mentionCount: number }) => {
      setChannels((prev) =>
        prev.map((ch) =>
          ch.id === data.channelId ? { ...ch, mentionCount: data.mentionCount } : ch,
        ),
      );
    };

    socket.on('mention_updated', handleMentionUpdated);
    return () => {
      socket.off('mention_updated', handleMentionUpdated);
    };
  }, [socket]);

  const handleSelect = (channelId: number) => {
    // 即時リセット（API レスポンス待ちなし）
    setChannels((prev) =>
      prev.map((ch) => (ch.id === channelId ? { ...ch, unreadCount: 0, mentionCount: 0 } : ch)),
    );
    void api.channels.read(channelId);
    const channel = channels.find((ch) => ch.id === channelId);
    const name = channel?.name ?? '';
    onSelect(channelId, name, channel);
  };

  const handleCreate = (channel: Channel) => {
    setChannels((prev) => [...prev, channel].sort((a, b) => a.name.localeCompare(b.name)));
    onSelect(channel.id, channel.name, channel);
  };

  const handlePin = (channelId: number) => {
    setPinnedIds((prev) => {
      const next = [...prev, channelId];
      savePins(user?.id ?? 0, next);
      return next;
    });
  };

  const handleUnpin = (channelId: number) => {
    setPinnedIds((prev) => {
      const next = prev.filter((id) => id !== channelId);
      savePins(user?.id ?? 0, next);
      return next;
    });
  };

  const handleArchive = async (channelId: number) => {
    const channel = channels.find((ch) => ch.id === channelId);
    try {
      await api.channels.archive(channelId);
      setChannels((prev) => prev.filter((ch) => ch.id !== channelId));
      showSuccess(`#${channel?.name ?? ''} をアーカイブしました`);
    } catch (err) {
      showError(err instanceof Error ? err.message : 'アーカイブに失敗しました');
    }
  };

  const filteredChannels = searchQuery
    ? channels.filter((ch) => ch.name.toLowerCase().includes(searchQuery.toLowerCase()))
    : channels;

  const pinnedChannels = filteredChannels.filter((ch) => pinnedIds.includes(ch.id));
  const unpinnedChannels = filteredChannels.filter((ch) => !pinnedIds.includes(ch.id));

  return (
    <Box sx={{ overflow: 'auto', height: '100%' }}>
      <Box sx={{ display: 'flex', alignItems: 'center', px: 2, py: 1 }}>
        <Typography
          variant="subtitle2"
          sx={{ flexGrow: 1, fontWeight: 'bold', textTransform: 'uppercase', fontSize: 11 }}
        >
          Channels
        </Typography>
        <Tooltip title="Create channel">
          <IconButton size="small" onClick={() => setDialogOpen(true)}>
            <AddIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      </Box>

      <ChannelSearchBox value={searchQuery} onChange={setSearchQuery} />

      <Divider />

      {/* ピン留めセクション */}
      {pinnedChannels.length > 0 && (
        <Box data-testid="pinned-channels">
          <Typography
            variant="caption"
            sx={{
              px: 2,
              pt: 1,
              pb: 0.5,
              display: 'block',
              color: 'text.secondary',
              fontWeight: 'bold',
              textTransform: 'uppercase',
              fontSize: 10,
            }}
          >
            ピン留め
          </Typography>
          <List dense disablePadding>
            {pinnedChannels.map((ch) => (
              <ChannelItem
                key={ch.id}
                channel={ch}
                isActive={ch.id === activeChannelId}
                isPinned={true}
                isHovered={hoveredId === ch.id}
                onMouseEnter={() => setHoveredId(ch.id)}
                onMouseLeave={() => setHoveredId(null)}
                onClick={() => handleSelect(ch.id)}
                onPin={handlePin}
                onUnpin={handleUnpin}
                onOpenMembersDialog={setMembersDialogChannel}
                onArchive={(id) => void handleArchive(id)}
                currentUserId={user?.id}
                userRole={user?.role}
              />
            ))}
          </List>
          <Divider />
        </Box>
      )}

      {/* 通常チャンネルセクション */}
      <Box data-testid="all-channels">
        <List dense disablePadding>
          {unpinnedChannels.map((ch) => (
            <ChannelItem
              key={ch.id}
              channel={ch}
              isActive={ch.id === activeChannelId}
              isPinned={false}
              isHovered={hoveredId === ch.id}
              onMouseEnter={() => setHoveredId(ch.id)}
              onMouseLeave={() => setHoveredId(null)}
              onClick={() => handleSelect(ch.id)}
              onPin={handlePin}
              onUnpin={handleUnpin}
              onOpenMembersDialog={setMembersDialogChannel}
              onArchive={(id) => void handleArchive(id)}
              currentUserId={user?.id}
              userRole={user?.role}
            />
          ))}
        </List>
      </Box>

      <DmNavigationItems
        dmUnreadCount={dmUnreadCount}
        onDmUnreadCountChange={setDmUnreadCount}
      />

      <CreateChannelDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        onCreate={handleCreate}
      />

      {membersDialogChannel && (
        <ChannelMembersDialog
          open={true}
          channelId={membersDialogChannel.id}
          onClose={() => setMembersDialogChannel(null)}
        />
      )}
    </Box>
  );
}

export default function ChannelList({ activeChannelId, onSelect }: Props) {
  const [channelsPromise] = useState(() => getOrCreateChannelsPromise());

  return (
    <Suspense
      fallback={
        <Box sx={{ display: 'flex', justifyContent: 'center', pt: 4 }}>
          <CircularProgress size={24} />
        </Box>
      }
    >
      <ChannelListContent
        channelsPromise={channelsPromise}
        activeChannelId={activeChannelId}
        onSelect={onSelect}
      />
    </Suspense>
  );
}
