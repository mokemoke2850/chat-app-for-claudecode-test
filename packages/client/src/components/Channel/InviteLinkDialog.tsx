import { useState, useCallback } from 'react';
import {
  Alert,
  Box,
  Button,
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
import type { InviteLink } from '@chat-app/shared';
import { api } from '../../api/client';
import { useAuth } from '../../contexts/AuthContext';

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

export default function InviteLinkDialog({ open, channelId, onClose }: Props) {
  const { user } = useAuth();
  const [invites, setInvites] = useState<InviteLink[]>([]);
  const [expiresInHours, setExpiresInHours] = useState('');
  const [maxUsesInput, setMaxUsesInput] = useState('');
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  const loadInvites = useCallback(async () => {
    try {
      const param = channelId !== null ? channelId : undefined;
      const res = await api.invites.list(param);
      setInvites(res.invites);
      setLoaded(true);
    } catch {
      // 取得失敗は無視（一覧なしで表示）
      setLoaded(true);
    }
  }, [channelId]);

  // ダイアログが開いた時に一度だけ読み込む
  const handleEntered = useCallback(() => {
    setLoaded(false);
    setError('');
    void loadInvites();
  }, [loadInvites]);

  const handleCreate = async () => {
    setCreating(true);
    setError('');
    try {
      const maxUses = maxUsesInput ? Number(maxUsesInput) : null;
      const hours = expiresInHours ? Number(expiresInHours) : null;
      const res = await api.invites.create({
        channelId: channelId ?? null,
        maxUses,
        expiresInHours: hours,
      });
      setInvites((prev) => [res.invite, ...prev]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'リンクの作成に失敗しました');
    } finally {
      setCreating(false);
    }
  };

  const handleRevoke = async (id: number) => {
    try {
      const res = await api.invites.revoke(id);
      setInvites((prev) => prev.map((inv) => (inv.id === res.invite.id ? res.invite : inv)));
    } catch (err) {
      setError(err instanceof Error ? err.message : '無効化に失敗しました');
    }
  };

  const handleCopy = async (token: string) => {
    const url = `${window.location.origin}/invite/${token}`;
    await navigator.clipboard.writeText(url);
    setCopied(token);
    setTimeout(() => setCopied(null), 2000);
  };

  const canRevoke = (invite: InviteLink) => {
    if (!user) return false;
    return user.role === 'admin' || invite.createdBy === user.id;
  };

  const inviteUrl = (token: string) => `${window.location.origin}/invite/${token}`;

  const statusLabel = (invite: InviteLink) => {
    if (invite.isRevoked) return '無効';
    if (invite.expiresAt && new Date(invite.expiresAt) < new Date()) return '期限切れ';
    if (invite.maxUses !== null && invite.usedCount >= invite.maxUses) return '上限到達';
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
      <DialogTitle>招待リンク</DialogTitle>
      <DialogContent dividers>
        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        {/* リンク生成フォーム */}
        <Typography variant="subtitle2" gutterBottom>
          新しいリンクを生成
        </Typography>
        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mb: 2 }}>
          <FormControl size="small" sx={{ minWidth: 140 }}>
            <InputLabel>有効期限</InputLabel>
            <Select
              label="有効期限"
              value={expiresInHours}
              onChange={(e) => setExpiresInHours(e.target.value)}
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
            label="最大使用回数"
            type="number"
            value={maxUsesInput}
            onChange={(e) => setMaxUsesInput(e.target.value)}
            placeholder="無制限"
            sx={{ width: 140 }}
            inputProps={{ min: 1 }}
          />
          <Button
            variant="contained"
            onClick={() => void handleCreate()}
            disabled={creating}
            startIcon={creating ? <CircularProgress size={16} /> : undefined}
          >
            リンクを生成
          </Button>
        </Box>

        <Divider sx={{ mb: 2 }} />

        {/* 既存リンク一覧 */}
        <Typography variant="subtitle2" gutterBottom>
          発行済みリンク
        </Typography>
        {!loaded ? (
          <CircularProgress size={24} />
        ) : invites.length === 0 ? (
          <Typography variant="body2" color="text.secondary">
            リンクはまだありません
          </Typography>
        ) : (
          <List dense disablePadding>
            {invites.map((invite) => (
              <ListItem
                key={invite.id}
                disablePadding
                sx={{ flexDirection: 'column', alignItems: 'flex-start', mb: 1 }}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', width: '100%', gap: 1 }}>
                  <ListItemText
                    primary={
                      <Typography variant="body2" noWrap sx={{ maxWidth: 300 }}>
                        {inviteUrl(invite.token)}
                      </Typography>
                    }
                    secondary={
                      <>
                        状態: {statusLabel(invite)}
                        {invite.expiresAt &&
                          ` · 期限: ${new Date(invite.expiresAt).toLocaleString('ja-JP')}`}
                        {invite.maxUses !== null &&
                          ` · 使用: ${invite.usedCount}/${invite.maxUses}`}
                      </>
                    }
                  />
                  <Box sx={{ display: 'flex', gap: 0.5, flexShrink: 0 }}>
                    <Tooltip title={copied === invite.token ? 'コピーしました' : 'URLをコピー'}>
                      <IconButton
                        size="small"
                        onClick={() => void handleCopy(invite.token)}
                        disabled={invite.isRevoked}
                        aria-label="URLをコピー"
                      >
                        <ContentCopyIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                    {canRevoke(invite) && !invite.isRevoked && (
                      <Button
                        size="small"
                        color="error"
                        onClick={() => void handleRevoke(invite.id)}
                        aria-label="無効化"
                      >
                        無効化
                      </Button>
                    )}
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
