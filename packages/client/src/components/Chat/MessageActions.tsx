import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  IconButton,
  Tooltip,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
} from '@mui/material';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import FlagIcon from '@mui/icons-material/Flag';
import LabelIcon from '@mui/icons-material/Label';
import LinkIcon from '@mui/icons-material/Link';
import EmojiEmotionsIcon from '@mui/icons-material/EmojiEmotions';
import ReplyIcon from '@mui/icons-material/Reply';
import FormatQuoteIcon from '@mui/icons-material/FormatQuote';
import PushPinIcon from '@mui/icons-material/PushPin';
import BookmarkIcon from '@mui/icons-material/Bookmark';
import BookmarkBorderIcon from '@mui/icons-material/BookmarkBorder';
import AlarmIcon from '@mui/icons-material/Alarm';
import ForwardIcon from '@mui/icons-material/Forward';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import AssignmentIcon from '@mui/icons-material/Assignment';
import MenuBookIcon from '@mui/icons-material/MenuBook';
import type { Message } from '@chat-app/shared';
import EmojiPicker from './EmojiPicker';
import ReminderDialog from '../Reminder/ReminderDialog';
import ForwardMessageDialog from './ForwardMessageDialog';
import ReportMessageDialog from './ReportMessageDialog';
import CreateTaskDialog from '../Task/CreateTaskDialog';
import { api } from '../../api/client';
import { useSocket } from '../../contexts/SocketContext';
import { useSnackbar } from '../../contexts/SnackbarContext';
import { extractMessageText } from '../../utils/extractMessageText';

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
  const [menuAnchor, setMenuAnchor] = useState<HTMLElement | null>(null);
  const [bookmarked, setBookmarked] = useState(isBookmarked);
  const [reminderDialogOpen, setReminderDialogOpen] = useState(false);
  const [forwardDialogOpen, setForwardDialogOpen] = useState(false);
  const [reportDialogOpen, setReportDialogOpen] = useState(false);
  const [createTaskDialogOpen, setCreateTaskDialogOpen] = useState(false);
  const socket = useSocket();
  const { showSuccess, showError } = useSnackbar();
  const navigate = useNavigate();

  const handleDelete = () => {
    socket?.emit('delete_message', message.id);
  };

  // メッセージを Wiki ページ化する（#355）
  // 本文と元メッセージURLを sessionStorage に保存し、Wikiタブの新規作成フォームへ遷移する
  const handleWikify = () => {
    const url = `${window.location.origin}/?channel=${message.channelId}&message=${message.id}`;
    sessionStorage.setItem(
      `wiki.fromMessage.${message.id}`,
      JSON.stringify({ content: extractMessageText(message.content), url }),
    );
    navigate(`/chat?channel=${message.channelId}&newWiki=1&fromMessage=${message.id}`);
  };

  const handleCopyLink = () => {
    const url = `${window.location.origin}${window.location.pathname}?channel=${message.channelId}&message=${message.id}`;
    navigator.clipboard.writeText(url).then(
      () => {
        showSuccess('リンクをコピーしました');
      },
      () => {
        showError('リンクのコピーに失敗しました');
      },
    );
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

  const closeMenu = () => setMenuAnchor(null);

  return (
    <>
      {/* 可視性は外側 .msg-actions-floating の display で制御する (opacity 切り替えは不要) */}
      <Box
        className="msg-actions"
        sx={{
          display: 'flex',
          flexDirection: 'row',
          gap: 0.25,
          flexShrink: 0,
        }}
      >
        {/* 直置きアイコン: リアクション追加 */}
        <Tooltip title="リアクションを追加">
          <IconButton
            size="small"
            aria-label="リアクションを追加"
            onClick={(e) => setEmojiAnchor(e.currentTarget)}
          >
            <EmojiEmotionsIcon fontSize="small" />
          </IconButton>
        </Tooltip>

        {/* 直置きアイコン: 返信（スレッド） */}
        <Tooltip title="返信">
          <IconButton size="small" aria-label="返信" onClick={() => onOpenThread?.(message.id)}>
            <ReplyIcon fontSize="small" />
          </IconButton>
        </Tooltip>

        {/* 直置きアイコン: 編集・削除（自分のメッセージのみ） */}
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

        {/* 3点メニュートグルボタン */}
        <Tooltip title="その他のアクション">
          <IconButton
            size="small"
            aria-label="その他のアクション"
            onClick={(e) => setMenuAnchor(e.currentTarget)}
          >
            <MoreVertIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      </Box>

      {/* 3点メニュー */}
      <Menu
        anchorEl={menuAnchor}
        open={Boolean(menuAnchor)}
        onClose={closeMenu}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
        transitionDuration={0}
      >
        {/* 引用返信 */}
        <MenuItem
          onClick={() => {
            onQuoteReply?.(message);
            closeMenu();
          }}
        >
          <ListItemIcon>
            <FormatQuoteIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>引用返信</ListItemText>
        </MenuItem>

        {/* 転送 */}
        <MenuItem
          onClick={() => {
            setForwardDialogOpen(true);
            closeMenu();
          }}
        >
          <ListItemIcon>
            <ForwardIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>転送</ListItemText>
        </MenuItem>

        {/* ピン留め / ピン留め解除 */}
        <MenuItem
          onClick={() => {
            onPinMessage?.(message.id);
            closeMenu();
          }}
        >
          <ListItemIcon>
            <PushPinIcon fontSize="small" color={isPinned ? 'primary' : 'inherit'} />
          </ListItemIcon>
          <ListItemText>{isPinned ? 'ピン留めを解除' : 'ピン留め'}</ListItemText>
        </MenuItem>

        {/* ブックマーク / ブックマーク解除 */}
        <MenuItem
          onClick={() => {
            void handleBookmark();
            closeMenu();
          }}
        >
          <ListItemIcon>
            {bookmarked ? (
              <BookmarkIcon fontSize="small" color="primary" />
            ) : (
              <BookmarkBorderIcon fontSize="small" />
            )}
          </ListItemIcon>
          <ListItemText>{bookmarked ? 'ブックマーク解除' : 'ブックマーク'}</ListItemText>
        </MenuItem>

        {/* リマインダー設定 */}
        <MenuItem
          onClick={() => {
            setReminderDialogOpen(true);
            closeMenu();
          }}
        >
          <ListItemIcon>
            <AlarmIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>リマインダー設定</ListItemText>
        </MenuItem>

        {/* リンクをコピー */}
        <MenuItem
          onClick={() => {
            handleCopyLink();
            closeMenu();
          }}
        >
          <ListItemIcon>
            <LinkIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>リンクをコピー</ListItemText>
        </MenuItem>

        {/* タグを編集 */}
        <MenuItem
          onClick={() => {
            onEditTags?.();
            closeMenu();
          }}
        >
          <ListItemIcon>
            <LabelIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>タグを編集</ListItemText>
        </MenuItem>

        {/* タスク化 (#151) */}
        <MenuItem
          onClick={() => {
            setCreateTaskDialogOpen(true);
            closeMenu();
          }}
        >
          <ListItemIcon>
            <AssignmentIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>タスク化</ListItemText>
        </MenuItem>

        {/* Wikiページ化 (#355) */}
        <MenuItem
          onClick={() => {
            handleWikify();
            closeMenu();
          }}
        >
          <ListItemIcon>
            <MenuBookIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>Wikiページ化</ListItemText>
        </MenuItem>

        {/* 通報（自分のメッセージ以外） */}
        {!isOwn && (
          <MenuItem
            onClick={() => {
              setReportDialogOpen(true);
              closeMenu();
            }}
          >
            <ListItemIcon>
              <FlagIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText>通報</ListItemText>
          </MenuItem>
        )}
      </Menu>

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

      <ForwardMessageDialog
        open={forwardDialogOpen}
        messageId={message.id}
        onClose={() => setForwardDialogOpen(false)}
      />

      {/* #116 通報ダイアログ */}
      <ReportMessageDialog
        open={reportDialogOpen}
        messageId={message.id}
        onClose={() => setReportDialogOpen(false)}
      />

      {/* #151 タスク作成ダイアログ */}
      <CreateTaskDialog
        open={createTaskDialogOpen}
        onClose={() => setCreateTaskDialogOpen(false)}
        sourceMessageId={message.id}
      />
    </>
  );
}
