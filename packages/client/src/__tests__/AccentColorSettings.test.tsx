/**
 * テスト対象: アクセントカラー / カスタムテーマ機能（#274）
 *
 * 戦略:
 *   - ThemeContext を拡張して accentColor 状態を保持することを検証する
 *   - MUI の palette.primary がアクセントカラーに応じて切り替わることを検証する
 *   - ProfilePage のアクセントカラーセクション UI（カラーパレットボタン）を検証する
 *   - API 呼び出しのエラーハンドリング（成功・失敗時のロールバック挙動）を検証する
 *   - AuthContext.user.accentColor から初期値が復元されることを検証する
 *
 *   API クライアント (`../api/client`) は vi.mock で差し替え、AuthContext / ThemeContext は
 *   実装をそのまま読み込む。
 */

import { render, screen, act, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { ReactNode } from 'react';
import { useTheme as useMuiTheme } from '@mui/material/styles';
import { ACCENT_COLOR_HEX, type AccentColor, type User } from '@chat-app/shared';
import { ThemeProvider, useTheme } from '../contexts/ThemeContext';
import ProfilePage from '../pages/ProfilePage';

// ---- モック ----
const mockUpdateUser = vi.hoisted(() => vi.fn());
const mockUpdateProfile = vi.hoisted(() => vi.fn());
const mockChangePassword = vi.hoisted(() => vi.fn());
const mockShowSuccess = vi.hoisted(() => vi.fn());
const mockShowError = vi.hoisted(() => vi.fn());

const mockUserState = vi.hoisted(
  () =>
    ({
      id: 1,
      username: 'alice',
      email: 'alice@example.com',
      avatarUrl: null,
      displayName: null,
      location: null,
      createdAt: '2024-01-01T00:00:00Z',
      role: 'user',
      isActive: true,
      onboardingCompletedAt: null,
      accentColor: null,
    }) as User & { accentColor: AccentColor | null },
);

vi.mock('../contexts/AuthContext', async () => {
  const { createContext } = await import('react');
  const ctxValue = {
    user: mockUserState,
    updateUser: mockUpdateUser,
    login: vi.fn(),
    register: vi.fn(),
    logout: vi.fn(),
    completeOnboarding: vi.fn(),
  };
  // ThemeContext は AuthContext を直接 useContext で読むため、
  // Provider で値を流し込む形式の AuthContext を返す
  const AuthContext = createContext<typeof ctxValue | null>(ctxValue);
  return {
    AuthContext,
    useAuth: () => ctxValue,
    AuthProvider: ({ children }: { children: ReactNode }) => <>{children}</>,
  };
});

vi.mock('../api/client', () => ({
  api: {
    auth: {
      updateProfile: mockUpdateProfile,
      changePassword: mockChangePassword,
    },
  },
}));

vi.mock('react-router-dom', () => ({
  useNavigate: () => vi.fn(),
}));

vi.mock('../contexts/SnackbarContext', () => ({
  useSnackbar: () => ({
    showSuccess: mockShowSuccess,
    showError: mockShowError,
    showInfo: vi.fn(),
  }),
}));

vi.mock('../components/Layout/AppLayout', () => ({
  default: ({ children }: { children: ReactNode }) => (
    <div data-testid="app-layout-stub">{children}</div>
  ),
}));

// AccessibilityContext / DensityContext は ProfilePage が使うため最小モック
vi.mock('../contexts/AccessibilityContext', () => ({
  useAccessibility: () => ({
    fontSize: 'medium',
    highContrast: false,
    setFontSize: vi.fn(),
    setHighContrast: vi.fn(),
  }),
  AccessibilityProvider: ({ children }: { children: ReactNode }) => <>{children}</>,
}));

vi.mock('../contexts/DensityContext', () => ({
  useDensity: () => ({
    density: 'cozy',
    setDensity: vi.fn(),
  }),
  DensityProvider: ({ children }: { children: ReactNode }) => <>{children}</>,
}));

/** テスト用: useTheme の値を表示するコンポーネント。setAccentColor の rejection は握りつぶす */
function ThemeDisplay() {
  const { accentColor, setAccentColor } = useTheme();
  const muiTheme = useMuiTheme();
  const safeSet = (color: AccentColor) => {
    setAccentColor(color).catch(() => {
      /* テスト用: 失敗時は無視（unhandled rejection を防ぐ） */
    });
  };
  return (
    <div>
      <span data-testid="accent-color">{accentColor}</span>
      <span data-testid="primary-main">{muiTheme.palette.primary.main}</span>
      <button onClick={() => safeSet('blue')}>Blue</button>
      <button onClick={() => safeSet('purple')}>Purple</button>
      <button onClick={() => safeSet('green')}>Green</button>
      <button onClick={() => safeSet('orange')}>Orange</button>
      <button onClick={() => safeSet('red')}>Red</button>
    </div>
  );
}

function renderWithTheme(ui: ReactNode = <ThemeDisplay />) {
  return render(<ThemeProvider>{ui}</ThemeProvider>);
}

beforeEach(() => {
  mockUserState.accentColor = null;
  vi.clearAllMocks();
  // 既定: updateProfile は更新後のユーザーを返す
  mockUpdateProfile.mockImplementation(async (data: { accentColor?: AccentColor | null }) => ({
    user: { ...mockUserState, accentColor: data.accentColor ?? null },
  }));
});

describe('アクセントカラー機能', () => {
  describe('ThemeContext の accentColor 状態管理', () => {
    it('useTheme() で accentColor の現在値が取得できる', () => {
      mockUserState.accentColor = 'green';
      renderWithTheme();
      expect(screen.getByTestId('accent-color').textContent).toBe('green');
    });

    it('AuthContext.user.accentColor が null の場合はデフォルト値（blue）になる', () => {
      mockUserState.accentColor = null;
      renderWithTheme();
      expect(screen.getByTestId('accent-color').textContent).toBe('blue');
    });

    it('setAccentColor() で accentColor を更新できる', async () => {
      renderWithTheme();
      await act(async () => {
        await userEvent.click(screen.getByRole('button', { name: 'Purple' }));
      });
      expect(mockUpdateProfile).toHaveBeenCalledWith({ accentColor: 'purple' });
    });

    it('setAccentColor() の更新後、useTheme() が新しい値を返す', async () => {
      renderWithTheme();
      expect(screen.getByTestId('accent-color').textContent).toBe('blue');

      await act(async () => {
        await userEvent.click(screen.getByRole('button', { name: 'Red' }));
      });
      await waitFor(() => {
        expect(screen.getByTestId('accent-color').textContent).toBe('red');
      });
    });

    it('ThemeProvider の外で useTheme() を呼んでもエラーにならず、デフォルト値が返る', () => {
      // ProfilePage 等の既存コンポーネントテスト互換性のためフォールバック値を返す仕様
      render(<ThemeDisplay />);
      expect(screen.getByTestId('accent-color').textContent).toBe('blue');
    });
  });

  describe('MUI palette.primary への反映', () => {
    it('accentColor が "blue" のとき MUI theme の palette.primary.main が青系の色になる', () => {
      mockUserState.accentColor = 'blue';
      renderWithTheme();
      expect(screen.getByTestId('primary-main').textContent).toBe(ACCENT_COLOR_HEX.blue);
    });

    it('accentColor を "purple" に変更すると palette.primary.main が紫系の色に切り替わる', async () => {
      renderWithTheme();
      await act(async () => {
        await userEvent.click(screen.getByRole('button', { name: 'Purple' }));
      });
      await waitFor(() => {
        expect(screen.getByTestId('primary-main').textContent).toBe(ACCENT_COLOR_HEX.purple);
      });
    });

    it('accentColor の 5 つのプリセット（blue / purple / green / orange / red）すべてが個別の色にマッピングされる', () => {
      const colors: AccentColor[] = ['blue', 'purple', 'green', 'orange', 'red'];
      const hexValues = colors.map((c) => ACCENT_COLOR_HEX[c]);
      // 5 色すべて異なる
      expect(new Set(hexValues).size).toBe(5);
      // 既知の色相に分類できる（hex が定義されている）
      for (const c of colors) {
        expect(ACCENT_COLOR_HEX[c]).toMatch(/^#[0-9a-fA-F]{6}$/);
      }
    });
  });

  describe('ProfilePage アクセントカラーセクションの UI', () => {
    it('ProfilePage 最下部に「アクセントカラー」セクションが表示される', () => {
      renderWithTheme(<ProfilePage />);
      expect(screen.getByText('アクセントカラー')).toBeInTheDocument();
    });

    it('5 色のプリセットボタン（blue / purple / green / orange / red）が並んで表示される', () => {
      renderWithTheme(<ProfilePage />);
      expect(screen.getByLabelText(/青（blue）/)).toBeInTheDocument();
      expect(screen.getByLabelText(/紫（purple）/)).toBeInTheDocument();
      expect(screen.getByLabelText(/緑（green）/)).toBeInTheDocument();
      expect(screen.getByLabelText(/オレンジ（orange）/)).toBeInTheDocument();
      expect(screen.getByLabelText(/赤（red）/)).toBeInTheDocument();
    });

    it('現在選択中の色のボタンにアクティブ表示（aria-pressed=true）が付く', () => {
      mockUserState.accentColor = 'green';
      renderWithTheme(<ProfilePage />);
      const greenBtn = screen.getByLabelText(/緑（green）/);
      expect(greenBtn).toHaveAttribute('aria-pressed', 'true');

      const blueBtn = screen.getByLabelText(/青（blue）/);
      expect(blueBtn).toHaveAttribute('aria-pressed', 'false');
    });

    it('未選択の色のボタンをクリックすると updateProfile API が呼ばれる', async () => {
      mockUserState.accentColor = 'blue';
      renderWithTheme(<ProfilePage />);
      await act(async () => {
        await userEvent.click(screen.getByLabelText(/紫（purple）/));
      });
      expect(mockUpdateProfile).toHaveBeenCalledWith({ accentColor: 'purple' });
    });

    it('API 成功後、ThemeContext の accentColor とアクティブ表示が新しい色に切り替わる', async () => {
      mockUserState.accentColor = 'blue';
      renderWithTheme(<ProfilePage />);
      await act(async () => {
        await userEvent.click(screen.getByLabelText(/オレンジ（orange）/));
      });
      await waitFor(() => {
        expect(screen.getByLabelText(/オレンジ（orange）/)).toHaveAttribute('aria-pressed', 'true');
      });
      expect(screen.getByLabelText(/青（blue）/)).toHaveAttribute('aria-pressed', 'false');
    });
  });

  describe('API 呼び出しエラー時のハンドリング', () => {
    it('API 呼び出しが失敗するとエラースナックバーが表示される', async () => {
      mockUpdateProfile.mockRejectedValueOnce(new Error('保存に失敗しました'));
      mockUserState.accentColor = 'blue';
      renderWithTheme(<ProfilePage />);
      await act(async () => {
        await userEvent.click(screen.getByLabelText(/赤（red）/));
      });
      await waitFor(() => {
        expect(mockShowError).toHaveBeenCalled();
      });
    });

    it('API 呼び出しが失敗した場合、accentColor は変更前の値にロールバックされる', async () => {
      mockUpdateProfile.mockRejectedValueOnce(new Error('network error'));
      mockUserState.accentColor = 'blue';
      renderWithTheme();

      await act(async () => {
        await userEvent.click(screen.getByRole('button', { name: 'Red' }));
      });

      // ロールバックされて blue に戻る
      await waitFor(() => {
        expect(screen.getByTestId('accent-color').textContent).toBe('blue');
      });
    });
  });

  describe('AuthContext.user.accentColor からの初期値復元', () => {
    it('user.accentColor に "purple" が保存されている場合、初期表示で purple が選択状態になる', () => {
      mockUserState.accentColor = 'purple';
      renderWithTheme(<ProfilePage />);
      const purpleBtn = screen.getByLabelText(/紫（purple）/);
      expect(purpleBtn).toHaveAttribute('aria-pressed', 'true');
    });

    it('user.accentColor が null の場合はデフォルト値（blue）が初期選択になる', () => {
      mockUserState.accentColor = null;
      renderWithTheme(<ProfilePage />);
      const blueBtn = screen.getByLabelText(/青（blue）/);
      expect(blueBtn).toHaveAttribute('aria-pressed', 'true');
    });
  });
});
