import { useState } from 'react';
import {
  Box,
  IconButton,
  Tooltip,
  Typography,
  CircularProgress,
  Snackbar,
  Alert,
} from '@mui/material';
import LogoutIcon from '@mui/icons-material/Logout';
import NotificationsIcon from '@mui/icons-material/Notifications';
import NotificationsOffIcon from '@mui/icons-material/NotificationsOff';
import AccountCircleIcon from '@mui/icons-material/AccountCircle';
import DarkModeIcon from '@mui/icons-material/DarkMode';
import LightModeIcon from '@mui/icons-material/LightMode';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import { usePushNotifications } from '../../hooks/usePushNotifications';
import { api } from '../../api/client';
import StatusEditDialog from '../User/StatusEditDialog';

/**
 * Step 8e-3: Rail (64px 幅) 最下部に組み込まれるフッター。
 * 縦並びアイコン群: ステータス / テーマ切替 / Push 通知 / プロフィール / ログアウト。
 * ユーザー名は Tooltip で表示 (幅不足のため Rail 上には直接表示しない)。
 */
export default function SidebarFooter() {
  const [statusDialogOpen, setStatusDialogOpen] = useState(false);
  const { user, logout, updateUser } = useAuth();
  const { mode, toggleTheme } = useTheme();
  const { supported, subscribed, loading, error, subscribe, unsubscribe } = usePushNotifications();
  const navigate = useNavigate();

  const themeLabel = mode === 'dark' ? 'ライトモードに切り替える' : 'ダークモードに切り替える';
  const notificationLabel = subscribed ? '通知を無効にする' : '通知を有効にする';
  const userLabel = user?.displayName ?? user?.username ?? '';
  const statusTooltip = userLabel ? `${userLabel} のステータスを設定` : 'ステータスを設定';

  return (
    <>
      <Box
        sx={{
          borderTop: '1px solid var(--border)',
          py: 0.5,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 0.25,
          background: 'var(--bg-elev)',
        }}
      >
        <Tooltip title={statusTooltip} placement="right">
          <IconButton
            size="small"
            aria-label="ステータスを設定"
            onClick={() => setStatusDialogOpen(true)}
            sx={{
              width: 36,
              height: 32,
              borderRadius: 'var(--radius-sm)',
              color: 'var(--text)',
            }}
          >
            {user?.status?.emoji ? (
              <Typography component="span" sx={{ fontSize: '1.1rem', lineHeight: 1 }}>
                {user.status.emoji}
              </Typography>
            ) : (
              <AccountCircleIcon fontSize="small" />
            )}
          </IconButton>
        </Tooltip>

        <Tooltip title={themeLabel} placement="right">
          <IconButton
            size="small"
            aria-label={themeLabel}
            onClick={toggleTheme}
            sx={{ width: 36, height: 32 }}
          >
            {mode === 'dark' ? (
              <LightModeIcon fontSize="small" />
            ) : (
              <DarkModeIcon fontSize="small" />
            )}
          </IconButton>
        </Tooltip>

        {supported && (
          <Tooltip title={notificationLabel} placement="right">
            <span>
              <IconButton
                size="small"
                aria-label={notificationLabel}
                disabled={loading}
                onClick={() => void (subscribed ? unsubscribe() : subscribe())}
                sx={{ width: 36, height: 32 }}
              >
                {loading ? (
                  <CircularProgress size={16} />
                ) : subscribed ? (
                  <NotificationsIcon fontSize="small" />
                ) : (
                  <NotificationsOffIcon fontSize="small" />
                )}
              </IconButton>
            </span>
          </Tooltip>
        )}

        <Tooltip title="プロフィール設定" placement="right">
          <IconButton
            size="small"
            aria-label="プロフィール設定"
            onClick={() => navigate('/profile')}
            sx={{ width: 36, height: 32 }}
          >
            <AccountCircleIcon fontSize="small" />
          </IconButton>
        </Tooltip>

        <Tooltip title="ログアウト" placement="right">
          <IconButton
            size="small"
            aria-label="ログアウト"
            onClick={() => void logout()}
            sx={{ width: 36, height: 32 }}
          >
            <LogoutIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      </Box>

      <Snackbar open={!!error} autoHideDuration={6000}>
        <Alert severity="error" variant="filled">
          {error}
        </Alert>
      </Snackbar>

      <StatusEditDialog
        open={statusDialogOpen}
        onClose={() => setStatusDialogOpen(false)}
        currentStatus={user?.status ?? null}
        onSaved={() => {
          void (async () => {
            try {
              const { user: updated } = await api.auth.me();
              updateUser(updated);
            } catch {
              // 取得失敗時は次回リロードで反映
            }
          })();
        }}
      />
    </>
  );
}
