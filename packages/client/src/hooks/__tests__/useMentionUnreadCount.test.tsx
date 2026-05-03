/**
 * テスト対象: hooks/useMentionUnreadCount.ts (Step 6d / 保留 TODO #5)
 *
 * Rail のホームアイコン (Inbox) に出すメンション未読数バッジ用集計フック。
 * Step 6b で追加した `api.messages.search('', { mentionedToMe: true, unreadOnly: true })`
 * を再利用して count を取得する。
 *
 * 戦略:
 *   - api.messages.search をモックして件数を制御する
 *   - 現在パスが Inbox (ホーム `/`) のときは count を 0 に潰す（自分が見ている画面に
 *     バッジを出すと冗長になるため）
 */

import { renderHook, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import type { ReactNode } from 'react';
import { useMentionUnreadCount } from '../useMentionUnreadCount';

const mockSearch = vi.fn();

vi.mock('../../api/client', () => ({
  api: {
    messages: {
      search: (q: string, filters: unknown) => mockSearch(q, filters),
    },
  },
}));

function wrapperFactory(initialPath: string) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return <MemoryRouter initialEntries={[initialPath]}>{children}</MemoryRouter>;
  };
}

beforeEach(() => {
  mockSearch.mockReset();
});

describe('useMentionUnreadCount (Step 6d)', () => {
  it('初回マウント時に api.messages.search を mentionedToMe / unreadOnly フィルタで呼ぶ', async () => {
    mockSearch.mockResolvedValue({ messages: [] });
    renderHook(() => useMentionUnreadCount(), { wrapper: wrapperFactory('/chat') });
    await waitFor(() => {
      expect(mockSearch).toHaveBeenCalledWith('', { mentionedToMe: true, unreadOnly: true });
    });
  });

  it('レスポンスの messages.length をカウントとして返す', async () => {
    mockSearch.mockResolvedValue({
      messages: [{ id: 1 }, { id: 2 }, { id: 3 }],
    });
    const { result } = renderHook(() => useMentionUnreadCount(), {
      wrapper: wrapperFactory('/chat'),
    });
    await waitFor(() => {
      expect(result.current).toBe(3);
    });
  });

  it('現在パスが / (Inbox) のときは 0 を返す（内部 state は保持）', async () => {
    mockSearch.mockResolvedValue({ messages: [{ id: 1 }, { id: 2 }] });
    const { result } = renderHook(() => useMentionUnreadCount(), {
      wrapper: wrapperFactory('/'),
    });
    // API は呼ばれるが、location が '/' のため count は 0
    await waitFor(() => {
      expect(mockSearch).toHaveBeenCalled();
    });
    expect(result.current).toBe(0);
  });

  it('API が失敗した場合は 0 を返す（throw しない）', async () => {
    mockSearch.mockRejectedValue(new Error('boom'));
    const { result } = renderHook(() => useMentionUnreadCount(), {
      wrapper: wrapperFactory('/chat'),
    });
    // 失敗後も throw せず 0 のまま
    await waitFor(() => {
      expect(mockSearch).toHaveBeenCalled();
    });
    expect(result.current).toBe(0);
  });
});
