import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  List,
  ListItemButton,
  ListItemText,
  Stack,
  Tab,
  Tabs,
  TextField,
  Typography,
  Alert,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import type { WikiPage, WikiPageSummary } from '@chat-app/shared';
import { api } from '../../api/client';
import MarkdownRenderer from '../Wiki/MarkdownRenderer';

interface Props {
  channelId: number;
  currentUserId: number;
  currentUserRole: 'user' | 'admin';
  channelCreatedBy: number;
}

// 一覧キャッシュ（チャンネル×クエリ単位）。テスト時は resetWikiPagesCache() でクリア
const listCache = new Map<string, WikiPageSummary[]>();
export function resetWikiPagesCache(): void {
  listCache.clear();
}

type RightPaneMode =
  | { kind: 'empty' }
  | { kind: 'detail'; pageId: number }
  | { kind: 'new' }
  | { kind: 'edit'; pageId: number };

export default function ChannelWikiTab({
  channelId,
  currentUserId,
  currentUserRole,
  channelCreatedBy,
}: Props) {
  const [searchParams, setSearchParams] = useSearchParams();
  const [pages, setPages] = useState<WikiPageSummary[]>([]);
  const [searchInput, setSearchInput] = useState('');
  const [activeQuery, setActiveQuery] = useState<string | undefined>(undefined);
  const [right, setRight] = useState<RightPaneMode>({ kind: 'empty' });
  const [currentPage, setCurrentPage] = useState<WikiPage | null>(null);
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const refreshList = useCallback(
    async (q?: string) => {
      const key = `${channelId}|${q ?? ''}`;
      const res = await api.wikiPages.list(channelId, q);
      listCache.set(key, res.pages);
      setPages(res.pages);
    },
    [channelId],
  );

  // 初期ロード
  useEffect(() => {
    void refreshList(activeQuery);
  }, [activeQuery, refreshList]);

  // 検索入力をデバウンスで activeQuery に反映
  useEffect(() => {
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(() => {
      const trimmed = searchInput.trim();
      setActiveQuery(trimmed.length > 0 ? trimmed : undefined);
    }, 150);
    return () => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
    };
  }, [searchInput]);

  // URLクエリでの動線
  const wikiPageParam = searchParams.get('wikiPage');
  const newWikiParam = searchParams.get('newWiki');
  const fromMessageParam = searchParams.get('fromMessage');

  useEffect(() => {
    if (wikiPageParam) {
      const id = parseInt(wikiPageParam, 10);
      if (!isNaN(id)) {
        setRight({ kind: 'detail', pageId: id });
      }
    } else if (newWikiParam) {
      setRight({ kind: 'new' });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 詳細ページの読み込み（既に同じIDの page が currentPage にあれば再フェッチしない）
  useEffect(() => {
    if (right.kind === 'detail') {
      if (currentPage && currentPage.id === right.pageId) return;
      let alive = true;
      void api.wikiPages.get(right.pageId).then((res) => {
        if (alive) setCurrentPage(res.page);
      });
      return () => {
        alive = false;
      };
    }
    if (right.kind !== 'edit') {
      setCurrentPage(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [right]);

  const handleSelect = useCallback(
    (pageId: number) => {
      setRight({ kind: 'detail', pageId });
      const next = new URLSearchParams(searchParams);
      next.set('wikiPage', String(pageId));
      next.delete('newWiki');
      next.delete('fromMessage');
      setSearchParams(next, { replace: true });
    },
    [searchParams, setSearchParams],
  );

  const handleNew = useCallback(() => {
    setRight({ kind: 'new' });
    const next = new URLSearchParams(searchParams);
    next.delete('wikiPage');
    next.set('newWiki', '1');
    setSearchParams(next, { replace: true });
  }, [searchParams, setSearchParams]);

  const canEditPage = useMemo(() => {
    if (!currentPage) return false;
    if (currentUserRole === 'admin') return true;
    if (currentPage.createdBy === currentUserId) return true;
    if (channelCreatedBy === currentUserId) return true;
    return false;
  }, [currentPage, currentUserId, currentUserRole, channelCreatedBy]);

  const canDeletePage = useMemo(() => {
    if (!currentPage) return false;
    if (currentUserRole === 'admin') return true;
    if (channelCreatedBy === currentUserId) return true;
    return false;
  }, [currentPage, currentUserId, currentUserRole, channelCreatedBy]);

  return (
    <Box sx={{ display: 'flex', flexGrow: 1, overflow: 'hidden' }}>
      {/* 左ペイン: 一覧 */}
      <Box
        sx={{
          width: 320,
          borderRight: 1,
          borderColor: 'divider',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <Box sx={{ p: 1 }}>
          <TextField
            placeholder="検索"
            size="small"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            fullWidth
          />
        </Box>
        <Button
          onClick={handleNew}
          startIcon={<AddIcon />}
          sx={{ mx: 1, mb: 1 }}
          variant="outlined"
          size="small"
        >
          新規作成
        </Button>
        <Divider />
        <Box sx={{ flexGrow: 1, overflowY: 'auto' }}>
          {pages.length === 0 ? (
            <Typography sx={{ p: 2, color: 'text.secondary' }}>
              まだWikiページがありません
            </Typography>
          ) : (
            <List dense disablePadding>
              {pages.map((p) => (
                <ListItemButton
                  key={p.id}
                  selected={right.kind === 'detail' && right.pageId === p.id}
                  onClick={() => handleSelect(p.id)}
                >
                  <ListItemText
                    primary={p.title}
                    secondary={new Date(p.updatedAt).toLocaleString('ja-JP')}
                  />
                </ListItemButton>
              ))}
            </List>
          )}
        </Box>
      </Box>

      {/* 右ペイン */}
      <Box sx={{ flexGrow: 1, overflowY: 'auto', p: 2 }}>
        {right.kind === 'empty' && (
          <Typography color="text.secondary">左の一覧からWikiページを選択してください</Typography>
        )}

        {right.kind === 'detail' && currentPage && (
          <WikiPageDetail
            page={currentPage}
            canEdit={canEditPage}
            canDelete={canDeletePage}
            onEdit={() => setRight({ kind: 'edit', pageId: currentPage.id })}
            onDeleted={async () => {
              setRight({ kind: 'empty' });
              setCurrentPage(null);
              await refreshList(activeQuery);
            }}
          />
        )}

        {right.kind === 'new' && (
          <WikiPageForm
            mode="new"
            initial={{
              title: '',
              content: buildInitialContent(fromMessageParam),
            }}
            onSubmit={async ({ title, content }) => {
              const res = await api.wikiPages.create(channelId, { title, content });
              await refreshList(activeQuery);
              setRight({ kind: 'detail', pageId: res.page.id });
              setCurrentPage(res.page);
              if (fromMessageParam) {
                sessionStorage.removeItem(`wiki.fromMessage.${fromMessageParam}`);
              }
            }}
            onCancel={() => setRight({ kind: 'empty' })}
          />
        )}

        {right.kind === 'edit' && currentPage && (
          <WikiPageForm
            mode="edit"
            initial={{ title: currentPage.title, content: currentPage.content }}
            onSubmit={async ({ title, content }) => {
              const res = await api.wikiPages.update(currentPage.id, {
                title,
                content,
                expectedUpdatedAt: currentPage.updatedAt,
              });
              await refreshList(activeQuery);
              setCurrentPage(res.page);
              setRight({ kind: 'detail', pageId: res.page.id });
            }}
            onCancel={() => setRight({ kind: 'detail', pageId: currentPage.id })}
          />
        )}
      </Box>
    </Box>
  );
}

function buildInitialContent(fromMessageParam: string | null): string {
  if (!fromMessageParam) return '';
  try {
    const raw = sessionStorage.getItem(`wiki.fromMessage.${fromMessageParam}`);
    if (!raw) return '';
    const obj = JSON.parse(raw) as { content?: string; url?: string };
    const quoted = (obj.content ?? '')
      .split('\n')
      .map((line) => `> ${line}`)
      .join('\n');
    return `${quoted}\n\n${obj.url ?? ''}\n`;
  } catch {
    return '';
  }
}

// ---------------------------------------------------------------------------
// 詳細ペイン
// ---------------------------------------------------------------------------

interface DetailProps {
  page: WikiPage;
  canEdit: boolean;
  canDelete: boolean;
  onEdit: () => void;
  onDeleted: () => Promise<void>;
}

function WikiPageDetail({ page, canEdit, canDelete, onEdit, onDeleted }: DetailProps) {
  const [confirmOpen, setConfirmOpen] = useState(false);

  const handleConfirmDelete = async () => {
    await api.wikiPages.delete(page.id);
    setConfirmOpen(false);
    await onDeleted();
  };

  return (
    <Box>
      <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1 }}>
        <Typography variant="h5">{page.title}</Typography>
        <Stack direction="row" spacing={1}>
          {canEdit && (
            <Button onClick={onEdit} variant="outlined" size="small">
              編集
            </Button>
          )}
          {canDelete && (
            <Button
              onClick={() => setConfirmOpen(true)}
              color="error"
              variant="outlined"
              size="small"
            >
              削除
            </Button>
          )}
        </Stack>
      </Stack>
      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
        作成: {page.createdByUsername ?? '不明'} / 更新: {page.updatedByUsername ?? '不明'} (
        {new Date(page.updatedAt).toLocaleString('ja-JP')})
      </Typography>
      {page.tags.length > 0 && (
        <Stack direction="row" spacing={1} sx={{ mb: 2 }} flexWrap="wrap">
          {page.tags.map((t) => (
            <Chip key={t.id} label={t.name} size="small" />
          ))}
        </Stack>
      )}
      <Divider sx={{ mb: 2 }} />
      <MarkdownRenderer source={page.content} />

      <Dialog open={confirmOpen} onClose={() => setConfirmOpen(false)}>
        <DialogTitle>Wikiページを削除しますか？</DialogTitle>
        <DialogContent>
          <Typography>「{page.title}」を削除します。この操作は取り消せません。</Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmOpen(false)}>キャンセル</Button>
          <Button onClick={handleConfirmDelete} color="error" variant="contained">
            削除する
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

// ---------------------------------------------------------------------------
// フォーム（新規 / 編集）
// ---------------------------------------------------------------------------

interface FormProps {
  mode: 'new' | 'edit';
  initial: { title: string; content: string };
  onSubmit: (data: { title: string; content: string }) => Promise<void>;
  onCancel: () => void;
}

function WikiPageForm({ mode, initial, onSubmit, onCancel }: FormProps) {
  const [title, setTitle] = useState(initial.title);
  const [content, setContent] = useState(initial.content);
  const [tab, setTab] = useState<'edit' | 'preview'>('edit');
  const [titleError, setTitleError] = useState<string | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);

  const handleSave = async () => {
    if (title.trim().length === 0) {
      setTitleError('タイトルは必須です');
      return;
    }
    setTitleError(null);
    setServerError(null);
    try {
      await onSubmit({ title: title.trim(), content });
    } catch (err: unknown) {
      const statusCode = (err as { statusCode?: number }).statusCode;
      if (statusCode === 409) {
        setServerError('他のユーザーによる更新と競合しました。最新の状態を確認してください。');
      } else {
        setServerError((err as Error).message || '保存に失敗しました');
      }
    }
  };

  return (
    <Box>
      <Typography variant="h6" sx={{ mb: 2 }}>
        {mode === 'new' ? 'Wikiページを新規作成' : 'Wikiページを編集'}
      </Typography>
      {serverError && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {serverError}
        </Alert>
      )}
      <TextField
        label="タイトル"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        fullWidth
        error={!!titleError}
        helperText={titleError ?? undefined}
        sx={{ mb: 2 }}
      />
      <TextField
        label="タグ（カンマ区切り）"
        placeholder="まだ未対応 — タグはサーバ実装済み（UIは将来対応）"
        fullWidth
        sx={{ mb: 2 }}
        disabled
      />
      <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 1 }}>
        <Tab value="edit" label="編集" />
        <Tab value="preview" label="プレビュー" />
      </Tabs>
      {tab === 'edit' ? (
        <TextField
          label="本文"
          value={content}
          onChange={(e) => setContent(e.target.value)}
          multiline
          minRows={10}
          fullWidth
        />
      ) : (
        <Box sx={{ minHeight: 200, p: 1, border: 1, borderColor: 'divider' }}>
          <MarkdownRenderer source={content} />
        </Box>
      )}
      <Stack direction="row" spacing={1} sx={{ mt: 2 }}>
        <Button onClick={handleSave} variant="contained">
          保存
        </Button>
        <Button onClick={onCancel}>キャンセル</Button>
      </Stack>
    </Box>
  );
}
