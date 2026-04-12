import { use, useState, useEffect, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { CssBaseline, ThemeProvider, createTheme, CircularProgress, Box } from '@mui/material';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { SocketProvider } from './contexts/SocketContext';
import { SnackbarProvider } from './contexts/SnackbarContext';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import ChatPage from './pages/ChatPage';
import ProfilePage from './pages/ProfilePage';
import { api } from './api/client';
import type { User } from '@chat-app/shared';

const theme = createTheme({
  palette: { mode: 'light' },
});

function RequireAuth({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  return user ? <>{children}</> : <Navigate to="/login" replace />;
}

/** ユーザー一覧を use() で取得し ChatPage に渡す */
function ChatWithUsers({ currentUser }: { currentUser: User }) {
  const [usersPromise] = useState(() => api.auth.users().catch(() => ({ users: [] as User[] })));
  const { users: initialUsers } = use(usersPromise);
  const [users, setUsers] = useState<User[]>(initialUsers);

  // プロフィール更新時に users 配列の該当エントリを同期する
  useEffect(() => {
    setUsers((prev) => {
      const idx = prev.findIndex((u) => u.id === currentUser.id);
      if (idx === -1) return prev;
      const updated = [...prev];
      updated[idx] = currentUser;
      return updated;
    });
  }, [currentUser]);

  return <ChatPage users={users} />;
}

function AppRoutes() {
  const { user } = useAuth();

  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route
        path="/profile"
        element={
          <RequireAuth>
            <ProfilePage />
          </RequireAuth>
        }
      />
      <Route
        path="/*"
        element={
          <RequireAuth>
            <SocketProvider>
              {user && (
                <Suspense
                  fallback={
                    <Box
                      sx={{
                        display: 'flex',
                        height: '100vh',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <CircularProgress />
                    </Box>
                  }
                >
                  {/* key={user.id} でユーザー切替時にコンポーネントを再マウントし useState を初期化する */}
                  <ChatWithUsers key={user.id} currentUser={user} />
                </Suspense>
              )}
            </SocketProvider>
          </RequireAuth>
        }
      />
    </Routes>
  );
}

export default function App() {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <BrowserRouter>
        {/* AuthProvider 内の use(mePromise) がサスペンドする間は CircularProgress を表示する */}
        <Suspense
          fallback={
            <Box
              sx={{
                display: 'flex',
                height: '100vh',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <CircularProgress />
            </Box>
          }
        >
          <AuthProvider>
            <SnackbarProvider>
              <AppRoutes />
            </SnackbarProvider>
          </AuthProvider>
        </Suspense>
      </BrowserRouter>
    </ThemeProvider>
  );
}
