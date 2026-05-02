import { use, useState, useEffect, Suspense } from 'react';
import {
  Avatar,
  Badge,
  Box,
  CircularProgress,
  IconButton,
  List,
  ListItem,
  ListItemAvatar,
  ListItemButton,
  ListItemText,
  Tooltip,
  Typography,
} from '@mui/material';
import AddCommentIcon from '@mui/icons-material/AddComment';
import { useNavigate } from 'react-router-dom';
import type { DmConversationWithDetails, DmMessage } from '@chat-app/shared';
import { api } from '../../api/client';
import { useSocket } from '../../contexts/SocketContext';

/**
 * Sidebar 列下部に積む DM 会話一覧ブロック (Step 3c)。
 * - api.dm.listConversations を Suspense で取得
 * - Socket new_dm_message で lastMessage / unreadCount をリアルタイム更新
 * - 行クリックで /dm?conv=N に遷移、新規 DM ボタンで /dm に遷移
 */

let _conversationsPromise: Promise<{ conversations: DmConversationWithDetails[] }> | null = null;

function getOrCreatePromise(): Promise<{ conversations: DmConversationWithDetails[] }> {
  if (!_conversationsPromise) {
    _conversationsPromise = api.dm.listConversations();
  }
  return _conversationsPromise;
}

/** テスト用キャッシュリセット */
export function resetSidebarDmListCache(): void {
  _conversationsPromise = null;
}

function SidebarDmListContent({
  conversationsPromise,
}: {
  conversationsPromise: Promise<{ conversations: DmConversationWithDetails[] }>;
}) {
  const { conversations: initial } = use(conversationsPromise);
  const [conversations, setConversations] = useState<DmConversationWithDetails[]>(initial);
  const navigate = useNavigate();
  const socket = useSocket();

  useEffect(() => {
    if (!socket) return;
    const handler = (msg: DmMessage) => {
      setConversations((prev) =>
        prev.map((c) =>
          c.id === msg.conversationId
            ? {
                ...c,
                lastMessage: {
                  content: msg.content,
                  createdAt: msg.createdAt,
                  senderId: msg.senderId,
                },
                updatedAt: msg.createdAt,
                // 相手 (otherUser) からのメッセージのみ未読数を加算
                // (自分自身が送ったメッセージは relayed back されても加算しない)
                unreadCount: msg.senderId === c.otherUser.id ? c.unreadCount + 1 : c.unreadCount,
              }
            : c,
        ),
      );
    };
    socket.on('new_dm_message', handler);
    return () => {
      socket.off('new_dm_message', handler);
    };
  }, [socket]);

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        minHeight: 0,
        background: 'var(--surface)',
      }}
    >
      <Box
        sx={{
          px: 1,
          py: 0.5,
          display: 'flex',
          alignItems: 'center',
          borderTop: '1px solid var(--border)',
        }}
      >
        <Typography
          variant="caption"
          sx={{
            flexGrow: 1,
            fontWeight: 'bold',
            textTransform: 'uppercase',
            color: 'text.secondary',
            fontSize: 10,
            letterSpacing: '0.05em',
          }}
        >
          DM
        </Typography>
        <Tooltip title="新規 DM">
          <IconButton size="small" aria-label="新規 DM" onClick={() => navigate('/dm')}>
            <AddCommentIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      </Box>

      <Box sx={{ overflowY: 'auto', maxHeight: 240, minHeight: 0 }}>
        {conversations.length === 0 ? (
          <Box sx={{ px: 2, py: 1.5, textAlign: 'center', color: 'text.secondary' }}>
            <Typography variant="caption">DM会話がありません</Typography>
          </Box>
        ) : (
          <List dense disablePadding>
            {conversations.map((conv) => (
              <ListItem key={conv.id} disablePadding>
                <ListItemButton
                  onClick={() => navigate(`/dm?conv=${conv.id}`)}
                  style={{ minHeight: 28, paddingTop: 0, paddingBottom: 0 }}
                >
                  <ListItemAvatar sx={{ minWidth: 32 }}>
                    <Badge
                      badgeContent={conv.unreadCount > 0 ? conv.unreadCount : undefined}
                      color="error"
                      max={9}
                    >
                      <Avatar
                        src={conv.otherUser.avatarUrl ?? undefined}
                        sx={{ width: 24, height: 24, fontSize: 12 }}
                      >
                        {conv.otherUser.username[0]?.toUpperCase()}
                      </Avatar>
                    </Badge>
                  </ListItemAvatar>
                  <ListItemText
                    primary={
                      <Typography
                        variant="body2"
                        noWrap
                        style={{ fontWeight: conv.unreadCount > 0 ? 'bold' : 'normal' }}
                      >
                        {conv.otherUser.displayName ?? conv.otherUser.username}
                      </Typography>
                    }
                  />
                </ListItemButton>
              </ListItem>
            ))}
          </List>
        )}
      </Box>
    </Box>
  );
}

export default function SidebarDmList() {
  const [conversationsPromise] = useState(() => getOrCreatePromise());
  return (
    <Suspense
      fallback={
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 2 }}>
          <CircularProgress size={20} />
        </Box>
      }
    >
      <SidebarDmListContent conversationsPromise={conversationsPromise} />
    </Suspense>
  );
}
