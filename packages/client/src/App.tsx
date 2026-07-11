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
import { AccessibilityProvider } from './contexts/AccessibilityContext';
import { DensityProvider } from './contexts/DensityContext';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import ChatPage from './pages/ChatPage';
import InboxPage from './pages/InboxPage';
import ProfilePage from './pages/ProfilePage';
import AdminPage from './pages/AdminPage';
import BookmarkPage from './pages/BookmarkPage';
import DMPage from './pages/DMPage';
import FilesPage from './pages/FilesPage';
import TemplatesPage from './pages/TemplatesPage';
import InviteRedeemPage from './pages/InviteRedeemPage';
import GuestChannelPage from './pages/GuestChannelPage';
import TaskBoardPage from './pages/TaskBoardPage';
import CalendarPage from './pages/CalendarPage';
import SearchPage from './pages/SearchPage';
import NotificationCenterPage from './pages/NotificationCenterPage';
import { api, setRateLimitErrorHandler } from './api/client';
import { useSnackbar } from './contexts/SnackbarContext';
import type { User } from '@chat-app/shared';
import WelcomeModal from './components/Onboarding/WelcomeModal';

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

/**
 * HTTP 429 レート制限エラーを SnackbarContext に転送するリスナ。
 * SnackbarProvider の内側でマウントすることで useSnackbar() が利用可能になる。
 * setRateLimitErrorHandler() は api/client.ts のモジュールレベル変数を設定するだけなので
 * useEffect で一度だけ登録すれば十分。
 */
function RateLimitListener() {
  const { showError } = useSnackbar();
  useEffect(() => {
    setRateLimitErrorHandler(showError);
    return () => {
      setRateLimitErrorHandler(null as unknown as (message: string) => void);
    };
  }, [showError]);
  return null;
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
  const { user, updateUser, completeOnboarding } = useAuth();

  const handleOnboardingComplete = async (updatedUser?: User) => {
    if (updatedUser) updateUser(updatedUser);
    else await completeOnboarding().catch(() => {});
  };

  return (
    <>
      <WelcomeModal user={user} onComplete={(u) => void handleOnboardingComplete(u)} />
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/invite/:token" element={<InviteRedeemPage />} />
        <Route path="/g/:token" element={<GuestChannelPage />} />
        {/* Rail の DM/メンション未読バッジを動作させるため SocketProvider 配下に置く */}
        <Route
          path="/profile"
          element={
            <RequireAuth>
              <SocketProvider>
                <ProfilePage />
              </SocketProvider>
            </RequireAuth>
          }
        />
        <Route
          path="/admin"
          element={
            <RequireAuth>
              <SocketProvider>
                <AdminPage />
              </SocketProvider>
            </RequireAuth>
          }
        />
        <Route
          path="/bookmarks"
          element={
            <RequireAuth>
              <SocketProvider>
                <BookmarkPage />
              </SocketProvider>
            </RequireAuth>
          }
        />
        <Route
          path="/templates"
          element={
            <RequireAuth>
              <SocketProvider>
                <TemplatesPage />
              </SocketProvider>
            </RequireAuth>
          }
        />
        <Route
          path="/tasks"
          element={
            <RequireAuth>
              <SocketProvider>
                <TaskBoardPage />
              </SocketProvider>
            </RequireAuth>
          }
        />
        <Route
          path="/calendar"
          element={
            <RequireAuth>
              <CalendarPage />
            </RequireAuth>
          }
        />
        <Route
          path="/notifications"
          element={<RequireAuth><SocketProvider><NotificationCenterPage /></SocketProvider></RequireAuth>}
        />
        <Route
          path="/search"
          element={
            <RequireAuth>
              <SocketProvider>
                <SearchPage />
              </SocketProvider>
            </RequireAuth>
          }
        />
        <Route
          path="/channels/:channelId/files"
          element={
            <RequireAuth>
              <SocketProvider>
                <FilesPageWrapper />
              </SocketProvider>
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
        {/* チャット画面は /chat/*、ルート / は InboxPage が担当 */}
        <Route
          path="/chat/*"
          element={
            <RequireAuth>
              <SocketProvider>
                {/* key={user.id} でユーザー切替時にコンポーネントを再マウントし useState を初期化する */}
                {user && <ChatWithUsers key={user.id} currentUser={user} />}
              </SocketProvider>
            </RequireAuth>
          }
        />
        <Route
          path="/*"
          element={
            <RequireAuth>
              <SocketProvider>
                <InboxPage />
              </SocketProvider>
            </RequireAuth>
          }
        />
      </Routes>
    </>
  );
}

export default function App() {
  return (
    <AccessibilityProvider>
      <DensityProvider>
        <BrowserRouter>
          {/* AuthProvider 自身が内部に Suspense を持ち、me() 解決中は CircularProgress を表示する */}
          <AuthProvider>
            {/* ThemeProvider は AuthContext.user.accentColor を初期値に使うため AuthProvider の内側に置く（#274） */}
            <ThemeProvider>
              <SnackbarProvider>
                <RateLimitListener />
                <AppRoutes />
              </SnackbarProvider>
            </ThemeProvider>
          </AuthProvider>
        </BrowserRouter>
      </DensityProvider>
    </AccessibilityProvider>
  );
}
