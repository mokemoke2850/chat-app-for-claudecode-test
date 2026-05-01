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
 * Sidebar 列フッター。Step 2b で AppBar から移譲した
 * ステータス / テーマ切替 / Push 通知 / プロフィール / ログアウト を集約する。
 */
export default function SidebarFooter() {
  const [statusDialogOpen, setStatusDialogOpen] = useState(false);
  const { user, logout, updateUser } = useAuth();
  const { mode, toggleTheme } = useTheme();
  const { supported, subscribed, loading, error, subscribe, unsubscribe } = usePushNotifications();
  const navigate = useNavigate();

  const themeLabel = mode === 'dark' ? 'ライトモードに切り替える' : 'ダークモードに切り替える';
  const notificationLabel = subscribed ? '通知を無効にする' : '通知を有効にする';

  return (
    <>
      <Box
        sx={{
          borderTop: '1px solid var(--border)',
          px: 1,
          py: 1,
          display: 'flex',
          flexDirection: 'column',
          gap: 0.5,
          background: 'var(--bg-elev)',
        }}
      >
        <Tooltip title="ステータスを設定">
          <Box
            component="button"
            aria-label="ステータスを設定"
            onClick={() => setStatusDialogOpen(true)}
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 0.5,
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: 'var(--text)',
              px: 1,
              py: 0.5,
              borderRadius: 'var(--radius-sm)',
              textAlign: 'left',
              minWidth: 0,
              '&:hover': { background: 'var(--surface-hover)' },
            }}
          >
            {user?.status?.emoji && (
              <Typography component="span" sx={{ fontSize: '1rem', lineHeight: 1 }}>
                {user.status.emoji}
              </Typography>
            )}
            <Typography
              variant="body2"
              sx={{
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                minWidth: 0,
              }}
            >
              {user?.displayName ?? user?.username}
            </Typography>
          </Box>
        </Tooltip>

        <Box sx={{ display: 'flex', gap: 0.5 }}>
          <Tooltip title={themeLabel}>
            <IconButton size="small" aria-label={themeLabel} onClick={toggleTheme}>
              {mode === 'dark' ? (
                <LightModeIcon fontSize="small" />
              ) : (
                <DarkModeIcon fontSize="small" />
              )}
            </IconButton>
          </Tooltip>

          {supported && (
            <Tooltip title={notificationLabel}>
              <span>
                <IconButton
                  size="small"
                  aria-label={notificationLabel}
                  disabled={loading}
                  onClick={() => void (subscribed ? unsubscribe() : subscribe())}
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

          <Tooltip title="プロフィール設定">
            <IconButton
              size="small"
              aria-label="プロフィール設定"
              onClick={() => navigate('/profile')}
            >
              <AccountCircleIcon fontSize="small" />
            </IconButton>
          </Tooltip>

          <Tooltip title="ログアウト">
            <IconButton size="small" aria-label="ログアウト" onClick={() => void logout()}>
              <LogoutIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </Box>
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
