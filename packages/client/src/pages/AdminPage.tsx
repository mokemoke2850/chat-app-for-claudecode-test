import { useState, useMemo, use, Suspense, Component, ReactNode } from 'react';
import {
  Box,
  Tab,
  Tabs,
  Typography,
  Card,
  CardContent,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  IconButton,
  Tooltip,
  Paper,
  Avatar,
  Divider,
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import AdminPanelSettingsIcon from '@mui/icons-material/AdminPanelSettings';
import PeopleIcon from '@mui/icons-material/People';
import ForumIcon from '@mui/icons-material/Forum';
import MessageIcon from '@mui/icons-material/Message';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import DateRangeIcon from '@mui/icons-material/DateRange';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { api } from '../api/client';
import type { AdminUser, AdminChannel, AdminStats } from '../types/admin';

// ─── 統計タブ ────────────────────────────────────────────────
const STAT_CARDS = [
  { key: 'totalUsers', label: 'ユーザー数', icon: PeopleIcon, color: '#1976d2', bg: '#e3f2fd' },
  { key: 'totalChannels', label: 'チャンネル数', icon: ForumIcon, color: '#7b1fa2', bg: '#f3e5f5' },
  {
    key: 'totalMessages',
    label: '総メッセージ数',
    icon: MessageIcon,
    color: '#388e3c',
    bg: '#e8f5e9',
  },
  {
    key: 'activeUsersLast24h',
    label: '24h アクティブ',
    icon: AccessTimeIcon,
    color: '#f57c00',
    bg: '#fff3e0',
  },
  {
    key: 'activeUsersLast7d',
    label: '7日 アクティブ',
    icon: DateRangeIcon,
    color: '#0288d1',
    bg: '#e1f5fe',
  },
] as const;

function StatsContent({ statsPromise }: { statsPromise: Promise<AdminStats> }) {
  const stats = use(statsPromise);

  return (
    <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', p: 2 }}>
      {STAT_CARDS.map(({ key, label, icon: Icon, color, bg }) => (
        <Card
          key={key}
          elevation={0}
          sx={{
            minWidth: 180,
            border: '1px solid',
            borderColor: 'divider',
            borderRadius: 2,
            transition: 'box-shadow 0.2s',
            '&:hover': { boxShadow: 4 },
          }}
        >
          <CardContent sx={{ p: 2.5 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1.5 }}>
              <Avatar sx={{ bgcolor: bg, width: 40, height: 40 }}>
                <Icon sx={{ color, fontSize: 22 }} />
              </Avatar>
              <Typography variant="body2" color="text.secondary" fontWeight={500}>
                {label}
              </Typography>
            </Box>
            <Typography variant="h4" fontWeight="bold" color="text.primary">
              {stats[key].toLocaleString()}
            </Typography>
          </CardContent>
        </Card>
      ))}
    </Box>
  );
}

// ─── ユーザー管理タブ ─────────────────────────────────────────
function UsersContent({
  usersPromise,
  currentUserId,
}: {
  usersPromise: Promise<{ users: AdminUser[] }>;
  currentUserId: number;
}) {
  const { users: initial } = use(usersPromise);
  const [users, setUsers] = useState<AdminUser[]>(initial);
  const [deleteTarget, setDeleteTarget] = useState<AdminUser | null>(null);

  const handleRoleToggle = async (user: AdminUser) => {
    const newRole = user.role === 'admin' ? 'user' : 'admin';
    try {
      await api.admin.updateUserRole(user.id, newRole);
      setUsers((prev) => prev.map((u) => (u.id === user.id ? { ...u, role: newRole } : u)));
    } catch {
      // API エラー時は状態を変更しない
    }
  };

  const handleStatusToggle = async (user: AdminUser) => {
    const newActive = !user.isActive;
    await api.admin.updateUserStatus(user.id, newActive);
    setUsers((prev) => prev.map((u) => (u.id === user.id ? { ...u, isActive: newActive } : u)));
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    await api.admin.deleteUser(deleteTarget.id);
    setUsers((prev) => prev.filter((u) => u.id !== deleteTarget.id));
    setDeleteTarget(null);
  };

  return (
    <>
      <Paper
        elevation={0}
        sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2, overflow: 'hidden' }}
      >
        <Table size="small">
          <TableHead>
            <TableRow sx={{ bgcolor: 'grey.50' }}>
              <TableCell sx={{ fontWeight: 600 }}>ユーザー名</TableCell>
              <TableCell sx={{ fontWeight: 600 }}>メール</TableCell>
              <TableCell sx={{ fontWeight: 600 }}>ロール</TableCell>
              <TableCell sx={{ fontWeight: 600 }}>状態</TableCell>
              <TableCell sx={{ fontWeight: 600 }}>最終ログイン</TableCell>
              <TableCell sx={{ fontWeight: 600 }}>操作</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {users.map((user) => {
              const isSelf = user.id === currentUserId;
              return (
                <TableRow
                  key={user.id}
                  sx={{
                    '&:hover': { bgcolor: 'action.hover' },
                    transition: 'background-color 0.15s',
                  }}
                >
                  <TableCell>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Avatar sx={{ width: 28, height: 28, fontSize: 12, bgcolor: 'primary.main' }}>
                        {user.username[0].toUpperCase()}
                      </Avatar>
                      <Typography variant="body2" fontWeight={isSelf ? 600 : 400}>
                        {user.username}
                        {isSelf && (
                          <Chip
                            label="自分"
                            size="small"
                            sx={{ ml: 0.5, height: 18, fontSize: 10 }}
                          />
                        )}
                      </Typography>
                    </Box>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2" color="text.secondary">
                      {user.email}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={user.role}
                      color={user.role === 'admin' ? 'primary' : 'default'}
                      size="small"
                      sx={{ fontWeight: 500 }}
                    />
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={user.isActive ? '有効' : '停止中'}
                      color={user.isActive ? 'success' : 'error'}
                      size="small"
                      sx={{ fontWeight: 500 }}
                    />
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2" color="text.secondary">
                      {user.lastLoginAt
                        ? new Date(user.lastLoginAt).toLocaleDateString('ja-JP')
                        : '—'}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Box sx={{ display: 'flex', gap: 0.5 }}>
                      {!isSelf && (
                        <Button
                          size="small"
                          variant="outlined"
                          sx={{ fontSize: 11, whiteSpace: 'nowrap' }}
                          onClick={() => void handleRoleToggle(user)}
                        >
                          {user.role === 'admin' ? 'user に変更' : 'admin に変更'}
                        </Button>
                      )}
                      {!isSelf && (
                        <Button
                          size="small"
                          variant="outlined"
                          color={user.isActive ? 'warning' : 'success'}
                          sx={{ fontSize: 11 }}
                          onClick={() => void handleStatusToggle(user)}
                        >
                          {user.isActive ? '停止' : '復活'}
                        </Button>
                      )}
                      {!isSelf && (
                        <Button
                          size="small"
                          variant="outlined"
                          color="error"
                          sx={{ fontSize: 11 }}
                          onClick={() => setDeleteTarget(user)}
                        >
                          削除
                        </Button>
                      )}
                    </Box>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </Paper>

      <Dialog open={!!deleteTarget} onClose={() => setDeleteTarget(null)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ pb: 1 }}>ユーザーを削除しますか？</DialogTitle>
        <DialogContent>
          <DialogContentText>
            <strong>{deleteTarget?.username}</strong> を削除します。この操作は取り消せません。
          </DialogContentText>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setDeleteTarget(null)} variant="outlined">
            キャンセル
          </Button>
          <Button color="error" variant="contained" onClick={() => void handleDelete()}>
            削除
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}

// ─── チャンネル管理タブ ───────────────────────────────────────
function ChannelsContent({
  channelsPromise,
}: {
  channelsPromise: Promise<{ channels: AdminChannel[] }>;
}) {
  const { channels: initial } = use(channelsPromise);
  const [channels, setChannels] = useState<AdminChannel[]>(initial);
  const [deleteTarget, setDeleteTarget] = useState<AdminChannel | null>(null);

  const handleDelete = async () => {
    if (!deleteTarget) return;
    await api.admin.deleteChannel(deleteTarget.id);
    setChannels((prev) => prev.filter((c) => c.id !== deleteTarget.id));
    setDeleteTarget(null);
  };

  return (
    <>
      <Paper
        elevation={0}
        sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2, overflow: 'hidden' }}
      >
        <Table size="small">
          <TableHead>
            <TableRow sx={{ bgcolor: 'grey.50' }}>
              <TableCell sx={{ fontWeight: 600 }}>チャンネル名</TableCell>
              <TableCell sx={{ fontWeight: 600 }}>説明</TableCell>
              <TableCell sx={{ fontWeight: 600 }}>種別</TableCell>
              <TableCell sx={{ fontWeight: 600 }}>メンバー数</TableCell>
              <TableCell sx={{ fontWeight: 600 }}>操作</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {channels.map((ch) => (
              <TableRow
                key={ch.id}
                sx={{
                  '&:hover': { bgcolor: 'action.hover' },
                  transition: 'background-color 0.15s',
                }}
              >
                <TableCell>
                  <Typography variant="body2" fontWeight={500}>
                    <Box component="span" sx={{ color: 'text.disabled', mr: 0.25 }}>
                      #
                    </Box>
                    {ch.name}
                  </Typography>
                </TableCell>
                <TableCell>
                  <Typography variant="body2" color="text.secondary">
                    {ch.description ?? '—'}
                  </Typography>
                </TableCell>
                <TableCell>
                  <Chip
                    label={ch.isPrivate ? 'プライベート' : '公開'}
                    size="small"
                    color={ch.isPrivate ? 'warning' : 'default'}
                    sx={{ fontWeight: 500 }}
                  />
                </TableCell>
                <TableCell>
                  <Typography variant="body2">{ch.memberCount}</Typography>
                </TableCell>
                <TableCell>
                  <Button
                    size="small"
                    variant="outlined"
                    color="error"
                    sx={{ fontSize: 11 }}
                    onClick={() => setDeleteTarget(ch)}
                  >
                    削除
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Paper>

      <Dialog open={!!deleteTarget} onClose={() => setDeleteTarget(null)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ pb: 1 }}>チャンネルを削除しますか？</DialogTitle>
        <DialogContent>
          <DialogContentText>
            <strong>#{deleteTarget?.name}</strong> を削除します。この操作は取り消せません。
          </DialogContentText>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setDeleteTarget(null)} variant="outlined">
            キャンセル
          </Button>
          <Button color="error" variant="contained" onClick={() => void handleDelete()}>
            削除
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}

// ─── ErrorBoundary ───────────────────────────────────────────
interface ErrorBoundaryState {
  hasError: boolean;
  message: string;
}

class ErrorBoundary extends Component<{ children: ReactNode }, ErrorBoundaryState> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false, message: '' };
  }

  static getDerivedStateFromError(error: unknown): ErrorBoundaryState {
    const message = error instanceof Error ? error.message : 'エラーが発生しました';
    return { hasError: true, message };
  }

  render() {
    if (this.state.hasError) {
      return (
        <Box sx={{ p: 2, color: 'error.main' }}>
          <Typography>エラーが発生しました: {this.state.message}</Typography>
        </Box>
      );
    }
    return this.props.children;
  }
}

// ─── メインコンポーネント ─────────────────────────────────────
export default function AdminPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [tab, setTab] = useState(0);

  // admin 以外はトップにリダイレクト
  if (!user || user.role !== 'admin') {
    navigate('/', { replace: true });
    return null;
  }

  const statsPromise = useMemo(() => api.admin.getStats(), []);
  const usersPromise = useMemo(() => api.admin.getUsers(), []);
  const channelsPromise = useMemo(() => api.admin.getChannels(), []);

  const fallback = (
    <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
      <CircularProgress />
    </Box>
  );

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: 'grey.50' }}>
      {/* ヘッダー */}
      <Paper
        elevation={0}
        sx={{
          px: 3,
          py: 2,
          borderBottom: '1px solid',
          borderColor: 'divider',
          bgcolor: 'white',
          display: 'flex',
          alignItems: 'center',
          gap: 2,
        }}
      >
        <Tooltip title="ホーム画面に戻る">
          <IconButton
            onClick={() => navigate('/')}
            color="primary"
            aria-label="ホーム画面に戻る"
            sx={{ border: '1px solid', borderColor: 'primary.light' }}
          >
            <ArrowBackIcon />
          </IconButton>
        </Tooltip>

        <Divider orientation="vertical" flexItem />

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <Avatar sx={{ bgcolor: 'primary.main', width: 36, height: 36 }}>
            <AdminPanelSettingsIcon sx={{ fontSize: 20 }} />
          </Avatar>
          <Box>
            <Typography variant="h6" fontWeight="bold" lineHeight={1.2}>
              管理画面
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {user.displayName ?? user.username} でログイン中
            </Typography>
          </Box>
        </Box>
      </Paper>

      {/* コンテンツ */}
      <Box sx={{ p: 3 }}>
        <Tabs
          value={tab}
          onChange={(_, v: number) => setTab(v)}
          sx={{
            mb: 3,
            bgcolor: 'white',
            borderRadius: 2,
            border: '1px solid',
            borderColor: 'divider',
            px: 1,
          }}
        >
          <Tab label="統計" />
          <Tab label="ユーザー管理" />
          <Tab label="チャンネル管理" />
        </Tabs>

        {tab === 0 && (
          <ErrorBoundary>
            <Suspense fallback={fallback}>
              <StatsContent statsPromise={statsPromise} />
            </Suspense>
          </ErrorBoundary>
        )}
        {tab === 1 && (
          <ErrorBoundary>
            <Suspense fallback={fallback}>
              <UsersContent usersPromise={usersPromise} currentUserId={user.id} />
            </Suspense>
          </ErrorBoundary>
        )}
        {tab === 2 && (
          <ErrorBoundary>
            <Suspense fallback={fallback}>
              <ChannelsContent channelsPromise={channelsPromise} />
            </Suspense>
          </ErrorBoundary>
        )}
      </Box>
    </Box>
  );
}
