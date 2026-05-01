// テスト対象: hooks/useScheduledMessages.ts (#110)
// 戦略:
//   - React 19 の use() + Suspense パターンでの fetch Promise 生成ロジックを検証
//   - Promise は useState/useMemo で安定化させており、再レンダーで再生成されないことを確認
//   - list / create / update / cancel のラッパ関数を経由してキャッシュが更新されることを確認

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import type { ScheduledMessage } from '@chat-app/shared';
import { useScheduledMessages } from '../hooks/useScheduledMessages';

const listMock = vi.fn();
const createMock = vi.fn();
const updateMock = vi.fn();
const cancelMock = vi.fn();
vi.mock('../api/client', () => ({
  api: {
    scheduledMessages: {
      list: () => listMock(),
      create: (input: unknown) => createMock(input),
      update: (id: number, patch: unknown) => updateMock(id, patch),
      cancel: (id: number) => cancelMock(id),
    },
  },
}));

function makeScheduledMessage(overrides: Partial<ScheduledMessage> = {}): ScheduledMessage {
  return {
    id: 1,
    userId: 1,
    channelId: 1,
    content: 'test',
    scheduledAt: '2030-01-01T10:00:00.000Z',
    status: 'pending',
    error: null,
    sentMessageId: null,
    attachments: [],
    createdAt: '',
    updatedAt: '',
    ...overrides,
  };
}

beforeEach(() => {
  listMock.mockReset().mockResolvedValue({ scheduledMessages: [] });
  createMock.mockReset();
  updateMock.mockReset();
  cancelMock.mockReset();
});

describe('useScheduledMessages', () => {
  describe('初回フェッチ', () => {
    it('マウント時に api.scheduledMessages.list が1回だけ呼ばれる', () => {
      renderHook(() => useScheduledMessages());
      expect(listMock).toHaveBeenCalledTimes(1);
    });

    it('同じコンポーネントが再レンダーされても list は追加で呼ばれない（Promise が安定している）', () => {
      const { rerender } = renderHook(() => useScheduledMessages());
      listMock.mockClear();
      rerender();
      rerender();
      expect(listMock).not.toHaveBeenCalled();
    });
  });

  describe('作成', () => {
    it('create() を呼ぶと api.scheduledMessages.create が呼ばれ、キャッシュが再取得される', async () => {
      const created = makeScheduledMessage({ id: 7 });
      createMock.mockResolvedValue({ scheduledMessage: created });
      const { result } = renderHook(() => useScheduledMessages());
      listMock.mockClear();
      await act(async () => {
        await result.current.create({
          channelId: 1,
          content: 'hi',
          scheduledAt: '2030-01-01T10:00:00.000Z',
        });
      });
      expect(createMock).toHaveBeenCalledWith(
        expect.objectContaining({ channelId: 1, content: 'hi' }),
      );
      // create 成功後に refresh で list が再実行される
      expect(listMock).toHaveBeenCalledTimes(1);
    });
  });

  describe('更新', () => {
    it('update(id, patch) を呼ぶと api.scheduledMessages.update が呼ばれ、キャッシュが更新される', async () => {
      const updated = makeScheduledMessage({ id: 5, content: 'updated' });
      updateMock.mockResolvedValue({ scheduledMessage: updated });
      const { result } = renderHook(() => useScheduledMessages());
      listMock.mockClear();
      await act(async () => {
        await result.current.update(5, { content: 'updated' });
      });
      expect(updateMock).toHaveBeenCalledWith(5, { content: 'updated' });
      expect(listMock).toHaveBeenCalledTimes(1);
    });
  });

  describe('キャンセル', () => {
    it('cancel(id) を呼ぶと api.scheduledMessages.cancel が呼ばれ、該当要素のステータスが canceled になる', async () => {
      const before = makeScheduledMessage({ id: 3, status: 'pending' });
      const after = makeScheduledMessage({ id: 3, status: 'canceled' });
      // 初回は pending、refresh 後は canceled を返す
      listMock
        .mockResolvedValueOnce({ scheduledMessages: [before] })
        .mockResolvedValueOnce({ scheduledMessages: [after] });
      cancelMock.mockResolvedValue({ scheduledMessage: after });

      const { result } = renderHook(() => useScheduledMessages());
      const initial = await result.current.promise;
      expect(initial[0].status).toBe('pending');

      await act(async () => {
        await result.current.cancel(3);
      });
      expect(cancelMock).toHaveBeenCalledWith(3);

      const refreshed = await result.current.promise;
      expect(refreshed[0].status).toBe('canceled');
    });
  });

  describe('リフレッシュ', () => {
    it('refresh() で list を再実行する（Socket で別タブから更新があったとき用）', () => {
      const { result } = renderHook(() => useScheduledMessages());
      listMock.mockClear();
      act(() => {
        result.current.refresh();
      });
      expect(listMock).toHaveBeenCalledTimes(1);
    });
  });
});
