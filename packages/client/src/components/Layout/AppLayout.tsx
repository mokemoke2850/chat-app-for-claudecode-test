import { ReactNode, useRef, useEffect, useState } from 'react';
import {
  Box,
  Drawer,
  Toolbar,
  AppBar,
  Typography,
  IconButton,
  Tooltip,
  CircularProgress,
  Snackbar,
  Alert,
  InputBase,
  Paper,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
} from '@mui/material';
import LogoutIcon from '@mui/icons-material/Logout';
import MenuIcon from '@mui/icons-material/Menu';
import NotificationsIcon from '@mui/icons-material/Notifications';
import NotificationsOffIcon from '@mui/icons-material/NotificationsOff';
import AccountCircleIcon from '@mui/icons-material/AccountCircle';
import SearchIcon from '@mui/icons-material/Search';
import DarkModeIcon from '@mui/icons-material/DarkMode';
import LightModeIcon from '@mui/icons-material/LightMode';
import AssignmentIcon from '@mui/icons-material/Assignment';
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth';
import ChatIcon from '@mui/icons-material/Chat';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import { usePushNotifications } from '../../hooks/usePushNotifications';
import { useSocket } from '../../contexts/SocketContext';
import { api } from '../../api/client';
import StatusEditDialog from '../User/StatusEditDialog';

const DRAWER_WIDTH = 240;

interface Props {
  sidebar: ReactNode;
  children: ReactNode;
  searchQuery?: string;
  onSearchChange?: (q: string) => void;
  onSearchFocus?: () => void;
}

export default function AppLayout({
  sidebar,
  children,
  searchQuery = '',
  onSearchChange,
  onSearchFocus,
}: Props) {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [reminderNotification, setReminderNotification] = useState<string | null>(null);
  const [statusDialogOpen, setStatusDialogOpen] = useState(false);
  const { user, logout, updateUser } = useAuth();
  const { mode, toggleTheme } = useTheme();
  const { supported, subscribed, loading, error, subscribe, unsubscribe } = usePushNotifications();
  const navigate = useNavigate();
  const searchRef = useRef<HTMLInputElement>(null);
  const socket = useSocket();

  useEffect(() => {
    if (!socket) return;
    const handler = (data: {
      type: 'reminder';
      reminderId: number;
      messageId: number;
      messageContent: string;
      remindAt: string;
    }) => {
      if (data.type === 'reminder') {
        const preview = (() => {
          try {
            const parsed = JSON.parse(data.messageContent) as {
              ops?: { insert?: string | object }[];
            };
            return (
              parsed.ops
                ?.map((op) => (typeof op.insert === 'string' ? op.insert : ''))
                .join('')
                .trim()
                .slice(0, 50) ?? data.messageContent
            );
          } catch {
            return data.messageContent;
          }
        })();
        setReminderNotification(`リマインダー: ${preview}`);
      }
    };
    socket.on('notification', handler);
    return () => {
      socket.off('notification', handler);
    };
  }, [socket]);

  // Ctrl+F でヘッダー検索ボックスにフォーカス
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
        if (onSearchChange) {
          e.preventDefault();
          searchRef.current?.focus();
        }
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onSearchChange]);

  return (
    <Box sx={{ display: 'flex', height: '100vh' }}>
      <AppBar position="fixed" sx={{ zIndex: (theme) => theme.zIndex.drawer + 1 }}>
        <Toolbar sx={{ gap: 1 }}>
          <Tooltip title="サイドバーを開閉する">
            <IconButton
              color="inherit"
              aria-label="サイドバーを開閉する"
              aria-expanded={sidebarOpen}
              onClick={() => setSidebarOpen((prev) => !prev)}
            >
              <MenuIcon />
            </IconButton>
          </Tooltip>

          <Typography variant="h6" sx={{ flexShrink: 0 }}>
            Chat App
          </Typography>

          {/* ヘッダー中央の検索ボックス */}
          {onSearchChange && (
            <Paper
              component="form"
              onSubmit={(e) => e.preventDefault()}
              sx={{
                display: 'flex',
                alignItems: 'center',
                flexGrow: 1,
                mx: 2,
                px: 1,
                py: 0.25,
                bgcolor: 'rgba(255,255,255,0.15)',
                borderRadius: 1,
                maxWidth: 480,
              }}
            >
              <SearchIcon sx={{ color: 'inherit', mr: 0.5, fontSize: 18 }} />
              <InputBase
                inputRef={searchRef}
                placeholder="メッセージを検索 (Ctrl+F)"
                value={searchQuery}
                onChange={(e) => onSearchChange(e.target.value)}
                onFocus={() => onSearchFocus?.()}
                sx={{ color: 'inherit', fontSize: 14, flexGrow: 1 }}
                inputProps={{ 'aria-label': 'search messages' }}
              />
            </Paper>
          )}

          <Box sx={{ flexGrow: 1 }} />

          {/* 自分の表示名とステータス絵文字 — クリックでステータス編集ダイアログを開く */}
          <Tooltip title="ステータスを設定">
            <Box
              component="button"
              onClick={() => setStatusDialogOpen(true)}
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 0.5,
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                color: 'inherit',
                px: 1,
                py: 0.5,
                borderRadius: 1,
                '&:hover': { bgcolor: 'rgba(255,255,255,0.1)' },
              }}
            >
              {user?.status?.emoji && (
                <Typography component="span" sx={{ fontSize: '1rem', lineHeight: 1 }}>
                  {user.status.emoji}
                </Typography>
              )}
              <Typography variant="body2">{user?.displayName ?? user?.username}</Typography>
            </Box>
          </Tooltip>

          <Tooltip
            title={mode === 'dark' ? 'ライトモードに切り替える' : 'ダークモードに切り替える'}
          >
            <IconButton
              color="inherit"
              aria-label={mode === 'dark' ? 'ライトモードに切り替える' : 'ダークモードに切り替える'}
              onClick={toggleTheme}
            >
              {mode === 'dark' ? <LightModeIcon /> : <DarkModeIcon />}
            </IconButton>
          </Tooltip>

          {supported && (
            <Tooltip title={subscribed ? 'Disable notifications' : 'Enable notifications'}>
              <span>
                <IconButton
                  color="inherit"
                  disabled={loading}
                  onClick={() => void (subscribed ? unsubscribe() : subscribe())}
                >
                  {loading ? (
                    <CircularProgress size={20} color="inherit" />
                  ) : subscribed ? (
                    <NotificationsIcon />
                  ) : (
                    <NotificationsOffIcon />
                  )}
                </IconButton>
              </span>
            </Tooltip>
          )}

          <Tooltip title="プロフィール設定">
            <IconButton color="inherit" onClick={() => navigate('/profile')}>
              <AccountCircleIcon />
            </IconButton>
          </Tooltip>

          <Tooltip title="Logout">
            <IconButton color="inherit" onClick={() => void logout()}>
              <LogoutIcon />
            </IconButton>
          </Tooltip>
        </Toolbar>
      </AppBar>

      <Drawer
        variant="persistent"
        open={sidebarOpen}
        sx={{
          width: sidebarOpen ? DRAWER_WIDTH : 0,
          flexShrink: 0,
          transition: (theme) => theme.transitions.create('width'),
          '& .MuiDrawer-paper': { width: DRAWER_WIDTH, boxSizing: 'border-box' },
        }}
      >
        <Toolbar />
        {/* チャット / タスクボード (#151) / カレンダー (#152) ナビゲーション */}
        <List dense>
          <ListItemButton onClick={() => navigate('/')} aria-label="チャット">
            <ListItemIcon>
              <ChatIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText primary="チャット" />
          </ListItemButton>
          <ListItemButton onClick={() => navigate('/calendar')} aria-label="カレンダー">
            <ListItemIcon>
              <CalendarMonthIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText primary="カレンダー" />
          </ListItemButton>
          <ListItemButton onClick={() => navigate('/tasks')} aria-label="タスクボード">
            <ListItemIcon>
              <AssignmentIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText primary="タスクボード" />
          </ListItemButton>
        </List>
        {sidebar}
      </Drawer>

      <Box
        component="main"
        sx={{ flexGrow: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}
      >
        <Toolbar />
        <Box sx={{ flexGrow: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          {children}
        </Box>
      </Box>

      <Snackbar open={!!error} autoHideDuration={6000}>
        <Alert severity="error" variant="filled">
          {error}
        </Alert>
      </Snackbar>

      <Snackbar
        open={!!reminderNotification}
        autoHideDuration={6000}
        onClose={() => setReminderNotification(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert severity="info" variant="filled" onClose={() => setReminderNotification(null)}>
          {reminderNotification}
        </Alert>
      </Snackbar>

      {/* #147 ステータス編集ダイアログ */}
      <StatusEditDialog
        open={statusDialogOpen}
        onClose={() => setStatusDialogOpen(false)}
        currentStatus={user?.status ?? null}
        onSaved={() => {
          // 保存後に最新ユーザー情報を再取得して AuthContext を更新
          void (async () => {
            try {
              const { user: updated } = await api.auth.me();
              updateUser(updated);
            } catch {
              // 取得失敗時は次回のページリロードで反映
            }
          })();
        }}
      />
    </Box>
  );
}
