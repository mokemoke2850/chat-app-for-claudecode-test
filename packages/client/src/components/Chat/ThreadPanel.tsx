import { useState, useEffect } from 'react';
import { Box, Typography, IconButton, Divider, Avatar, Tooltip, Chip } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import ReplyIcon from '@mui/icons-material/Reply';
import type { Message, User } from '@chat-app/shared';
import { useSocket } from '../../contexts/SocketContext';
import RichEditor from './RichEditor';
import { getAvatarColor } from '../../utils/avatarColor';

const THREAD_PANEL_WIDTH = 360;
const MAX_INDENT_DEPTH = 2;
const INDENT_PX = 24;

interface Props {
  rootMessage: Message;
  initialReplies: Message[];
  currentUserId: number;
  users: User[];
  onClose: () => void;
}

function formatTime(dateStr: string): string {
  return new Date(dateStr).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

interface DeltaOp {
  insert?: string | { mention?: { value: string } };
}

function extractText(content: string): string {
  try {
    const delta = JSON.parse(content) as { ops?: DeltaOp[] };
    return (
      delta.ops
        ?.map((op) => (typeof op.insert === 'string' ? op.insert : ''))
        .join('')
        .trim() ?? content
    );
  } catch {
    return content;
  }
}

interface ReplyItemProps {
  message: Message;
  depth: number;
  currentUserId: number;
  users: User[];
  onReply: (message: Message) => void;
}

function ReplyItem({ message, depth, users, onReply }: ReplyItemProps) {
  const indentDepth = Math.min(depth, MAX_INDENT_DEPTH);
  const author = users.find((u) => u.id === message.userId);
  const displayName = author?.displayName || message.username;

  return (
    <Box
      sx={{
        display: 'flex',
        gap: 1,
        pl: indentDepth * (INDENT_PX / 8),
        py: 0.5,
        '&:hover .reply-action': { opacity: 1 },
      }}
    >
      <Avatar
        src={author?.avatarUrl ?? undefined}
        alt={displayName}
        sx={{
          width: 28,
          height: 28,
          mt: 0.25,
          flexShrink: 0,
          fontSize: '0.75rem',
          ...(!author?.avatarUrl && { bgcolor: getAvatarColor(author?.email ?? '') }),
        }}
      >
        {displayName[0].toUpperCase()}
      </Avatar>
      <Box sx={{ flexGrow: 1, minWidth: 0 }}>
        <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1 }}>
          <Typography variant="caption" fontWeight="bold">
            {displayName}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {formatTime(message.createdAt)}
          </Typography>
        </Box>
        <Typography variant="body2" sx={{ wordBreak: 'break-word', whiteSpace: 'pre-wrap' }}>
          {extractText(message.content)}
        </Typography>
      </Box>
      <Tooltip title="返信">
        <IconButton
          aria-label="返信"
          size="small"
          className="reply-action"
          sx={{ opacity: 0, transition: 'opacity 0.15s', flexShrink: 0 }}
          onClick={() => onReply(message)}
        >
          <ReplyIcon fontSize="small" />
        </IconButton>
      </Tooltip>
    </Box>
  );
}

export default function ThreadPanel({
  rootMessage,
  initialReplies,
  currentUserId,
  users,
  onClose,
}: Props) {
  const [replies, setReplies] = useState<Message[]>(initialReplies);
  const [replyTarget, setReplyTarget] = useState<Message>(rootMessage);
  const socket = useSocket();

  // initialReplies は非同期フェッチ後に更新されるため、変化を検知して同期する
  useEffect(() => {
    setReplies(initialReplies);
  }, [initialReplies]);

  const author = users.find((u) => u.id === rootMessage.userId);
  const displayName = author?.displayName || rootMessage.username;

  useEffect(() => {
    if (!socket) return;
    const handler = (data: {
      reply: Message;
      rootMessageId: number;
      channelId: number;
      replyCount: number;
    }) => {
      if (data.rootMessageId === rootMessage.id) {
        setReplies((prev) => {
          if (prev.some((r) => r.id === data.reply.id)) return prev;
          return [...prev, data.reply];
        });
      }
    };
    socket.on('new_thread_reply', handler);
    return () => {
      socket.off('new_thread_reply', handler);
    };
  }, [socket, rootMessage.id]);

  const handleSend = (content: string, mentionedUserIds: number[], attachmentIds: number[]) => {
    socket?.emit('send_thread_reply', {
      parentMessageId: replyTarget.id,
      rootMessageId: rootMessage.id,
      content,
      mentionedUserIds,
      attachmentIds,
    });
    setReplyTarget(rootMessage);
  };

  return (
    <Box
      sx={{
        width: THREAD_PANEL_WIDTH,
        flexShrink: 0,
        display: 'flex',
        flexDirection: 'column',
        borderLeft: 1,
        borderColor: 'divider',
        height: '100%',
        overflow: 'hidden',
      }}
    >
      {/* ヘッダー */}
      <Box sx={{ display: 'flex', alignItems: 'center', px: 2, py: 1, flexShrink: 0 }}>
        <Typography variant="subtitle1" fontWeight="bold" sx={{ flexGrow: 1 }}>
          スレッド
        </Typography>
        <Tooltip title="閉じる">
          <IconButton aria-label="閉じる" size="small" onClick={onClose}>
            <CloseIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      </Box>
      <Divider />

      {/* ルートメッセージ */}
      <Box sx={{ px: 2, py: 1.5, flexShrink: 0 }}>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Avatar
            src={author?.avatarUrl ?? undefined}
            alt={displayName}
            sx={{
              width: 32,
              height: 32,
              mt: 0.25,
              flexShrink: 0,
              ...(!author?.avatarUrl && { bgcolor: getAvatarColor(author?.email ?? '') }),
            }}
          >
            {displayName[0].toUpperCase()}
          </Avatar>
          <Box>
            <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1 }}>
              <Typography variant="caption" fontWeight="bold">
                {displayName}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {formatTime(rootMessage.createdAt)}
              </Typography>
            </Box>
            <Typography variant="body2" sx={{ wordBreak: 'break-word', whiteSpace: 'pre-wrap' }}>
              {extractText(rootMessage.content)}
            </Typography>
          </Box>
        </Box>
      </Box>

      <Divider />

      {/* 返信一覧 */}
      <Box sx={{ flexGrow: 1, overflowY: 'auto', px: 1, py: 1 }}>
        {replies.length > 0 && (
          <Typography
            variant="caption"
            color="text.secondary"
            sx={{ px: 1, display: 'block', mb: 0.5 }}
          >
            {replies.length}件の返信
          </Typography>
        )}
        {replies.map((reply) => {
          const depth = reply.parentMessageId === rootMessage.id ? 1 : 2;
          return (
            <ReplyItem
              key={reply.id}
              message={reply}
              depth={depth}
              currentUserId={currentUserId}
              users={users}
              onReply={(msg) => setReplyTarget(msg)}
            />
          );
        })}
      </Box>

      <Divider />

      {/* 入力エリア */}
      <Box sx={{ px: 1, py: 1, flexShrink: 0 }}>
        {replyTarget.id !== rootMessage.id && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.5 }}>
            <Typography variant="caption" color="text.secondary">
              返信先:{' '}
              {users.find((u) => u.id === replyTarget.userId)?.displayName || replyTarget.username}{' '}
              へ
            </Typography>
            <Chip
              label="×"
              size="small"
              onClick={() => setReplyTarget(rootMessage)}
              sx={{ height: 16, fontSize: '0.65rem', cursor: 'pointer' }}
            />
          </Box>
        )}
        <RichEditor users={users} onSend={handleSend} />
      </Box>
    </Box>
  );
}
