import { useState, useEffect, useCallback } from 'react';
import { Box } from '@mui/material';
import AppLayout from '../components/Layout/AppLayout';
import ChannelList from '../components/Channel/ChannelList';
import MessageList from '../components/Chat/MessageList';
import RichEditor from '../components/Chat/RichEditor';
import SearchResults from '../components/Chat/SearchResults';
import { useMessages } from '../hooks/useMessages';
import { useSocket } from '../contexts/SocketContext';
import { api } from '../api/client';
import type { User, MessageSearchResult } from '@chat-app/shared';

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

  // URL の ?channel=X からチャンネルを初期選択する
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const channelId = params.get('channel');
    if (channelId) setActiveChannelId(Number(channelId));
  }, []);

  // 検索クエリが変わったら API を呼ぶ（デバウンスなし・300ms debounce）
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
    // チャンネル切り替え後に hash scroll が動くよう非同期で設定
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
      <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
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
            />
            <Box sx={{ p: 2, borderTop: 1, borderColor: 'divider' }}>
              <RichEditor users={users} onSend={handleSend} disabled={!activeChannelId} />
            </Box>
          </>
        )}
      </Box>
    </AppLayout>
  );
}
