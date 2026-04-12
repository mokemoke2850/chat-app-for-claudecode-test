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
import AdminPage from './pages/AdminPage';
import { api } from './api/client';
import type { User } from '@chat-app/shared';

const theme = createTheme({
  palette: { mode: 'light' },
});

function RequireAuth({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  return user ? <>{children}</> : <Navigate to="/login" replace />;
}

/** use() でユーザー一覧を読み取り ChatPage に渡す（Suspense の内側） */
function ChatWithUsersContent({
  usersPromise,
  currentUser,
}: {
  usersPromise: Promise<{ users: User[] }>;
  currentUser: User;
}) {
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

/**
 * usersPromise を生成して自身の <Suspense> で囲む（Suspense の外側）。
 * React 19 では Suspense フォールバック表示時に境界以下が unmount されるため、
 * useState による Promise 生成はこのコンポーネント（Suspense の外側）に置く必要がある。
 */
function ChatWithUsers({ currentUser }: { currentUser: User }) {
  const [usersPromise] = useState(() => api.auth.users().catch(() => ({ users: [] as User[] })));

  return (
    <Suspense
      fallback={
        <Box
          sx={{ display: 'flex', height: '100vh', alignItems: 'center', justifyContent: 'center' }}
        >
          <CircularProgress />
        </Box>
      }
    >
      <ChatWithUsersContent usersPromise={usersPromise} currentUser={currentUser} />
    </Suspense>
  );
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
        path="/admin"
        element={
          <RequireAuth>
            <AdminPage />
          </RequireAuth>
        }
      />
      <Route
        path="/*"
        element={
          <RequireAuth>
            <SocketProvider>
              {/* key={user.id} でユーザー切替時にコンポーネントを再マウントし useState を初期化する */}
              {user && <ChatWithUsers key={user.id} currentUser={user} />}
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
        {/* AuthProvider 自身が内部に Suspense を持ち、me() 解決中は CircularProgress を表示する */}
        <AuthProvider>
          <SnackbarProvider>
            <AppRoutes />
          </SnackbarProvider>
        </AuthProvider>
      </BrowserRouter>
    </ThemeProvider>
  );
}
