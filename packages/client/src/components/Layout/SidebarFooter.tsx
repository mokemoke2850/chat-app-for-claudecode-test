import { useState } from 'react';
import {
  Box,
  IconButton,
  Tooltip,
  Typography,
  CircularProgress,
  Snackbar,
  Alert,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
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

interface Props {
  /**
   * 表示形式。
   * - `'rail'` (default): Rail (64px 幅) 内に縦並びアイコンとして表示。ラベルは Tooltip。
   * - `'drawer'`: モバイル Sidebar ドロワー底部に ListItem 形式 (アイコン + ラベル) で表示。
   */
  variant?: 'rail' | 'drawer';
}

/**
 * ステータス / テーマ切替 / Push 通知 / プロフィール / ログアウトを集約するフッター。
 * Rail 最下部 (variant='rail') とモバイル Sidebar ドロワー底部 (variant='drawer') で
 * 表示形式を切り替える。ユーザー名は幅不足のため Rail 上には直接表示せず Tooltip に集約。
 */
export default function SidebarFooter({ variant = 'rail' }: Props = {}) {
  const [statusDialogOpen, setStatusDialogOpen] = useState(false);
  const { user, logout, updateUser } = useAuth();
  const { mode, toggleTheme } = useTheme();
  const { supported, subscribed, loading, error, subscribe, unsubscribe } = usePushNotifications();
  const navigate = useNavigate();

  const themeLabel = mode === 'dark' ? 'ライトモードに切り替える' : 'ダークモードに切り替える';
  const notificationLabel = subscribed ? '通知を無効にする' : '通知を有効にする';
  const userLabel = user?.displayName ?? user?.username ?? '';
  const statusTooltip = userLabel ? `${userLabel} のステータスを設定` : 'ステータスを設定';

  const statusDialog = (
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
  );

  if (variant === 'drawer') {
    return (
      <>
        <Box
          sx={{
            borderTop: '1px solid var(--border)',
            background: 'var(--bg-elev)',
          }}
        >
          <List disablePadding>
            <ListItemButton aria-label="ステータスを設定" onClick={() => setStatusDialogOpen(true)}>
              <ListItemIcon sx={{ minWidth: 40 }}>
                {user?.status?.emoji ? (
                  <Typography component="span" sx={{ fontSize: '1.25rem', lineHeight: 1 }}>
                    {user.status.emoji}
                  </Typography>
                ) : (
                  <AccountCircleIcon fontSize="small" />
                )}
              </ListItemIcon>
              <ListItemText primary={statusTooltip} />
            </ListItemButton>

            <ListItemButton aria-label={themeLabel} onClick={toggleTheme}>
              <ListItemIcon sx={{ minWidth: 40 }}>
                {mode === 'dark' ? (
                  <LightModeIcon fontSize="small" />
                ) : (
                  <DarkModeIcon fontSize="small" />
                )}
              </ListItemIcon>
              <ListItemText primary={themeLabel} />
            </ListItemButton>

            {supported && (
              <ListItemButton
                aria-label={notificationLabel}
                disabled={loading}
                onClick={() => void (subscribed ? unsubscribe() : subscribe())}
              >
                <ListItemIcon sx={{ minWidth: 40 }}>
                  {loading ? (
                    <CircularProgress size={16} />
                  ) : subscribed ? (
                    <NotificationsIcon fontSize="small" />
                  ) : (
                    <NotificationsOffIcon fontSize="small" />
                  )}
                </ListItemIcon>
                <ListItemText primary={notificationLabel} />
              </ListItemButton>
            )}

            <ListItemButton aria-label="プロフィール設定" onClick={() => navigate('/profile')}>
              <ListItemIcon sx={{ minWidth: 40 }}>
                <AccountCircleIcon fontSize="small" />
              </ListItemIcon>
              <ListItemText primary="プロフィール設定" />
            </ListItemButton>

            <ListItemButton aria-label="ログアウト" onClick={() => void logout()}>
              <ListItemIcon sx={{ minWidth: 40 }}>
                <LogoutIcon fontSize="small" />
              </ListItemIcon>
              <ListItemText primary="ログアウト" />
            </ListItemButton>
          </List>
        </Box>

        <Snackbar open={!!error} autoHideDuration={6000}>
          <Alert severity="error" variant="filled">
            {error}
          </Alert>
        </Snackbar>

        {statusDialog}
      </>
    );
  }

  // variant === 'rail' (default)
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

      {statusDialog}
    </>
  );
}
