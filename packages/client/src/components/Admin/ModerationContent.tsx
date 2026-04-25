import { useEffect, useState } from 'react';
import {
  Box,
  Button,
  Card,
  CardContent,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  MenuItem,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import { api } from '../../api/client';
import { useSnackbar } from '../../contexts/SnackbarContext';
import type { NgWord, NgWordAction, BlockedExtension } from '@chat-app/shared';

/**
 * #117 NG ワード / 添付制限 — モデレーション設定タブ
 *
 * 設計メモ:
 *   - 既存タブ（統計/ユーザー管理/チャンネル管理/監査ログ）は use() + Suspense を採用しているが、
 *     当タブは CRUD 操作で頻繁に再取得するため、useState + useEffect で素直に実装する。
 *   - エラー / 成功通知は SnackbarContext を経由する。
 */

export default function ModerationContent() {
  const { showSuccess, showError } = useSnackbar();

  const [ngWords, setNgWords] = useState<NgWord[]>([]);
  const [blocked, setBlocked] = useState<BlockedExtension[]>([]);

  // NG ワード追加ダイアログ
  const [ngDialogOpen, setNgDialogOpen] = useState(false);
  const [ngPatternInput, setNgPatternInput] = useState('');
  const [ngActionInput, setNgActionInput] = useState<NgWordAction>('block');

  // 拡張子追加ダイアログ
  const [extDialogOpen, setExtDialogOpen] = useState(false);
  const [extInput, setExtInput] = useState('');
  const [extReasonInput, setExtReasonInput] = useState('');

  const loadAll = async () => {
    try {
      const [a, b] = await Promise.all([
        api.admin.ngWords.list(),
        api.admin.blockedExtensions.list(),
      ]);
      setNgWords(a.ngWords);
      setBlocked(b.blockedExtensions);
    } catch {
      showError('モデレーション設定の取得に失敗しました');
    }
  };

  useEffect(() => {
    void loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ─── NG ワード操作 ─────────────────────────────────────────
  const handleCreateNg = async () => {
    if (!ngPatternInput.trim()) return;
    try {
      await api.admin.ngWords.create({
        pattern: ngPatternInput.trim(),
        action: ngActionInput,
      });
      setNgPatternInput('');
      setNgActionInput('block');
      setNgDialogOpen(false);
      await loadAll();
      showSuccess('NG ワードを追加しました');
    } catch {
      showError('NG ワードの追加に失敗しました');
    }
  };

  const handleUpdateNg = async (
    id: number,
    patch: { action?: NgWordAction; isActive?: boolean },
  ) => {
    try {
      await api.admin.ngWords.update(id, patch);
      await loadAll();
    } catch {
      showError('NG ワードの更新に失敗しました');
    }
  };

  const handleDeleteNg = async (id: number) => {
    try {
      await api.admin.ngWords.delete(id);
      await loadAll();
      showSuccess('NG ワードを削除しました');
    } catch {
      showError('NG ワードの削除に失敗しました');
    }
  };

  // ─── 拡張子ブロック操作 ──────────────────────────────────
  const handleCreateExt = async () => {
    if (!extInput.trim()) return;
    try {
      await api.admin.blockedExtensions.create({
        extension: extInput.trim(),
        reason: extReasonInput.trim() || undefined,
      });
      setExtInput('');
      setExtReasonInput('');
      setExtDialogOpen(false);
      await loadAll();
      showSuccess('拡張子を追加しました');
    } catch {
      showError('拡張子の追加に失敗しました');
    }
  };

  const handleDeleteExt = async (id: number) => {
    try {
      await api.admin.blockedExtensions.delete(id);
      await loadAll();
      showSuccess('拡張子を削除しました');
    } catch {
      showError('拡張子の削除に失敗しました');
    }
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      <Card>
        <CardContent>
          <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
            <Typography variant="h6" sx={{ flexGrow: 1 }}>
              NG ワード
            </Typography>
            <Button variant="contained" onClick={() => setNgDialogOpen(true)}>
              NG ワードを追加
            </Button>
          </Box>

          <Table size="small" aria-label="NG ワード一覧">
            <TableHead>
              <TableRow>
                <TableCell>パターン</TableCell>
                <TableCell>動作</TableCell>
                <TableCell>有効</TableCell>
                <TableCell>操作</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {ngWords.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4} align="center">
                    NG ワードは登録されていません
                  </TableCell>
                </TableRow>
              )}
              {ngWords.map((w) => (
                <TableRow key={w.id}>
                  <TableCell>{w.pattern}</TableCell>
                  <TableCell>
                    <TextField
                      select
                      size="small"
                      value={w.action}
                      onChange={(e) =>
                        void handleUpdateNg(w.id, {
                          action: e.target.value as NgWordAction,
                        })
                      }
                      inputProps={{ 'aria-label': `${w.pattern} の動作` }}
                    >
                      <MenuItem value="block">block（送信拒否）</MenuItem>
                      <MenuItem value="warn">warn（警告のみ）</MenuItem>
                    </TextField>
                  </TableCell>
                  <TableCell>
                    <Switch
                      checked={w.isActive}
                      onChange={(e) => void handleUpdateNg(w.id, { isActive: e.target.checked })}
                      inputProps={{ 'aria-label': `${w.pattern} を有効化` }}
                    />
                  </TableCell>
                  <TableCell>
                    <IconButton
                      aria-label={`${w.pattern} を削除`}
                      onClick={() => void handleDeleteNg(w.id)}
                    >
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardContent>
          <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
            <Typography variant="h6" sx={{ flexGrow: 1 }}>
              添付ファイル拡張子ブロックリスト
            </Typography>
            <Button variant="contained" onClick={() => setExtDialogOpen(true)}>
              拡張子を追加
            </Button>
          </Box>

          <Table size="small" aria-label="拡張子ブロックリスト一覧">
            <TableHead>
              <TableRow>
                <TableCell>拡張子</TableCell>
                <TableCell>理由</TableCell>
                <TableCell>操作</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {blocked.length === 0 && (
                <TableRow>
                  <TableCell colSpan={3} align="center">
                    拡張子は登録されていません
                  </TableCell>
                </TableRow>
              )}
              {blocked.map((b) => (
                <TableRow key={b.id}>
                  <TableCell>.{b.extension}</TableCell>
                  <TableCell>{b.reason ?? ''}</TableCell>
                  <TableCell>
                    <IconButton
                      aria-label={`.${b.extension} を削除`}
                      onClick={() => void handleDeleteExt(b.id)}
                    >
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* NG ワード追加ダイアログ */}
      <Dialog open={ngDialogOpen} onClose={() => setNgDialogOpen(false)} fullWidth maxWidth="xs">
        <DialogTitle>NG ワードを追加</DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
          <TextField
            label="パターン"
            value={ngPatternInput}
            onChange={(e) => setNgPatternInput(e.target.value)}
            autoFocus
            fullWidth
            inputProps={{ 'aria-label': 'NG ワードのパターン' }}
          />
          <TextField
            select
            label="動作"
            value={ngActionInput}
            onChange={(e) => setNgActionInput(e.target.value as NgWordAction)}
            inputProps={{ 'aria-label': '動作' }}
          >
            <MenuItem value="block">block（送信拒否）</MenuItem>
            <MenuItem value="warn">warn（警告のみ）</MenuItem>
          </TextField>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setNgDialogOpen(false)}>キャンセル</Button>
          <Button
            variant="contained"
            disabled={!ngPatternInput.trim()}
            onClick={() => void handleCreateNg()}
          >
            追加
          </Button>
        </DialogActions>
      </Dialog>

      {/* 拡張子追加ダイアログ */}
      <Dialog open={extDialogOpen} onClose={() => setExtDialogOpen(false)} fullWidth maxWidth="xs">
        <DialogTitle>拡張子を追加</DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
          <TextField
            label="拡張子"
            placeholder="例: exe"
            value={extInput}
            onChange={(e) => setExtInput(e.target.value)}
            autoFocus
            fullWidth
            inputProps={{ 'aria-label': '拡張子' }}
          />
          <TextField
            label="理由（任意）"
            value={extReasonInput}
            onChange={(e) => setExtReasonInput(e.target.value)}
            fullWidth
            inputProps={{ 'aria-label': '理由' }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setExtDialogOpen(false)}>キャンセル</Button>
          <Button
            variant="contained"
            disabled={!extInput.trim()}
            onClick={() => void handleCreateExt()}
          >
            追加
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
