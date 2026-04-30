/**
 * テスト対象: hooks/useTagSuggestions.ts (タグ候補取得フック)
 * 戦略:
 *   - api.tags.suggestions をモックし、prefix 変更時の再フェッチ・キャッシュ・
 *     エラーフォールバック挙動を検証する。
 *   - React 19 の use() + Suspense 構成のため、Probe を <Suspense> でラップする。
 *   - Suspense サスペンド解消は waitFor では不十分（react19-troubleshooting 参照）。
 *     render 自体を act(async) でラップしてサスペンド解消まで進める。
 *
 * NOTE: 入力デバウンスは TagInput 側の責務（Suspense 境界の外側）に分離した
 *       ため、本フックではテスト対象外（#177）。
 */

import React, { Suspense } from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import type { TagSuggestion } from '@chat-app/shared';
import { useTagSuggestions, _resetSuggestionsCacheForTest } from '../useTagSuggestions';

const suggestionsMock = vi.fn();
vi.mock('../../api/client', () => ({
  api: {
    tags: {
      suggestions: (prefix: string, limit: number) => suggestionsMock(prefix, limit),
    },
  },
}));

function Probe({ prefix, limit }: { prefix: string; limit?: number }) {
  const data = useTagSuggestions(prefix, limit);
  return React.createElement('div', { 'data-testid': 'probe' }, JSON.stringify(data));
}

function Wrap({ prefix, limit }: { prefix: string; limit?: number }) {
  return React.createElement(
    Suspense,
    { fallback: React.createElement('div', { 'data-testid': 'loading' }, 'loading') },
    React.createElement(Probe, { prefix, limit }),
  );
}

async function renderWithSuspense(ui: React.ReactElement) {
  let result!: ReturnType<typeof render>;
  await act(async () => {
    result = render(ui);
  });
  return result;
}

beforeEach(() => {
  suggestionsMock.mockReset();
  _resetSuggestionsCacheForTest();
});

describe('useTagSuggestions', () => {
  describe('初期取得', () => {
    it('マウント時に prefix なしで api.tags.suggestions が呼ばれる', async () => {
      suggestionsMock.mockResolvedValue({ suggestions: [] });
      await renderWithSuspense(React.createElement(Wrap, { prefix: '' }));
      expect(suggestionsMock).toHaveBeenCalledWith('', 10);
    });

    it('取得した候補配列が data として返る', async () => {
      const data: TagSuggestion[] = [{ id: 1, name: 'apple', useCount: 1 }];
      suggestionsMock.mockResolvedValue({ suggestions: data });
      await renderWithSuspense(React.createElement(Wrap, { prefix: 'data-key' }));
      expect(screen.getByTestId('probe').textContent).toBe(JSON.stringify(data));
    });
  });

  describe('prefix の変更', () => {
    it('prefix を変更すると新しい prefix で再フェッチされる', async () => {
      suggestionsMock.mockResolvedValue({ suggestions: [] });
      const { rerender } = await renderWithSuspense(React.createElement(Wrap, { prefix: '' }));
      expect(suggestionsMock).toHaveBeenCalledWith('', 10);

      await act(async () => {
        rerender(React.createElement(Wrap, { prefix: 'ap' }));
      });
      expect(suggestionsMock).toHaveBeenCalledWith('ap', 10);
    });

    it('同じ prefix への再要求はキャッシュから返り API は呼ばれない', async () => {
      const data: TagSuggestion[] = [{ id: 1, name: 'cached', useCount: 7 }];
      suggestionsMock.mockResolvedValue({ suggestions: data });
      const { unmount } = await renderWithSuspense(React.createElement(Wrap, { prefix: 'k' }));
      expect(screen.getByTestId('probe').textContent).toBe(JSON.stringify(data));
      const callsBefore = suggestionsMock.mock.calls.length;
      unmount();

      // 同じ prefix で再マウント → 内部 promiseCache からヒット
      await renderWithSuspense(React.createElement(Wrap, { prefix: 'k' }));
      expect(screen.getByTestId('probe').textContent).toBe(JSON.stringify(data));
      expect(suggestionsMock.mock.calls.length).toBe(callsBefore);
    });
  });

  describe('エラー処理', () => {
    it('API がエラーを投げた場合、空配列にフォールバックして UI を壊さない', async () => {
      suggestionsMock.mockRejectedValue(new Error('network error'));
      await renderWithSuspense(React.createElement(Wrap, { prefix: 'errkey' }));
      expect(screen.getByTestId('probe').textContent).toBe('[]');
    });
  });
});
