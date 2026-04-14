import { use, useState, Suspense } from 'react';
import { renderMessageContent } from '../utils/renderMessageContent';
import {
  Box,
  Typography,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  IconButton,
  CircularProgress,
  AppBar,
  Toolbar,
  Tooltip,
  Divider,
  Paper,
  Avatar,
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import BookmarkIcon from '@mui/icons-material/Bookmark';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import type { Bookmark } from '@chat-app/shared';

let _bookmarksPromise: Promise<{ bookmarks: Bookmark[] }> | null = null;

export function resetBookmarksCache(): void {
  _bookmarksPromise = null;
}

function getOrCreateBookmarksPromise(): Promise<{ bookmarks: Bookmark[] }> {
  if (!_bookmarksPromise) {
    _bookmarksPromise = api.bookmarks.list();
  }
  return _bookmarksPromise;
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleString('ja-JP', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

interface BookmarkListContentProps {
  bookmarksPromise: Promise<{ bookmarks: Bookmark[] }>;
}

function BookmarkListContent({ bookmarksPromise }: BookmarkListContentProps) {
  const { bookmarks: initialBookmarks } = use(bookmarksPromise);
  const [bookmarks, setBookmarks] = useState<Bookmark[]>(initialBookmarks);
  const navigate = useNavigate();

  const handleRemove = async (messageId: number) => {
    await api.bookmarks.remove(messageId);
    setBookmarks((prev) => prev.filter((b) => b.messageId !== messageId));
    _bookmarksPromise = null;
  };

  const handleJump = (bookmark: Bookmark) => {
    if (bookmark.message?.channelId) {
      navigate(`/?channel=${bookmark.message.channelId}&message=${bookmark.messageId}`);
    }
  };

  if (bookmarks.length === 0) {
    return (
      <Box sx={{ textAlign: 'center', mt: 8, color: 'text.secondary' }}>
        <BookmarkIcon sx={{ fontSize: 64, mb: 2, opacity: 0.3 }} />
        <Typography variant="h6">ブックマークはありません</Typography>
        <Typography variant="body2" sx={{ mt: 1 }}>
          メッセージをブックマークして後で見返しましょう
        </Typography>
      </Box>
    );
  }

  return (
    <List disablePadding>
      {bookmarks.map((bookmark, index) => (
        <Box key={bookmark.id}>
          {index > 0 && <Divider component="li" />}
          <ListItem
            alignItems="flex-start"
            onClick={() => handleJump(bookmark)}
            sx={{ cursor: 'pointer', '&:hover': { bgcolor: 'action.hover' } }}
          >
            <Avatar
              src={bookmark.message?.avatarUrl ?? undefined}
              sx={{ mr: 2, mt: 0.5, width: 36, height: 36 }}
            >
              {bookmark.message?.username?.[0]?.toUpperCase()}
            </Avatar>
            <ListItemText
              primary={
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Typography variant="subtitle2" component="span">
                    {bookmark.message?.username ?? '不明なユーザー'}
                  </Typography>
                  {bookmark.channelName && (
                    <Typography variant="caption" color="text.secondary">
                      #{bookmark.channelName}
                    </Typography>
                  )}
                  <Typography variant="caption" color="text.secondary">
                    {formatDate(bookmark.bookmarkedAt)}
                  </Typography>
                </Box>
              }
              secondary={
                <Typography
                  variant="body2"
                  color="text.primary"
                  sx={{ mt: 0.5, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}
                >
                  {bookmark.message
                    ? renderMessageContent(bookmark.message.content)
                    : '（メッセージを取得できません）'}
                </Typography>
              }
            />
            <ListItemSecondaryAction>
              <Tooltip title="ブックマーク解除">
                <IconButton
                  edge="end"
                  size="small"
                  onClick={(e) => {
                    e.stopPropagation();
                    void handleRemove(bookmark.messageId);
                  }}
                >
                  <DeleteOutlineIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            </ListItemSecondaryAction>
          </ListItem>
        </Box>
      ))}
    </List>
  );
}

function BookmarkPageInner() {
  const [bookmarksPromise] = useState(() => getOrCreateBookmarksPromise());
  const navigate = useNavigate();

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
      <AppBar position="static">
        <Toolbar>
          <Tooltip title="戻る">
            <IconButton color="inherit" edge="start" onClick={() => navigate(-1)} sx={{ mr: 1 }}>
              <ArrowBackIcon />
            </IconButton>
          </Tooltip>
          <BookmarkIcon sx={{ mr: 1 }} />
          <Typography variant="h6">ブックマーク</Typography>
        </Toolbar>
      </AppBar>

      <Box sx={{ flexGrow: 1, overflow: 'auto', p: 2 }}>
        <Paper elevation={0} variant="outlined" sx={{ maxWidth: 800, mx: 'auto' }}>
          <Suspense
            fallback={
              <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
                <CircularProgress />
              </Box>
            }
          >
            <BookmarkListContent bookmarksPromise={bookmarksPromise} />
          </Suspense>
        </Paper>
      </Box>
    </Box>
  );
}

export default function BookmarkPage() {
  return (
    <Suspense
      fallback={
        <Box
          sx={{ display: 'flex', height: '100vh', alignItems: 'center', justifyContent: 'center' }}
        >
          <CircularProgress />
        </Box>
      }
    >
      <BookmarkPageInner />
    </Suspense>
  );
}
