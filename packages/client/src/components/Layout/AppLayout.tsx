import { ReactNode } from 'react';
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
} from '@mui/material';
import LogoutIcon from '@mui/icons-material/Logout';
import NotificationsIcon from '@mui/icons-material/Notifications';
import NotificationsOffIcon from '@mui/icons-material/NotificationsOff';
import AccountCircleIcon from '@mui/icons-material/AccountCircle';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { usePushNotifications } from '../../hooks/usePushNotifications';

const DRAWER_WIDTH = 240;

interface Props {
  sidebar: ReactNode;
  children: ReactNode;
}

export default function AppLayout({ sidebar, children }: Props) {
  const { user, logout } = useAuth();
  const { supported, subscribed, loading, error, subscribe, unsubscribe } = usePushNotifications();
  const navigate = useNavigate();

  return (
    <Box sx={{ display: 'flex', height: '100vh' }}>
      <AppBar position="fixed" sx={{ zIndex: (theme) => theme.zIndex.drawer + 1 }}>
        <Toolbar sx={{ gap: 1 }}>
          <Typography variant="h6" sx={{ flexGrow: 1 }}>
            Chat App
          </Typography>
          <Typography variant="body2">{user?.username}</Typography>

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
        variant="permanent"
        sx={{
          width: DRAWER_WIDTH,
          flexShrink: 0,
          '& .MuiDrawer-paper': { width: DRAWER_WIDTH, boxSizing: 'border-box' },
        }}
      >
        <Toolbar />
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
    </Box>
  );
}
