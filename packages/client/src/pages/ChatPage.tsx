import { useState, useEffect, useCallback, useMemo, Suspense, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Box, IconButton, Tooltip, Typography, CircularProgress } from '@mui/material';
import ScheduleSendIcon from '@mui/icons-material/ScheduleSend';
import AttachFileIcon from '@mui/icons-material/AttachFile';
import ViewSidebarIcon from '@mui/icons-material/ViewSidebar';
import ForumOutlinedIcon from '@mui/icons-material/ForumOutlined';
import AppLayout from '../components/Layout/AppLayout';
import { ChannelFilesTab } from './FilesPage';
import ChannelList from '../components/Channel/ChannelList';
import SidebarDmList from '../components/Layout/SidebarDmList';
import ChannelTopicBar from '../components/Channel/ChannelTopicBar';
import ContextRail from '../components/Channel/ContextRail';
import MessageList from '../components/Chat/MessageList';
import RichEditor, { type QuotedMessagePreview } from '../components/Chat/RichEditor';
import ThreadPanel from '../components/Chat/ThreadPanel';
import ScheduledMessagesDialog from '../components/Chat/ScheduledMessagesDialog';
import CreateEventDialog from '../components/Chat/CreateEventDialog';
import { useMessages } from '../hooks/useMessages';
import { useScheduledMessages } from '../hooks/useScheduledMessages';
import { useMessageKeyNav } from '../hooks/useMessageKeyNav';
import { useSocket } from '../contexts/SocketContext';
import { api } from '../api/client';
import type { User, Message, Channel, RateLimitSocketError } from '@chat-app/shared';
import ArchivedBanner from '../components/Channel/ArchivedBanner';
import { useAuth } from '../contexts/AuthContext';
import { useSnackbar } from '../contexts/SnackbarContext';

interface Props {
  users: User[];
}

export default function ChatPage({ users }: Props) {
  const [activeChannelId, setActiveChannelId] = useState<number | null>(null);
  const [activeChannel, setActiveChannel] = useState<Channel | null>(null);
  // #247 #248 ヘッダー名は activeChannel から派生表示する（state の二重管理を排除）
  const activeChannelName = activeChannel?.name ?? '';
  // #247 #248 URL 直リンク時に activeChannel を埋めるための全チャンネルリスト
  const [allChannels, setAllChannels] = useState<Channel[] | null>(null);
  const [activeTab, setActiveTab] = useState<'messages' | 'files'>('messages');
  // #148 下書きマップ: channelId → 下書きコンテンツ
  const [draftMap, setDraftMap] = useState<Map<number, string>>(new Map());
  const draftMapRef = useRef(draftMap);
  draftMapRef.current = draftMap;
  const { user } = useAuth();
  // #113 投稿権限制御 — 現在のチャンネルとユーザーロールから投稿可否を計算
  // readonly: 全員不可 / admins: 管理者のみ / everyone: 全員可
  const canPostToActiveChannel = (() => {
    if (!activeChannel) return false;
    if (activeChannel.postingPermission === 'readonly') return false;
    if (activeChannel.postingPermission === 'admins') return user?.role === 'admin';
    return true;
  })();
  const [pinRefreshKey, setPinRefreshKey] = useState(0);
  // ContextRail 開閉状態を localStorage に永続化
  const [contextRailOpen, setContextRailOpen] = useState<boolean>(
    () => window.localStorage.getItem('contextRail.open') === 'true',
  );
  useEffect(() => {
    window.localStorage.setItem('contextRail.open', String(contextRailOpen));
  }, [contextRailOpen]);
  const [bookmarkedMessageIds, setBookmarkedMessageIds] = useState<Set<number>>(new Set());
  const { messages, loading, loadMore, refetch } = useMessages(activeChannelId);
  const socket = useSocket();
  const [threadRootId, setThreadRootId] = useState<number | null>(null);
  const [threadReplies, setThreadReplies] = useState<Message[]>([]);
  const [quotedMessage, setQuotedMessage] = useState<QuotedMessagePreview | undefined>(undefined);
  const [scheduledDialogOpen, setScheduledDialogOpen] = useState(false);
  const [eventDialogOpen, setEventDialogOpen] = useState(false);
  // エディタのフォーカス状態（キーボードナビゲーション無効化に使用）
  const [isEditorFocused, setIsEditorFocused] = useState(false);
  const {
    promise: scheduledPromise,
    refresh: refreshScheduled,
    cancel: cancelScheduled,
    update: updateScheduled,
  } = useScheduledMessages();

  // URL ?channel=X とチャンネル選択を双方向同期 (ブラウザ戻る/進むに対応)
  const [searchParams, setSearchParams] = useSearchParams();
  const urlChannelId = searchParams.get('channel');
  useEffect(() => {
    if (urlChannelId) {
      const id = Number(urlChannelId);
      if (Number.isFinite(id) && id !== activeChannelId) {
        setActiveChannelId(id);
      }
    } else if (activeChannelId !== null) {
      setActiveChannelId(null);
      setActiveChannel(null);
    }
    // activeChannelId は同期対象なので依存に含めない (URL → state の単方向反映)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [urlChannelId]);

  // #247 #248 マウント時にチャンネル一覧を取得し、URL 直リンク時の activeChannel 補完用に保持する
  // ChannelList の onSelect 経由なら activeChannel が直接渡されるが、
  // ?channel=N の直リンク・リロード時は ChannelList の onSelect が走らないため
  // 別ルートでチャンネル詳細を取得する必要がある。
  useEffect(() => {
    api.channels
      .list()
      .then(({ channels }) => setAllChannels(channels))
      .catch(console.error);
  }, []);

  // activeChannelId が変わり、かつ allChannels が取得済みなら該当 channel を引いて activeChannel をセット
  // (URL 直リンク・リロード時のヘッダー名・投稿権限の正しい計算のため)
  useEffect(() => {
    if (activeChannelId === null || !allChannels) return;
    // 既に同 ID の activeChannel が埋まっている場合はスキップ（onSelect 経由で先に埋まるケース）
    if (activeChannel && activeChannel.id === activeChannelId) return;
    const found = allChannels.find((ch) => ch.id === activeChannelId);
    if (found) {
      setActiveChannel(found);
    }
  }, [activeChannelId, allChannels, activeChannel]);

  // ブックマーク済みメッセージIDセットをマウント時に取得する
  useEffect(() => {
    api.bookmarks
      .list()
      .then(({ bookmarks }) => {
        setBookmarkedMessageIds(new Set(bookmarks.map((b) => b.messageId)));
      })
      .catch(console.error);
  }, []);

  // #148 下書き初期ロード: マウント時に GET /drafts を呼び draftMap を構築する
  useEffect(() => {
    api.drafts
      .getAll()
      .then(({ drafts }) => {
        const map = new Map<number, string>();
        for (const d of drafts) {
          if (d.channelId !== null && d.channelId !== undefined) {
            map.set(d.channelId, d.content);
          }
        }
        setDraftMap(map);
      })
      .catch(console.error);
  }, []);

  // #148 下書きマップを更新するコールバック（RichEditorのデバウンス保存成功時に呼ぶ）
  const handleDraftSaved = useCallback((channelId: number, content: string) => {
    setDraftMap((prev) => {
      const next = new Map(prev);
      if (content) {
        next.set(channelId, content);
      } else {
        next.delete(channelId);
      }
      return next;
    });
  }, []);

  // #148 送信成功後に下書きをキャッシュから削除するコールバック
  const handleDraftDeleted = useCallback((channelId: number) => {
    setDraftMap((prev) => {
      if (!prev.has(channelId)) return prev;
      const next = new Map(prev);
      next.delete(channelId);
      return next;
    });
  }, []);

  const handleBookmarkChange = useCallback((messageId: number, bookmarked: boolean) => {
    setBookmarkedMessageIds((prev) => {
      const next = new Set(prev);
      if (bookmarked) next.add(messageId);
      else next.delete(messageId);
      return next;
    });
  }, []);

  // ピン留め状態の変化時にリフレッシュ
  useEffect(() => {
    if (!socket || !activeChannelId) return;
    const handlePinned = () => setPinRefreshKey((k) => k + 1);
    const handleUnpinned = () => setPinRefreshKey((k) => k + 1);
    socket.on('message_pinned', handlePinned);
    socket.on('message_unpinned', handleUnpinned);
    return () => {
      socket.off('message_pinned', handlePinned);
      socket.off('message_unpinned', handleUnpinned);
    };
  }, [socket, activeChannelId]);

  // #117 NG ワード関連: 送信エラー / 警告を Socket 経由で受信
  const { showError, showInfo } = useSnackbar();
  useEffect(() => {
    if (!socket) return;
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
    const handleWarning = (data: { matchedPattern: string; message: string }) => {
      showInfo(data.message);
    };
    socket.on('error', handleError);
    socket.on('message_warning', handleWarning);
    return () => {
      socket.off('error', handleError);
      socket.off('message_warning', handleWarning);
    };
  }, [socket, showError, showInfo]);

  const handlePinMessage = useCallback(
    (messageId: number) => {
      if (!activeChannelId || !socket) return;
      socket.emit('pin_message', { messageId, channelId: activeChannelId });
    },
    [activeChannelId, socket],
  );

  const handleUnpinMessage = useCallback(
    (messageId: number) => {
      if (!activeChannelId || !socket) return;
      socket.emit('unpin_message', { messageId, channelId: activeChannelId });
    },
    [activeChannelId, socket],
  );

  // スレッドパネルを開く
  const handleOpenThread = useCallback((messageId: number) => {
    setThreadRootId(messageId);
    setThreadReplies([]);
    api.messages
      .getReplies(messageId)
      .then(({ replies }) => setThreadReplies(replies))
      .catch(console.error);
  }, []);

  const handleCloseThread = useCallback(() => {
    setThreadRootId(null);
    setThreadReplies([]);
  }, []);

  const threadRootMessage = useMemo(
    () => messages.find((m) => m.id === threadRootId) ?? null,
    [messages, threadRootId],
  );

  const handleQuoteReply = useCallback((message: Message) => {
    setQuotedMessage({
      id: message.id,
      content: message.content,
      username: message.username,
      createdAt: message.createdAt,
    });
  }, []);

  // キーボードナビゲーション: j/k でメッセージ間移動、Enter/r/p で操作
  // handleOpenThread / handlePinMessage の定義後に呼ぶ必要があるためここに配置する
  const { focusedMessageId } = useMessageKeyNav({
    messages,
    isEditorFocused,
    onOpenThread: handleOpenThread,
    onPinMessage: handlePinMessage,
  });

  const handleSend = (
    content: string,
    mentionedUserIds: number[],
    attachmentIds: number[],
    quotedMessageId?: number,
  ) => {
    if (!activeChannelId || !socket) return;
    socket.emit('send_message', {
      channelId: activeChannelId,
      content,
      mentionedUserIds,
      attachmentIds,
      ...(quotedMessageId != null ? { quotedMessageId } : {}),
    });
    setQuotedMessage(undefined);
  };

  return (
    <AppLayout
      sidebar={
        <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>
          <Box sx={{ flex: 1, overflow: 'auto', minHeight: 0 }}>
            <ChannelList
              activeChannelId={activeChannelId}
              onSelect={(id, _name, channel) => {
                // activeChannelName は activeChannel?.name から派生するため name 引数は使わない (#247 #248)
                setActiveChannel(channel ?? null);
                setActiveTab('messages');
                // URL を push 更新すると useEffect で activeChannelId が同期される
                setSearchParams({ channel: String(id) });
              }}
              draftMap={draftMap}
            />
          </Box>
          <SidebarDmList />
        </Box>
      }
      rightPane={
        contextRailOpen && activeChannel && user ? (
          <ContextRail
            channel={activeChannel}
            currentUserId={user.id}
            userRole={user.role}
            onClose={() => setContextRailOpen(false)}
            onTopicUpdated={(updated) => setActiveChannel(updated)}
            pinRefreshKey={pinRefreshKey}
            onUnpin={handleUnpinMessage}
          />
        ) : undefined
      }
      onCloseRightPane={() => setContextRailOpen(false)}
    >
      <Box sx={{ display: 'flex', height: '100%', overflow: 'hidden' }}>
        {/* メインエリア */}
        <Box sx={{ flexGrow: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          {/* チャンネルヘッダー（1行） */}
          {activeChannelId && (
            <Box
              sx={{
                borderBottom: 1,
                borderColor: 'divider',
                px: 2,
                py: 0.5,
                flexShrink: 0,
                display: 'flex',
                alignItems: 'center',
                minHeight: 40,
                gap: 1,
              }}
            >
              <Typography variant="subtitle2" color="text.secondary" sx={{ flexShrink: 0 }}>
                # {activeChannelName}
              </Typography>
              {activeChannel && user && (
                <Box sx={{ flexGrow: 1, minWidth: 0 }}>
                  {/* 編集ボタン群 (招待/ゲスト/編集) は ContextRail 概要タブの ChannelSettingsForm に
                      集約済み。Main トップバーは topic / tags 表示のみ */}
                  <ChannelTopicBar channel={activeChannel} />
                </Box>
              )}
              {!activeChannel && <Box sx={{ flexGrow: 1 }} />}
              <Tooltip title="ファイル一覧">
                <IconButton
                  size="small"
                  aria-label="ファイル一覧"
                  onClick={() => setActiveTab((t) => (t === 'files' ? 'messages' : 'files'))}
                  data-active={activeTab === 'files' ? 'true' : undefined}
                  sx={{
                    bgcolor: activeTab === 'files' ? 'action.selected' : undefined,
                    flexShrink: 0,
                  }}
                >
                  <AttachFileIcon fontSize="small" />
                </IconButton>
              </Tooltip>
              <Tooltip title="予約送信一覧">
                <IconButton
                  size="small"
                  aria-label="予約送信一覧"
                  onClick={() => setScheduledDialogOpen(true)}
                  sx={{ flexShrink: 0 }}
                >
                  <ScheduleSendIcon fontSize="small" />
                </IconButton>
              </Tooltip>
              <Tooltip title="コンテキストペインを開く">
                <IconButton
                  size="small"
                  aria-label="コンテキストペインを開く"
                  onClick={() => setContextRailOpen((v) => !v)}
                  data-active={contextRailOpen ? 'true' : undefined}
                  sx={{
                    bgcolor: contextRailOpen ? 'action.selected' : undefined,
                    flexShrink: 0,
                  }}
                >
                  <ViewSidebarIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            </Box>
          )}

          {/* ファイルタブ */}
          {activeTab === 'files' && activeChannelId && (
            <Suspense
              fallback={
                <Box
                  sx={{
                    display: 'flex',
                    flexGrow: 1,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <CircularProgress />
                </Box>
              }
            >
              <ChannelFilesTab channelId={activeChannelId} />
            </Suspense>
          )}

          {/* チャット未選択時の案内文 */}
          {activeTab === 'messages' && !activeChannelId && (
            <Box
              sx={{
                display: 'flex',
                flexGrow: 1,
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 1,
                color: 'text.secondary',
                p: 4,
              }}
            >
              <ForumOutlinedIcon sx={{ fontSize: 64, opacity: 0.3 }} />
              <Typography variant="h6">チャンネルを選択してください</Typography>
              <Typography variant="body2">左のチャンネル一覧からチャットを始めましょう</Typography>
            </Box>
          )}

          {/* メッセージタブ */}
          {activeTab === 'messages' && activeChannelId && (
            <>
              {activeChannel?.isArchived && <ArchivedBanner />}
              <MessageList
                messages={messages}
                loading={loading}
                onLoadMore={loadMore}
                currentUserId={null}
                users={users}
                onOpenThread={handleOpenThread}
                onPinMessage={handlePinMessage}
                bookmarkedMessageIds={bookmarkedMessageIds}
                onBookmarkChange={handleBookmarkChange}
                onQuoteReply={handleQuoteReply}
                focusedMessageId={focusedMessageId}
              />
              <Box sx={{ p: 2, borderTop: 1, borderColor: 'divider' }}>
                <RichEditor
                  users={users}
                  onSend={handleSend}
                  disabled={activeChannel?.isArchived === true || !canPostToActiveChannel}
                  quotedMessage={quotedMessage}
                  onClearQuote={() => setQuotedMessage(undefined)}
                  channelId={activeChannelId}
                  initialContent={draftMap.get(activeChannelId)}
                  onDraftSaved={handleDraftSaved}
                  onDraftDeleted={handleDraftDeleted}
                  onSlashEvent={() => setEventDialogOpen(true)}
                  onFocus={() => setIsEditorFocused(true)}
                  onBlur={() => setIsEditorFocused(false)}
                />
              </Box>
            </>
          )}
        </Box>

        {/* イベント作成ダイアログ */}
        {activeChannelId && (
          <CreateEventDialog
            open={eventDialogOpen}
            channelId={activeChannelId}
            onClose={() => setEventDialogOpen(false)}
            onCreated={() => refetch()}
          />
        )}

        {/* 予約送信一覧ダイアログ */}
        <ScheduledMessagesDialog
          open={scheduledDialogOpen}
          onClose={() => setScheduledDialogOpen(false)}
          promise={scheduledPromise}
          onCancel={cancelScheduled}
          onUpdate={updateScheduled}
          onRefresh={refreshScheduled}
        />

        {/* スレッドパネル */}
        {threadRootMessage && (
          <ThreadPanel
            rootMessage={threadRootMessage}
            initialReplies={threadReplies}
            currentUserId={0}
            users={users}
            onClose={handleCloseThread}
          />
        )}
      </Box>
    </AppLayout>
  );
}
