import { useState, useMemo, use, Suspense } from 'react';
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
} from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { api } from '../api/client';
import type { AdminUser, AdminChannel, AdminStats } from '../types/admin';

// ─── 統計タブ ────────────────────────────────────────────────
function StatsContent({ statsPromise }: { statsPromise: Promise<AdminStats> }) {
  const stats = use(statsPromise);
  const cards: { label: string; value: number }[] = [
    { label: 'ユーザー数', value: stats.totalUsers },
    { label: 'チャンネル数', value: stats.totalChannels },
    { label: '総メッセージ数', value: stats.totalMessages },
    { label: '24h アクティブ', value: stats.activeUsersLast24h },
    { label: '7日 アクティブ', value: stats.activeUsersLast7d },
  ];
  return (
    <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', p: 2 }}>
      {cards.map(({ label, value }) => (
        <Card key={label} sx={{ minWidth: 160 }}>
          <CardContent>
            <Typography variant="h4" fontWeight="bold">
              {value.toLocaleString()}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {label}
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
    await api.admin.updateUserRole(user.id, newRole);
    setUsers((prev) => prev.map((u) => (u.id === user.id ? { ...u, role: newRole } : u)));
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
      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell>ユーザー名</TableCell>
            <TableCell>メール</TableCell>
            <TableCell>ロール</TableCell>
            <TableCell>状態</TableCell>
            <TableCell>最終ログイン</TableCell>
            <TableCell>操作</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {users.map((user) => {
            const isSelf = user.id === currentUserId;
            return (
              <TableRow key={user.id}>
                <TableCell>{user.username}</TableCell>
                <TableCell>{user.email}</TableCell>
                <TableCell>
                  <Chip
                    label={user.role}
                    color={user.role === 'admin' ? 'primary' : 'default'}
                    size="small"
                  />
                </TableCell>
                <TableCell>
                  <Chip
                    label={user.isActive ? '有効' : '停止中'}
                    color={user.isActive ? 'success' : 'error'}
                    size="small"
                  />
                </TableCell>
                <TableCell>
                  {user.lastLoginAt ? new Date(user.lastLoginAt).toLocaleDateString('ja-JP') : '—'}
                </TableCell>
                <TableCell>
                  <Box sx={{ display: 'flex', gap: 1 }}>
                    {!isSelf && (
                      <Button
                        size="small"
                        variant="outlined"
                        onClick={() => void handleRoleToggle(user)}
                      >
                        {user.role === 'admin' ? 'user に変更' : 'admin に変更'}
                      </Button>
                    )}
                    <Button
                      size="small"
                      variant="outlined"
                      color={user.isActive ? 'warning' : 'success'}
                      onClick={() => void handleStatusToggle(user)}
                    >
                      {user.isActive ? '停止' : '復活'}
                    </Button>
                    {!isSelf && (
                      <Button
                        size="small"
                        variant="outlined"
                        color="error"
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

      <Dialog open={!!deleteTarget} onClose={() => setDeleteTarget(null)}>
        <DialogTitle>ユーザーを削除しますか？</DialogTitle>
        <DialogContent>
          <DialogContentText>
            {deleteTarget?.username} を削除します。この操作は取り消せません。
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteTarget(null)}>キャンセル</Button>
          <Button color="error" onClick={() => void handleDelete()}>
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
      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell>チャンネル名</TableCell>
            <TableCell>説明</TableCell>
            <TableCell>種別</TableCell>
            <TableCell>メンバー数</TableCell>
            <TableCell>操作</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {channels.map((ch) => (
            <TableRow key={ch.id}>
              <TableCell>{ch.name}</TableCell>
              <TableCell>{ch.description ?? '—'}</TableCell>
              <TableCell>
                <Chip
                  label={ch.isPrivate ? 'プライベート' : '公開'}
                  size="small"
                  color={ch.isPrivate ? 'warning' : 'default'}
                />
              </TableCell>
              <TableCell>{ch.memberCount}</TableCell>
              <TableCell>
                <Button
                  size="small"
                  variant="outlined"
                  color="error"
                  onClick={() => setDeleteTarget(ch)}
                >
                  削除
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <Dialog open={!!deleteTarget} onClose={() => setDeleteTarget(null)}>
        <DialogTitle>チャンネルを削除しますか？</DialogTitle>
        <DialogContent>
          <DialogContentText>
            #{deleteTarget?.name} を削除します。この操作は取り消せません。
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteTarget(null)}>キャンセル</Button>
          <Button color="error" onClick={() => void handleDelete()}>
            削除
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
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
    <Box sx={{ p: 3 }}>
      <Typography variant="h5" fontWeight="bold" mb={2}>
        管理画面
      </Typography>

      <Tabs value={tab} onChange={(_, v: number) => setTab(v)} sx={{ mb: 2 }}>
        <Tab label="統計" />
        <Tab label="ユーザー管理" />
        <Tab label="チャンネル管理" />
      </Tabs>

      {tab === 0 && (
        <Suspense fallback={fallback}>
          <StatsContent statsPromise={statsPromise} />
        </Suspense>
      )}
      {tab === 1 && (
        <Suspense fallback={fallback}>
          <UsersContent usersPromise={usersPromise} currentUserId={user.id} />
        </Suspense>
      )}
      {tab === 2 && (
        <Suspense fallback={fallback}>
          <ChannelsContent channelsPromise={channelsPromise} />
        </Suspense>
      )}
    </Box>
  );
}
