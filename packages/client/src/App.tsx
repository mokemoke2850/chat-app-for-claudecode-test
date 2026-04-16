import { use, useState, useEffect, Suspense } from 'react';
import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
  useParams,
  useSearchParams,
} from 'react-router-dom';
import { CircularProgress, Box } from '@mui/material';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { SocketProvider } from './contexts/SocketContext';
import { SnackbarProvider } from './contexts/SnackbarContext';
import { ThemeProvider } from './contexts/ThemeContext';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import ChatPage from './pages/ChatPage';
import ProfilePage from './pages/ProfilePage';
import AdminPage from './pages/AdminPage';
import BookmarkPage from './pages/BookmarkPage';
import DMPage from './pages/DMPage';
import FilesPage from './pages/FilesPage';
import { api } from './api/client';
import type { User } from '@chat-app/shared';

/**
 * React 19 の concurrent モードではコミット前に同じコンポーネントが複数回インスタンス化される
 * 場合がある。その都度 useState イニシャライザが呼ばれると API が多重発行されるため、
 * モジュールレベルでキャッシュして 1 回しかフェッチしないようにする。
 * キーは userId なのでユーザー切替時は自動的に別エントリが生成される。
 */
const _usersPromiseCache = new Map<number, Promise<{ users: User[] }>>();

function getOrCreateUsersPromise(userId: number): Promise<{ users: User[] }> {
  if (!_usersPromiseCache.has(userId)) {
    _usersPromiseCache.set(
      userId,
      api.auth.users().catch(() => ({ users: [] as User[] })),
    );
  }
  return _usersPromiseCache.get(userId)!;
}

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

/** use() でユーザー一覧を読み取り DMPage に渡す（Suspense の内側） */
function DmWithUsersContent({ usersPromise }: { usersPromise: Promise<{ users: User[] }> }) {
  const { users } = use(usersPromise);
  return <DMPage users={users} />;
}

/**
 * usersPromise を生成して自身の <Suspense> で囲む（Suspense の外側）。
 * React 19 では Suspense フォールバック表示時に境界以下が unmount されるため、
 * useState による Promise 生成はこのコンポーネント（Suspense の外側）に置く必要がある。
 * モジュールレベルキャッシュを使うことで concurrent モードの多重インスタンス化に対応する。
 */
function ChatWithUsers({ currentUser }: { currentUser: User }) {
  const [usersPromise] = useState(() => getOrCreateUsersPromise(currentUser.id));

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

function DmWithUsers({ currentUser }: { currentUser: User }) {
  const [usersPromise] = useState(() => getOrCreateUsersPromise(currentUser.id));

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
      <DmWithUsersContent usersPromise={usersPromise} />
    </Suspense>
  );
}

/** URLパラメーターからチャンネル情報を取得して FilesPage に渡すラッパー */
function FilesPageWrapper() {
  const { channelId } = useParams<{ channelId: string }>();
  const [searchParams] = useSearchParams();
  const channelName = searchParams.get('name') ?? '';
  const id = Number(channelId);
  if (!channelId || isNaN(id)) return <Navigate to="/" replace />;
  return <FilesPage channelId={id} channelName={channelName} />;
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
        path="/bookmarks"
        element={
          <RequireAuth>
            <BookmarkPage />
          </RequireAuth>
        }
      />
      <Route
        path="/channels/:channelId/files"
        element={
          <RequireAuth>
            <FilesPageWrapper />
          </RequireAuth>
        }
      />
      <Route
        path="/dm"
        element={
          <RequireAuth>
            <SocketProvider>
              {user && <DmWithUsers key={user.id} currentUser={user} />}
            </SocketProvider>
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
    <ThemeProvider>
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
