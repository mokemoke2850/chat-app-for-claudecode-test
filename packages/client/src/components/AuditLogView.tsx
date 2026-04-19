import { useState, useMemo, use, Suspense, Component, ReactNode } from 'react';
import {
  Box,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  MenuItem,
  Select,
  TextField,
  Button,
  CircularProgress,
  Typography,
  FormControl,
  InputLabel,
} from '@mui/material';
import { api } from '../api/client';
import type { AuditLog, AuditActionType, AuditLogListResponse } from '../types/admin';

const PAGE_LIMIT = 50;

const ACTION_TYPE_LABELS: Record<AuditActionType, string> = {
  'auth.login': 'ログイン',
  'auth.logout': 'ログアウト',
  'channel.create': 'チャンネル作成',
  'channel.delete': 'チャンネル削除',
  'channel.archive': 'チャンネルアーカイブ',
  'channel.unarchive': 'アーカイブ解除',
  'message.delete': 'メッセージ削除',
  'user.role_change': 'ロール変更',
  'user.status_change': 'アカウント状態変更',
  'user.delete': 'ユーザー削除',
  'audit.export': '監査ログエクスポート',
};

const ACTION_TYPE_OPTIONS: AuditActionType[] = Object.keys(ACTION_TYPE_LABELS) as AuditActionType[];

interface FilterState {
  actionType: string;
  actorUserId: string;
  from: string;
  to: string;
  offset: number;
}

interface ActorOption {
  id: number;
  username: string;
}

interface AuditLogContentProps {
  fetchPromise: Promise<AuditLogListResponse>;
}

function formatTargetCell(log: AuditLog): string {
  if (!log.targetType) return '—';
  if (log.targetId === null) return log.targetType;
  return `${log.targetType} #${log.targetId}`;
}

function formatActorName(log: AuditLog): string {
  if (log.actorUserId === null || log.actorUsername === null) {
    return '（削除済みユーザー）';
  }
  return log.actorUsername;
}

function formatMetadata(metadata: Record<string, unknown> | null): string {
  if (!metadata) return '—';
  return Object.entries(metadata)
    .map(([k, v]) => `${k}: ${String(v)}`)
    .join(', ');
}

function AuditLogContent({ fetchPromise }: AuditLogContentProps) {
  const result = use(fetchPromise);
  const { logs } = result;

  if (logs.length === 0) {
    return (
      <Paper elevation={0} sx={{ p: 4, textAlign: 'center', color: 'text.secondary' }}>
        <Typography>監査ログがありません</Typography>
      </Paper>
    );
  }

  return (
    <Paper
      elevation={0}
      sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2, overflow: 'hidden' }}
    >
      <Table size="small">
        <TableHead>
          <TableRow sx={{ bgcolor: 'grey.50' }}>
            <TableCell sx={{ fontWeight: 600 }}>日時</TableCell>
            <TableCell sx={{ fontWeight: 600 }}>操作</TableCell>
            <TableCell sx={{ fontWeight: 600 }}>実行者</TableCell>
            <TableCell sx={{ fontWeight: 600 }}>対象</TableCell>
            <TableCell sx={{ fontWeight: 600 }}>詳細</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {logs.map((log) => (
            <TableRow key={log.id} hover>
              <TableCell>
                <Typography variant="body2">
                  {new Date(log.createdAt).toLocaleString('ja-JP')}
                </Typography>
              </TableCell>
              <TableCell>
                <Typography variant="body2">
                  {ACTION_TYPE_LABELS[log.actionType] ?? log.actionType}
                </Typography>
              </TableCell>
              <TableCell>
                <Typography
                  variant="body2"
                  color={log.actorUserId === null ? 'text.disabled' : 'text.primary'}
                >
                  {formatActorName(log)}
                </Typography>
              </TableCell>
              <TableCell>
                <Typography variant="body2">{formatTargetCell(log)}</Typography>
              </TableCell>
              <TableCell>
                <Typography variant="body2" color="text.secondary">
                  {formatMetadata(log.metadata)}
                </Typography>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Paper>
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

interface AuditLogViewProps {
  actors?: ActorOption[];
}

export default function AuditLogView({ actors = [] }: AuditLogViewProps) {
  const [filter, setFilter] = useState<FilterState>({
    actionType: '',
    actorUserId: '',
    from: '',
    to: '',
    offset: 0,
  });
  const [total, setTotal] = useState<number>(0);

  // filter の各値が変わるたびに新しい Promise を作る（useMemo で安定化）
  const fetchPromise = useMemo(() => {
    const params: Parameters<typeof api.admin.getAuditLogs>[0] = {
      limit: PAGE_LIMIT,
      offset: filter.offset,
    };
    if (filter.actionType) params.actionType = filter.actionType;
    if (filter.actorUserId) params.actorUserId = Number(filter.actorUserId);
    if (filter.from) params.from = filter.from;
    if (filter.to) params.to = filter.to;

    return api.admin.getAuditLogs(params).then((res) => {
      setTotal(res.total);
      return res;
    });
  }, [filter]);

  const hasPrev = filter.offset > 0;
  const hasNext = filter.offset + PAGE_LIMIT < total;

  const handleReset = () => {
    setFilter({ actionType: '', actorUserId: '', from: '', to: '', offset: 0 });
  };

  return (
    <Box>
      {/* フィルタ */}
      <Box sx={{ display: 'flex', gap: 2, mb: 2, flexWrap: 'wrap', alignItems: 'center' }}>
        <FormControl size="small" sx={{ minWidth: 180 }}>
          <InputLabel id="audit-action-type-label">操作</InputLabel>
          <Select
            labelId="audit-action-type-label"
            label="操作"
            value={filter.actionType}
            onChange={(e) =>
              setFilter((f) => ({ ...f, actionType: String(e.target.value), offset: 0 }))
            }
            inputProps={{ 'aria-label': '操作' }}
          >
            <MenuItem value="">すべて</MenuItem>
            {ACTION_TYPE_OPTIONS.map((v) => (
              <MenuItem key={v} value={v}>
                {ACTION_TYPE_LABELS[v]}
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        <FormControl size="small" sx={{ minWidth: 180 }}>
          <InputLabel id="audit-actor-label">実行者</InputLabel>
          <Select
            labelId="audit-actor-label"
            label="実行者"
            value={filter.actorUserId}
            onChange={(e) =>
              setFilter((f) => ({ ...f, actorUserId: String(e.target.value), offset: 0 }))
            }
            inputProps={{ 'aria-label': '実行者' }}
          >
            <MenuItem value="">すべて</MenuItem>
            {actors.map((a) => (
              <MenuItem key={a.id} value={String(a.id)}>
                {a.username}
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        <TextField
          size="small"
          type="date"
          label="開始日"
          InputLabelProps={{ shrink: true }}
          value={filter.from}
          onChange={(e) => setFilter((f) => ({ ...f, from: e.target.value, offset: 0 }))}
          inputProps={{ 'aria-label': '開始日' }}
        />

        <TextField
          size="small"
          type="date"
          label="終了日"
          InputLabelProps={{ shrink: true }}
          value={filter.to}
          onChange={(e) => setFilter((f) => ({ ...f, to: e.target.value, offset: 0 }))}
          inputProps={{ 'aria-label': '終了日' }}
        />

        <Button variant="outlined" onClick={handleReset}>
          リセット
        </Button>

        <Button
          variant="contained"
          onClick={() => {
            const url = api.admin.exportAuditLogsUrl({
              actionType: filter.actionType || undefined,
              actorUserId: filter.actorUserId ? Number(filter.actorUserId) : undefined,
              from: filter.from || undefined,
              to: filter.to || undefined,
            });
            window.open(url, '_blank');
          }}
        >
          CSV エクスポート
        </Button>
      </Box>

      {/* ログテーブル */}
      <ErrorBoundary>
        <Suspense
          fallback={
            <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
              <CircularProgress />
            </Box>
          }
        >
          <AuditLogContent fetchPromise={fetchPromise} />
        </Suspense>
      </ErrorBoundary>

      {/* ページネーション */}
      <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1, mt: 2 }}>
        <Button
          variant="outlined"
          disabled={!hasPrev}
          onClick={() => setFilter((f) => ({ ...f, offset: Math.max(f.offset - PAGE_LIMIT, 0) }))}
        >
          前へ
        </Button>
        <Button
          variant="outlined"
          disabled={!hasNext}
          onClick={() => setFilter((f) => ({ ...f, offset: f.offset + PAGE_LIMIT }))}
        >
          次へ
        </Button>
      </Box>
    </Box>
  );
}
