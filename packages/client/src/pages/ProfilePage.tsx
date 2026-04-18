import { useState, useRef, ChangeEvent } from 'react';
import {
  Box,
  Button,
  TextField,
  Typography,
  Avatar,
  IconButton,
  Alert,
  CircularProgress,
  Paper,
  Divider,
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { api } from '../api/client';
import { getAvatarColor } from '../utils/avatarColor';
import { useSnackbar } from '../contexts/SnackbarContext';

export default function ProfilePage() {
  const { user, updateUser } = useAuth();
  const navigate = useNavigate();
  const { showSuccess, showError } = useSnackbar();

  const [displayName, setDisplayName] = useState(user?.displayName ?? '');
  const [location, setLocation] = useState(user?.location ?? '');
  const [avatarPreview, setAvatarPreview] = useState<string | null>(user?.avatarUrl ?? null);
  const [avatarDataUrl, setAvatarDataUrl] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // パスワード変更フォームの状態
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [changingPassword, setChangingPassword] = useState(false);

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const result = ev.target?.result as string;
      setAvatarPreview(result);
      setAvatarDataUrl(result);
    };
    reader.readAsDataURL(file);
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      const { user: updated } = await api.auth.updateProfile({
        displayName,
        location,
        ...(avatarDataUrl ? { avatarUrl: avatarDataUrl } : {}),
      });
      updateUser(updated);
      showSuccess('プロフィールを保存しました');
    } catch (err) {
      const message = err instanceof Error ? err.message : '保存に失敗しました';
      setError(message);
      showError(message);
    } finally {
      setSaving(false);
    }
  };

  const handleChangePassword = async () => {
    setPasswordError(null);
    if (newPassword.length < 8) {
      setPasswordError('新しいパスワードは8文字以上で入力してください');
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError('新しいパスワードが一致しません');
      return;
    }
    setChangingPassword(true);
    try {
      await api.auth.changePassword({ currentPassword, newPassword, confirmPassword });
      showSuccess('パスワードを変更しました');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'パスワード変更に失敗しました';
      showError(message);
    } finally {
      setChangingPassword(false);
    }
  };

  const avatarLabel = displayName || user?.username || '';

  return (
    <Box sx={{ maxWidth: 480, mx: 'auto', mt: 4, px: 2 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 3, gap: 1 }}>
        <IconButton onClick={() => navigate(-1)} aria-label="戻る">
          <ArrowBackIcon />
        </IconButton>
        <Typography variant="h6">プロフィール設定</Typography>
      </Box>

      <Paper sx={{ p: 3 }}>
        {/* アバター */}
        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', mb: 3, gap: 1 }}>
          {avatarPreview ? (
            <Box
              data-testid="avatar-preview"
              component="img"
              src={avatarPreview}
              alt="アバタープレビュー"
              role="img"
              aria-label="アバター"
              sx={{ width: 80, height: 80, borderRadius: '50%', objectFit: 'cover' }}
            />
          ) : (
            <Avatar
              sx={{
                width: 80,
                height: 80,
                fontSize: 32,
                bgcolor: getAvatarColor(user?.email ?? ''),
              }}
            >
              {(avatarLabel[0] ?? '').toUpperCase()}
            </Avatar>
          )}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            style={{ display: 'none' }}
            onChange={handleFileChange}
            aria-label="アバター画像を選択"
          />
          <Button size="small" onClick={() => fileInputRef.current?.click()}>
            画像を変更
          </Button>
        </Box>

        {/* フォーム */}
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <TextField
            label="表示名"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            fullWidth
            inputProps={{ 'aria-label': '表示名' }}
          />
          <TextField
            label="勤務地"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            fullWidth
            inputProps={{ 'aria-label': '勤務地' }}
          />

          {error && <Alert severity="error">{error}</Alert>}

          <Button
            variant="contained"
            onClick={() => void handleSave()}
            disabled={saving}
            startIcon={saving ? <CircularProgress size={16} /> : null}
          >
            保存
          </Button>
        </Box>

        <Divider sx={{ my: 3 }} />

        {/* パスワード変更フォーム */}
        <Typography variant="subtitle1" fontWeight="bold" sx={{ mb: 2 }}>
          パスワード変更
        </Typography>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <TextField
            label="現在のパスワード"
            type="password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            fullWidth
            inputProps={{ 'aria-label': '現在のパスワード' }}
          />
          <TextField
            label="新しいパスワード"
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            fullWidth
            inputProps={{ 'aria-label': '新しいパスワード' }}
          />
          <TextField
            label="新しいパスワード（確認）"
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            fullWidth
            inputProps={{ 'aria-label': '新しいパスワード（確認）' }}
          />

          {passwordError && <Alert severity="error">{passwordError}</Alert>}

          <Button
            variant="outlined"
            onClick={() => void handleChangePassword()}
            disabled={changingPassword}
            startIcon={changingPassword ? <CircularProgress size={16} /> : null}
          >
            パスワードを変更
          </Button>
        </Box>
      </Paper>
    </Box>
  );
}
