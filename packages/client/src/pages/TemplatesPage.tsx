import { use, useState, Suspense, useCallback } from 'react';
import {
  AppBar,
  Box,
  Button,
  CircularProgress,
  Divider,
  IconButton,
  List,
  ListItem,
  Paper,
  TextField,
  Toolbar,
  Tooltip,
  Typography,
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import ArticleIcon from '@mui/icons-material/Article';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import EditIcon from '@mui/icons-material/Edit';
import KeyboardArrowUpIcon from '@mui/icons-material/KeyboardArrowUp';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import type { MessageTemplate } from '@chat-app/shared';

let _templatesPromise: Promise<{ templates: MessageTemplate[] }> | null = null;

export function resetTemplatesCache(): void {
  _templatesPromise = null;
}

function getOrCreateTemplatesPromise(): Promise<{ templates: MessageTemplate[] }> {
  if (!_templatesPromise) {
    _templatesPromise = api.templates.list();
  }
  return _templatesPromise;
}

interface EditState {
  id: number;
  title: string;
  body: string;
}

interface TemplatesListContentProps {
  templatesPromise: Promise<{ templates: MessageTemplate[] }>;
}

function TemplatesListContent({ templatesPromise }: TemplatesListContentProps) {
  const { templates: initialTemplates } = use(templatesPromise);
  const [templates, setTemplates] = useState<MessageTemplate[]>(initialTemplates);
  const [editState, setEditState] = useState<EditState | null>(null);
  const [newTitle, setNewTitle] = useState('');
  const [newBody, setNewBody] = useState('');

  const handleCreate = useCallback(async () => {
    const { template } = await api.templates.create({ title: newTitle, body: newBody });
    setTemplates((prev) => [...prev, template]);
    setNewTitle('');
    setNewBody('');
    _templatesPromise = null;
  }, [newTitle, newBody]);

  const handleStartEdit = useCallback((tpl: MessageTemplate) => {
    setEditState({ id: tpl.id, title: tpl.title, body: tpl.body });
  }, []);

  const handleCancelEdit = useCallback(() => {
    setEditState(null);
  }, []);

  const handleSaveEdit = useCallback(async () => {
    if (!editState) return;
    const { template } = await api.templates.update(editState.id, {
      title: editState.title,
      body: editState.body,
    });
    setTemplates((prev) => prev.map((t) => (t.id === editState.id ? template : t)));
    setEditState(null);
    _templatesPromise = null;
  }, [editState]);

  const handleDelete = useCallback(async (id: number) => {
    await api.templates.remove(id);
    setTemplates((prev) => prev.filter((t) => t.id !== id));
    _templatesPromise = null;
  }, []);

  const handleMoveUp = useCallback(
    async (index: number) => {
      if (index === 0) return;
      const newOrder = [...templates];
      [newOrder[index - 1], newOrder[index]] = [newOrder[index], newOrder[index - 1]];
      setTemplates(newOrder);
      await api.templates.reorder(newOrder.map((t) => t.id));
      _templatesPromise = null;
    },
    [templates],
  );

  const handleMoveDown = useCallback(
    async (index: number) => {
      if (index === templates.length - 1) return;
      const newOrder = [...templates];
      [newOrder[index], newOrder[index + 1]] = [newOrder[index + 1], newOrder[index]];
      setTemplates(newOrder);
      await api.templates.reorder(newOrder.map((t) => t.id));
      _templatesPromise = null;
    },
    [templates],
  );

  const canSave = newTitle.trim() !== '' && newBody.trim() !== '';

  return (
    <Box>
      {/* 新規作成フォーム */}
      <Paper variant="outlined" sx={{ p: 2, mb: 3 }}>
        <Typography variant="subtitle2" gutterBottom>
          新しいテンプレートを追加
        </Typography>
        <TextField
          fullWidth
          size="small"
          label="タイトル"
          placeholder="タイトルを入力"
          value={newTitle}
          onChange={(e) => setNewTitle(e.target.value)}
          sx={{ mb: 1 }}
        />
        <TextField
          fullWidth
          size="small"
          multiline
          rows={3}
          label="本文"
          placeholder="本文を入力"
          value={newBody}
          onChange={(e) => setNewBody(e.target.value)}
          sx={{ mb: 1 }}
        />
        <Button
          variant="contained"
          size="small"
          disabled={!canSave}
          onClick={() => void handleCreate()}
        >
          追加
        </Button>
      </Paper>

      {/* テンプレート一覧 */}
      {templates.length === 0 ? (
        <Box sx={{ textAlign: 'center', mt: 6, color: 'text.secondary' }}>
          <ArticleIcon sx={{ fontSize: 64, mb: 2, opacity: 0.3 }} />
          <Typography variant="h6">テンプレートがありません</Typography>
          <Typography variant="body2" sx={{ mt: 1 }}>
            よく使うメッセージをテンプレートとして登録しましょう
          </Typography>
        </Box>
      ) : (
        <List disablePadding>
          {templates.map((tpl, index) => (
            <Box key={tpl.id}>
              {index > 0 && <Divider component="li" />}
              <ListItem alignItems="flex-start" sx={{ gap: 1 }}>
                {/* 並び替えボタン */}
                <Box sx={{ display: 'flex', flexDirection: 'column', mr: 1 }}>
                  <Tooltip title="上に移動">
                    <span>
                      <IconButton
                        size="small"
                        aria-label="上に移動"
                        disabled={index === 0}
                        onClick={() => void handleMoveUp(index)}
                      >
                        <KeyboardArrowUpIcon fontSize="small" />
                      </IconButton>
                    </span>
                  </Tooltip>
                  <Tooltip title="下に移動">
                    <span>
                      <IconButton
                        size="small"
                        aria-label="下に移動"
                        disabled={index === templates.length - 1}
                        onClick={() => void handleMoveDown(index)}
                      >
                        <KeyboardArrowDownIcon fontSize="small" />
                      </IconButton>
                    </span>
                  </Tooltip>
                </Box>

                {/* テンプレート内容 */}
                <Box sx={{ flexGrow: 1 }}>
                  {editState?.id === tpl.id ? (
                    <Box>
                      <TextField
                        fullWidth
                        size="small"
                        value={editState.title}
                        onChange={(e) =>
                          setEditState((prev) => prev && { ...prev, title: e.target.value })
                        }
                        sx={{ mb: 1 }}
                      />
                      <TextField
                        fullWidth
                        size="small"
                        multiline
                        rows={3}
                        value={editState.body}
                        onChange={(e) =>
                          setEditState((prev) => prev && { ...prev, body: e.target.value })
                        }
                        sx={{ mb: 1 }}
                      />
                      <Box sx={{ display: 'flex', gap: 1 }}>
                        <Button
                          size="small"
                          variant="contained"
                          onClick={() => void handleSaveEdit()}
                        >
                          保存
                        </Button>
                        <Button size="small" onClick={handleCancelEdit}>
                          キャンセル
                        </Button>
                      </Box>
                    </Box>
                  ) : (
                    <Box>
                      <Typography variant="subtitle2">{tpl.title}</Typography>
                      <Typography
                        variant="body2"
                        color="text.secondary"
                        sx={{
                          whiteSpace: 'pre-wrap',
                          wordBreak: 'break-word',
                          mt: 0.5,
                        }}
                      >
                        {tpl.body}
                      </Typography>
                    </Box>
                  )}
                </Box>

                {/* 操作ボタン */}
                {editState?.id !== tpl.id && (
                  <Box sx={{ display: 'flex', flexDirection: 'column' }}>
                    <Tooltip title="編集">
                      <IconButton
                        size="small"
                        aria-label="編集"
                        onClick={() => handleStartEdit(tpl)}
                      >
                        <EditIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="削除">
                      <IconButton
                        size="small"
                        aria-label="削除"
                        onClick={() => void handleDelete(tpl.id)}
                      >
                        <DeleteOutlineIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </Box>
                )}
              </ListItem>
            </Box>
          ))}
        </List>
      )}
    </Box>
  );
}

function TemplatesPageInner() {
  const [templatesPromise] = useState(() => getOrCreateTemplatesPromise());
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
          <ArticleIcon sx={{ mr: 1 }} />
          <Typography variant="h6">テンプレート管理</Typography>
        </Toolbar>
      </AppBar>

      <Box sx={{ flexGrow: 1, overflow: 'auto', p: 2 }}>
        <Paper elevation={0} variant="outlined" sx={{ maxWidth: 800, mx: 'auto', p: 2 }}>
          <Suspense
            fallback={
              <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
                <CircularProgress />
              </Box>
            }
          >
            <TemplatesListContent templatesPromise={templatesPromise} />
          </Suspense>
        </Paper>
      </Box>
    </Box>
  );
}

export default function TemplatesPage() {
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
      <TemplatesPageInner />
    </Suspense>
  );
}
