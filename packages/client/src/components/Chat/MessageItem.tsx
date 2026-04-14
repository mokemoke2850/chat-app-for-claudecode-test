import { useState, useEffect } from 'react';
import { Box, Avatar, Typography, IconButton, Tooltip, Popover, Paper, Link } from '@mui/material';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import CloseIcon from '@mui/icons-material/Close';
import RestoreIcon from '@mui/icons-material/Restore';
import LinkIcon from '@mui/icons-material/Link';
import LocationOnIcon from '@mui/icons-material/LocationOn';
import InsertDriveFileIcon from '@mui/icons-material/InsertDriveFile';
import EmojiEmotionsIcon from '@mui/icons-material/EmojiEmotions';
import ReplyIcon from '@mui/icons-material/Reply';
import PushPinIcon from '@mui/icons-material/PushPin';
import type { Message, Reaction, User } from '@chat-app/shared';
import { useSocket } from '../../contexts/SocketContext';
import RichEditor from './RichEditor';
import EmojiPicker from './EmojiPicker';
import ReactionBadge from './ReactionBadge';
import { getAvatarColor } from '../../utils/avatarColor';

interface Props {
  message: Message;
  currentUserId: number;
  users: User[];
  onOpenThread?: (messageId: number) => void;
  onPinMessage?: (messageId: number) => void;
  isPinned?: boolean;
}

function formatTime(dateStr: string): string {
  return new Date(dateStr).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

interface DeltaOp {
  insert?: string | { mention?: { value: string }; image?: string };
  attributes?: {
    bold?: boolean;
    italic?: boolean;
    underline?: boolean;
    strike?: boolean;
    code?: boolean;
    'code-block'?: boolean;
    color?: string;
    background?: string;
  };
}

function renderContent(content: string): React.ReactNode {
  try {
    const delta = JSON.parse(content) as { ops?: DeltaOp[] };
    const ops = delta.ops ?? [];

    return ops.map((op, i) => {
      // Mention blot
      if (typeof op.insert === 'object' && op.insert?.mention) {
        return (
          <Box key={i} component="span" sx={{ color: 'primary.main', fontWeight: 600 }}>
            @{op.insert.mention.value}
          </Box>
        );
      }

      // Image blot
      if (typeof op.insert === 'object' && op.insert?.image) {
        return (
          <Box
            key={i}
            component="img"
            src={op.insert.image}
            alt="Attached image"
            sx={{ maxWidth: '100%', maxHeight: 300, borderRadius: 1, display: 'block', mt: 0.5 }}
          />
        );
      }

      if (typeof op.insert !== 'string') return null;

      const text = op.insert;
      const a = op.attributes;

      // Code block — render as pre
      if (a?.['code-block']) {
        return (
          <Box
            key={i}
            component="pre"
            sx={{
              display: 'inline',
              background: 'action.hover',
              px: 0.5,
              borderRadius: 1,
              fontFamily: 'monospace',
              fontSize: '0.85em',
            }}
          >
            {text}
          </Box>
        );
      }

      // Build inline style for color / background
      const inlineStyle: React.CSSProperties = {};
      if (a?.color) inlineStyle.color = a.color;
      if (a?.background) inlineStyle.backgroundColor = a.background;

      let node: React.ReactNode = text;
      if (a?.bold) node = <strong key={`b${i}`}>{node}</strong>;
      if (a?.italic) node = <em key={`i${i}`}>{node}</em>;
      if (a?.underline) node = <u key={`u${i}`}>{node}</u>;
      if (a?.strike) node = <s key={`s${i}`}>{node}</s>;
      if (a?.code)
        node = (
          <Box
            key={`c${i}`}
            component="code"
            sx={{
              background: 'action.hover',
              px: 0.5,
              borderRadius: 1,
              fontFamily: 'monospace',
              fontSize: '0.85em',
            }}
          >
            {node}
          </Box>
        );

      if (Object.keys(inlineStyle).length > 0) {
        node = (
          <span key={`style${i}`} style={inlineStyle}>
            {node}
          </span>
        );
      }

      return <span key={i}>{node}</span>;
    });
  } catch {
    return content;
  }
}

export default function MessageItem({ message, currentUserId, users, onOpenThread, onPinMessage, isPinned = false }: Props) {
  const [editing, setEditing] = useState(false);
  const [profileAnchor, setProfileAnchor] = useState<HTMLElement | null>(null);
  const [emojiAnchor, setEmojiAnchor] = useState<HTMLElement | null>(null);
  const [reactions, setReactions] = useState<Reaction[]>(message.reactions ?? []);
  const socket = useSocket();
  const isOwn = message.userId === currentUserId;

  useEffect(() => {
    if (!socket) return;
    const handler = (data: { messageId: number; channelId: number; reactions: Reaction[] }) => {
      if (data.messageId === message.id) {
        setReactions(data.reactions);
      }
    };
    socket.on('reaction_updated', handler);
    return () => {
      socket.off('reaction_updated', handler);
    };
  }, [socket, message.id]);

  // 投稿者の User 情報を users 配列から取得
  const author = users.find((u) => u.id === message.userId);
  const displayName = author?.displayName || message.username;

  const handleEditSend = (content: string, mentionedUserIds: number[], attachmentIds: number[]) => {
    socket?.emit('edit_message', {
      messageId: message.id,
      content,
      mentionedUserIds,
      attachmentIds,
    });
    setEditing(false);
  };

  const handleDelete = () => {
    socket?.emit('delete_message', message.id);
  };

  const handleRestore = () => {
    socket?.emit('restore_message', message.id);
  };

  const handleCopyLink = () => {
    const url = `${window.location.origin}${window.location.pathname}?channel=${message.channelId}#message-${message.id}`;
    navigator.clipboard.writeText(url);
  };

  const handleReactionClick = (emoji: string) => {
    const alreadyReacted = reactions
      .find((r) => r.emoji === emoji)
      ?.userIds.includes(currentUserId);
    if (alreadyReacted) {
      socket?.emit('remove_reaction', { messageId: message.id, emoji });
    } else {
      socket?.emit('add_reaction', { messageId: message.id, emoji });
    }
  };

  if (message.isDeleted) {
    return (
      <Box
        sx={{ display: 'flex', gap: 1.5, px: 2, py: 0.5, opacity: 0.5, alignItems: 'flex-start' }}
      >
        <Avatar
          src={author?.avatarUrl ?? undefined}
          sx={{
            width: 36,
            height: 36,
            mt: 0.5,
            ...(!author?.avatarUrl && { bgcolor: getAvatarColor(author?.email ?? '') }),
          }}
        >
          {displayName[0].toUpperCase()}
        </Avatar>
        <Box>
          <Typography variant="caption" color="text.secondary">
            {displayName}
          </Typography>
          <Typography variant="body2" fontStyle="italic" color="text.secondary">
            This message was deleted.
          </Typography>
          {isOwn && (
            <Tooltip title="取り消しを元に戻す">
              <IconButton size="small" aria-label="取り消しを元に戻す" onClick={handleRestore}>
                <RestoreIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          )}
        </Box>
      </Box>
    );
  }

  return (
    <Box
      id={`message-${message.id}`}
      data-own={isOwn ? 'true' : 'false'}
      sx={{
        display: 'flex',
        flexDirection: isOwn ? 'row-reverse' : 'row',
        gap: 1.5,
        px: 2,
        py: 0.5,
        '&:hover .msg-actions': { opacity: 1 },
        position: 'relative',
        alignItems: 'flex-start',
      }}
    >
      {/* アバター（ホバーでプロフィールポップアップ） */}
      <Box
        data-testid="user-avatar"
        onMouseEnter={(e) => setProfileAnchor(e.currentTarget)}
        onMouseLeave={() => setProfileAnchor(null)}
        sx={{ flexShrink: 0, cursor: 'pointer' }}
      >
        <Avatar
          src={author?.avatarUrl ?? message.avatarUrl ?? undefined}
          alt={displayName}
          sx={{
            width: 36,
            height: 36,
            ...(!(author?.avatarUrl ?? message.avatarUrl) && {
              bgcolor: getAvatarColor(author?.email ?? ''),
            }),
          }}
        >
          {displayName[0].toUpperCase()}
        </Avatar>
      </Box>

      {/* プロフィールポップアップ */}
      <Popover
        open={Boolean(profileAnchor)}
        anchorEl={profileAnchor}
        onClose={() => setProfileAnchor(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
        transformOrigin={{ vertical: 'top', horizontal: 'left' }}
        disableRestoreFocus
        sx={{ pointerEvents: 'none' }}
      >
        <Paper sx={{ p: 2, display: 'flex', gap: 1.5, alignItems: 'center', minWidth: 200 }}>
          <Avatar
            src={author?.avatarUrl ?? undefined}
            alt={displayName}
            sx={{
              width: 48,
              height: 48,
              ...(!author?.avatarUrl && { bgcolor: getAvatarColor(author?.email ?? '') }),
            }}
          >
            {displayName[0].toUpperCase()}
          </Avatar>
          <Box>
            <Typography variant="subtitle2" fontWeight="bold">
              {displayName}
            </Typography>
            {author && (
              <Typography variant="caption" color="text.secondary" display="block">
                {`ID: ${author.id}`}
              </Typography>
            )}
            {author?.email && (
              <Typography variant="caption" color="text.secondary" display="block">
                {author.email}
              </Typography>
            )}
            {author?.location && (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                <LocationOnIcon fontSize="small" color="action" />
                <Typography variant="body2" color="text.secondary">
                  {author.location}
                </Typography>
              </Box>
            )}
          </Box>
        </Paper>
      </Popover>

      <Box
        sx={{
          flexGrow: 1,
          minWidth: 0,
          display: 'flex',
          flexDirection: 'column',
          alignItems: isOwn ? 'flex-end' : 'flex-start',
        }}
      >
        <Box
          sx={{
            display: 'flex',
            flexDirection: isOwn ? 'row-reverse' : 'row',
            alignItems: 'baseline',
            gap: 1,
          }}
        >
          <Typography variant="subtitle2" fontWeight="bold">
            {displayName}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {formatTime(message.createdAt)}
          </Typography>
          {message.isEdited && (
            <Typography variant="caption" color="text.secondary">
              (edited)
            </Typography>
          )}
        </Box>

        {editing ? (
          <Box sx={{ mt: 0.5, width: '100%' }}>
            <RichEditor
              users={users}
              onSend={handleEditSend}
              onCancel={() => setEditing(false)}
              initialContent={message.content}
              initialAttachments={message.attachments ?? []}
            />
          </Box>
        ) : (
          /* バブルとアクションを横並びにして、バブルのすぐ隣にボタンを配置する */
          <Box
            sx={{
              display: 'flex',
              flexDirection: isOwn ? 'row-reverse' : 'row',
              alignItems: 'flex-end',
              gap: 0.5,
              mt: 0.25,
            }}
          >
            {/* メッセージバブル */}
            <Box
              sx={{
                maxWidth: '75%',
                wordBreak: 'break-word',
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
              {renderContent(message.content)}

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
                      onClick={handleReactionClick}
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

            {/* 絵文字ピッカー（Popper なので DOM 位置は任意） */}
            <EmojiPicker
              anchorEl={emojiAnchor}
              onSelect={(emoji) => {
                socket?.emit('add_reaction', { messageId: message.id, emoji });
              }}
              onClose={() => setEmojiAnchor(null)}
            />

            {/* アクションボタン（バブルのすぐ隣） */}
            <Box
              className="msg-actions"
              sx={{
                opacity: 0,
                transition: 'opacity 0.15s',
                display: 'flex',
                flexDirection: 'row',
                gap: 0.25,
                flexShrink: 0,
              }}
            >
              <Tooltip title="返信">
                <IconButton
                  size="small"
                  aria-label="返信"
                  onClick={() => onOpenThread?.(message.id)}
                >
                  <ReplyIcon fontSize="small" />
                </IconButton>
              </Tooltip>
              <Tooltip title="リアクションを追加">
                <IconButton
                  size="small"
                  aria-label="リアクションを追加"
                  onClick={(e) => setEmojiAnchor(e.currentTarget)}
                >
                  <EmojiEmotionsIcon fontSize="small" />
                </IconButton>
              </Tooltip>
              <Tooltip title={isPinned ? 'ピン留めを解除' : 'ピン留め'}>
                <IconButton
                  size="small"
                  aria-label={isPinned ? 'ピン留めを解除' : 'ピン留め'}
                  onClick={() => onPinMessage?.(message.id)}
                  color={isPinned ? 'primary' : 'default'}
                >
                  <PushPinIcon fontSize="small" />
                </IconButton>
              </Tooltip>
              <Tooltip title="リンクをコピー">
                <IconButton size="small" aria-label="リンクをコピー" onClick={handleCopyLink}>
                  <LinkIcon fontSize="small" />
                </IconButton>
              </Tooltip>
              {isOwn && (
                <>
                  <Tooltip title="Edit">
                    <IconButton size="small" onClick={() => setEditing(true)}>
                      <EditIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                  <Tooltip title="Delete">
                    <IconButton size="small" color="error" onClick={handleDelete}>
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                </>
              )}
            </Box>
          </Box>
        )}
      </Box>

      {editing && (
        <Box sx={{ display: 'flex', gap: 0.5, alignItems: 'flex-start', flexShrink: 0 }}>
          <Tooltip title="Cancel">
            <IconButton size="small" onClick={() => setEditing(false)}>
              <CloseIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </Box>
      )}
    </Box>
  );
}
