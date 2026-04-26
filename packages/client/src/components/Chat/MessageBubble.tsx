import { Box, Typography, Link } from '@mui/material';
import InsertDriveFileIcon from '@mui/icons-material/InsertDriveFile';
import ReplyIcon from '@mui/icons-material/Reply';
import ForwardIcon from '@mui/icons-material/Forward';
import EventIcon from '@mui/icons-material/Event';
import type { Message, Reaction, User } from '@chat-app/shared';
import ReactionBadge from './ReactionBadge';
import { renderMessageContent } from '../../utils/renderMessageContent';

/** 転送 / 引用ヘッダー領域に表示するイベント開始日時のフォーマット */
function formatEventStart(startsAt: string): string {
  const d = new Date(startsAt);
  if (isNaN(d.getTime())) return startsAt;
  return d.toLocaleString([], {
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

interface Props {
  message: Message;
  reactions: Reaction[];
  currentUserId: number;
  users: User[];
  isOwn: boolean;
  onReactionClick: (emoji: string) => void;
  onOpenThread?: (messageId: number) => void;
}

export default function MessageBubble({
  message,
  reactions,
  currentUserId,
  users,
  isOwn,
  onReactionClick,
  onOpenThread,
}: Props) {
  return (
    <Box
      sx={{
        maxWidth: '100%',
        wordBreak: 'break-word',
        overflowWrap: 'break-word',
        whiteSpace: 'pre-wrap',
        fontSize: '0.875rem',
        lineHeight: 1.5,
        borderRadius: isOwn ? '12px 12px 0 12px' : '12px 12px 12px 0',
        px: 1.5,
        py: 0.75,
        bgcolor: isOwn ? '#dbeafe' : 'grey.100',
        color: 'text.primary',
      }}
    >
      {/* 転送元メッセージプレビュー */}
      {message.forwardedFromMessage && (
        <Box
          data-testid="forwarded-message-preview"
          sx={{
            borderLeft: '3px solid',
            borderColor: 'secondary.main',
            pl: 1,
            mb: 0.5,
            opacity: 0.8,
            fontSize: '0.8rem',
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.25 }}>
            <ForwardIcon sx={{ fontSize: '0.75rem', color: 'text.secondary' }} />
            <Typography variant="caption" color="text.secondary" data-testid="forwarded-label">
              転送元
            </Typography>
          </Box>
          <Typography
            variant="caption"
            fontWeight="bold"
            data-testid="forwarded-username"
            display="block"
          >
            {message.forwardedFromMessage.username}
          </Typography>
          {/*
           * 転送元がイベント投稿の場合は、本文プレースホルダ（"[event]" 等）の代わりに
           * イベントの概要（タイトル + 開始日時 + 📅 ラベル）をコンパクト表示する。
           * 完全な EventCard を埋めるとヘッダーが視覚的に重くなるため、要点のみに絞る。
           */}
          {message.forwardedFromMessage.event ? (
            <Box
              data-testid="forwarded-event-summary"
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 0.5,
                maxWidth: 240,
                mt: 0.25,
              }}
            >
              <EventIcon sx={{ fontSize: '0.85rem', color: 'primary.main' }} />
              <Box sx={{ minWidth: 0 }}>
                <Typography
                  variant="caption"
                  fontWeight={600}
                  data-testid="forwarded-event-title"
                  display="block"
                  sx={{
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {message.forwardedFromMessage.event.title}
                </Typography>
                <Typography
                  variant="caption"
                  color="text.secondary"
                  data-testid="forwarded-event-start"
                  display="block"
                >
                  📅 {formatEventStart(message.forwardedFromMessage.event.startsAt)}
                </Typography>
              </Box>
            </Box>
          ) : (
            <Typography
              variant="caption"
              color="text.secondary"
              data-testid="forwarded-content"
              display="block"
              sx={{
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                maxWidth: 200,
              }}
            >
              {(() => {
                try {
                  const parsed = JSON.parse(message.forwardedFromMessage.content) as {
                    ops?: { insert?: string | object }[];
                  };
                  return (
                    parsed.ops
                      ?.map((op) => (typeof op.insert === 'string' ? op.insert : ''))
                      .join('')
                      .trim()
                      .slice(0, 100) ?? message.forwardedFromMessage.content
                  );
                } catch {
                  return message.forwardedFromMessage.content;
                }
              })()}
            </Typography>
          )}
        </Box>
      )}

      {/* 引用元メッセージプレビュー */}
      {message.quotedMessage && (
        <Box
          data-testid="quoted-message-preview"
          sx={{
            borderLeft: '3px solid',
            borderColor: 'primary.main',
            pl: 1,
            mb: 0.5,
            opacity: 0.8,
            fontSize: '0.8rem',
          }}
        >
          <Typography
            variant="caption"
            fontWeight="bold"
            data-testid="quoted-username"
            display="block"
          >
            {message.quotedMessage.username}
          </Typography>
          <Typography
            variant="caption"
            color="text.secondary"
            data-testid="quoted-content"
            display="block"
            sx={{
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              maxWidth: 200,
            }}
          >
            {(() => {
              try {
                const parsed = JSON.parse(message.quotedMessage.content) as {
                  ops?: { insert?: string | object }[];
                };
                return (
                  parsed.ops
                    ?.map((op) => (typeof op.insert === 'string' ? op.insert : ''))
                    .join('')
                    .trim()
                    .slice(0, 100) ?? message.quotedMessage.content
                );
              } catch {
                return message.quotedMessage.content;
              }
            })()}
          </Typography>
        </Box>
      )}

      {renderMessageContent(message.content)}

      {/* 添付ファイル */}
      {message.attachments && message.attachments.length > 0 && (
        <Box
          data-testid="message-attachments"
          sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, mt: 0.5 }}
        >
          {message.attachments.map((attachment) => {
            const isImage = attachment.mimeType.startsWith('image/');
            return isImage ? (
              <Link
                key={attachment.id}
                href={attachment.url}
                download={attachment.originalName}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={attachment.originalName}
              >
                <Box
                  component="img"
                  src={attachment.url}
                  alt={attachment.originalName}
                  sx={{
                    maxWidth: '100%',
                    maxHeight: 200,
                    borderRadius: 1,
                    display: 'block',
                  }}
                />
              </Link>
            ) : (
              <Link
                key={attachment.id}
                href={attachment.url}
                download={attachment.originalName}
                underline="hover"
                sx={{ display: 'flex', alignItems: 'center', gap: 0.5, fontSize: '0.8rem' }}
                aria-label={attachment.originalName}
              >
                <InsertDriveFileIcon fontSize="small" data-testid="file-icon" />
                <Typography variant="caption">{attachment.originalName}</Typography>
              </Link>
            );
          })}
        </Box>
      )}

      {/* リアクションバッジ */}
      {reactions.length > 0 && (
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mt: 0.5 }}>
          {reactions.map((reaction) => (
            <ReactionBadge
              key={reaction.emoji}
              reaction={reaction}
              currentUserId={currentUserId}
              users={users}
              onClick={onReactionClick}
            />
          ))}
        </Box>
      )}

      {/* 返信バッジ */}
      {message.replyCount > 0 && (
        <Box
          component="button"
          onClick={() => onOpenThread?.(message.id)}
          sx={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 0.5,
            mt: 0.5,
            px: 1,
            py: 0.25,
            border: 'none',
            borderRadius: 1,
            bgcolor: 'transparent',
            color: 'primary.main',
            cursor: 'pointer',
            fontSize: '0.75rem',
            fontWeight: 600,
            '&:hover': { bgcolor: 'action.hover' },
          }}
        >
          <ReplyIcon sx={{ fontSize: '0.875rem' }} />
          {message.replyCount}件の返信
        </Box>
      )}
    </Box>
  );
}
