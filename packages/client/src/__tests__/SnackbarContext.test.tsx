/**
 * contexts/SnackbarContext.tsx のユニットテスト
 *
 * テスト対象: 全画面共通スナックバー通知機能
 * 戦略:
 *   - SnackbarProvider でラップしたコンポーネント内で useSnackbar を使用する
 *   - 成功・エラーメッセージの表示を検証する
 *   - 自動消去・手動クローズの動作を検証する
 */

import { render, screen, act, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderHook } from '@testing-library/react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { SnackbarProvider, useSnackbar } from '../contexts/SnackbarContext';

function TestComponent() {
  const { showSuccess, showError } = useSnackbar();
  return (
    <>
      <button onClick={() => showSuccess('保存しました')}>成功</button>
      <button onClick={() => showError('エラーが発生しました')}>エラー</button>
    </>
  );
}

function renderWithProvider() {
  return render(
    <SnackbarProvider>
      <TestComponent />
    </SnackbarProvider>,
  );
}

describe('SnackbarContext', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  describe('成功メッセージ表示', () => {
    it('showSuccess を呼ぶと成功スナックバーが表示される', async () => {
      renderWithProvider();
      await userEvent.click(screen.getByRole('button', { name: '成功' }));
      expect(screen.getByText('保存しました')).toBeInTheDocument();
    });

    it('成功スナックバーは一定時間後に自動で消える', async () => {
      vi.useFakeTimers();
      renderWithProvider();

      fireEvent.click(screen.getByRole('button', { name: '成功' }));
      expect(screen.getByText('保存しました')).toBeInTheDocument();

      // autoHideDuration タイマー発火 → onClose → open: false
      await act(async () => {
        vi.runAllTimers();
      });
      // Fade transition (timeout: 0) の退場タイマー発火 → unmount
      await act(async () => {
        vi.runAllTimers();
      });
      expect(screen.queryByText('保存しました')).not.toBeInTheDocument();
    });
  });

  describe('エラーメッセージ表示', () => {
    it('showError を呼ぶとエラースナックバーが表示される', async () => {
      renderWithProvider();
      await userEvent.click(screen.getByRole('button', { name: 'エラー' }));
      expect(screen.getByText('エラーが発生しました')).toBeInTheDocument();
    });
  });

  describe('クローズ動作', () => {
    it('クローズボタンをクリックするとスナックバーが消える', async () => {
      renderWithProvider();
      await userEvent.click(screen.getByRole('button', { name: '成功' }));
      expect(screen.getByText('保存しました')).toBeInTheDocument();

      const closeButton = screen.getByRole('button', { name: /close/i });
      await userEvent.click(closeButton);
      await waitFor(() => {
        expect(screen.queryByText('保存しました')).not.toBeInTheDocument();
      });
    });
  });

  describe('useSnackbar フック', () => {
    it('SnackbarProvider の外で useSnackbar を呼ぶとエラーが投げられる', () => {
      expect(() => renderHook(() => useSnackbar())).toThrow(
        'useSnackbar must be used inside SnackbarProvider',
      );
    });
  });
});
