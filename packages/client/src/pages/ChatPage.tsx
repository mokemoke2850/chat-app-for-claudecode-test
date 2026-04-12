import { useState, useEffect, useCallback, useMemo } from 'react';
import { Box } from '@mui/material';
import AppLayout from '../components/Layout/AppLayout';
import ChannelList from '../components/Channel/ChannelList';
import MessageList from '../components/Chat/MessageList';
import RichEditor from '../components/Chat/RichEditor';
import SearchResults from '../components/Chat/SearchResults';
import ThreadPanel from '../components/Chat/ThreadPanel';
import { useMessages } from '../hooks/useMessages';
import { useSocket } from '../contexts/SocketContext';
import { api } from '../api/client';
import type { User, Message, MessageSearchResult } from '@chat-app/shared';

interface Props {
  users: User[];
}

export default function ChatPage({ users }: Props) {
  const [activeChannelId, setActiveChannelId] = useState<number | null>(null);
  const { messages, loading, loadMore } = useMessages(activeChannelId);
  const socket = useSocket();
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<MessageSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [threadRootId, setThreadRootId] = useState<number | null>(null);
  const [threadReplies, setThreadReplies] = useState<Message[]>([]);

  // URL の ?channel=X からチャンネルを初期選択する
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const channelId = params.get('channel');
    if (channelId) setActiveChannelId(Number(channelId));
  }, []);

  // 検索クエリが変わったら API を呼ぶ（300ms debounce）
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      setSearching(false);
      return;
    }
    const timer = setTimeout(() => {
      setSearching(true);
      api.messages
        .search(searchQuery.trim())
        .then(({ messages }) => setSearchResults(messages))
        .catch(console.error)
        .finally(() => setSearching(false));
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // スレッドパネルを開く
  const handleOpenThread = useCallback((messageId: number) => {
    setThreadRootId(messageId);
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

  const handleSend = (content: string, mentionedUserIds: number[], attachmentIds: number[]) => {
    if (!activeChannelId || !socket) return;
    socket.emit('send_message', {
      channelId: activeChannelId,
      content,
      mentionedUserIds,
      attachmentIds,
    });
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
      sidebar={<ChannelList activeChannelId={activeChannelId} onSelect={setActiveChannelId} />}
      searchQuery={searchQuery}
      onSearchChange={setSearchQuery}
    >
      <Box sx={{ display: 'flex', height: '100%', overflow: 'hidden' }}>
        {/* メインエリア */}
        <Box sx={{ flexGrow: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          {isSearchMode ? (
            <Box sx={{ flexGrow: 1, overflowY: 'auto' }}>
              {!searching && <SearchResults results={searchResults} onNavigate={handleNavigate} />}
            </Box>
          ) : (
            <>
              <MessageList
                messages={messages}
                loading={loading}
                onLoadMore={loadMore}
                currentUserId={null}
                users={users}
                onOpenThread={handleOpenThread}
              />
              <Box sx={{ p: 2, borderTop: 1, borderColor: 'divider' }}>
                <RichEditor users={users} onSend={handleSend} disabled={!activeChannelId} />
              </Box>
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
