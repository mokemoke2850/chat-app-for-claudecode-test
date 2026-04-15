import { use, useState, useEffect, useRef, Suspense, useMemo } from 'react';
import {
  Box,
  Typography,
  List,
  ListItem,
  ListItemButton,
  ListItemAvatar,
  ListItemText,
  Avatar,
  Badge,
  CircularProgress,
  AppBar,
  Toolbar,
  IconButton,
  Tooltip,
  TextField,
  Paper,
  Dialog,
  DialogTitle,
  DialogContent,
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import ChatIcon from '@mui/icons-material/Chat';
import SendIcon from '@mui/icons-material/Send';
import AddCommentIcon from '@mui/icons-material/AddComment';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import { useSocket } from '../contexts/SocketContext';
import { useAuth } from '../contexts/AuthContext';
import type { DmConversationWithDetails, DmMessage, User } from '@chat-app/shared';

// ---------------------------------------------------------------------------
// Promise キャッシュ（React 19 concurrent モード多重初期化対策）
// ---------------------------------------------------------------------------

let _conversationsPromise: Promise<{ conversations: DmConversationWithDetails[] }> | null = null;

export function resetDmConversationsCache(): void {
  _conversationsPromise = null;
}

function getOrCreateConversationsPromise(): Promise<{
  conversations: DmConversationWithDetails[];
}> {
  if (!_conversationsPromise) {
    _conversationsPromise = api.dm.listConversations();
  }
  return _conversationsPromise;
}

// ---------------------------------------------------------------------------
// ユーティリティ
// ---------------------------------------------------------------------------

function formatTime(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' });
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleString('ja-JP', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

// ---------------------------------------------------------------------------
// メッセージエリア
// ---------------------------------------------------------------------------

interface MessageAreaProps {
  conversation: DmConversationWithDetails;
  currentUserId: number;
  onSend: (content: string) => void;
  messages: DmMessage[];
  typingUserId: number | null;
}

function MessageArea({
  conversation,
  currentUserId,
  onSend,
  messages,
  typingUserId,
}: MessageAreaProps) {
  const [input, setInput] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);
  const socket = useSocket();

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  const handleSend = () => {
    const trimmed = input.trim();
    if (!trimmed) return;
    onSend(trimmed);
    setInput('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInput(e.target.value);
    if (socket) {
      socket.emit('dm_typing_start', conversation.id);
    }
  };

  const handleBlur = () => {
    if (socket) {
      socket.emit('dm_typing_stop', conversation.id);
    }
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* ヘッダー */}
      <Box
        sx={{
          px: 2,
          py: 1.5,
          borderBottom: 1,
          borderColor: 'divider',
          display: 'flex',
          alignItems: 'center',
          gap: 1,
        }}
      >
        <Avatar src={conversation.otherUser.avatarUrl ?? undefined} sx={{ width: 32, height: 32 }}>
          {conversation.otherUser.username[0].toUpperCase()}
        </Avatar>
        <Typography variant="subtitle1" fontWeight="bold">
          {conversation.otherUser.displayName ?? conversation.otherUser.username}
        </Typography>
      </Box>

      {/* メッセージ一覧 */}
      <Box sx={{ flexGrow: 1, overflowY: 'auto', p: 2 }}>
        {messages.map((msg) => {
          const isMine = msg.senderId === currentUserId;
          return (
            <Box
              key={msg.id}
              sx={{
                display: 'flex',
                flexDirection: isMine ? 'row-reverse' : 'row',
                alignItems: 'flex-end',
                gap: 1,
                mb: 1,
              }}
            >
              {!isMine && (
                <Avatar src={msg.senderAvatarUrl ?? undefined} sx={{ width: 28, height: 28 }}>
                  {msg.senderUsername[0].toUpperCase()}
                </Avatar>
              )}
              <Box
                sx={{
                  maxWidth: '70%',
                  bgcolor: isMine ? 'primary.main' : 'grey.100',
                  color: isMine ? 'primary.contrastText' : 'text.primary',
                  borderRadius: 2,
                  px: 1.5,
                  py: 1,
                }}
              >
                <Typography
                  variant="body2"
                  sx={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}
                >
                  {msg.content}
                </Typography>
                <Typography
                  variant="caption"
                  sx={{
                    display: 'block',
                    textAlign: isMine ? 'right' : 'left',
                    opacity: 0.7,
                    mt: 0.25,
                  }}
                >
                  {formatTime(msg.createdAt)}
                </Typography>
              </Box>
            </Box>
          );
        })}
        {typingUserId !== null && typingUserId !== currentUserId && (
          <Typography variant="caption" color="text.secondary" sx={{ ml: 1 }}>
            {conversation.otherUser.username} が入力中...
          </Typography>
        )}
        <div ref={bottomRef} />
      </Box>

      {/* 送信フォーム */}
      <Box sx={{ p: 1.5, borderTop: 1, borderColor: 'divider', display: 'flex', gap: 1 }}>
        <TextField
          fullWidth
          size="small"
          multiline
          maxRows={4}
          placeholder={`${conversation.otherUser.displayName ?? conversation.otherUser.username} にメッセージを送信`}
          value={input}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          onBlur={handleBlur}
          inputProps={{ 'aria-label': 'DM入力' }}
        />
        <IconButton color="primary" onClick={handleSend} disabled={!input.trim()} aria-label="送信">
          <SendIcon />
        </IconButton>
      </Box>
    </Box>
  );
}

// ---------------------------------------------------------------------------
// 新規DM開始ダイアログ
// ---------------------------------------------------------------------------

interface NewDmDialogProps {
  open: boolean;
  users: User[];
  currentUserId: number;
  onClose: () => void;
  onSelect: (userId: number) => void;
}

function NewDmDialog({ open, users, currentUserId, onClose, onSelect }: NewDmDialogProps) {
  const others = users.filter((u) => u.id !== currentUserId);

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle>新規ダイレクトメッセージ</DialogTitle>
      <DialogContent dividers sx={{ p: 0 }}>
        <List disablePadding>
          {others.map((u) => (
            <ListItemButton
              key={u.id}
              onClick={() => {
                onSelect(u.id);
                onClose();
              }}
            >
              <ListItemAvatar>
                <Avatar src={u.avatarUrl ?? undefined} sx={{ width: 32, height: 32 }}>
                  {u.username[0].toUpperCase()}
                </Avatar>
              </ListItemAvatar>
              <ListItemText
                primary={u.displayName ?? u.username}
                secondary={u.displayName ? `@${u.username}` : undefined}
              />
            </ListItemButton>
          ))}
          {others.length === 0 && (
            <Typography variant="body2" color="text.secondary" sx={{ p: 2, textAlign: 'center' }}>
              他のユーザーがいません
            </Typography>
          )}
        </List>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// DMリストとメッセージの内側コンポーネント（Suspense内）
// ---------------------------------------------------------------------------

interface DMPageContentProps {
  conversationsPromise: Promise<{ conversations: DmConversationWithDetails[] }>;
  users: User[];
  currentUserId: number;
}

function DMPageContent({ conversationsPromise, users, currentUserId }: DMPageContentProps) {
  const { conversations: initial } = use(conversationsPromise);
  const [conversations, setConversations] = useState<DmConversationWithDetails[]>(initial);
  const [activeConvId, setActiveConvId] = useState<number | null>(null);
  const [messages, setMessages] = useState<DmMessage[]>([]);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [typingUserId, setTypingUserId] = useState<number | null>(null);
  const [newDmOpen, setNewDmOpen] = useState(false);
  const socket = useSocket();

  const activeConversation = useMemo(
    () => conversations.find((c) => c.id === activeConvId) ?? null,
    [conversations, activeConvId],
  );

  // 会話を選択してメッセージを取得
  const handleSelectConversation = async (convId: number) => {
    setActiveConvId(convId);
    setLoadingMessages(true);
    try {
      const { messages: msgs } = await api.dm.getMessages(convId);
      setMessages(msgs);
      await api.dm.markAsRead(convId);
      // 既読後に未読数をリセット
      setConversations((prev) => prev.map((c) => (c.id === convId ? { ...c, unreadCount: 0 } : c)));
    } finally {
      setLoadingMessages(false);
    }
  };

  // Socket.IO イベント
  useEffect(() => {
    if (!socket) return;

    const handleNewDmMessage = (msg: DmMessage) => {
      // アクティブ会話のメッセージ追加
      if (msg.conversationId === activeConvId) {
        setMessages((prev) => [...prev, msg]);
        // 自分の受信メッセージは自動既読
        if (msg.senderId !== currentUserId) {
          void api.dm.markAsRead(msg.conversationId);
        }
      } else if (msg.senderId !== currentUserId) {
        // 非アクティブ会話の未読数更新
        setConversations((prev) =>
          prev.map((c) =>
            c.id === msg.conversationId ? { ...c, unreadCount: c.unreadCount + 1 } : c,
          ),
        );
      }
      // 会話一覧の最新メッセージを更新
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
              }
            : c,
        ),
      );
    };

    const handleDmTyping = (data: { conversationId: number; userId: number }) => {
      if (data.conversationId === activeConvId) {
        setTypingUserId(data.userId);
      }
    };

    const handleDmStoppedTyping = (data: { conversationId: number; userId: number }) => {
      if (data.conversationId === activeConvId) {
        setTypingUserId(null);
      }
    };

    socket.on('new_dm_message', handleNewDmMessage);
    socket.on('dm_user_typing', handleDmTyping);
    socket.on('dm_user_stopped_typing', handleDmStoppedTyping);

    return () => {
      socket.off('new_dm_message', handleNewDmMessage);
      socket.off('dm_user_typing', handleDmTyping);
      socket.off('dm_user_stopped_typing', handleDmStoppedTyping);
    };
  }, [socket, activeConvId, currentUserId]);

  const handleSend = (content: string) => {
    if (!activeConvId || !socket) return;
    socket.emit('send_dm', { conversationId: activeConvId, content });
  };

  // 新規DM開始
  const handleStartDm = async (targetUserId: number) => {
    const { conversation } = await api.dm.createConversation(targetUserId);
    // 既存会話でなければ一覧に追加
    setConversations((prev) => {
      if (prev.some((c) => c.id === conversation.id)) return prev;
      return [conversation, ...prev];
    });
    void handleSelectConversation(conversation.id);
  };

  return (
    <Box sx={{ display: 'flex', height: '100%', overflow: 'hidden' }}>
      {/* DM会話一覧サイドバー */}
      <Box
        sx={{
          width: 280,
          flexShrink: 0,
          borderRight: 1,
          borderColor: 'divider',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        <Box
          sx={{
            px: 2,
            py: 1.5,
            display: 'flex',
            alignItems: 'center',
            borderBottom: 1,
            borderColor: 'divider',
          }}
        >
          <Typography variant="subtitle1" fontWeight="bold" sx={{ flexGrow: 1 }}>
            ダイレクトメッセージ
          </Typography>
          <Tooltip title="新規DM">
            <IconButton size="small" onClick={() => setNewDmOpen(true)} aria-label="新規DM">
              <AddCommentIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </Box>

        <Box sx={{ flexGrow: 1, overflowY: 'auto' }}>
          {conversations.length === 0 ? (
            <Box sx={{ p: 2, textAlign: 'center', color: 'text.secondary' }}>
              <Typography variant="body2">DM会話がありません</Typography>
              <Typography variant="caption">上のボタンから開始しましょう</Typography>
            </Box>
          ) : (
            <List disablePadding>
              {conversations.map((conv) => (
                <ListItem key={conv.id} disablePadding>
                  <ListItemButton
                    selected={conv.id === activeConvId}
                    onClick={() => void handleSelectConversation(conv.id)}
                  >
                    <ListItemAvatar sx={{ minWidth: 40 }}>
                      <Badge
                        badgeContent={conv.unreadCount > 0 ? conv.unreadCount : undefined}
                        color="error"
                        max={9}
                      >
                        <Avatar
                          src={conv.otherUser.avatarUrl ?? undefined}
                          sx={{ width: 32, height: 32 }}
                        >
                          {conv.otherUser.username[0].toUpperCase()}
                        </Avatar>
                      </Badge>
                    </ListItemAvatar>
                    <ListItemText
                      primary={
                        <Typography
                          variant="body2"
                          fontWeight={conv.unreadCount > 0 ? 'bold' : 'normal'}
                          noWrap
                        >
                          {conv.otherUser.displayName ?? conv.otherUser.username}
                        </Typography>
                      }
                      secondary={
                        conv.lastMessage ? (
                          <Typography variant="caption" noWrap color="text.secondary">
                            {conv.lastMessage.content}
                          </Typography>
                        ) : undefined
                      }
                    />
                    {conv.lastMessage && (
                      <Typography
                        variant="caption"
                        color="text.secondary"
                        sx={{ ml: 0.5, flexShrink: 0 }}
                      >
                        {formatDate(conv.lastMessage.createdAt)}
                      </Typography>
                    )}
                  </ListItemButton>
                </ListItem>
              ))}
            </List>
          )}
        </Box>
      </Box>

      {/* メッセージエリア */}
      <Box sx={{ flexGrow: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {activeConversation ? (
          loadingMessages ? (
            <Box
              sx={{
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                height: '100%',
              }}
            >
              <CircularProgress />
            </Box>
          ) : (
            <MessageArea
              conversation={activeConversation}
              currentUserId={currentUserId}
              onSend={handleSend}
              messages={messages}
              typingUserId={typingUserId}
            />
          )
        ) : (
          <Box
            sx={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              height: '100%',
              color: 'text.secondary',
              gap: 1,
            }}
          >
            <ChatIcon sx={{ fontSize: 64, opacity: 0.3 }} />
            <Typography variant="h6">会話を選択してください</Typography>
            <Typography variant="body2">
              左のリストから相手を選ぶか、新規DMを開始しましょう
            </Typography>
          </Box>
        )}
      </Box>

      <NewDmDialog
        open={newDmOpen}
        users={users}
        currentUserId={currentUserId}
        onClose={() => setNewDmOpen(false)}
        onSelect={(uid) => void handleStartDm(uid)}
      />
    </Box>
  );
}

// ---------------------------------------------------------------------------
// ページ外側（Suspense境界の外）
// ---------------------------------------------------------------------------

interface DMPageInnerProps {
  users: User[];
  currentUserId: number;
}

function DMPageInner({ users, currentUserId }: DMPageInnerProps) {
  const [conversationsPromise] = useState(() => getOrCreateConversationsPromise());
  const navigate = useNavigate();

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
      <AppBar position="static">
        <Toolbar>
          <Tooltip title="戻る">
            <IconButton color="inherit" edge="start" onClick={() => navigate(-1)} sx={{ mr: 1 }}>
              <ArrowBackIcon />
            </IconButton>
          </Tooltip>
          <ChatIcon sx={{ mr: 1 }} />
          <Typography variant="h6">ダイレクトメッセージ</Typography>
        </Toolbar>
      </AppBar>

      <Box sx={{ flexGrow: 1, overflow: 'hidden' }}>
        <Paper elevation={0} sx={{ height: '100%' }}>
          <Suspense
            fallback={
              <Box
                sx={{
                  display: 'flex',
                  justifyContent: 'center',
                  alignItems: 'center',
                  height: '100%',
                }}
              >
                <CircularProgress />
              </Box>
            }
          >
            <DMPageContent
              conversationsPromise={conversationsPromise}
              users={users}
              currentUserId={currentUserId}
            />
          </Suspense>
        </Paper>
      </Box>
    </Box>
  );
}

// ---------------------------------------------------------------------------
// エクスポート
// ---------------------------------------------------------------------------

interface DMPageProps {
  users: User[];
}

export default function DMPage({ users }: DMPageProps) {
  const { user } = useAuth();

  if (!user) return null;

  return (
    <Suspense
      fallback={
        <Box
          sx={{ display: 'flex', height: '100vh', alignItems: 'center', justifyContent: 'center' }}
        >
          <CircularProgress />
        </Box>
      }
    >
      <DMPageInner users={users} currentUserId={user.id} />
    </Suspense>
  );
}
