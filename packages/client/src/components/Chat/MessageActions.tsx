import { useState } from 'react';
import { Box, IconButton, Tooltip } from '@mui/material';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import LabelIcon from '@mui/icons-material/Label';
import LinkIcon from '@mui/icons-material/Link';
import EmojiEmotionsIcon from '@mui/icons-material/EmojiEmotions';
import ReplyIcon from '@mui/icons-material/Reply';
import FormatQuoteIcon from '@mui/icons-material/FormatQuote';
import PushPinIcon from '@mui/icons-material/PushPin';
import BookmarkIcon from '@mui/icons-material/Bookmark';
import BookmarkBorderIcon from '@mui/icons-material/BookmarkBorder';
import AlarmIcon from '@mui/icons-material/Alarm';
import type { Message } from '@chat-app/shared';
import EmojiPicker from './EmojiPicker';
import ReminderDialog from '../Reminder/ReminderDialog';
import { api } from '../../api/client';
import { useSocket } from '../../contexts/SocketContext';

interface Props {
  message: Message;
  isOwn: boolean;
  isPinned?: boolean;
  isBookmarked?: boolean;
  onBookmarkChange?: (messageId: number, bookmarked: boolean) => void;
  onQuoteReply?: (message: Message) => void;
  onOpenThread?: (messageId: number) => void;
  onPinMessage?: (messageId: number) => void;
  onEdit?: () => void;
  onEditTags?: () => void;
}

export default function MessageActions({
  message,
  isOwn,
  isPinned = false,
  isBookmarked = false,
  onBookmarkChange,
  onQuoteReply,
  onOpenThread,
  onPinMessage,
  onEdit,
  onEditTags,
}: Props) {
  const [emojiAnchor, setEmojiAnchor] = useState<HTMLElement | null>(null);
  const [bookmarked, setBookmarked] = useState(isBookmarked);
  const [reminderDialogOpen, setReminderDialogOpen] = useState(false);
  const socket = useSocket();

  const handleDelete = () => {
    socket?.emit('delete_message', message.id);
  };

  const handleCopyLink = () => {
    const url = `${window.location.origin}${window.location.pathname}?channel=${message.channelId}#message-${message.id}`;
    navigator.clipboard.writeText(url);
  };

  const handleBookmark = async () => {
    try {
      if (bookmarked) {
        await api.bookmarks.remove(message.id);
        setBookmarked(false);
        onBookmarkChange?.(message.id, false);
      } else {
        await api.bookmarks.add(message.id);
        setBookmarked(true);
        onBookmarkChange?.(message.id, true);
      }
    } catch {
      // エラー時は状態を変更しない
    }
  };

  return (
    <>
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
        <Tooltip title="引用返信">
          <IconButton size="small" aria-label="引用返信" onClick={() => onQuoteReply?.(message)}>
            <FormatQuoteIcon fontSize="small" />
          </IconButton>
        </Tooltip>
        <Tooltip title="返信">
          <IconButton size="small" aria-label="返信" onClick={() => onOpenThread?.(message.id)}>
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
        <Tooltip title={bookmarked ? 'ブックマーク解除' : 'ブックマーク'}>
          <IconButton
            size="small"
            aria-label={bookmarked ? 'ブックマーク解除' : 'ブックマーク'}
            onClick={() => void handleBookmark()}
            color={bookmarked ? 'primary' : 'default'}
          >
            {bookmarked ? (
              <BookmarkIcon fontSize="small" />
            ) : (
              <BookmarkBorderIcon fontSize="small" />
            )}
          </IconButton>
        </Tooltip>
        <Tooltip title="リマインダー設定">
          <IconButton
            size="small"
            aria-label="リマインダー設定"
            onClick={() => setReminderDialogOpen(true)}
          >
            <AlarmIcon fontSize="small" />
          </IconButton>
        </Tooltip>
        <Tooltip title="リンクをコピー">
          <IconButton size="small" aria-label="リンクをコピー" onClick={handleCopyLink}>
            <LinkIcon fontSize="small" />
          </IconButton>
        </Tooltip>
        <Tooltip title="タグを編集">
          <IconButton size="small" aria-label="タグを編集" onClick={onEditTags}>
            <LabelIcon fontSize="small" />
          </IconButton>
        </Tooltip>
        {isOwn && (
          <>
            <Tooltip title="Edit">
              <IconButton size="small" aria-label="Edit" onClick={onEdit}>
                <EditIcon fontSize="small" />
              </IconButton>
            </Tooltip>
            <Tooltip title="Delete">
              <IconButton size="small" aria-label="Delete" color="error" onClick={handleDelete}>
                <DeleteIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          </>
        )}
      </Box>

      {/* 絵文字ピッカー */}
      <EmojiPicker
        anchorEl={emojiAnchor}
        onSelect={(emoji) => {
          socket?.emit('add_reaction', { messageId: message.id, emoji });
        }}
        onClose={() => setEmojiAnchor(null)}
      />

      <ReminderDialog
        open={reminderDialogOpen}
        message={message}
        onClose={() => setReminderDialogOpen(false)}
        onCreated={() => setReminderDialogOpen(false)}
      />
    </>
  );
}
