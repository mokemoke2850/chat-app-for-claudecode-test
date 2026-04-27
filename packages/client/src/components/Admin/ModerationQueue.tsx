/**
 * #116 モデレーションキュー
 * 管理者が通報一覧を確認し、却下またはメッセージ削除で対応するコンポーネント
 */

import { useState, useMemo, use, Suspense, Component, ReactNode } from 'react';
import {
  Box,
  Button,
  Chip,
  CircularProgress,
  FormControl,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material';
import type { MessageReport, ReportStatus } from '@chat-app/shared';
import { api } from '../../api/client';
import { useSnackbar } from '../../contexts/SnackbarContext';

// ─── ErrorBoundary ────────────────────────────────────────────

class ErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean; msg: string }> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false, msg: '' };
  }
  static getDerivedStateFromError(error: unknown) {
    return { hasError: true, msg: error instanceof Error ? error.message : 'エラー' };
  }
  render() {
    if (this.state.hasError) {
      return (
        <Box sx={{ p: 2, color: 'error.main' }}>
          <Typography>エラーが発生しました: {this.state.msg}</Typography>
        </Box>
      );
    }
    return this.props.children;
  }
}

// ─── ステータスラベル ──────────────────────────────────────────

const STATUS_LABELS: Record<ReportStatus, string> = {
  pending: '未対応',
  dismissed: '却下',
  actioned: '対応済み',
};

const STATUS_COLORS: Record<ReportStatus, 'warning' | 'default' | 'success'> = {
  pending: 'warning',
  dismissed: 'default',
  actioned: 'success',
};

const REASON_LABELS: Record<string, string> = {
  spam: 'スパム',
  harassment: 'ハラスメント',
  other: 'その他',
};

// ─── キューコンテンツ ──────────────────────────────────────────

function QueueContent({
  reportsPromise,
}: {
  reportsPromise: Promise<{ reports: MessageReport[] }>;
}) {
  const { reports: initial } = use(reportsPromise);
  const [reports, setReports] = useState<MessageReport[]>(initial);
  const { showError, showSuccess } = useSnackbar();

  const handleDismiss = async (reportId: number) => {
    try {
      const result = await api.admin.reports.dismiss(reportId);
      setReports((prev) => prev.map((r) => (r.id === reportId ? result.report : r)));
      showSuccess('通報を却下しました');
    } catch {
      showError('却下に失敗しました');
    }
  };

  const handleDeleteMessage = async (reportId: number) => {
    try {
      const result = await api.admin.reports.action(reportId, 'delete_message');
      setReports((prev) => prev.map((r) => (r.id === reportId ? result.report : r)));
      showSuccess('メッセージを削除しました');
    } catch {
      showError('削除に失敗しました');
    }
  };

  if (reports.length === 0) {
    return (
      <Box sx={{ p: 3, textAlign: 'center' }}>
        <Typography color="text.secondary">通報はありません</Typography>
      </Box>
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
            <TableCell sx={{ fontWeight: 600 }}>ID</TableCell>
            <TableCell sx={{ fontWeight: 600 }}>通報日時</TableCell>
            <TableCell sx={{ fontWeight: 600 }}>通報者</TableCell>
            <TableCell sx={{ fontWeight: 600 }}>メッセージID</TableCell>
            <TableCell sx={{ fontWeight: 600 }}>理由</TableCell>
            <TableCell sx={{ fontWeight: 600 }}>コメント</TableCell>
            <TableCell sx={{ fontWeight: 600 }}>ステータス</TableCell>
            <TableCell sx={{ fontWeight: 600 }}>操作</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {reports.map((report) => (
            <TableRow key={report.id} sx={{ '&:hover': { bgcolor: 'action.hover' } }}>
              <TableCell>{report.id}</TableCell>
              <TableCell>
                <Typography variant="body2" color="text.secondary">
                  {new Date(report.createdAt).toLocaleString('ja-JP')}
                </Typography>
              </TableCell>
              <TableCell>
                <Typography variant="body2">{report.reporterUsername ?? '—'}</Typography>
              </TableCell>
              <TableCell>{report.messageId}</TableCell>
              <TableCell>
                <Chip
                  label={REASON_LABELS[report.reason] ?? report.reason}
                  size="small"
                  variant="outlined"
                />
              </TableCell>
              <TableCell>
                <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 200 }}>
                  {report.comment ?? '—'}
                </Typography>
              </TableCell>
              <TableCell>
                <Chip
                  label={STATUS_LABELS[report.status]}
                  color={STATUS_COLORS[report.status]}
                  size="small"
                  sx={{ fontWeight: 500 }}
                />
              </TableCell>
              <TableCell>
                {report.status === 'pending' && (
                  <Box sx={{ display: 'flex', gap: 0.5 }}>
                    <Button
                      size="small"
                      variant="outlined"
                      sx={{ fontSize: 11, whiteSpace: 'nowrap' }}
                      onClick={() => void handleDismiss(report.id)}
                      aria-label={`通報 ${report.id} を却下`}
                    >
                      却下
                    </Button>
                    <Button
                      size="small"
                      variant="outlined"
                      color="error"
                      sx={{ fontSize: 11, whiteSpace: 'nowrap' }}
                      onClick={() => void handleDeleteMessage(report.id)}
                      aria-label={`通報 ${report.id} のメッセージを削除`}
                    >
                      メッセージを削除
                    </Button>
                  </Box>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Paper>
  );
}

// ─── メインコンポーネント ──────────────────────────────────────

export default function ModerationQueue() {
  const [statusFilter, setStatusFilter] = useState<ReportStatus | 'all'>('all');

  const reportsPromise = useMemo(
    () => api.admin.reports.list(statusFilter !== 'all' ? { status: statusFilter } : undefined),
    [statusFilter],
  );

  return (
    <Box>
      <Box sx={{ mb: 2, display: 'flex', alignItems: 'center', gap: 2 }}>
        <Typography variant="h6" fontWeight={600}>
          通報キュー
        </Typography>
        <FormControl size="small" sx={{ minWidth: 140 }}>
          <InputLabel id="report-status-filter-label">ステータス</InputLabel>
          <Select
            labelId="report-status-filter-label"
            value={statusFilter}
            label="ステータス"
            onChange={(e) => setStatusFilter(e.target.value as ReportStatus | 'all')}
          >
            <MenuItem value="all">すべて</MenuItem>
            <MenuItem value="pending">未対応</MenuItem>
            <MenuItem value="dismissed">却下</MenuItem>
            <MenuItem value="actioned">対応済み</MenuItem>
          </Select>
        </FormControl>
      </Box>

      <ErrorBoundary>
        <Suspense
          fallback={
            <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
              <CircularProgress />
            </Box>
          }
        >
          <QueueContent reportsPromise={reportsPromise} />
        </Suspense>
      </ErrorBoundary>
    </Box>
  );
}
