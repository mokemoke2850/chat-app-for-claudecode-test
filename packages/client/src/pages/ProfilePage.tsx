import { useState, useRef, ChangeEvent } from 'react';
import {
  Box,
  Button,
  TextField,
  Typography,
  Avatar,
  Alert,
  CircularProgress,
  Paper,
  Divider,
  FormControl,
  FormLabel,
  RadioGroup,
  FormControlLabel,
  Radio,
  InputLabel,
  Select,
  MenuItem,
  Switch,
  IconButton,
  Tooltip,
} from '@mui/material';
import AccountCircleIcon from '@mui/icons-material/AccountCircle';
import CheckIcon from '@mui/icons-material/Check';
import { useAuth } from '../contexts/AuthContext';
import { api } from '../api/client';
import { getAvatarColor } from '../utils/avatarColor';
import { useSnackbar } from '../contexts/SnackbarContext';
import AppLayout from '../components/Layout/AppLayout';
import { useAccessibility, type FontSize } from '../contexts/AccessibilityContext';
import { useDensity } from '../contexts/DensityContext';
import type { DensityMode } from '../contexts/DensityContext';
import { useTheme } from '../contexts/ThemeContext';
import {
  ACCENT_COLORS,
  ACCENT_COLOR_HEX,
  EXTENDED_PROFILE_LIMITS,
  type AccentColor,
} from '@chat-app/shared';

/**
 * #305 拡張プロフィール: タイムゾーン候補
 * Intl.supportedValuesOf が利用可能ならランタイムから取得し、フォールバックとして
 * よく使われる主要な IANA タイムゾーンを定数で持つ。
 */
function getTimezoneOptions(): string[] {
  const fallback = [
    'UTC',
    'Asia/Tokyo',
    'America/Los_Angeles',
    'America/New_York',
    'Europe/London',
  ];
  try {
    const supported = (Intl as unknown as { supportedValuesOf?: (key: string) => string[] })
      .supportedValuesOf;
    if (typeof supported === 'function') {
      const list = supported('timeZone');
      if (Array.isArray(list) && list.length > 0) {
        // Intl のリストには UTC が含まれない実装が多いため明示的に先頭へ追加
        return list.includes('UTC') ? list : ['UTC', ...list];
      }
    }
  } catch {
    // ignore
  }
  return fallback;
}

/** http/https URL の簡易バリデーション（クライアントサイド） */
function isValidHttpUrl(value: string): boolean {
  try {
    const u = new URL(value);
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return false;
    if (/\s/.test(value)) return false;
    return true;
  } catch {
    return false;
  }
}

const ACCENT_COLOR_LABEL: Record<AccentColor, string> = {
  blue: '青',
  purple: '紫',
  green: '緑',
  orange: 'オレンジ',
  red: '赤',
};

export default function ProfilePage() {
  const { user, updateUser } = useAuth();
  const { showSuccess, showError } = useSnackbar();
  const { fontSize, highContrast, setFontSize, setHighContrast } = useAccessibility();
  const { density, setDensity } = useDensity();
  const { accentColor, setAccentColor } = useTheme();

  const handleAccentColorChange = async (color: AccentColor) => {
    try {
      await setAccentColor(color);
      showSuccess('アクセントカラーを変更しました');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'アクセントカラーの変更に失敗しました';
      showError(message);
    }
  };

  const [displayName, setDisplayName] = useState(user?.displayName ?? '');
  const [location, setLocation] = useState(user?.location ?? '');
  const [avatarPreview, setAvatarPreview] = useState<string | null>(user?.avatarUrl ?? null);
  const [avatarDataUrl, setAvatarDataUrl] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // #305 拡張プロフィール項目の状態
  const [bio, setBio] = useState(user?.bio ?? '');
  const [jobTitle, setJobTitle] = useState(user?.jobTitle ?? '');
  const [department, setDepartment] = useState(user?.department ?? '');
  const [timezone, setTimezone] = useState(user?.timezone ?? '');
  const [githubUrl, setGithubUrl] = useState(user?.githubUrl ?? '');
  const [snsUrl, setSnsUrl] = useState(user?.snsUrl ?? '');
  // タイムゾーン候補（コンポーネントマウント時に1度だけ算出）
  const timezoneOptions = useState<string[]>(() => getTimezoneOptions())[0];

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

    // #305 クライアントサイドバリデーション（URL 形式・文字数）
    if (githubUrl && !isValidHttpUrl(githubUrl)) {
      const msg = 'GitHub URL は http(s) の URL を指定してください';
      setError(msg);
      showError(msg);
      setSaving(false);
      return;
    }
    if (snsUrl && !isValidHttpUrl(snsUrl)) {
      const msg = 'SNS URL は http(s) の URL を指定してください';
      setError(msg);
      showError(msg);
      setSaving(false);
      return;
    }
    if (bio.length > EXTENDED_PROFILE_LIMITS.bio) {
      const msg = `自己紹介は ${EXTENDED_PROFILE_LIMITS.bio} 文字以内で入力してください`;
      setError(msg);
      showError(msg);
      setSaving(false);
      return;
    }

    try {
      const { user: updated } = await api.auth.updateProfile({
        displayName,
        location,
        ...(avatarDataUrl ? { avatarUrl: avatarDataUrl } : {}),
        // #305 拡張プロフィール項目（空文字は null として送信し、サーバ側でクリア扱い）
        bio: bio === '' ? null : bio,
        jobTitle: jobTitle === '' ? null : jobTitle,
        department: department === '' ? null : department,
        timezone: timezone === '' ? null : timezone,
        githubUrl: githubUrl === '' ? null : githubUrl,
        snsUrl: snsUrl === '' ? null : snsUrl,
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
    if (!currentPassword) {
      setPasswordError('現在のパスワードを入力してください');
      return;
    }
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
          <AccountCircleIcon />
          <Typography variant="h6">プロフィール設定</Typography>
        </Box>

        <Box sx={{ flexGrow: 1, overflow: 'auto', p: 2 }}>
          <Box sx={{ maxWidth: 480, mx: 'auto' }}>
            <Paper sx={{ p: 3 }}>
              {/* アバター */}
              <Box
                sx={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  mb: 3,
                  gap: 1,
                }}
              >
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

                {/* #305 拡張プロフィール項目 */}
                <TextField
                  label="自己紹介"
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  fullWidth
                  multiline
                  minRows={3}
                  maxRows={8}
                  inputProps={{
                    'aria-label': '自己紹介',
                    maxLength: EXTENDED_PROFILE_LIMITS.bio,
                  }}
                  helperText={`${bio.length} / ${EXTENDED_PROFILE_LIMITS.bio}`}
                />
                <TextField
                  label="役職"
                  value={jobTitle}
                  onChange={(e) => setJobTitle(e.target.value)}
                  fullWidth
                  inputProps={{
                    'aria-label': '役職',
                    maxLength: EXTENDED_PROFILE_LIMITS.jobTitle,
                  }}
                />
                <TextField
                  label="部署"
                  value={department}
                  onChange={(e) => setDepartment(e.target.value)}
                  fullWidth
                  inputProps={{
                    'aria-label': '部署',
                    maxLength: EXTENDED_PROFILE_LIMITS.department,
                  }}
                />
                <FormControl fullWidth>
                  <InputLabel id="timezone-label">タイムゾーン</InputLabel>
                  <Select
                    labelId="timezone-label"
                    label="タイムゾーン"
                    value={timezone}
                    onChange={(e) => setTimezone(e.target.value)}
                    inputProps={{ 'aria-label': 'タイムゾーン' }}
                    displayEmpty
                  >
                    <MenuItem value="">
                      <em>未設定</em>
                    </MenuItem>
                    {timezoneOptions.map((tz) => (
                      <MenuItem key={tz} value={tz}>
                        {tz}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
                <TextField
                  label="GitHub URL"
                  value={githubUrl}
                  onChange={(e) => setGithubUrl(e.target.value)}
                  fullWidth
                  type="url"
                  placeholder="https://github.com/your-name"
                  inputProps={{ 'aria-label': 'GitHub URL' }}
                />
                <TextField
                  label="SNS URL"
                  value={snsUrl}
                  onChange={(e) => setSnsUrl(e.target.value)}
                  fullWidth
                  type="url"
                  placeholder="https://example.com/your-sns"
                  inputProps={{ 'aria-label': 'SNS URL' }}
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

              <Divider sx={{ my: 3 }} />

              {/* アクセシビリティセクション */}
              <Typography variant="subtitle1" fontWeight="bold" sx={{ mb: 2 }}>
                アクセシビリティ
              </Typography>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <FormControl fullWidth>
                  <InputLabel id="font-size-label">フォントサイズ</InputLabel>
                  <Select
                    labelId="font-size-label"
                    inputProps={{ 'aria-label': 'フォントサイズ' }}
                    label="フォントサイズ"
                    value={fontSize}
                    onChange={(e) => setFontSize(e.target.value as FontSize)}
                  >
                    <MenuItem value="small">小</MenuItem>
                    <MenuItem value="medium">中</MenuItem>
                    <MenuItem value="large">大</MenuItem>
                  </Select>
                </FormControl>
                <FormControlLabel
                  control={
                    <Switch
                      checked={highContrast}
                      onChange={(e) => setHighContrast(e.target.checked)}
                      inputProps={{ 'aria-label': 'ハイコントラストモード' }}
                    />
                  }
                  label="ハイコントラストモード"
                />
              </Box>

              <Divider sx={{ my: 3 }} />

              {/* 表示密度セクション */}
              <Typography variant="subtitle1" fontWeight="bold" sx={{ mb: 2 }}>
                表示密度
              </Typography>
              <FormControl component="fieldset">
                <FormLabel component="legend" sx={{ fontSize: '0.875rem', mb: 1 }}>
                  メッセージリストの表示密度を選択してください
                </FormLabel>
                <RadioGroup
                  value={density}
                  onChange={(e) => setDensity(e.target.value as DensityMode)}
                >
                  <FormControlLabel
                    value="cozy"
                    control={<Radio />}
                    label="快適（デフォルト・アバター大・余白あり）"
                  />
                  <FormControlLabel
                    value="compact"
                    control={<Radio />}
                    label="コンパクト（アバター・余白を最小化、連投時は省略）"
                  />
                </RadioGroup>
              </FormControl>

              <Divider sx={{ my: 3 }} />

              {/* アクセントカラーセクション（#274） */}
              <Typography variant="subtitle1" fontWeight="bold" sx={{ mb: 2 }}>
                アクセントカラー
              </Typography>
              <Box
                role="group"
                aria-label="アクセントカラー選択"
                sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}
              >
                {ACCENT_COLORS.map((color) => {
                  const selected = color === accentColor;
                  const label = `${ACCENT_COLOR_LABEL[color]}（${color}）`;
                  return (
                    <Tooltip key={color} title={label}>
                      <IconButton
                        aria-label={label}
                        aria-pressed={selected}
                        onClick={() => void handleAccentColorChange(color)}
                        sx={{
                          width: 40,
                          height: 40,
                          backgroundColor: ACCENT_COLOR_HEX[color],
                          color: '#fff',
                          border: selected ? '3px solid var(--text)' : '3px solid transparent',
                          '&:hover': {
                            backgroundColor: ACCENT_COLOR_HEX[color],
                            opacity: 0.85,
                          },
                        }}
                      >
                        {selected && <CheckIcon fontSize="small" />}
                      </IconButton>
                    </Tooltip>
                  );
                })}
              </Box>
            </Paper>
          </Box>
        </Box>
      </Box>
    </AppLayout>
  );
}
