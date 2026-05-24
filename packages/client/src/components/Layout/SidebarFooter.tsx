import { MouseEvent, useEffect, useMemo, useState } from 'react';
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
  Popover,
  Button,
  Divider,
} from '@mui/material';
import LogoutIcon from '@mui/icons-material/Logout';
import NotificationsIcon from '@mui/icons-material/Notifications';
import NotificationsOffIcon from '@mui/icons-material/NotificationsOff';
import NotificationsNoneIcon from '@mui/icons-material/NotificationsNone';
import NotificationAddIcon from '@mui/icons-material/NotificationAdd';
import AccountCircleIcon from '@mui/icons-material/AccountCircle';
import DarkModeIcon from '@mui/icons-material/DarkMode';
import LightModeIcon from '@mui/icons-material/LightMode';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import { usePushNotifications } from '../../hooks/usePushNotifications';
import { useNotificationPermission } from '../../hooks/useNotificationPermission';
import { useChannelNotifications } from '../../hooks/useChannelNotifications';
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
 *
 * #321 通知ボタンは `Notification.permission` 状態に応じて表示と挙動を出し分ける：
 *   - default : 「ブラウザ通知を有効化」CTA、クリックで requestPermission
 *   - denied  : 「通知がブロックされています」、クリックで手順案内 Popover
 *   - granted : 「通知設定」、クリックで Push 購読状態 + チャンネル別件数 Popover
 */
export default function SidebarFooter({ variant = 'rail' }: Props = {}) {
  const [statusDialogOpen, setStatusDialogOpen] = useState(false);
  const { user, logout, updateUser } = useAuth();
  const { mode, toggleTheme } = useTheme();
  const { supported, subscribed, loading, error, subscribe, unsubscribe } = usePushNotifications();
  const { permission, requestPermission } = useNotificationPermission();
  const { settings, fetchSettings } = useChannelNotifications();
  const navigate = useNavigate();

  const [notifPopoverAnchor, setNotifPopoverAnchor] = useState<HTMLElement | null>(null);

  // Popover を開いた時にチャンネル通知設定を取得（granted のときのみ意味がある）
  useEffect(() => {
    if (notifPopoverAnchor && permission === 'granted') {
      void fetchSettings();
    }
  }, [notifPopoverAnchor, permission, fetchSettings]);

  const themeLabel = mode === 'dark' ? 'ライトモードに切り替える' : 'ダークモードに切り替える';
  const userLabel = user?.displayName ?? user?.username ?? '';
  const statusTooltip = userLabel ? `${userLabel} のステータスを設定` : 'ステータスを設定';

  const notificationLabel =
    permission === 'default'
      ? 'ブラウザ通知を有効化'
      : permission === 'denied'
        ? '通知がブロックされています'
        : '通知設定';

  const showNotificationButton = supported && permission !== 'unsupported';

  const { mentionsOnlyCount, mutedCount } = useMemo(() => {
    let m = 0;
    let mu = 0;
    for (const s of settings.values()) {
      if (s.level === 'mentions') m++;
      else if (s.level === 'muted') mu++;
    }
    return { mentionsOnlyCount: m, mutedCount: mu };
  }, [settings]);

  function notificationIcon() {
    if (loading) return <CircularProgress size={16} />;
    if (permission === 'denied') return <NotificationsOffIcon fontSize="small" />;
    if (permission === 'default') return <NotificationAddIcon fontSize="small" />;
    // granted
    return subscribed ? (
      <NotificationsIcon fontSize="small" />
    ) : (
      <NotificationsNoneIcon fontSize="small" />
    );
  }

  async function handleNotificationClick(e: MouseEvent<HTMLElement>) {
    if (permission === 'default') {
      await requestPermission();
      return;
    }
    // denied / granted は Popover を開く
    setNotifPopoverAnchor(e.currentTarget);
  }

  const notificationPopover = (
    <Popover
      open={Boolean(notifPopoverAnchor)}
      anchorEl={notifPopoverAnchor}
      onClose={() => setNotifPopoverAnchor(null)}
      anchorOrigin={{ vertical: 'top', horizontal: 'right' }}
      transformOrigin={{ vertical: 'bottom', horizontal: 'left' }}
    >
      {permission === 'denied' && (
        <Box sx={{ p: 2, maxWidth: 320 }}>
          <Typography variant="subtitle2" gutterBottom>
            通知がブロックされています
          </Typography>
          <Typography variant="body2" color="text.secondary">
            ブラウザの設定から通知を許可する必要があります。
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
            アドレスバー左の鍵アイコンをクリックし、「通知」項目を「許可」に変更してください。
          </Typography>
        </Box>
      )}
      {permission === 'granted' && (
        <Box sx={{ p: 2, minWidth: 240 }}>
          <Typography variant="subtitle2" gutterBottom>
            通知設定
          </Typography>
          <Typography variant="body2">Push 通知: {subscribed ? '購読中' : '未購読'}</Typography>
          <Box sx={{ mt: 1, mb: 1 }}>
            <Button
              size="small"
              variant="outlined"
              disabled={loading}
              onClick={() => void (subscribed ? unsubscribe() : subscribe())}
            >
              {subscribed ? 'Push を無効にする' : 'Push を有効にする'}
            </Button>
          </Box>
          <Divider sx={{ my: 1 }} />
          <Typography variant="body2">メンションのみ: {mentionsOnlyCount} 件</Typography>
          <Typography variant="body2">ミュート中: {mutedCount} 件</Typography>
        </Box>
      )}
    </Popover>
  );

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

            {showNotificationButton && (
              <ListItemButton
                aria-label={notificationLabel}
                disabled={loading}
                onClick={(e) => void handleNotificationClick(e)}
              >
                <ListItemIcon sx={{ minWidth: 40 }}>{notificationIcon()}</ListItemIcon>
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

        {notificationPopover}
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

        {showNotificationButton && (
          <Tooltip title={notificationLabel} placement="right">
            <span>
              <IconButton
                size="small"
                aria-label={notificationLabel}
                disabled={loading}
                onClick={(e) => void handleNotificationClick(e)}
                sx={{ width: 36, height: 32 }}
              >
                {notificationIcon()}
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

      {notificationPopover}
      {statusDialog}
    </>
  );
}
