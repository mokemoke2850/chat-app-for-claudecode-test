import {
  createContext,
  useContext,
  useState,
  useCallback,
  useMemo,
  useEffect,
  ReactNode,
} from 'react';
import { ThemeProvider as MuiThemeProvider, createTheme } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import {
  ACCENT_COLOR_HEX,
  DEFAULT_ACCENT_COLOR,
  isAccentColor,
  type AccentColor,
} from '@chat-app/shared';
import { AuthContext } from './AuthContext';
import { api } from '../api/client';

const STORAGE_KEY = 'theme-mode';

type ThemeMode = 'dark' | 'light';

interface ThemeContextValue {
  mode: ThemeMode;
  toggleTheme: () => void;
  /** 現在のアクセントカラー（user.accentColor が null の場合はデフォルト 'blue'） */
  accentColor: AccentColor;
  /** アクセントカラーを更新する。API 失敗時は前の値にロールバックする */
  setAccentColor: (color: AccentColor) => Promise<void>;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

function getInitialMode(): ThemeMode {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored === 'dark' || stored === 'light') return stored;
  if (window.matchMedia('(prefers-color-scheme: dark)').matches) return 'dark';
  return 'light';
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  // AuthProvider の有無に関わらず動作させるため、useAuth() ではなく useContext(AuthContext) を直接呼ぶ
  const authCtx = useContext(AuthContext);
  const user = authCtx?.user ?? null;
  const updateUser = authCtx?.updateUser;
  const [mode, setMode] = useState<ThemeMode>(getInitialMode);

  // ユーザーの accentColor を初期値として取り込む。null や未ログインなら DEFAULT を使う
  const initialAccent: AccentColor = isAccentColor(user?.accentColor)
    ? (user!.accentColor as AccentColor)
    : DEFAULT_ACCENT_COLOR;
  const [accentColor, setAccentColorState] = useState<AccentColor>(initialAccent);

  // ログイン状態が変わって user.accentColor が更新された場合に追従する
  useEffect(() => {
    const next: AccentColor = isAccentColor(user?.accentColor)
      ? (user!.accentColor as AccentColor)
      : DEFAULT_ACCENT_COLOR;
    setAccentColorState(next);
  }, [user?.accentColor]);

  const toggleTheme = useCallback(() => {
    setMode((prev) => {
      const next: ThemeMode = prev === 'dark' ? 'light' : 'dark';
      localStorage.setItem(STORAGE_KEY, next);
      return next;
    });
  }, []);

  const setAccentColor = useCallback(
    async (color: AccentColor) => {
      const previous = accentColor;
      // 楽観的更新
      setAccentColorState(color);
      try {
        const { user: updated } = await api.auth.updateProfile({ accentColor: color });
        updateUser?.(updated);
      } catch (err) {
        // 失敗時は前の値にロールバック
        setAccentColorState(previous);
        throw err;
      }
    },
    [accentColor, updateUser],
  );

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', mode);
  }, [mode]);

  const value = useMemo(
    () => ({ mode, toggleTheme, accentColor, setAccentColor }),
    [mode, toggleTheme, accentColor, setAccentColor],
  );

  const theme = useMemo(
    () =>
      createTheme({
        palette: {
          mode,
          primary: {
            main: ACCENT_COLOR_HEX[accentColor],
          },
        },
      }),
    [mode, accentColor],
  );

  return (
    <ThemeContext.Provider value={value}>
      <MuiThemeProvider theme={theme}>
        <CssBaseline />
        {children}
      </MuiThemeProvider>
    </ThemeContext.Provider>
  );
}

/**
 * ThemeProvider 外で useTheme を呼び出した場合のフォールバック値。
 * テスト等で ThemeProvider をマウントしないコンポーネント単体テストでも、
 * defaultAccent / no-op の setAccentColor が返ることで描画を継続できる。
 */
const FALLBACK_THEME_VALUE: ThemeContextValue = {
  mode: 'light',
  toggleTheme: () => {
    /* no-op */
  },
  accentColor: DEFAULT_ACCENT_COLOR,
  setAccentColor: async () => {
    /* no-op */
  },
};

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  // ThemeProvider 外（既存テスト等）でも安全に動作させるためにフォールバック値を返す
  return ctx ?? FALLBACK_THEME_VALUE;
}
