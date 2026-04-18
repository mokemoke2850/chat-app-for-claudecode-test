import { useState, useEffect, useCallback, useMemo, Suspense } from 'react';
import { Box, Tabs, Tab, Typography, CircularProgress } from '@mui/material';
import AppLayout from '../components/Layout/AppLayout';
import { ChannelFilesTab } from './FilesPage';
import ChannelList from '../components/Channel/ChannelList';
import ChannelTopicBar from '../components/Channel/ChannelTopicBar';
import MessageList from '../components/Chat/MessageList';
import RichEditor, { type QuotedMessagePreview } from '../components/Chat/RichEditor';
import SearchResults from '../components/Chat/SearchResults';
import SearchFilterPanel, { type SearchFilters } from '../components/Chat/SearchFilterPanel';
import ThreadPanel from '../components/Chat/ThreadPanel';
import { useMessages } from '../hooks/useMessages';
import { useSocket } from '../contexts/SocketContext';
import { api } from '../api/client';
import type { User, Message, MessageSearchResult, Channel } from '@chat-app/shared';
import PinnedMessages from '../components/Channel/PinnedMessages';
import ArchivedBanner from '../components/Channel/ArchivedBanner';
import { useAuth } from '../contexts/AuthContext';

interface Props {
  users: User[];
}

export default function ChatPage({ users }: Props) {
  const [activeChannelId, setActiveChannelId] = useState<number | null>(null);
  const [activeChannelName, setActiveChannelName] = useState<string>('');
  const [activeChannel, setActiveChannel] = useState<Channel | null>(null);
  const [activeTab, setActiveTab] = useState<'messages' | 'files'>('messages');
  const { user } = useAuth();
  const [pinRefreshKey, setPinRefreshKey] = useState(0);
  const [bookmarkedMessageIds, setBookmarkedMessageIds] = useState<Set<number>>(new Set());
  const { messages, loading, loadMore } = useMessages(activeChannelId);
  const socket = useSocket();
  const [searchQuery, setSearchQuery] = useState('');
  const [searchFilters, setSearchFilters] = useState<SearchFilters>({});
  const [searchResults, setSearchResults] = useState<MessageSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [threadRootId, setThreadRootId] = useState<number | null>(null);
  const [threadReplies, setThreadReplies] = useState<Message[]>([]);
  const [quotedMessage, setQuotedMessage] = useState<QuotedMessagePreview | undefined>(undefined);

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

  // 検索クエリ or フィルタが変わったら API を呼ぶ（300ms debounce）
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      setSearching(false);
      return;
    }
    const timer = setTimeout(() => {
      setSearching(true);
      api.messages
        .search(searchQuery.trim(), searchFilters)
        .then(({ messages }) => setSearchResults(messages))
        .catch(console.error)
        .finally(() => setSearching(false));
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery, searchFilters]);

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

  const handleSend = (content: string, mentionedUserIds: number[], attachmentIds: number[], quotedMessageId?: number) => {
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
    setActiveChannelId(channelId);
    setTimeout(() => {
      window.location.hash = `#message-${messageId}`;
    }, 100);
  }, []);

  const isSearchMode = searchQuery.trim().length > 0;

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
          }}
        />
      }
      searchQuery={searchQuery}
      onSearchChange={setSearchQuery}
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
                  <Box sx={{ width: 240, flexShrink: 0, borderRight: 1, borderColor: 'divider', overflowY: 'auto' }}>
                    <Suspense fallback={null}>
                      <SearchFilterPanel onFilterChange={setSearchFilters} />
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
                      disabled={!activeChannelId || activeChannel?.isArchived === true}
                      quotedMessage={quotedMessage}
                      onClearQuote={() => setQuotedMessage(undefined)}
                    />
                  </Box>
                </>
              )}
            </>
          )}
        </Box>

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
