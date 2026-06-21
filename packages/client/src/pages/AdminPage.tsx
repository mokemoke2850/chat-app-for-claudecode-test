import {
  useState,
  useMemo,
  useEffect,
  use,
  Suspense,
  Component,
  ReactNode,
  ChangeEvent,
} from 'react';
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
  FormControlLabel,
  Switch,
  Alert,
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
  MaintenanceModeSettings,
  SettingsImportPreview,
  AdminHealthDetails,
  HealthStatus,
  JobMonitoringStatus,
  OrphanFile,
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
  const timestamps = Array.from(
    new Set(data.flatMap((channel) => channel.points.map((p) => p.timestamp))),
  );
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

const HEALTH_STATUS_LABEL: Record<HealthStatus, string> = {
  normal: '正常',
  warning: '警告',
  error: '異常',
};

const HEALTH_STATUS_COLOR: Record<HealthStatus, 'success' | 'warning' | 'error'> = {
  normal: 'success',
  warning: 'warning',
  error: 'error',
};

function StatusChip({ status }: { status: HealthStatus }) {
  return (
    <Chip
      size="small"
      color={HEALTH_STATUS_COLOR[status]}
      label={HEALTH_STATUS_LABEL[status]}
      sx={{ fontWeight: 600 }}
    />
  );
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function HealthCard({
  title,
  status,
  children,
}: {
  title: string;
  status: HealthStatus;
  children: ReactNode;
}) {
  return (
    <Card
      elevation={0}
      sx={{
        flex: '1 1 260px',
        minWidth: 260,
        border: '1px solid',
        borderColor: 'divider',
        borderRadius: 2,
      }}
    >
      <CardContent sx={{ display: 'flex', flexDirection: 'column', gap: 1.25 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1 }}>
          <Typography variant="subtitle1" fontWeight={600}>
            {title}
          </Typography>
          <StatusChip status={status} />
        </Box>
        {children}
      </CardContent>
    </Card>
  );
}

function HealthDetailsContent({
  healthPromise,
}: {
  healthPromise: Promise<AdminHealthDetails>;
}) {
  const details = use(healthPromise);
  const { database, socket, jobs, storage } = details.components;

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, p: 2 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
        <Typography variant="h6">ヘルスチェック詳細</Typography>
        <StatusChip status={details.overallStatus} />
        <Typography variant="body2" color="text.secondary">
          最終確認: {new Date(details.checkedAt).toLocaleString('ja-JP')}
        </Typography>
      </Box>

      <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
        <HealthCard title="DB 接続" status={database.status}>
          <Typography variant="body2">{database.reachable ? '応答可' : '応答不可'}</Typography>
          <Typography variant="body2" color="text.secondary">
            レイテンシ: {database.latencyMs === null ? '-' : `${database.latencyMs} ms`}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {database.message}
          </Typography>
        </HealthCard>

        <HealthCard title="Socket サーバー" status={socket.status}>
          <Typography variant="body2">{socket.running ? '稼働中' : '停止中'}</Typography>
          <Typography variant="body2" color="text.secondary">
            {socket.connectionCount} 接続
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {socket.message}
          </Typography>
        </HealthCard>

        <HealthCard title="ストレージ" status={storage.status}>
          <Typography variant="body2">{storage.writable ? '書き込み可' : '書き込み不可'}</Typography>
          <Typography variant="body2" color="text.secondary">
            {formatBytes(storage.totalBytes)}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {storage.fileCount} ファイル
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {storage.message}
          </Typography>
        </HealthCard>
      </Box>

      <Card elevation={0} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2 }}>
        <CardContent>
          <Box
            sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1.5 }}
          >
            <Typography variant="subtitle1" fontWeight={600}>
              バックグラウンドジョブ
            </Typography>
            <StatusChip status={jobs.status} />
          </Box>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>ジョブ</TableCell>
                <TableCell>状態</TableCell>
                <TableCell>間隔</TableCell>
                <TableCell>ステータス</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {jobs.workers.map((worker) => (
                <TableRow key={worker.key}>
                  <TableCell>{worker.label}</TableCell>
                  <TableCell>{worker.running ? '稼働中' : '停止中'}</TableCell>
                  <TableCell>{Math.round(worker.intervalMs / 1000)} 秒</TableCell>
                  <TableCell>
                    <StatusChip status={worker.status} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1.5 }}>
            {jobs.message}
          </Typography>
        </CardContent>
      </Card>
    </Box>
  );
}

function JobMonitoringContent({
  jobMonitoringPromise,
}: {
  jobMonitoringPromise: Promise<{ jobs: JobMonitoringStatus[] }>;
}) {
  const { jobs } = use(jobMonitoringPromise);
  const formatDate = (value: string | null) =>
    value ? new Date(value).toLocaleString('ja-JP') : '未実行';
  return (
    <Box sx={{ p: 2 }}>
      <Typography variant="h6" sx={{ mb: 2 }}>バックグラウンドジョブ監視</Typography>
      <Table size="small">
        <TableHead><TableRow>
          <TableCell>ジョブ</TableCell><TableCell>最終実行</TableCell><TableCell>次回予定</TableCell>
          <TableCell>成功</TableCell><TableCell>失敗</TableCell><TableCell>直近の失敗</TableCell><TableCell>状態</TableCell>
        </TableRow></TableHead>
        <TableBody>{jobs.map((job) => (
          <TableRow key={job.key}>
            <TableCell>{job.label}</TableCell>
            <TableCell>{formatDate(job.lastRunAt)}</TableCell>
            <TableCell>{formatDate(job.nextRunAt)}</TableCell>
            <TableCell>{job.successCount} 回</TableCell>
            <TableCell>{job.failureCount} 回</TableCell>
            <TableCell>{job.lastFailure?.message ?? 'なし'}</TableCell>
            <TableCell><StatusChip status={job.status} /></TableCell>
          </TableRow>
        ))}</TableBody>
      </Table>
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

function formatOrphanFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function OrphanFilesContent({ filesPromise }: { filesPromise: Promise<{ files: OrphanFile[] }> }) {
  const { files: initialFiles } = use(filesPromise);
  const [files, setFiles] = useState(initialFiles);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [pendingDeleteIds, setPendingDeleteIds] = useState<number[] | null>(null);
  const [deleting, setDeleting] = useState(false);
  const { showSuccess, showError } = useSnackbar();

  const toggleSelected = (id: number) => {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleDelete = async () => {
    if (!pendingDeleteIds || pendingDeleteIds.length === 0) return;
    setDeleting(true);
    try {
      const result = await api.admin.deleteOrphanFiles(pendingDeleteIds);
      const deleted = new Set(result.deletedIds);
      setFiles((current) => current.filter((file) => !deleted.has(file.id)));
      setSelectedIds((current) => {
        const next = new Set(current);
        result.deletedIds.forEach((id) => next.delete(id));
        return next;
      });
      if (result.deletedCount > 0) {
        showSuccess(`${result.deletedCount}件のファイルを削除しました`);
      }
      if (result.failed.length > 0 || result.skippedIds.length > 0) {
        showError('一部のファイルを削除できませんでした');
      }
      setPendingDeleteIds(null);
    } catch {
      showError('ファイルの削除に失敗しました');
      setPendingDeleteIds(null);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
        <Box>
          <Typography variant="h6">孤立ファイル</Typography>
          <Typography variant="body2" color="text.secondary">
            どこからも参照されず、アップロードから24時間以上経過したファイルです。
          </Typography>
        </Box>
        <Button
          variant="contained"
          color="error"
          disabled={selectedIds.size === 0}
          onClick={() => setPendingDeleteIds(Array.from(selectedIds))}
        >
          選択した{selectedIds.size}件を削除
        </Button>
      </Box>

      {files.length === 0 ? (
        <Alert severity="success">削除候補のファイルはありません</Alert>
      ) : (
        <Paper variant="outlined" sx={{ overflowX: 'auto' }}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell padding="checkbox" />
                <TableCell>ファイル名</TableCell>
                <TableCell>サイズ</TableCell>
                <TableCell>アップロード日時</TableCell>
                <TableCell>アップロード者</TableCell>
                <TableCell align="right">操作</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {files.map((file) => (
                <TableRow key={file.id}>
                  <TableCell padding="checkbox">
                    <Checkbox
                      checked={selectedIds.has(file.id)}
                      onChange={() => toggleSelected(file.id)}
                      inputProps={{ 'aria-label': `選択: ${file.originalName}` }}
                    />
                  </TableCell>
                  <TableCell>{file.originalName}</TableCell>
                  <TableCell>{formatOrphanFileSize(file.size)}</TableCell>
                  <TableCell>{new Date(file.createdAt).toLocaleString('ja-JP')}</TableCell>
                  <TableCell>{file.uploader?.username ?? '不明なユーザー'}</TableCell>
                  <TableCell align="right">
                    <Button
                      color="error"
                      size="small"
                      aria-label={`削除: ${file.originalName}`}
                      onClick={() => setPendingDeleteIds([file.id])}
                    >
                      削除
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Paper>
      )}

      <Dialog
        open={pendingDeleteIds !== null}
        onClose={() => !deleting && setPendingDeleteIds(null)}
      >
        <DialogTitle>孤立ファイルを削除しますか？</DialogTitle>
        <DialogContent>
          <DialogContentText>
            {pendingDeleteIds?.length ?? 0}
            件のファイルを完全に削除します。この操作は元に戻せません。
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button disabled={deleting} onClick={() => setPendingDeleteIds(null)}>
            キャンセル
          </Button>
          <Button
            disabled={deleting}
            color="error"
            variant="contained"
            onClick={() => void handleDelete()}
          >
            削除する
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

// ─── メンテナンスモード設定タブ（Issue #392） ─────────────────
function MaintenanceModeContent({
  maintenancePromise,
}: {
  maintenancePromise: Promise<{ settings: MaintenanceModeSettings }>;
}) {
  const { settings: initial } = use(maintenancePromise);
  const [enabled, setEnabled] = useState(initial.enabled);
  const [message, setMessage] = useState(initial.message);
  const [restrictedOperations, setRestrictedOperations] = useState<string[]>(
    initial.restrictedOperations,
  );
  const [saving, setSaving] = useState(false);
  const { showSuccess, showError } = useSnackbar();

  const toggleRestriction = (operation: string) => {
    setRestrictedOperations((prev) =>
      prev.includes(operation) ? prev.filter((op) => op !== operation) : [...prev, operation],
    );
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const result = await api.admin.maintenance.update({
        enabled,
        message,
        restrictedOperations,
      });
      setEnabled(result.settings.enabled);
      setMessage(result.settings.message);
      setRestrictedOperations(result.settings.restrictedOperations);
      showSuccess('メンテナンスモード設定を保存しました');
    } catch (err) {
      showError(err instanceof Error ? err.message : 'メンテナンスモード設定の保存に失敗しました');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Box sx={{ maxWidth: 720 }}>
      <Paper
        elevation={0}
        sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2, p: 2.5 }}
      >
        <FormControlLabel
          control={
            <Switch
              checked={enabled}
              onChange={(event) => setEnabled(event.target.checked)}
              inputProps={{ 'aria-label': 'メンテナンスモード' }}
            />
          }
          label="メンテナンスモード"
        />
        <TextField
          label="告知メッセージ"
          value={message}
          onChange={(event) => setMessage(event.target.value)}
          fullWidth
          multiline
          minRows={2}
          sx={{ mt: 2 }}
        />
        <Typography variant="subtitle2" sx={{ mt: 2, mb: 1 }}>
          制限対象
        </Typography>
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
          {[
            ['posting', '投稿'],
            ['upload', 'アップロード'],
            ['login', 'ログイン'],
          ].map(([value, label]) => (
            <FormControlLabel
              key={value}
              control={
                <Checkbox
                  checked={restrictedOperations.includes(value)}
                  onChange={() => toggleRestriction(value)}
                />
              }
              label={label}
            />
          ))}
        </Box>
        <Button
          variant="contained"
          onClick={() => void handleSave()}
          disabled={saving}
          sx={{ mt: 2 }}
        >
          保存
        </Button>
      </Paper>
    </Box>
  );
}

// ─── 設定エクスポート / インポートタブ（Issue #394） ───────────
function SettingsImportExportContent() {
  const [preview, setPreview] = useState<SettingsImportPreview | null>(null);
  const [importData, setImportData] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);
  const { showSuccess, showError } = useSnackbar();

  const handleExport = async () => {
    setBusy(true);
    try {
      const data = await api.admin.settings.export();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `settings-export-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      showSuccess('設定をエクスポートしました');
    } catch (err) {
      showError(err instanceof Error ? err.message : '設定のエクスポートに失敗しました');
    } finally {
      setBusy(false);
    }
  };

  const handleFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const parsed = JSON.parse(text) as unknown;
      const result = await api.admin.settings.previewImport(parsed);
      setImportData(parsed);
      setPreview(result);
      showSuccess('インポート内容を確認しました');
    } catch (err) {
      setImportData(null);
      setPreview(null);
      showError(err instanceof Error ? err.message : '設定 JSON の読み込みに失敗しました');
    } finally {
      event.target.value = '';
    }
  };

  const handleImport = async () => {
    if (!importData) return;
    setBusy(true);
    try {
      const result = await api.admin.settings.import(importData);
      setPreview(result);
      showSuccess('設定をインポートしました');
    } catch (err) {
      showError(err instanceof Error ? err.message : '設定のインポートに失敗しました');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Box sx={{ maxWidth: 760 }}>
      <Paper
        elevation={0}
        sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2, p: 2.5 }}
      >
        <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap', mb: 2 }}>
          <Button variant="contained" onClick={() => void handleExport()} disabled={busy}>
            JSON をエクスポート
          </Button>
          <Button variant="outlined" component="label" disabled={busy}>
            JSON を選択
            <input
              hidden
              type="file"
              accept="application/json,.json"
              onChange={(event) => void handleFileChange(event)}
            />
          </Button>
        </Box>
        {preview ? (
          <Alert severity="info" sx={{ mb: 2 }}>
            差分プレビュー: チャンネル 追加 {preview.diff.channels.added} / 更新{' '}
            {preview.diff.channels.updated}、通知 追加 {preview.diff.notifications.added} / 更新{' '}
            {preview.diff.notifications.updated}、NG ワード 追加 {preview.diff.ngWords.added} / 更新{' '}
            {preview.diff.ngWords.updated}、権限 更新 {preview.diff.permissions.updated}
          </Alert>
        ) : (
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            インポートする JSON を選択すると差分を確認できます。
          </Typography>
        )}
        <Button
          variant="contained"
          color="warning"
          onClick={() => void handleImport()}
          disabled={!preview || busy}
        >
          インポート実行
        </Button>
      </Paper>
    </Box>
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
  const healthPromise = useMemo(
    () =>
      tab === 6
        ? api.admin.getHealthDetails()
        : Promise.resolve({
            checkedAt: new Date(0).toISOString(),
            overallStatus: 'normal' as const,
            components: {
              database: {
                status: 'normal' as const,
                reachable: true,
                latencyMs: 0,
                message: '',
              },
              socket: {
                status: 'normal' as const,
                running: true,
                connectionCount: 0,
                message: '',
              },
              jobs: {
                status: 'normal' as const,
                workers: [],
                message: '',
              },
              storage: {
                status: 'normal' as const,
                writable: true,
                totalBytes: 0,
                fileCount: 0,
                path: '',
                message: '',
              },
            },
          }),
    [tab],
  );
  const jobMonitoringPromise = useMemo(
    () => tab === 7 ? api.admin.getJobMonitoring() : Promise.resolve({ jobs: [] }),
    [tab],
  );
  const maintenancePromise = useMemo(
    () =>
      tab === 8
        ? api.admin.maintenance.get()
        : Promise.resolve({
            settings: {
              enabled: false,
              message: '',
              restrictedOperations: [],
              updatedAt: null,
            },
          }),
    [tab],
  );
  const orphanFilesPromise = useMemo(
    () => (tab === 10 ? api.admin.getOrphanFiles() : Promise.resolve({ files: [] })),
    [tab],
  );
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
            <Tab label="ヘルスチェック" />
            <Tab label="ジョブ監視" />
            <Tab label="メンテナンスモード" />
            <Tab label="設定入出力" />
            <Tab label="孤立ファイル" />
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
          {tab === 6 && (
            <ErrorBoundary>
              <Suspense fallback={fallback}>
                <HealthDetailsContent healthPromise={healthPromise} />
              </Suspense>
            </ErrorBoundary>
          )}
          {tab === 7 && (
            <ErrorBoundary><Suspense fallback={fallback}>
              <JobMonitoringContent jobMonitoringPromise={jobMonitoringPromise} />
            </Suspense></ErrorBoundary>
          )}
          {tab === 8 && (
            <ErrorBoundary>
              <Suspense fallback={fallback}>
                <MaintenanceModeContent maintenancePromise={maintenancePromise} />
              </Suspense>
            </ErrorBoundary>
          )}
          {tab === 9 && <SettingsImportExportContent />}
          {tab === 10 && (
            <ErrorBoundary>
              <Suspense fallback={fallback}>
                <OrphanFilesContent filesPromise={orphanFilesPromise} />
              </Suspense>
            </ErrorBoundary>
          )}
        </Box>
      </Box>
    </AppLayout>
  );
}
