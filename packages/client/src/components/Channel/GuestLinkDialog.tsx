/**
 * 管理者向けゲストリンク発行 / 失効ダイアログ（#149）
 *
 * - チャンネル管理者・作成者がゲスト閲覧用 URL を発行できる
 * - 任意でパスワード保護・有効期限を設定可能
 * - 既存リンクの一覧・コピー・失効も同ダイアログで完結する
 * - InviteLinkDialog と同じパターン（onEntered で初回ロード、useEffect 不使用）
 */

import { useState, useCallback } from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControl,
  IconButton,
  InputLabel,
  List,
  ListItem,
  ListItemText,
  MenuItem,
  Select,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import LockIcon from '@mui/icons-material/Lock';
import type { GuestLink } from '@chat-app/shared';
import { api } from '../../api/client';
import { useAuth } from '../../contexts/AuthContext';
import { useSnackbar } from '../../contexts/SnackbarContext';

interface Props {
  open: boolean;
  channelId: number | null;
  onClose: () => void;
}

const EXPIRES_OPTIONS = [
  { label: '無期限', value: '' },
  { label: '1時間', value: '1' },
  { label: '24時間', value: '24' },
  { label: '7日間', value: String(24 * 7) },
  { label: '30日間', value: String(24 * 30) },
];

export default function GuestLinkDialog({ open, channelId, onClose }: Props) {
  const { user } = useAuth();
  const { showSuccess, showError } = useSnackbar();
  const [links, setLinks] = useState<GuestLink[]>([]);
  const [expiresInHours, setExpiresInHours] = useState('');
  const [password, setPassword] = useState('');
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [confirmingRevokeId, setConfirmingRevokeId] = useState<number | null>(null);

  const loadLinks = useCallback(async () => {
    if (channelId === null) {
      setLoaded(true);
      return;
    }
    try {
      const res = await api.guestLinks.list(channelId);
      setLinks(res.guestLinks);
      setLoaded(true);
    } catch {
      // 取得失敗は無視（一覧なしで表示）
      setLoaded(true);
    }
  }, [channelId]);

  // ダイアログが開いた時に一度だけ読み込む（InviteLinkDialog と同じパターン）
  const handleEntered = useCallback(() => {
    setLoaded(false);
    setError('');
    setPassword('');
    setExpiresInHours('');
    void loadLinks();
  }, [loadLinks]);

  const handleCreate = async () => {
    if (channelId === null) return;
    setCreating(true);
    setError('');
    try {
      const hours = expiresInHours ? Number(expiresInHours) : null;
      const pw = password.trim() === '' ? null : password;
      const res = await api.guestLinks.create(channelId, {
        password: pw,
        expiresInHours: hours,
      });
      setLinks((prev) => [res.guestLink, ...prev]);
      setPassword('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'リンクの発行に失敗しました');
    } finally {
      setCreating(false);
    }
  };

  const handleRevoke = async (id: number) => {
    try {
      const res = await api.guestLinks.revoke(id);
      setLinks((prev) => prev.map((l) => (l.id === res.guestLink.id ? res.guestLink : l)));
      setConfirmingRevokeId(null);
      showSuccess('リンクを失効しました');
    } catch (err) {
      showError(err instanceof Error ? err.message : '失効に失敗しました');
    }
  };

  const handleCopy = async (token: string) => {
    const url = `${window.location.origin}/g/${token}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(token);
      showSuccess('URL をコピーしました');
      setTimeout(() => setCopied(null), 2000);
    } catch {
      showError('コピーに失敗しました');
    }
  };

  const canRevoke = (link: GuestLink) => {
    if (!user) return false;
    return user.role === 'admin' || link.createdBy === user.id;
  };

  const guestUrl = (token: string) => `${window.location.origin}/g/${token}`;

  const statusLabel = (link: GuestLink) => {
    if (link.isRevoked) return '無効';
    if (link.expiresAt && new Date(link.expiresAt) < new Date()) return '期限切れ';
    return '有効';
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      fullWidth
      maxWidth="sm"
      TransitionProps={{ onEntered: handleEntered }}
    >
      <DialogTitle>ゲスト閲覧リンク</DialogTitle>
      <DialogContent dividers>
        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
          発行された URL は社外ユーザーに共有でき、メッセージは読み取り専用で表示されます。
        </Typography>

        {/* リンク発行フォーム */}
        <Typography variant="subtitle2" gutterBottom>
          新しいゲストリンクを発行
        </Typography>
        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mb: 2 }}>
          <FormControl size="small" sx={{ minWidth: 140 }}>
            <InputLabel id="guest-link-expires-label">有効期限</InputLabel>
            <Select
              labelId="guest-link-expires-label"
              label="有効期限"
              value={expiresInHours}
              onChange={(e) => setExpiresInHours(e.target.value)}
              inputProps={{ 'aria-label': '有効期限' }}
            >
              {EXPIRES_OPTIONS.map((o) => (
                <MenuItem key={o.value} value={o.value}>
                  {o.label}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <TextField
            size="small"
            label="パスワード（任意）"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="未入力で無し"
            sx={{ width: 200 }}
            inputProps={{ 'aria-label': 'パスワード' }}
          />
          <Button
            variant="contained"
            onClick={() => void handleCreate()}
            disabled={creating || channelId === null}
            startIcon={creating ? <CircularProgress size={16} /> : undefined}
          >
            ゲストリンクを発行
          </Button>
        </Box>

        <Divider sx={{ mb: 2 }} />

        {/* 既存リンク一覧 */}
        <Typography variant="subtitle2" gutterBottom>
          発行済みリンク
        </Typography>
        {!loaded ? (
          <CircularProgress size={24} />
        ) : links.length === 0 ? (
          <Typography variant="body2" color="text.secondary">
            リンクはまだありません
          </Typography>
        ) : (
          <List dense disablePadding>
            {links.map((link) => (
              <ListItem
                key={link.id}
                disablePadding
                sx={{ flexDirection: 'column', alignItems: 'flex-start', mb: 1 }}
                data-testid="guest-link-item"
              >
                <Box sx={{ display: 'flex', alignItems: 'center', width: '100%', gap: 1 }}>
                  <ListItemText
                    primary={
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                        <Typography variant="body2" noWrap sx={{ maxWidth: 280 }}>
                          {guestUrl(link.token)}
                        </Typography>
                        {link.hasPassword && (
                          <Tooltip title="パスワード保護中">
                            <LockIcon
                              fontSize="small"
                              color="action"
                              aria-label="パスワード保護中"
                            />
                          </Tooltip>
                        )}
                      </Box>
                    }
                    secondary={
                      <Box
                        component="span"
                        sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5 }}
                      >
                        <Chip
                          label={statusLabel(link)}
                          size="small"
                          color={
                            statusLabel(link) === '有効'
                              ? 'success'
                              : statusLabel(link) === '無効'
                                ? 'default'
                                : 'warning'
                          }
                          sx={{ height: 18 }}
                        />
                        {link.expiresAt && (
                          <Typography variant="caption" component="span">
                            期限: {new Date(link.expiresAt).toLocaleString('ja-JP')}
                          </Typography>
                        )}
                      </Box>
                    }
                  />
                  <Box sx={{ display: 'flex', gap: 0.5, flexShrink: 0 }}>
                    <Tooltip title={copied === link.token ? 'コピーしました' : 'URL をコピー'}>
                      <span>
                        <IconButton
                          size="small"
                          onClick={() => void handleCopy(link.token)}
                          disabled={link.isRevoked}
                          aria-label="URL をコピー"
                        >
                          <ContentCopyIcon fontSize="small" />
                        </IconButton>
                      </span>
                    </Tooltip>
                    {canRevoke(link) &&
                      !link.isRevoked &&
                      (confirmingRevokeId === link.id ? (
                        <Box sx={{ display: 'flex', gap: 0.5 }}>
                          <Button
                            size="small"
                            color="error"
                            variant="contained"
                            onClick={() => void handleRevoke(link.id)}
                            aria-label="失効を確定"
                          >
                            失効する
                          </Button>
                          <Button
                            size="small"
                            onClick={() => setConfirmingRevokeId(null)}
                            aria-label="キャンセル"
                          >
                            取消
                          </Button>
                        </Box>
                      ) : (
                        <Button
                          size="small"
                          color="error"
                          onClick={() => setConfirmingRevokeId(link.id)}
                          aria-label="失効"
                        >
                          失効
                        </Button>
                      ))}
                  </Box>
                </Box>
              </ListItem>
            ))}
          </List>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>閉じる</Button>
      </DialogActions>
    </Dialog>
  );
}
