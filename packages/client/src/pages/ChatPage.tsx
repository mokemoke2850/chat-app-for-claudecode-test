import { useState, useEffect, useCallback, useMemo, Suspense } from 'react';
import { Box, IconButton, Tabs, Tab, Tooltip, Typography, CircularProgress } from '@mui/material';
import ScheduleSendIcon from '@mui/icons-material/ScheduleSend';
import AppLayout from '../components/Layout/AppLayout';
import { ChannelFilesTab } from './FilesPage';
import ChannelList from '../components/Channel/ChannelList';
import ChannelTopicBar from '../components/Channel/ChannelTopicBar';
import MessageList from '../components/Chat/MessageList';
import RichEditor, { type QuotedMessagePreview } from '../components/Chat/RichEditor';
import SearchResults from '../components/Chat/SearchResults';
import SearchFilterPanel, { type SearchFilters } from '../components/Chat/SearchFilterPanel';
import ThreadPanel from '../components/Chat/ThreadPanel';
import ScheduledMessagesDialog from '../components/Chat/ScheduledMessagesDialog';
import CreateEventDialog from '../components/Chat/CreateEventDialog';
import { useMessages } from '../hooks/useMessages';
import { useScheduledMessages } from '../hooks/useScheduledMessages';
import { useSocket } from '../contexts/SocketContext';
import { api } from '../api/client';
import type { User, Message, MessageSearchResult, Channel } from '@chat-app/shared';
import PinnedMessages from '../components/Channel/PinnedMessages';
import ArchivedBanner from '../components/Channel/ArchivedBanner';
import { useAuth } from '../contexts/AuthContext';
import { useSnackbar } from '../contexts/SnackbarContext';

interface Props {
  users: User[];
}

export default function ChatPage({ users }: Props) {
  const [activeChannelId, setActiveChannelId] = useState<number | null>(null);
  const [activeChannelName, setActiveChannelName] = useState<string>('');
  const [activeChannel, setActiveChannel] = useState<Channel | null>(null);
  const [activeTab, setActiveTab] = useState<'messages' | 'files'>('messages');
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
  const [bookmarkedMessageIds, setBookmarkedMessageIds] = useState<Set<number>>(new Set());
  const { messages, loading, loadMore } = useMessages(activeChannelId);
  const socket = useSocket();
  const [searchQuery, setSearchQuery] = useState('');
  const [searchFilters, setSearchFilters] = useState<SearchFilters>({});
  const [searchResults, setSearchResults] = useState<MessageSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  // 検索モードの「明示的な開始/終了」フラグ。
  // - true にする: 検索ボックスへの focus（onSearchFocus）
  // - false に戻す: チャンネル切替 / 検索結果からの遷移（handleNavigate）
  // blur では false にしない（フィルターパネル内のクリックでパネルが消えるバグの回避）
  const [searchActive, setSearchActive] = useState(false);
  const [threadRootId, setThreadRootId] = useState<number | null>(null);
  const [threadReplies, setThreadReplies] = useState<Message[]>([]);
  const [quotedMessage, setQuotedMessage] = useState<QuotedMessagePreview | undefined>(undefined);
  const [scheduledDialogOpen, setScheduledDialogOpen] = useState(false);
  const [eventDialogOpen, setEventDialogOpen] = useState(false);
  const {
    promise: scheduledPromise,
    refresh: refreshScheduled,
    cancel: cancelScheduled,
    update: updateScheduled,
  } = useScheduledMessages();

  // URL の ?channel=X からチャンネルを初期選択する
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const channelId = params.get('channel');
    if (channelId) setActiveChannelId(Number(channelId));
  }, []);

  // ブックマーク済みメッセージIDセットをマウント時に取得する
  useEffect(() => {
    api.bookmarks
      .list()
      .then(({ bookmarks }) => {
        setBookmarkedMessageIds(new Set(bookmarks.map((b) => b.messageId)));
      })
      .catch(console.error);
  }, []);

  const handleBookmarkChange = useCallback((messageId: number, bookmarked: boolean) => {
    setBookmarkedMessageIds((prev) => {
      const next = new Set(prev);
      if (bookmarked) next.add(messageId);
      else next.delete(messageId);
      return next;
    });
  }, []);

  // フィルター（tagIds/dateFrom/dateTo/userId/hasAttachment）が 1 つでも指定されているか
  const hasAnyFilter =
    (searchFilters.tagIds?.length ?? 0) > 0 ||
    !!searchFilters.dateFrom ||
    !!searchFilters.dateTo ||
    searchFilters.userId !== undefined ||
    searchFilters.hasAttachment !== undefined;

  // 検索クエリ or フィルタが変わったら API を呼ぶ（300ms debounce）
  // クエリ・フィルタ両方が空なら API 呼び出しスキップ
  useEffect(() => {
    const trimmedQuery = searchQuery.trim();
    if (!trimmedQuery && !hasAnyFilter) {
      setSearchResults([]);
      setSearching(false);
      return;
    }
    const timer = setTimeout(() => {
      setSearching(true);
      api.messages
        .search(trimmedQuery, searchFilters)
        .then(({ messages }) => setSearchResults(messages))
        .catch(console.error)
        .finally(() => setSearching(false));
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery, searchFilters, hasAnyFilter]);

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
    const handleError = (msg: string) => {
      showError(msg);
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

  // 検索結果から投稿へ移動
  const handleNavigate = useCallback((channelId: number, messageId: number) => {
    setSearchQuery('');
    setSearchFilters({});
    setSearchActive(false);
    setActiveChannelId(channelId);
    setTimeout(() => {
      window.location.hash = `#message-${messageId}`;
    }, 100);
  }, []);

  // 検索モード: クエリがある or フィルター指定済み or 検索が明示的にアクティブ
  // searchActive は onFocus で true、明示的な閉じる動作（チャンネル切替・結果遷移）で false
  const isSearchMode = searchQuery.trim().length > 0 || hasAnyFilter || searchActive;

  return (
    <AppLayout
      sidebar={
        <ChannelList
          activeChannelId={activeChannelId}
          onSelect={(id, name, channel) => {
            setActiveChannelId(id);
            setActiveChannelName(name);
            setActiveChannel(channel ?? null);
            setActiveTab('messages');
            // チャンネル切替は「検索を閉じる」アクションとして扱う
            setSearchActive(false);
            setSearchQuery('');
            setSearchFilters({});
          }}
        />
      }
      searchQuery={searchQuery}
      onSearchChange={setSearchQuery}
      onSearchFocus={() => setSearchActive(true)}
    >
      <Box sx={{ display: 'flex', height: '100%', overflow: 'hidden' }}>
        {/* メインエリア */}
        <Box sx={{ flexGrow: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          {/* チャンネルヘッダー */}
          {activeChannelId && (
            <Box sx={{ borderBottom: 1, borderColor: 'divider', px: 2, pt: 1, flexShrink: 0 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 0.5 }}>
                <Typography variant="subtitle2" color="text.secondary" sx={{ flexGrow: 1 }}>
                  # {activeChannelName}
                </Typography>
                <Tooltip title="予約送信一覧">
                  <IconButton
                    size="small"
                    aria-label="予約送信一覧"
                    onClick={() => setScheduledDialogOpen(true)}
                  >
                    <ScheduleSendIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
              </Box>
              {activeChannel && user && (
                <ChannelTopicBar
                  channel={activeChannel}
                  currentUserId={user.id}
                  userRole={user.role}
                  onTopicUpdated={(updated) => setActiveChannel(updated)}
                />
              )}
              <Tabs
                value={activeTab}
                onChange={(_, v: 'messages' | 'files') => setActiveTab(v)}
                sx={{ minHeight: 36 }}
              >
                <Tab label="メッセージ" value="messages" sx={{ minHeight: 36, py: 0 }} />
                <Tab label="ファイル" value="files" sx={{ minHeight: 36, py: 0 }} />
              </Tabs>
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

          {/* メッセージタブ */}
          {activeTab === 'messages' && (
            <>
              {isSearchMode ? (
                <Box sx={{ display: 'flex', flexGrow: 1, overflow: 'hidden' }}>
                  <Box
                    sx={{
                      width: 240,
                      flexShrink: 0,
                      borderRight: 1,
                      borderColor: 'divider',
                      overflowY: 'auto',
                    }}
                  >
                    <Suspense fallback={null}>
                      <SearchFilterPanel
                        onFilterChange={setSearchFilters}
                        searchResults={searchResults}
                      />
                    </Suspense>
                  </Box>
                  <Box sx={{ flexGrow: 1, overflowY: 'auto' }}>
                    {!searching && (
                      <SearchResults results={searchResults} onNavigate={handleNavigate} />
                    )}
                  </Box>
                </Box>
              ) : (
                <>
                  {activeChannelId && user && (
                    <PinnedMessages
                      channelId={activeChannelId}
                      currentUserId={user.id}
                      refreshKey={pinRefreshKey}
                      onUnpin={handleUnpinMessage}
                    />
                  )}
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
                  />
                  <Box sx={{ p: 2, borderTop: 1, borderColor: 'divider' }}>
                    <RichEditor
                      users={users}
                      onSend={handleSend}
                      disabled={
                        !activeChannelId ||
                        activeChannel?.isArchived === true ||
                        !canPostToActiveChannel
                      }
                      quotedMessage={quotedMessage}
                      onClearQuote={() => setQuotedMessage(undefined)}
                      channelId={activeChannelId ?? undefined}
                      onSlashEvent={() => {
                        if (activeChannelId) setEventDialogOpen(true);
                      }}
                    />
                  </Box>
                </>
              )}
            </>
          )}
        </Box>

        {/* イベント作成ダイアログ */}
        {activeChannelId && (
          <CreateEventDialog
            open={eventDialogOpen}
            channelId={activeChannelId}
            onClose={() => setEventDialogOpen(false)}
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
