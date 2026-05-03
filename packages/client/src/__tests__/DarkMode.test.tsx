/**
 * ダークモード機能のユニットテスト
 *
 * テスト対象: ダーク/ライトモード切り替え機能
 * 戦略:
 *   - OSのカラースキーム（prefers-color-scheme）をモックして初期値を検証する
 *   - localStorageをモックして設定の永続化を検証する
 *   - ユーザー操作によるモード切り替えを検証する
 */

import { render, screen, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ThemeProvider, useTheme } from '../contexts/ThemeContext';

/** テスト用: useThemeの値を表示するコンポーネント */
function ThemeDisplay() {
  const { mode, toggleTheme } = useTheme();
  return (
    <div>
      <span data-testid="mode">{mode}</span>
      <button onClick={toggleTheme}>トグル</button>
    </div>
  );
}

function renderWithTheme() {
  return render(
    <ThemeProvider>
      <ThemeDisplay />
    </ThemeProvider>,
  );
}

/** matchMedia をモックするヘルパー */
function mockMatchMedia(prefersDark: boolean) {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn((query: string) => ({
      matches: query === '(prefers-color-scheme: dark)' ? prefersDark : false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
}

beforeEach(() => {
  localStorage.clear();
  document.documentElement.removeAttribute('data-theme');
});

afterEach(() => {
  vi.restoreAllMocks();
  document.documentElement.removeAttribute('data-theme');
});

describe('ダークモード機能', () => {
  describe('初期値の反映', () => {
    it('OSのカラースキームがダークの場合、ダークモードをデフォルトとして反映する', () => {
      mockMatchMedia(true);
      renderWithTheme();
      expect(screen.getByTestId('mode').textContent).toBe('dark');
    });

    it('OSのカラースキームがライトの場合、ライトモードをデフォルトとして反映する', () => {
      mockMatchMedia(false);
      renderWithTheme();
      expect(screen.getByTestId('mode').textContent).toBe('light');
    });
  });

  describe('モード切り替え', () => {
    it('トグルボタンをクリックするとダークモードからライトモードに切り替わる', async () => {
      mockMatchMedia(true);
      renderWithTheme();
      expect(screen.getByTestId('mode').textContent).toBe('dark');
      await act(async () => {
        await userEvent.click(screen.getByRole('button', { name: 'トグル' }));
      });
      expect(screen.getByTestId('mode').textContent).toBe('light');
    });

    it('トグルボタンをクリックするとライトモードからダークモードに切り替わる', async () => {
      mockMatchMedia(false);
      renderWithTheme();
      expect(screen.getByTestId('mode').textContent).toBe('light');
      await act(async () => {
        await userEvent.click(screen.getByRole('button', { name: 'トグル' }));
      });
      expect(screen.getByTestId('mode').textContent).toBe('dark');
    });
  });

  describe('設定の永続化', () => {
    it('トグル操作でlocalStorageに設定が保存される（ダーク・ライト両方を検証）', async () => {
      // ライト→ダーク
      mockMatchMedia(false);
      const { unmount } = renderWithTheme();
      await act(async () => {
        await userEvent.click(screen.getByRole('button', { name: 'トグル' }));
      });
      expect(localStorage.getItem('theme-mode')).toBe('dark');

      unmount();
      localStorage.clear();

      // ダーク→ライト
      mockMatchMedia(true);
      renderWithTheme();
      await act(async () => {
        await userEvent.click(screen.getByRole('button', { name: 'トグル' }));
      });
      expect(localStorage.getItem('theme-mode')).toBe('light');
    });
  });

  describe('設定の引き継ぎ', () => {
    it('localStorageの設定値（dark/light）が次回アクセス時に反映される', () => {
      // dark設定が保存されている場合
      mockMatchMedia(false);
      localStorage.setItem('theme-mode', 'dark');
      const { unmount } = renderWithTheme();
      expect(screen.getByTestId('mode').textContent).toBe('dark');

      unmount();
      localStorage.clear();

      // light設定が保存されている場合
      mockMatchMedia(true);
      localStorage.setItem('theme-mode', 'light');
      renderWithTheme();
      expect(screen.getByTestId('mode').textContent).toBe('light');
    });

    it('localStorageに設定がない場合、OSのカラースキームをデフォルトとして使用する', () => {
      mockMatchMedia(true);
      renderWithTheme();
      expect(screen.getByTestId('mode').textContent).toBe('dark');
    });
  });

  describe('<html data-theme> 属性出力（Step 1: トークン刷新で追加）', () => {
    it('初期マウント時に OS がダークなら <html data-theme="dark"> が設定される', () => {
      mockMatchMedia(true);
      renderWithTheme();
      expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
    });

    it('初期マウント時に OS がライトなら <html data-theme="light"> が設定される', () => {
      mockMatchMedia(false);
      renderWithTheme();
      expect(document.documentElement.getAttribute('data-theme')).toBe('light');
    });

    it('localStorage に dark が保存されている場合、初期マウント時に <html data-theme="dark"> が設定される', () => {
      mockMatchMedia(false);
      localStorage.setItem('theme-mode', 'dark');
      renderWithTheme();
      expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
    });

    it('localStorage に light が保存されている場合、初期マウント時に <html data-theme="light"> が設定される', () => {
      mockMatchMedia(true);
      localStorage.setItem('theme-mode', 'light');
      renderWithTheme();
      expect(document.documentElement.getAttribute('data-theme')).toBe('light');
    });

    it('toggleTheme で dark→light に切り替えると <html data-theme> が "light" に更新される', async () => {
      mockMatchMedia(true);
      renderWithTheme();
      expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
      await act(async () => {
        await userEvent.click(screen.getByRole('button', { name: 'トグル' }));
      });
      expect(document.documentElement.getAttribute('data-theme')).toBe('light');
    });

    it('toggleTheme で light→dark に切り替えると <html data-theme> が "dark" に更新される', async () => {
      mockMatchMedia(false);
      renderWithTheme();
      expect(document.documentElement.getAttribute('data-theme')).toBe('light');
      await act(async () => {
        await userEvent.click(screen.getByRole('button', { name: 'トグル' }));
      });
      expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
    });

    it('複数回 toggleTheme しても <html data-theme> が常に最新の mode と一致する', async () => {
      mockMatchMedia(false);
      renderWithTheme();
      const button = screen.getByRole('button', { name: 'トグル' });

      expect(document.documentElement.getAttribute('data-theme')).toBe('light');

      await act(async () => {
        await userEvent.click(button);
      });
      expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
      expect(screen.getByTestId('mode').textContent).toBe('dark');

      await act(async () => {
        await userEvent.click(button);
      });
      expect(document.documentElement.getAttribute('data-theme')).toBe('light');
      expect(screen.getByTestId('mode').textContent).toBe('light');

      await act(async () => {
        await userEvent.click(button);
      });
      expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
      expect(screen.getByTestId('mode').textContent).toBe('dark');
    });
  });
});
