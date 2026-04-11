import { useEffect, useRef } from 'react';
import { Box, Button, CircularProgress, Typography } from '@mui/material';
import type { Message, User } from '@chat-app/shared';
import MessageItem from './MessageItem';
import { useAuth } from '../../contexts/AuthContext';

interface Props {
  messages: Message[];
  loading: boolean;
  onLoadMore: () => void;
  currentUserId: number | null;
  users?: User[];
}

export default function MessageList({ messages, loading, onLoadMore, users = [] }: Props) {
  const { user } = useAuth();
  const bottomRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const hasScrolledToHash = useRef(false);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const isAtBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 100;
    if (isAtBottom) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  // URL ハッシュ #message-{id} に対応するメッセージへスクロール（初回のみ）
  useEffect(() => {
    if (hasScrolledToHash.current) return;
    const hash = window.location.hash;
    if (!hash.startsWith('#message-')) return;
    const el = document.getElementById(hash.slice(1));
    if (!el) return;
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    hasScrolledToHash.current = true;
  }, [messages]);

  if (!user) return null;

  return (
    <Box
      ref={containerRef}
      sx={{ flexGrow: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column' }}
    >
      {messages.length === 0 && !loading && (
        <Box sx={{ flexGrow: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Typography color="text.secondary">No messages yet. Say hello!</Typography>
        </Box>
      )}

      {messages.length > 0 && (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 1 }}>
          <Button size="small" onClick={onLoadMore} disabled={loading}>
            {loading ? <CircularProgress size={16} /> : 'Load older messages'}
          </Button>
        </Box>
      )}

      <Box sx={{ flexGrow: 1 }} />

      {messages.map((msg) => (
        <MessageItem key={msg.id} message={msg} currentUserId={user.id} users={users} />
      ))}

      <div ref={bottomRef} />
    </Box>
  );
}
