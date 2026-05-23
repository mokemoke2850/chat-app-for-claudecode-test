import { useState, useMemo, useEffect, use, Suspense, Component, ReactNode } from 'react';
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
  Paper,
  Avatar,
  Checkbox,
  ToggleButton,
  ToggleButtonGroup,
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
} from '@mui/material';
import AdminPanelSettingsIcon from '@mui/icons-material/AdminPanelSettings';
import PeopleIcon from '@mui/icons-material/People';
import ForumIcon from '@mui/icons-material/Forum';
import MessageIcon from '@mui/icons-material/Message';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import DateRangeIcon from '@mui/icons-material/DateRange';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useSnackbar } from '../contexts/SnackbarContext';
import { api } from '../api/client';
import type {
  AdminUser,
  AdminChannel,
  AdminStats,
  AdminTimeseriesResponse,
  ChannelTimeseries,
  TopChannelByMessageCount,
} from '../types/admin';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  Legend,
  BarChart,
  Bar,
} from 'recharts';
import AuditLogView from '../components/AuditLogView';
import ModerationContent from '../components/Admin/ModerationContent';
import ModerationQueue from '../components/Admin/ModerationQueue';
import AppLayout from '../components/Layout/AppLayout';

// ─── 期間フィルタ型 ────────────────────────────────────────────
type PeriodKey = '24h' | '7d' | '30d' | 'custom';

interface PeriodFilter {
  period?: PeriodKey;
  from?: string;
  to?: string;
}

// ─── 期間フィルタ UI ──────────────────────────────────────────
function PeriodFilterBar({
  value,
  onChange,
}: {
  value: PeriodFilter;
  onChange: (filter: PeriodFilter) => void;
}) {
  const [customFrom, setCustomFrom] = useState(value.from ?? '');
  const [customTo, setCustomTo] = useState(value.to ?? '');
  const [validationError, setValidationError] = useState('');

  const selectedPeriod: PeriodKey = value.from || value.to ? 'custom' : (value.period ?? '7d');

  const handlePeriodChange = (_: React.MouseEvent<HTMLElement>, next: PeriodKey | null) => {
    if (!next) return;
    setValidationError('');
    if (next === 'custom') {
      onChange({ period: 'custom' });
    } else {
      setCustomFrom('');
      setCustomTo('');
      onChange({ period: next });
    }
  };

  const handleApply = () => {
    setValidationError('');
    if (!customFrom || !customTo) return;
    if (new Date(customFrom) > new Date(customTo)) {
      setValidationError('開始日は終了日より前の日付を指定してください');
      return;
    }
    onChange({ from: customFrom, to: customTo });
  };

  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2, flexWrap: 'wrap' }}>
      <ToggleButtonGroup
        exclusive
        value={selectedPeriod}
        onChange={handlePeriodChange}
        size="small"
      >
        <ToggleButton value="24h">24h</ToggleButton>
        <ToggleButton value="7d">7d</ToggleButton>
        <ToggleButton value="30d">30d</ToggleButton>
        <ToggleButton value="custom">カスタム</ToggleButton>
      </ToggleButtonGroup>

      {selectedPeriod === 'custom' && (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
          <TextField
            type="date"
            size="small"
            value={customFrom}
            onChange={(e) => setCustomFrom(e.target.value)}
            inputProps={{ 'data-testid': 'period-date-from' }}
            sx={{ width: 160 }}
          />
          <Typography variant="body2" color="text.secondary">
            〜
          </Typography>
          <TextField
            type="date"
            size="small"
            value={customTo}
            onChange={(e) => setCustomTo(e.target.value)}
            inputProps={{ 'data-testid': 'period-date-to' }}
            sx={{ width: 160 }}
          />
          <Button
            variant="contained"
            size="small"
            onClick={handleApply}
            disabled={!customFrom || !customTo}
          >
            適用
          </Button>
          {validationError && (
            <Typography variant="caption" color="error">
              {validationError}
            </Typography>
          )}
        </Box>
      )}
    </Box>
  );
}

// ─── 月次レポート CSV エクスポート（Issue #273） ─────────────────
function generatePastMonths(count: number): string[] {
  const now = new Date();
  const months: string[] = [];
  for (let i = 1; i <= count; i++) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
    const y = d.getUTCFullYear();
    const m = String(d.getUTCMonth() + 1).padStart(2, '0');
    months.push(`${y}-${m}`);
  }
  return months;
}

function MonthlyReportSection() {
  const months = useMemo(() => generatePastMonths(12), []);
  const [selectedMonth, setSelectedMonth] = useState<string>(months[0] ?? '');
  const [downloading, setDownloading] = useState(false);

  const handleDownload = async () => {
    if (!selectedMonth || downloading) return;
    setDownloading(true);
    try {
      const blob = await api.admin.exportMonthlyReport({ month: selectedMonth });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `monthly-report-${selectedMonth}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {
      // ignore
    } finally {
      setDownloading(false);
    }
  };

  return (
    <Card
      elevation={0}
      sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2, mb: 2 }}
    >
      <CardContent>
        <Typography variant="subtitle1" fontWeight={600} sx={{ mb: 1.5 }}>
          月次レポート
        </Typography>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
          <FormControl size="small" sx={{ minWidth: 160 }}>
            <InputLabel id="monthly-report-month-label">対象月</InputLabel>
            <Select
              labelId="monthly-report-month-label"
              label="対象月"
              value={selectedMonth}
              data-testid="monthly-report-select"
              onChange={(e) => setSelectedMonth(String(e.target.value))}
            >
              {months.map((m) => (
                <MenuItem key={m} value={m}>
                  {m}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <Button
            variant="contained"
            onClick={() => void handleDownload()}
            disabled={!selectedMonth || downloading}
          >
            月次レポートをダウンロード
          </Button>
        </Box>
      </CardContent>
    </Card>
  );
}

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

// ─── 時系列グラフ ──────────────────────────────────────────────
function formatTimestamp(ts: string): string {
  const d = new Date(ts);
  // 24h以下のバケットは時刻、それ以外は日付
  // 軸の見やすさのため両方を含める
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(d.getUTCDate()).padStart(2, '0');
  const hh = String(d.getUTCHours()).padStart(2, '0');
  return `${mm}/${dd} ${hh}:00`;
}

function ChartCard({
  title,
  testId,
  data,
  color,
}: {
  title: string;
  testId: string;
  data: { timestamp: string; count: number }[];
  color: string;
}) {
  const formatted = data.map((p) => ({ ...p, label: formatTimestamp(p.timestamp) }));
  return (
    <Card
      data-testid={testId}
      elevation={0}
      sx={{
        flex: '1 1 360px',
        minWidth: 320,
        border: '1px solid',
        borderColor: 'divider',
        borderRadius: 2,
      }}
    >
      <CardContent>
        <Typography variant="subtitle1" fontWeight={600} sx={{ mb: 1 }}>
          {title}
        </Typography>
        {formatted.length === 0 ? (
          <Box sx={{ p: 4, textAlign: 'center', color: 'text.secondary' }}>
            <Typography variant="body2">データがありません</Typography>
          </Box>
        ) : (
          <Box sx={{ width: '100%', height: 240 }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={formatted} margin={{ top: 8, right: 16, bottom: 8, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                <RechartsTooltip />
                <Line
                  type="monotone"
                  dataKey="count"
                  stroke={color}
                  strokeWidth={2}
                  dot={false}
                  isAnimationActive={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </Box>
        )}
      </CardContent>
    </Card>
  );
}

const CHANNEL_COLORS = ['#1976d2', '#388e3c', '#f57c00', '#7b1fa2', '#00838f', '#c2185b'];

function ChannelTimeseriesCard({ data }: { data: ChannelTimeseries[] }) {
  const timestamps = Array.from(new Set(data.flatMap((channel) => channel.points.map((p) => p.timestamp))));
  const rows = timestamps.map((timestamp) => {
    const row: Record<string, string | number> = { timestamp, label: formatTimestamp(timestamp) };
    for (const channel of data) {
      const point = channel.points.find((p) => p.timestamp === timestamp);
      row[`channel_${channel.channelId}`] = point?.count ?? 0;
    }
    return row;
  });

  return (
    <Card
      data-testid="admin-chart-channel-timeseries"
      elevation={0}
      sx={{
        flex: '1 1 720px',
        minWidth: 320,
        border: '1px solid',
        borderColor: 'divider',
        borderRadius: 2,
      }}
    >
      <CardContent>
        <Typography variant="subtitle1" fontWeight={600} sx={{ mb: 1 }}>
          チャンネル別投稿ボリューム
        </Typography>
        {data.length === 0 ? (
          <Box sx={{ p: 4, textAlign: 'center', color: 'text.secondary' }}>
            <Typography variant="body2">データがありません</Typography>
          </Box>
        ) : (
          <>
          <Box sx={{ width: '100%', height: 280 }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={rows} margin={{ top: 8, right: 16, bottom: 8, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                <RechartsTooltip />
                <Legend />
                {data.map((channel, index) => (
                  <Line
                    key={channel.channelId}
                    type="monotone"
                    dataKey={`channel_${channel.channelId}`}
                    name={channel.channelName}
                    stroke={CHANNEL_COLORS[index % CHANNEL_COLORS.length]}
                    strokeWidth={2}
                    dot={false}
                    isAnimationActive={false}
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </Box>
          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mt: 1 }}>
            {data.map((channel) => (
              <Chip key={channel.channelId} size="small" label={channel.channelName} />
            ))}
          </Box>
          </>
        )}
      </CardContent>
    </Card>
  );
}

function TopChannelsCard({ data }: { data: TopChannelByMessageCount[] }) {
  const rows = data.map((channel) => ({
    ...channel,
    label: `#${channel.channelName}`,
  }));
  return (
    <Card
      data-testid="admin-chart-top-channels"
      elevation={0}
      sx={{
        flex: '1 1 480px',
        minWidth: 320,
        border: '1px solid',
        borderColor: 'divider',
        borderRadius: 2,
      }}
    >
      <CardContent>
        <Typography variant="subtitle1" fontWeight={600} sx={{ mb: 1 }}>
          投稿数 上位チャンネル
        </Typography>
        {rows.length === 0 ? (
          <Box sx={{ p: 4, textAlign: 'center', color: 'text.secondary' }}>
            <Typography variant="body2">データがありません</Typography>
          </Box>
        ) : (
          <>
            <Box sx={{ width: '100%', height: Math.max(220, rows.length * 36) }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={rows}
                  layout="vertical"
                  margin={{ top: 8, right: 24, bottom: 8, left: 56 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
                  <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11 }} />
                  <YAxis type="category" dataKey="label" width={92} tick={{ fontSize: 11 }} />
                  <RechartsTooltip />
                  <Bar dataKey="count" name="投稿数" fill="#1976d2" isAnimationActive={false} />
                </BarChart>
              </ResponsiveContainer>
            </Box>
            <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mt: 1 }}>
              {rows.map((channel) => (
                <Chip
                  key={channel.channelId}
                  size="small"
                  label={`${channel.label}: ${channel.count}`}
                />
              ))}
            </Box>
          </>
        )}
      </CardContent>
    </Card>
  );
}

function TimeseriesContent({
  timeseriesPromise,
  channelTimeseriesPromise,
  topChannelsPromise,
}: {
  timeseriesPromise: Promise<AdminTimeseriesResponse>;
  channelTimeseriesPromise: Promise<{ messagesByChannel?: ChannelTimeseries[] }>;
  topChannelsPromise: Promise<{ channels: TopChannelByMessageCount[] }>;
}) {
  const ts = use(timeseriesPromise);
  const channelTs = use(channelTimeseriesPromise);
  const topChannels = use(topChannelsPromise);
  return (
    <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', p: 2 }}>
      <ChartCard
        title="投稿数の推移"
        testId="admin-chart-messages"
        data={ts.messages}
        color="#1976d2"
      />
      <ChartCard
        title="アクティブユーザーの推移"
        testId="admin-chart-active-users"
        data={ts.activeUsers}
        color="#388e3c"
      />
      <ChannelTimeseriesCard data={channelTs.messagesByChannel ?? []} />
      <TopChannelsCard data={topChannels.channels} />
    </Box>
  );
}

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
            <TableRow sx={{ bgcolor: 'background.default' }}>
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
                      </Typography>
                      {isSelf && (
                        <Chip label="自分" size="small" sx={{ height: 18, fontSize: 10 }} />
                      )}
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
  const { showError } = useSnackbar();

  const handleDelete = async () => {
    if (!deleteTarget) return;
    await api.admin.deleteChannel(deleteTarget.id);
    setChannels((prev) => prev.filter((c) => c.id !== deleteTarget.id));
    setDeleteTarget(null);
  };

  const handleUnarchive = async (ch: AdminChannel) => {
    await api.admin.unarchiveChannel(ch.id);
    setChannels((prev) => prev.map((c) => (c.id === ch.id ? { ...c, isArchived: false } : c)));
  };

  const handleRecommendToggle = async (ch: AdminChannel) => {
    const next = !ch.isRecommended;
    // 楽観的更新
    setChannels((prev) => prev.map((c) => (c.id === ch.id ? { ...c, isRecommended: next } : c)));
    try {
      await api.admin.setChannelRecommended(ch.id, next);
    } catch {
      // ロールバック
      setChannels((prev) => prev.map((c) => (c.id === ch.id ? { ...c, isRecommended: !next } : c)));
      showError('おすすめ設定の更新に失敗しました');
    }
  };

  return (
    <>
      <Paper
        elevation={0}
        sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2, overflow: 'hidden' }}
      >
        <Table size="small">
          <TableHead>
            <TableRow sx={{ bgcolor: 'background.default' }}>
              <TableCell sx={{ fontWeight: 600 }}>チャンネル名</TableCell>
              <TableCell sx={{ fontWeight: 600 }}>説明</TableCell>
              <TableCell sx={{ fontWeight: 600 }}>種別</TableCell>
              <TableCell sx={{ fontWeight: 600 }}>状態</TableCell>
              <TableCell sx={{ fontWeight: 600 }}>メンバー数</TableCell>
              <TableCell sx={{ fontWeight: 600 }}>おすすめ</TableCell>
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
                  opacity: ch.isArchived ? 0.7 : 1,
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
                  {ch.isArchived && (
                    <Chip
                      label="アーカイブ済み"
                      size="small"
                      color="default"
                      sx={{ fontWeight: 500 }}
                    />
                  )}
                </TableCell>
                <TableCell>
                  <Typography variant="body2">{ch.memberCount}</Typography>
                </TableCell>
                <TableCell>
                  <Checkbox
                    checked={ch.isRecommended}
                    onChange={() => void handleRecommendToggle(ch)}
                    size="small"
                    inputProps={{ 'aria-label': 'おすすめ' }}
                  />
                </TableCell>
                <TableCell>
                  <Box sx={{ display: 'flex', gap: 0.5 }}>
                    {ch.isArchived && (
                      <Button
                        size="small"
                        variant="outlined"
                        color="primary"
                        sx={{ fontSize: 11, whiteSpace: 'nowrap' }}
                        onClick={() => void handleUnarchive(ch)}
                      >
                        アーカイブ解除
                      </Button>
                    )}
                    <Button
                      size="small"
                      variant="outlined"
                      color="error"
                      sx={{ fontSize: 11 }}
                      onClick={() => setDeleteTarget(ch)}
                    >
                      削除
                    </Button>
                  </Box>
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
  const [searchParams, setSearchParams] = useSearchParams();

  // URL パラメータから期間フィルタを復元
  const initialFilter = useMemo((): PeriodFilter => {
    const period = searchParams.get('period') as PeriodKey | null;
    const from = searchParams.get('from');
    const to = searchParams.get('to');
    if (from && to) return { from, to };
    if (period && ['24h', '7d', '30d'].includes(period)) return { period };
    return { period: '7d' };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const [periodFilter, setPeriodFilter] = useState<PeriodFilter>(initialFilter);

  // 期間フィルタが変わったら URL を更新
  const handlePeriodChange = (filter: PeriodFilter) => {
    setPeriodFilter(filter);
    const next = new URLSearchParams();
    if (filter.from && filter.to) {
      next.set('from', filter.from);
      next.set('to', filter.to);
    } else if (filter.period && filter.period !== 'custom') {
      next.set('period', filter.period);
    }
    setSearchParams(next, { replace: true });
  };

  // 期間フィルタに基づいて statsPromise を生成（filter が変わるたびに再生成）
  const statsPromise = useMemo(() => {
    const params: { period?: string; from?: string; to?: string } = {};
    if (periodFilter.from && periodFilter.to) {
      params.from = periodFilter.from;
      params.to = periodFilter.to;
    } else if (periodFilter.period && periodFilter.period !== 'custom') {
      params.period = periodFilter.period;
    }
    return api.admin.getStats(params);
  }, [periodFilter]);

  // 時系列データの Promise（Issue #271）
  const timeseriesPromise = useMemo(() => {
    const params: { period?: string; from?: string; to?: string } = {};
    if (periodFilter.from && periodFilter.to) {
      params.from = periodFilter.from;
      params.to = periodFilter.to;
    } else if (periodFilter.period && periodFilter.period !== 'custom') {
      params.period = periodFilter.period;
    } else {
      params.period = '7d';
    }
    return api.admin.getTimeseries(params);
  }, [periodFilter]);

  const channelTimeseriesPromise = useMemo(() => {
    const params: { period?: string; from?: string; to?: string } = {};
    if (periodFilter.from && periodFilter.to) {
      params.from = periodFilter.from;
      params.to = periodFilter.to;
    } else if (periodFilter.period && periodFilter.period !== 'custom') {
      params.period = periodFilter.period;
    } else {
      params.period = '7d';
    }
    return api.admin.getChannelTimeseries(params);
  }, [periodFilter]);

  const topChannelsPromise = useMemo(() => {
    const params: { period?: string; from?: string; to?: string; limit?: number } = { limit: 10 };
    if (periodFilter.from && periodFilter.to) {
      params.from = periodFilter.from;
      params.to = periodFilter.to;
    } else if (periodFilter.period && periodFilter.period !== 'custom') {
      params.period = periodFilter.period;
    } else {
      params.period = '7d';
    }
    return api.admin.getTopChannels(params);
  }, [periodFilter]);

  const usersPromise = useMemo(() => api.admin.getUsers(), []);
  const channelsPromise = useMemo(() => api.admin.getChannels(), []);
  const actorsPromise = useMemo(
    () =>
      api.admin.getUsers().then((r) => r.users.map((u) => ({ id: u.id, username: u.username }))),
    [],
  );
  const [actors, setActors] = useState<{ id: number; username: string }[]>([]);
  // actors 一覧はタブ切替時のフィルタ用、失敗時は空配列にフォールバック
  useEffect(() => {
    let cancelled = false;
    actorsPromise
      .then((r) => {
        if (!cancelled) setActors(r);
      })
      .catch(() => {
        if (!cancelled) setActors([]);
      });
    return () => {
      cancelled = true;
    };
  }, [actorsPromise]);

  // admin 以外はトップにリダイレクト
  if (!user || user.role !== 'admin') {
    navigate('/', { replace: true });
    return null;
  }

  const fallback = (
    <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
      <CircularProgress />
    </Box>
  );

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
          <AdminPanelSettingsIcon />
          <Typography variant="h6">管理画面</Typography>
        </Box>

        <Box sx={{ flexGrow: 1, overflow: 'auto', p: 3, bgcolor: 'background.default' }}>
          <Tabs
            value={tab}
            onChange={(_, v: number) => setTab(v)}
            sx={{
              mb: 3,
              bgcolor: 'background.paper',
              borderRadius: 1,
              border: '1px solid',
              borderColor: 'divider',
              px: 1,
            }}
          >
            <Tab label="統計" />
            <Tab label="ユーザー管理" />
            <Tab label="チャンネル管理" />
            <Tab label="監査ログ" />
            <Tab label="モデレーション設定" />
            <Tab label="通報キュー" />
          </Tabs>

          {tab === 0 && (
            <>
              <PeriodFilterBar value={periodFilter} onChange={handlePeriodChange} />
              <ErrorBoundary>
                <Suspense fallback={fallback}>
                  <StatsContent statsPromise={statsPromise} />
                </Suspense>
              </ErrorBoundary>
              <ErrorBoundary>
                <Suspense fallback={fallback}>
                  <TimeseriesContent
                    timeseriesPromise={timeseriesPromise}
                    channelTimeseriesPromise={channelTimeseriesPromise}
                    topChannelsPromise={topChannelsPromise}
                  />
                </Suspense>
              </ErrorBoundary>
              <Box sx={{ p: 2 }}>
                <MonthlyReportSection />
              </Box>
            </>
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
          {tab === 3 && <AuditLogView actors={actors} />}
          {tab === 4 && <ModerationContent />}
          {tab === 5 && <ModerationQueue />}
        </Box>
      </Box>
    </AppLayout>
  );
}
