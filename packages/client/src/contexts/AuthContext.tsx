import { createContext, useContext, useState, use, Suspense, ReactNode } from 'react';
import { CircularProgress, Box } from '@mui/material';
import type { User } from '@chat-app/shared';
import { api } from '../api/client';

interface AuthContextValue {
  user: User | null;
  login: (email: string, password: string) => Promise<void>;
  register: (username: string, email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  updateUser: (user: User) => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

interface AuthProviderContentProps {
  mePromise: Promise<User | null>;
  children: ReactNode;
}

/**
 * use() でプロミスを消費する内部コンポーネント。
 * AuthProvider の <Suspense> の内側に置かれ、サスペンド時に unmount される。
 * Promise の生成（AuthProvider の useState）は Suspense の外側なので再初期化されない。
 */
function AuthProviderContent({ mePromise, children }: AuthProviderContentProps) {
  const initialUser = use(mePromise);
  const [user, setUser] = useState<User | null>(initialUser);

  const login = async (email: string, password: string) => {
    const { user } = await api.auth.login({ email, password });
    setUser(user);
  };

  const register = async (username: string, email: string, password: string) => {
    const { user } = await api.auth.register({ username, email, password });
    setUser(user);
  };

  const logout = async () => {
    await api.auth.logout();
    setUser(null);
  };

  const updateUser = (updated: User) => setUser(updated);

  return (
    <AuthContext.Provider value={{ user, login, register, logout, updateUser }}>
      {children}
    </AuthContext.Provider>
  );
}

/**
 * me() の Promise を生成し、自身の <Suspense> で囲んだ AuthProviderContent に渡す。
 *
 * React 19 では Suspense フォールバック表示時に境界以下のコンポーネントが完全 unmount される。
 * useState による Promise 生成をこのコンポーネント（Suspense の外側）に置くことで、
 * AuthProviderContent がサスペンドしても useState が再初期化されない。
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  // me() が 401 等で失敗した場合（未ログイン）は null を返す Promise に変換する
  const [mePromise] = useState(() =>
    api.auth
      .me()
      .then(({ user }) => user)
      .catch(() => null as User | null),
  );

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
      <AuthProviderContent mePromise={mePromise}>{children}</AuthProviderContent>
    </Suspense>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
