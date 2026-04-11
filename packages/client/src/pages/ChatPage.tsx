import { useState, useEffect } from 'react';
import { Box } from '@mui/material';
import AppLayout from '../components/Layout/AppLayout';
import ChannelList from '../components/Channel/ChannelList';
import MessageList from '../components/Chat/MessageList';
import RichEditor from '../components/Chat/RichEditor';
import { useMessages } from '../hooks/useMessages';
import { useSocket } from '../contexts/SocketContext';
import type { User } from '@chat-app/shared';

interface Props {
  users: User[];
}

export default function ChatPage({ users }: Props) {
  const [activeChannelId, setActiveChannelId] = useState<number | null>(null);
  const { messages, loading, loadMore } = useMessages(activeChannelId);
  const socket = useSocket();

  // URL の ?channel=X からチャンネルを初期選択する
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const channelId = params.get('channel');
    if (channelId) setActiveChannelId(Number(channelId));
  }, []);

  const handleSend = (content: string, mentionedUserIds: number[]) => {
    if (!activeChannelId || !socket) return;
    socket.emit('send_message', { channelId: activeChannelId, content, mentionedUserIds });
  };

  return (
    <AppLayout
      sidebar={<ChannelList activeChannelId={activeChannelId} onSelect={setActiveChannelId} />}
    >
      <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
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
      </Box>
    </AppLayout>
  );
}
