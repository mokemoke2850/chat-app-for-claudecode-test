import { use, useState, useMemo, Suspense, useEffect } from 'react';
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
  Tooltip,
  Divider,
  Paper,
  Avatar,
  TextField,
  InputAdornment,
  Chip,
  Stack,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  ToggleButton,
  ToggleButtonGroup,
} from '@mui/material';
import BookmarkIcon from '@mui/icons-material/Bookmark';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import SearchIcon from '@mui/icons-material/Search';
import LocalOfferIcon from '@mui/icons-material/LocalOffer';
import EditIcon from '@mui/icons-material/Edit';
import { useNavigate } from 'react-router-dom';
import AppLayout from '../components/Layout/AppLayout';
import { api } from '../api/client';
import type { Bookmark, BookmarkTag } from '@chat-app/shared';

let _bookmarksPromise: Promise<{ bookmarks: Bookmark[] }> | null = null;
let _tagsPromise: Promise<{ tags: BookmarkTag[] }> | null = null;

export function resetBookmarksCache(): void {
  _bookmarksPromise = null;
  _tagsPromise = null;
}

function getOrCreateBookmarksPromise(): Promise<{ bookmarks: Bookmark[] }> {
  if (!_bookmarksPromise) {
    _bookmarksPromise = api.bookmarks.list();
  }
  return _bookmarksPromise;
}

function getOrCreateTagsPromise(): Promise<{ tags: BookmarkTag[] }> {
  if (!_tagsPromise) {
    _tagsPromise = api.bookmarkTags.list();
  }
  return _tagsPromise;
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
  tagsPromise: Promise<{ tags: BookmarkTag[] }>;
}

function BookmarkListContent({ bookmarksPromise, tagsPromise }: BookmarkListContentProps) {
  const { bookmarks: initialBookmarks } = use(bookmarksPromise);
  const { tags: initialTags } = use(tagsPromise);
  const [bookmarks, setBookmarks] = useState<Bookmark[]>(initialBookmarks);
  const [tags, setTags] = useState<BookmarkTag[]>(initialTags);
  const [search, setSearch] = useState('');
  const [selectedTagIds, setSelectedTagIds] = useState<number[]>([]);
  const [tagMode, setTagMode] = useState<'and' | 'or'>('or');
  const [tagDialogOpen, setTagDialogOpen] = useState(false);
  const [assignTarget, setAssignTarget] = useState<Bookmark | null>(null);
  const navigate = useNavigate();

  const filteredBookmarks = useMemo(() => {
    const lower = search.trim().toLowerCase();
    return bookmarks.filter((b) => {
      if (lower !== '') {
        const content = (b.message?.content ?? '').toLowerCase();
        const username = (b.message?.username ?? '').toLowerCase();
        if (!content.includes(lower) && !username.includes(lower)) {
          return false;
        }
      }
      if (selectedTagIds.length > 0) {
        const bookmarkTagIds = (b.tags ?? []).map((t) => t.id);
        if (tagMode === 'and') {
          if (!selectedTagIds.every((id) => bookmarkTagIds.includes(id))) return false;
        } else {
          if (!selectedTagIds.some((id) => bookmarkTagIds.includes(id))) return false;
        }
      }
      return true;
    });
  }, [bookmarks, search, selectedTagIds, tagMode]);

  const handleRemove = async (messageId: number) => {
    await api.bookmarks.remove(messageId);
    setBookmarks((prev) => prev.filter((b) => b.messageId !== messageId));
    _bookmarksPromise = null;
  };

  const handleJump = (bookmark: Bookmark) => {
    if (bookmark.message?.channelId) {
      navigate(`/chat?channel=${bookmark.message.channelId}&message=${bookmark.messageId}`);
    }
  };

  const toggleTagFilter = (tagId: number) => {
    setSelectedTagIds((prev) =>
      prev.includes(tagId) ? prev.filter((id) => id !== tagId) : [...prev, tagId],
    );
  };

  const clearTagFilter = () => setSelectedTagIds([]);

  return (
    <Box>
      <Box sx={{ p: 2, display: 'flex', flexDirection: 'column', gap: 1.5 }}>
        <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
          <TextField
            fullWidth
            size="small"
            placeholder="ブックマークを検索"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon fontSize="small" />
                </InputAdornment>
              ),
            }}
            inputProps={{ 'aria-label': 'ブックマーク検索' }}
          />
          <Button
            size="small"
            variant="outlined"
            startIcon={<LocalOfferIcon />}
            onClick={() => setTagDialogOpen(true)}
            sx={{ flexShrink: 0, whiteSpace: 'nowrap' }}
          >
            タグ管理
          </Button>
        </Box>

        {tags.length > 0 && (
          <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap', gap: 0.5 }}>
            {tags.map((tag) => {
              const active = selectedTagIds.includes(tag.id);
              return (
                <Chip
                  key={tag.id}
                  label={tag.name}
                  size="small"
                  color={active ? 'primary' : 'default'}
                  variant={active ? 'filled' : 'outlined'}
                  onClick={() => toggleTagFilter(tag.id)}
                  aria-pressed={active}
                  aria-label={`タグ:${tag.name}`}
                />
              );
            })}
            {selectedTagIds.length > 0 && (
              <>
                <ToggleButtonGroup
                  size="small"
                  exclusive
                  value={tagMode}
                  onChange={(_, v) => {
                    if (v === 'and' || v === 'or') setTagMode(v);
                  }}
                  aria-label="タグ条件モード"
                  sx={{ ml: 1 }}
                >
                  <ToggleButton value="or" aria-label="OR モード">
                    OR
                  </ToggleButton>
                  <ToggleButton value="and" aria-label="AND モード">
                    AND
                  </ToggleButton>
                </ToggleButtonGroup>
                <Button size="small" onClick={clearTagFilter} aria-label="タグ選択をクリア">
                  クリア
                </Button>
              </>
            )}
          </Stack>
        )}
      </Box>

      <Divider />

      {filteredBookmarks.length === 0 ? (
        bookmarks.length === 0 ? (
          <Box sx={{ textAlign: 'center', mt: 8, color: 'text.secondary' }}>
            <BookmarkIcon sx={{ fontSize: 64, mb: 2, opacity: 0.3 }} />
            <Typography variant="h6">ブックマークはありません</Typography>
            <Typography variant="body2" sx={{ mt: 1 }}>
              メッセージをブックマークして後で見返しましょう
            </Typography>
          </Box>
        ) : (
          <Box sx={{ textAlign: 'center', mt: 4, color: 'text.secondary', p: 4 }}>
            <Typography variant="body2">該当するブックマークはありません</Typography>
          </Box>
        )
      ) : (
        <List disablePadding>
          {filteredBookmarks.map((bookmark, index) => (
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
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
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
                    <Box component="span" sx={{ display: 'block' }}>
                      <Typography
                        variant="body2"
                        color="text.primary"
                        component="span"
                        sx={{
                          mt: 0.5,
                          whiteSpace: 'pre-wrap',
                          wordBreak: 'break-word',
                          display: 'block',
                        }}
                      >
                        {bookmark.message
                          ? renderMessageContent(bookmark.message.content)
                          : '（メッセージを取得できません）'}
                      </Typography>
                      {bookmark.tags && bookmark.tags.length > 0 && (
                        <Box
                          component="span"
                          sx={{
                            mt: 0.5,
                            display: 'inline-flex',
                            flexWrap: 'wrap',
                            gap: 0.5,
                          }}
                        >
                          {bookmark.tags.map((tag) => (
                            <Chip
                              key={tag.id}
                              label={tag.name}
                              size="small"
                              variant="outlined"
                              data-testid={`bookmark-${bookmark.id}-tag-${tag.id}`}
                            />
                          ))}
                        </Box>
                      )}
                    </Box>
                  }
                />
                <ListItemSecondaryAction>
                  <Tooltip title="タグを編集">
                    <IconButton
                      edge="end"
                      size="small"
                      aria-label={`ブックマーク${bookmark.id}のタグを編集`}
                      onClick={(e) => {
                        e.stopPropagation();
                        setAssignTarget(bookmark);
                      }}
                    >
                      <LocalOfferIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                  <Tooltip title="ブックマーク解除">
                    <IconButton
                      edge="end"
                      size="small"
                      aria-label="ブックマーク解除"
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
      )}

      <TagManageDialog
        open={tagDialogOpen}
        onClose={() => setTagDialogOpen(false)}
        tags={tags}
        onTagsChange={(next) => {
          setTags(next);
          _tagsPromise = null;
        }}
        onBookmarksChange={(updater) => setBookmarks(updater)}
      />

      <AssignTagsDialog
        bookmark={assignTarget}
        open={assignTarget !== null}
        onClose={() => setAssignTarget(null)}
        tags={tags}
        onUpdated={(updated) => {
          setBookmarks((prev) => prev.map((b) => (b.id === updated.id ? updated : b)));
          _bookmarksPromise = null;
        }}
      />
    </Box>
  );
}

interface TagManageDialogProps {
  open: boolean;
  onClose: () => void;
  tags: BookmarkTag[];
  onTagsChange: (next: BookmarkTag[]) => void;
  onBookmarksChange: (updater: (prev: Bookmark[]) => Bookmark[]) => void;
}

function TagManageDialog({
  open,
  onClose,
  tags,
  onTagsChange,
  onBookmarksChange,
}: TagManageDialogProps) {
  const [newName, setNewName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editingName, setEditingName] = useState('');

  useEffect(() => {
    if (!open) {
      setNewName('');
      setError(null);
      setEditingId(null);
      setEditingName('');
    }
  }, [open]);

  const handleCreate = async () => {
    const trimmed = newName.trim();
    if (trimmed === '') {
      setError('タグ名を入力してください');
      return;
    }
    try {
      const { tag } = await api.bookmarkTags.create({ name: trimmed });
      onTagsChange([...tags, tag]);
      setNewName('');
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const handleStartEdit = (tag: BookmarkTag) => {
    setEditingId(tag.id);
    setEditingName(tag.name);
  };

  const handleConfirmEdit = async () => {
    if (editingId === null) return;
    const trimmed = editingName.trim();
    if (trimmed === '') {
      setError('タグ名を入力してください');
      return;
    }
    try {
      const { tag } = await api.bookmarkTags.update(editingId, { name: trimmed });
      onTagsChange(tags.map((t) => (t.id === tag.id ? tag : t)));
      onBookmarksChange((prev) =>
        prev.map((b) => ({
          ...b,
          tags: (b.tags ?? []).map((t) => (t.id === tag.id ? tag : t)),
        })),
      );
      setEditingId(null);
      setEditingName('');
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const handleDelete = async (tagId: number) => {
    if (
      !window.confirm('このタグを削除しますか？関連するブックマークからも紐付けが解除されます。')
    ) {
      return;
    }
    try {
      await api.bookmarkTags.delete(tagId);
      onTagsChange(tags.filter((t) => t.id !== tagId));
      onBookmarksChange((prev) =>
        prev.map((b) => ({
          ...b,
          tags: (b.tags ?? []).filter((t) => t.id !== tagId),
        })),
      );
    } catch (e) {
      setError((e as Error).message);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="xs">
      <DialogTitle>タグの管理</DialogTitle>
      <DialogContent>
        <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
          <TextField
            size="small"
            fullWidth
            label="新しいタグ名"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            error={Boolean(error)}
            helperText={error ?? ' '}
            inputProps={{ 'aria-label': '新しいタグ名' }}
          />
          <Button onClick={() => void handleCreate()} variant="contained" size="small">
            追加
          </Button>
        </Box>
        <List dense>
          {tags.map((tag) => (
            <ListItem
              key={tag.id}
              secondaryAction={
                <>
                  {editingId === tag.id ? (
                    <Button size="small" onClick={() => void handleConfirmEdit()}>
                      保存
                    </Button>
                  ) : (
                    <IconButton
                      size="small"
                      aria-label={`タグ「${tag.name}」を編集`}
                      onClick={() => handleStartEdit(tag)}
                    >
                      <EditIcon fontSize="small" />
                    </IconButton>
                  )}
                  <IconButton
                    size="small"
                    aria-label={`タグ「${tag.name}」を削除`}
                    onClick={() => void handleDelete(tag.id)}
                  >
                    <DeleteOutlineIcon fontSize="small" />
                  </IconButton>
                </>
              }
            >
              {editingId === tag.id ? (
                <TextField
                  size="small"
                  value={editingName}
                  onChange={(e) => setEditingName(e.target.value)}
                  autoFocus
                  inputProps={{ 'aria-label': 'タグ名編集' }}
                />
              ) : (
                <ListItemText primary={tag.name} secondary={`${tag.bookmarkCount ?? 0} 件`} />
              )}
            </ListItem>
          ))}
        </List>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>閉じる</Button>
      </DialogActions>
    </Dialog>
  );
}

interface AssignTagsDialogProps {
  bookmark: Bookmark | null;
  open: boolean;
  onClose: () => void;
  tags: BookmarkTag[];
  onUpdated: (bookmark: Bookmark) => void;
}

function AssignTagsDialog({ bookmark, open, onClose, tags, onUpdated }: AssignTagsDialogProps) {
  const [selected, setSelected] = useState<number[]>([]);

  useEffect(() => {
    if (bookmark) {
      setSelected((bookmark.tags ?? []).map((t) => t.id));
    }
  }, [bookmark]);

  if (!bookmark) return null;

  const toggle = (tagId: number) => {
    setSelected((prev) =>
      prev.includes(tagId) ? prev.filter((id) => id !== tagId) : [...prev, tagId],
    );
  };

  const handleSave = async () => {
    try {
      const { bookmark: updated } = await api.bookmarks.setTags(bookmark.messageId, selected);
      onUpdated(updated);
      onClose();
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="xs">
      <DialogTitle>タグを付与</DialogTitle>
      <DialogContent>
        {tags.length === 0 ? (
          <Typography variant="body2" color="text.secondary">
            タグが未作成です。先に「タグ管理」から作成してください。
          </Typography>
        ) : (
          <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap', gap: 0.5, mt: 1 }}>
            {tags.map((tag) => {
              const active = selected.includes(tag.id);
              return (
                <Chip
                  key={tag.id}
                  label={tag.name}
                  color={active ? 'primary' : 'default'}
                  variant={active ? 'filled' : 'outlined'}
                  onClick={() => toggle(tag.id)}
                  aria-pressed={active}
                />
              );
            })}
          </Stack>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>キャンセル</Button>
        <Button onClick={() => void handleSave()} variant="contained">
          保存
        </Button>
      </DialogActions>
    </Dialog>
  );
}

function BookmarkPageInner() {
  const [bookmarksPromise] = useState(() => getOrCreateBookmarksPromise());
  const [tagsPromise] = useState(() => getOrCreateTagsPromise());

  return (
    <AppLayout defaultSidebarOpen={false} forceSidebarClosed sidebar={<Box />}>
      <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 1,
            px: 3,
            py: 2,
            borderBottom: '1px solid var(--border)',
            background: 'var(--bg-elev)',
          }}
        >
          <BookmarkIcon />
          <Typography variant="h6">ブックマーク</Typography>
        </Box>

        <Box sx={{ flexGrow: 1, overflow: 'auto', p: 2 }}>
          <Paper elevation={0} variant="outlined" sx={{ maxWidth: 800, mx: 'auto' }}>
            <Suspense
              fallback={
                <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
                  <CircularProgress />
                </Box>
              }
            >
              <BookmarkListContent bookmarksPromise={bookmarksPromise} tagsPromise={tagsPromise} />
            </Suspense>
          </Paper>
        </Box>
      </Box>
    </AppLayout>
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
