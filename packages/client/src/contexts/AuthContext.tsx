import { createContext, useContext, useState, use, ReactNode } from 'react';
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
 * プロミス生成（useState）と消費（use）を分離することで、
 * use() がサスペンドしてリトライされても useState を再初期化しないようにする。
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
 * me() の Promise を生成し AuthProviderContent に渡す。
 * このコンポーネント自身は use() を呼ばないため、サスペンド時に useState が再初期化されない。
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  // me() が 401 等で失敗した場合（未ログイン）は null を返す Promise に変換する
  const [mePromise] = useState(() =>
    api.auth
      .me()
      .then(({ user }) => user)
      .catch(() => null as User | null),
  );

  return <AuthProviderContent mePromise={mePromise}>{children}</AuthProviderContent>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
