import { use, useState, useEffect, useMemo, Suspense } from 'react';
import { Box, Typography, CircularProgress, Paper } from '@mui/material';
import ChatIcon from '@mui/icons-material/Chat';
import { useSearchParams } from 'react-router-dom';
import AppLayout from '../components/Layout/AppLayout';
import { api } from '../api/client';
import { useSocket } from '../contexts/SocketContext';
import { useAuth } from '../contexts/AuthContext';
import { useSnackbar } from '../contexts/SnackbarContext';
import type {
  DmConversationWithDetails,
  DmMessage,
  User,
  RateLimitSocketError,
} from '@chat-app/shared';
import MessageArea from '../components/DM/MessageArea';
import NewDmDialog from '../components/DM/NewDmDialog';
import DmConversationList from '../components/DM/DmConversationList';

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
  const { showError } = useSnackbar();

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

  // URL ?conv=N で初期会話を選択 (SidebarDmList からの遷移用)
  const [searchParams] = useSearchParams();
  useEffect(() => {
    const conv = searchParams.get('conv');
    if (conv === null) return;
    const convId = Number(conv);
    if (!Number.isFinite(convId) || convId <= 0) return;
    if (activeConvId === convId) return;
    void handleSelectConversation(convId);
    // searchParams は依存に入れない（同一 URL なら一度だけ起動）
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // アクティブ会話のメッセージ追加・タイピングイベント処理
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
      }
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

    const handleError = (msg: string | RateLimitSocketError) => {
      if (typeof msg === 'object' && msg.type === 'rate_limit') {
        const text =
          msg.retryAfterSec !== undefined
            ? `${msg.message}（${msg.retryAfterSec}秒後に再試行できます）`
            : msg.message;
        showError(text);
      } else {
        showError(msg as string);
      }
    };

    socket.on('new_dm_message', handleNewDmMessage);
    socket.on('dm_user_typing', handleDmTyping);
    socket.on('dm_user_stopped_typing', handleDmStoppedTyping);
    socket.on('error', handleError);

    return () => {
      socket.off('new_dm_message', handleNewDmMessage);
      socket.off('dm_user_typing', handleDmTyping);
      socket.off('dm_user_stopped_typing', handleDmStoppedTyping);
      socket.off('error', handleError);
    };
  }, [socket, activeConvId, currentUserId, showError]);

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
      <DmConversationList
        conversations={conversations}
        activeConvId={activeConvId}
        currentUserId={currentUserId}
        onSelectConversation={(convId) => void handleSelectConversation(convId)}
        onNewDm={() => setNewDmOpen(true)}
        onConversationsChange={setConversations}
      />

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

  return (
    <AppLayout defaultSidebarOpen={false} forceSidebarClosed sidebar={<Box />}>
      <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 1,
            px: 3,
            py: 2,
            borderBottom: '1px solid var(--border)',
            background: 'var(--bg-elev)',
          }}
        >
          <ChatIcon />
          <Typography variant="h6">ダイレクトメッセージ</Typography>
        </Box>

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
    </AppLayout>
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
