/**
 * アクセシビリティ設定機能のユニットテスト
 *
 * テスト対象: AccessibilityContext.tsx（コンテキスト・フック）と
 *             ProfilePage.tsx のアクセシビリティセクション UI
 * 戦略:
 *   - AccessibilityContext を直接レンダリングして状態管理ロジックを検証する
 *   - localStorageをモックして永続化・復元ロジックを検証する
 *   - ProfilePage 内のアクセシビリティセクションは AuthContext 等をモックして検証する
 */

import { render, screen, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { AccessibilityProvider, useAccessibility } from '../contexts/AccessibilityContext';
import ProfilePage from '../pages/ProfilePage';

// ---- ProfilePage テスト用モック ----
const mockUpdateUser = vi.hoisted(() => vi.fn());
const mockUpdateProfile = vi.hoisted(() => vi.fn());
const mockChangePassword = vi.hoisted(() => vi.fn());
const mockShowSuccess = vi.hoisted(() => vi.fn());
const mockShowError = vi.hoisted(() => vi.fn());

const mockUserState = vi.hoisted(() => ({
  id: 1,
  username: 'alice',
  email: 'alice@example.com',
  avatarUrl: null as string | null,
  displayName: null as string | null,
  location: null as string | null,
  createdAt: '2024-01-01T00:00:00Z',
}));

vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => ({
    user: mockUserState,
    updateUser: mockUpdateUser,
  }),
}));

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
  default: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="app-layout-stub">{children}</div>
  ),
}));

// AccessibilityContext を ProfilePage からもモックしない（実装を通してテスト）

/** テスト用: useAccessibility の値を表示するコンポーネント */
function AccessibilityDisplay() {
  const { fontSize, highContrast, setFontSize, setHighContrast } = useAccessibility();
  return (
    <div>
      <span data-testid="font-size">{fontSize}</span>
      <span data-testid="high-contrast">{String(highContrast)}</span>
      <button onClick={() => setFontSize('small')}>小</button>
      <button onClick={() => setFontSize('medium')}>中</button>
      <button onClick={() => setFontSize('large')}>大</button>
      <button onClick={() => setHighContrast(true)}>ハイコントラストON</button>
      <button onClick={() => setHighContrast(false)}>ハイコントラストOFF</button>
    </div>
  );
}

function renderWithProvider() {
  return render(
    <AccessibilityProvider>
      <AccessibilityDisplay />
    </AccessibilityProvider>,
  );
}

beforeEach(() => {
  localStorage.clear();
  document.body.removeAttribute('data-font-size');
  document.body.classList.remove('hc');
  vi.clearAllMocks();
});

afterEach(() => {
  document.body.removeAttribute('data-font-size');
  document.body.classList.remove('hc');
});

describe('アクセシビリティ設定', () => {
  describe('フォントサイズ切替', () => {
    it('「小」を選択すると --font-size-base が small 用の値に変わる', async () => {
      renderWithProvider();
      await act(async () => {
        await userEvent.click(screen.getByRole('button', { name: '小' }));
      });
      // CSS変数の確認は jsdom では困難なため、body の data-font-size 属性で検証する
      expect(document.body.getAttribute('data-font-size')).toBe('small');
    });

    it('「中」を選択すると --font-size-base がデフォルト値に変わる', async () => {
      // まず small に変更してから medium に戻す
      renderWithProvider();
      await act(async () => {
        await userEvent.click(screen.getByRole('button', { name: '小' }));
      });
      await act(async () => {
        await userEvent.click(screen.getByRole('button', { name: '中' }));
      });
      expect(document.body.getAttribute('data-font-size')).toBe('medium');
    });

    it('「大」を選択すると --font-size-base が large 用の値に変わる', async () => {
      renderWithProvider();
      await act(async () => {
        await userEvent.click(screen.getByRole('button', { name: '大' }));
      });
      expect(document.body.getAttribute('data-font-size')).toBe('large');
    });

    it('フォントサイズ変更は body に data-font-size 属性として反映される', async () => {
      renderWithProvider();
      expect(document.body.getAttribute('data-font-size')).toBe('medium');

      await act(async () => {
        await userEvent.click(screen.getByRole('button', { name: '大' }));
      });
      expect(document.body.getAttribute('data-font-size')).toBe('large');
    });
  });

  describe('ハイコントラストモード', () => {
    it('ハイコントラストをオンにすると body に hc クラスが付与される', async () => {
      renderWithProvider();
      await act(async () => {
        await userEvent.click(screen.getByRole('button', { name: 'ハイコントラストON' }));
      });
      expect(document.body.classList.contains('hc')).toBe(true);
    });

    it('ハイコントラストをオフにすると body から hc クラスが除去される', async () => {
      // まずONにしてからOFFにする
      renderWithProvider();
      await act(async () => {
        await userEvent.click(screen.getByRole('button', { name: 'ハイコントラストON' }));
      });
      expect(document.body.classList.contains('hc')).toBe(true);

      await act(async () => {
        await userEvent.click(screen.getByRole('button', { name: 'ハイコントラストOFF' }));
      });
      expect(document.body.classList.contains('hc')).toBe(false);
    });

    it('初期状態ではハイコントラストはオフである', () => {
      renderWithProvider();
      expect(screen.getByTestId('high-contrast').textContent).toBe('false');
      expect(document.body.classList.contains('hc')).toBe(false);
    });
  });

  describe('localStorage への永続化', () => {
    it('フォントサイズを変更すると localStorage に保存される', async () => {
      renderWithProvider();
      await act(async () => {
        await userEvent.click(screen.getByRole('button', { name: '大' }));
      });
      const stored = JSON.parse(localStorage.getItem('accessibility-settings') ?? '{}');
      expect(stored.fontSize).toBe('large');
    });

    it('ハイコントラストをオンにすると localStorage に保存される', async () => {
      renderWithProvider();
      await act(async () => {
        await userEvent.click(screen.getByRole('button', { name: 'ハイコントラストON' }));
      });
      const stored = JSON.parse(localStorage.getItem('accessibility-settings') ?? '{}');
      expect(stored.highContrast).toBe(true);
    });

    it('ハイコントラストをオフにすると localStorage から値が更新される', async () => {
      renderWithProvider();
      await act(async () => {
        await userEvent.click(screen.getByRole('button', { name: 'ハイコントラストON' }));
      });
      await act(async () => {
        await userEvent.click(screen.getByRole('button', { name: 'ハイコントラストOFF' }));
      });
      const stored = JSON.parse(localStorage.getItem('accessibility-settings') ?? '{}');
      expect(stored.highContrast).toBe(false);
    });
  });

  describe('初期表示時の保存値復元', () => {
    it('localStorage にフォントサイズが保存されていれば初期値として復元される', () => {
      localStorage.setItem(
        'accessibility-settings',
        JSON.stringify({ fontSize: 'large', highContrast: false }),
      );
      renderWithProvider();
      expect(screen.getByTestId('font-size').textContent).toBe('large');
    });

    it('localStorage にハイコントラスト設定が保存されていれば初期値として復元される', () => {
      localStorage.setItem(
        'accessibility-settings',
        JSON.stringify({ fontSize: 'medium', highContrast: true }),
      );
      renderWithProvider();
      expect(screen.getByTestId('high-contrast').textContent).toBe('true');
      expect(document.body.classList.contains('hc')).toBe(true);
    });

    it('localStorage に値がない場合はデフォルト値（中・ハイコントラストオフ）が使われる', () => {
      renderWithProvider();
      expect(screen.getByTestId('font-size').textContent).toBe('medium');
      expect(screen.getByTestId('high-contrast').textContent).toBe('false');
    });
  });

  describe('ProfilePage のアクセシビリティセクション UI', () => {
    it('ProfilePage の最下部にアクセシビリティセクションが表示される', () => {
      render(
        <AccessibilityProvider>
          <ProfilePage />
        </AccessibilityProvider>,
      );
      expect(screen.getByText('アクセシビリティ')).toBeInTheDocument();
    });

    it('フォントサイズ選択UI（小/中/大）が表示される', () => {
      render(
        <AccessibilityProvider>
          <ProfilePage />
        </AccessibilityProvider>,
      );
      expect(screen.getByLabelText('フォントサイズ')).toBeInTheDocument();
    });

    it('ハイコントラストモードのトグルが表示される', () => {
      render(
        <AccessibilityProvider>
          <ProfilePage />
        </AccessibilityProvider>,
      );
      expect(screen.getByLabelText('ハイコントラストモード')).toBeInTheDocument();
    });
  });
});
