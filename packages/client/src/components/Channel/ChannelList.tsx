import { use, useState, Suspense, useEffect } from 'react';
import {
  Badge,
  Box,
  CircularProgress,
  Divider,
  IconButton,
  InputBase,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  Tooltip,
  Typography,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import SearchIcon from '@mui/icons-material/Search';
import PushPinIcon from '@mui/icons-material/PushPin';
import PushPinOutlinedIcon from '@mui/icons-material/PushPinOutlined';
import LockIcon from '@mui/icons-material/Lock';
import GroupAddIcon from '@mui/icons-material/GroupAdd';
import type { Channel, Message } from '@chat-app/shared';
import { api } from '../../api/client';
import { useSocket } from '../../contexts/SocketContext';
import CreateChannelDialog from './CreateChannelDialog';
import ChannelMembersDialog from './ChannelMembersDialog';

const PINS_STORAGE_KEY = 'channel_pins';

interface Props {
  activeChannelId: number | null;
  onSelect: (id: number) => void;
}

function loadPins(): number[] {
  try {
    return JSON.parse(localStorage.getItem(PINS_STORAGE_KEY) ?? '[]') as number[];
  } catch {
    return [];
  }
}

function savePins(pins: number[]): void {
  localStorage.setItem(PINS_STORAGE_KEY, JSON.stringify(pins));
}

interface ChannelListContentProps extends Props {
  channelsPromise: Promise<{ channels: Channel[] }>;
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
  const [pinnedIds, setPinnedIds] = useState<number[]>(loadPins);
  const [hoveredId, setHoveredId] = useState<number | null>(null);
  const socket = useSocket();

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

  const handleSelect = (channelId: number) => {
    // 即時リセット（API レスポンス待ちなし）
    setChannels((prev) => prev.map((ch) => (ch.id === channelId ? { ...ch, unreadCount: 0 } : ch)));
    void api.channels.read(channelId);
    onSelect(channelId);
  };

  const handleCreate = (channel: Channel) => {
    setChannels((prev) => [...prev, channel].sort((a, b) => a.name.localeCompare(b.name)));
    onSelect(channel.id);
  };

  const handlePin = (channelId: number) => {
    setPinnedIds((prev) => {
      const next = [...prev, channelId];
      savePins(next);
      return next;
    });
  };

  const handleUnpin = (channelId: number) => {
    setPinnedIds((prev) => {
      const next = prev.filter((id) => id !== channelId);
      savePins(next);
      return next;
    });
  };

  const filteredChannels = searchQuery
    ? channels.filter((ch) => ch.name.toLowerCase().includes(searchQuery.toLowerCase()))
    : channels;

  const pinnedChannels = filteredChannels.filter((ch) => pinnedIds.includes(ch.id));
  const unpinnedChannels = filteredChannels.filter((ch) => !pinnedIds.includes(ch.id));

  const renderSecondaryAction = (ch: Channel, isPinned: boolean) => {
    if (hoveredId !== ch.id) return undefined;
    return (
      <Box sx={{ display: 'flex' }}>
        {ch.isPrivate && (
          <Tooltip title="メンバー管理">
            <IconButton
              size="small"
              aria-label="メンバー管理"
              onClick={(e) => {
                e.stopPropagation();
                setMembersDialogChannel(ch);
              }}
            >
              <GroupAddIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        )}
        {isPinned ? (
          <Tooltip title="ピン留めを解除">
            <IconButton
              size="small"
              edge="end"
              aria-label="ピン留めを解除"
              onClick={() => handleUnpin(ch.id)}
            >
              <PushPinIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        ) : (
          <Tooltip title="ピン留め">
            <IconButton
              size="small"
              edge="end"
              aria-label="ピン留め"
              onClick={() => handlePin(ch.id)}
            >
              <PushPinOutlinedIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        )}
      </Box>
    );
  };

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

      <Box sx={{ display: 'flex', alignItems: 'center', px: 1, pb: 1 }}>
        <SearchIcon sx={{ fontSize: 16, color: 'text.secondary', mr: 0.5 }} />
        <InputBase
          placeholder="Search channels"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          inputProps={{ 'aria-label': 'search channels' }}
          sx={{ fontSize: 13, flexGrow: 1 }}
        />
      </Box>

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
              <ListItem
                key={ch.id}
                disablePadding
                onMouseEnter={() => setHoveredId(ch.id)}
                onMouseLeave={() => setHoveredId(null)}
                secondaryAction={renderSecondaryAction(ch, true)}
              >
                <ListItemButton
                  selected={ch.id === activeChannelId}
                  onClick={() => handleSelect(ch.id)}
                >
                  {ch.isPrivate && (
                    <LockIcon
                      aria-label="private channel"
                      sx={{ fontSize: 12, mr: 0.5, color: 'text.secondary' }}
                    />
                  )}
                  <ListItemText
                    primary={`# ${ch.name}`}
                    primaryTypographyProps={{
                      fontSize: 14,
                      style: ch.unreadCount > 0 ? { fontWeight: 'bold' } : undefined,
                    }}
                  />
                  {ch.unreadCount > 0 && (
                    <Badge badgeContent={ch.unreadCount} color="primary" max={9} sx={{ ml: 1 }}>
                      <Box component="span" sx={{ display: 'inline-block', width: 8, height: 8 }} />
                    </Badge>
                  )}
                </ListItemButton>
              </ListItem>
            ))}
          </List>
          <Divider />
        </Box>
      )}

      {/* 通常チャンネルセクション */}
      <Box data-testid="all-channels">
        <List dense disablePadding>
          {unpinnedChannels.map((ch) => (
            <ListItem
              key={ch.id}
              disablePadding
              onMouseEnter={() => setHoveredId(ch.id)}
              onMouseLeave={() => setHoveredId(null)}
              secondaryAction={renderSecondaryAction(ch, false)}
            >
              <ListItemButton
                selected={ch.id === activeChannelId}
                onClick={() => handleSelect(ch.id)}
              >
                {ch.isPrivate && (
                  <LockIcon
                    aria-label="private channel"
                    sx={{ fontSize: 12, mr: 0.5, color: 'text.secondary' }}
                  />
                )}
                <ListItemText
                  primary={`# ${ch.name}`}
                  primaryTypographyProps={{
                    fontSize: 14,
                    style: ch.unreadCount > 0 ? { fontWeight: 'bold' } : undefined,
                  }}
                />
                {ch.unreadCount > 0 && (
                  <Badge badgeContent={ch.unreadCount} color="primary" max={9} sx={{ ml: 1 }}>
                    <Box component="span" sx={{ display: 'inline-block', width: 8, height: 8 }} />
                  </Badge>
                )}
              </ListItemButton>
            </ListItem>
          ))}
        </List>
      </Box>

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
  const [channelsPromise] = useState(() => api.channels.list());

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
