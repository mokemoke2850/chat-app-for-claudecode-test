import { useState, useEffect } from 'react';
import { Box, Avatar, Typography, IconButton, Tooltip, Button } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import RestoreIcon from '@mui/icons-material/Restore';
import type { Message, Reaction, User } from '@chat-app/shared';
import { useSocket } from '../../contexts/SocketContext';
import RichEditor from './RichEditor';
import MessageBubble from './MessageBubble';
import MessageActions from './MessageActions';
import UserProfilePopover from './UserProfilePopover';
import { getAvatarColor } from '../../utils/avatarColor';
import TagChip from './TagChip';
import TagInput from './TagInput';
import { api } from '../../api/client';
import { useSnackbar } from '../../contexts/SnackbarContext';

interface Props {
  message: Message;
  currentUserId: number;
  users: User[];
  onOpenThread?: (messageId: number) => void;
  onPinMessage?: (messageId: number) => void;
  isPinned?: boolean;
  isBookmarked?: boolean;
  onBookmarkChange?: (messageId: number, bookmarked: boolean) => void;
  onQuoteReply?: (message: Message) => void;
  onTagClick?: (tagName: string) => void;
}

function formatTime(dateStr: string): string {
  return new Date(dateStr).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export default function MessageItem({
  message,
  currentUserId,
  users,
  onOpenThread,
  onPinMessage,
  isPinned = false,
  isBookmarked = false,
  onBookmarkChange,
  onQuoteReply,
  onTagClick,
}: Props) {
  const [editing, setEditing] = useState(false);
  const [profileAnchor, setProfileAnchor] = useState<HTMLElement | null>(null);
  const [reactions, setReactions] = useState<Reaction[]>(message.reactions ?? []);
  const [tagEditing, setTagEditing] = useState(false);
  const [tagNames, setTagNames] = useState<string[]>((message.tags ?? []).map((t) => t.name));
  const socket = useSocket();
  const { showError } = useSnackbar();
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

  const handleRestore = () => {
    socket?.emit('restore_message', message.id);
  };

  const handleTagSave = async (names: string[]) => {
    try {
      await api.tags.setMessageTags(message.id, names);
      setTagNames(names);
      setTagEditing(false);
    } catch (err) {
      const msg = err instanceof Error && err.message ? err.message : 'タグの保存に失敗しました';
      showError(msg);
    }
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
      <UserProfilePopover
        user={author}
        displayName={displayName}
        anchorEl={profileAnchor}
        open={Boolean(profileAnchor)}
        onClose={() => setProfileAnchor(null)}
      />

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
            <Box
              sx={{
                display: 'flex',
                flexDirection: 'column',
                gap: 0.5,
                minWidth: 0,
                maxWidth: '75%',
                alignItems: isOwn ? 'flex-end' : 'flex-start',
              }}
            >
              <MessageBubble
                message={message}
                reactions={reactions}
                currentUserId={currentUserId}
                users={users}
                isOwn={isOwn}
                onReactionClick={handleReactionClick}
                onOpenThread={onOpenThread}
              />

              {/* タグ表示・編集エリア */}
              {tagEditing ? (
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, mt: 0.5 }}>
                  <TagInput value={tagNames} onChange={setTagNames} />
                  <Box sx={{ display: 'flex', gap: 1 }}>
                    <Button
                      size="small"
                      variant="contained"
                      onClick={() => void handleTagSave(tagNames)}
                    >
                      保存
                    </Button>
                    <Button
                      size="small"
                      onClick={() => {
                        setTagEditing(false);
                        setTagNames((message.tags ?? []).map((t) => t.name));
                      }}
                    >
                      キャンセル
                    </Button>
                  </Box>
                </Box>
              ) : (
                tagNames.length > 0 && (
                  <Box
                    sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mt: 0.25 }}
                    data-testid="tag-chips"
                  >
                    {tagNames.map((name) => {
                      const tag = (message.tags ?? []).find((t) => t.name === name);
                      if (!tag) return null;
                      return (
                        <TagChip key={tag.id} tag={tag} onClick={onTagClick} readOnly={true} />
                      );
                    })}
                    <Button
                      size="small"
                      aria-label="タグを編集"
                      sx={{ fontSize: '0.65rem', height: 20, px: 0.5 }}
                      onClick={() => setTagEditing(true)}
                    >
                      タグを編集
                    </Button>
                  </Box>
                )
              )}
            </Box>

            <MessageActions
              message={message}
              isOwn={isOwn}
              isPinned={isPinned}
              isBookmarked={isBookmarked}
              onBookmarkChange={onBookmarkChange}
              onQuoteReply={onQuoteReply}
              onOpenThread={onOpenThread}
              onPinMessage={onPinMessage}
              onEdit={() => setEditing(true)}
              onEditTags={() => setTagEditing(true)}
            />
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
