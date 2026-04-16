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
});

afterEach(() => {
  vi.restoreAllMocks();
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
    it('ダークモードに切り替えるとlocalStorageに設定が保存される', async () => {
      mockMatchMedia(false);
      renderWithTheme();
      await act(async () => {
        await userEvent.click(screen.getByRole('button', { name: 'トグル' }));
      });
      expect(localStorage.getItem('theme-mode')).toBe('dark');
    });

    it('ライトモードに切り替えるとlocalStorageに設定が保存される', async () => {
      mockMatchMedia(true);
      renderWithTheme();
      await act(async () => {
        await userEvent.click(screen.getByRole('button', { name: 'トグル' }));
      });
      expect(localStorage.getItem('theme-mode')).toBe('light');
    });
  });

  describe('設定の引き継ぎ', () => {
    it('localStorageにダークモードの設定がある場合、次回アクセス時にダークモードが適用される', () => {
      mockMatchMedia(false);
      localStorage.setItem('theme-mode', 'dark');
      renderWithTheme();
      expect(screen.getByTestId('mode').textContent).toBe('dark');
    });

    it('localStorageにライトモードの設定がある場合、次回アクセス時にライトモードが適用される', () => {
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
});
