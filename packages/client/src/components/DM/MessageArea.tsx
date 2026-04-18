import { useState, useEffect, useRef } from 'react';
import {
  Box,
  Typography,
  Avatar,
  IconButton,
  TextField,
} from '@mui/material';
import SendIcon from '@mui/icons-material/Send';
import { useSocket } from '../../contexts/SocketContext';
import type { DmConversationWithDetails, DmMessage } from '@chat-app/shared';

function formatTime(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' });
}

export interface MessageAreaProps {
  conversation: DmConversationWithDetails;
  currentUserId: number;
  onSend: (content: string) => void;
  messages: DmMessage[];
  typingUserId: number | null;
}

export default function MessageArea({
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
