/**
 * テスト対象: useLocalTime hook（#306）
 *
 * 役割:
 *   - 指定した IANA タイムゾーンに基づいて、現在のローカル時刻文字列と
 *     深夜帯判定フラグを返す
 *   - timezone 未設定時は formatted: null を返し、呼び出し側で表示を抑制できる
 *   - 1分ごとに値が更新される
 *
 * 戦略:
 *   - vi.useFakeTimers() で UTC 基準の時刻を固定
 *   - timezone を Asia/Tokyo / America/New_York / UTC で切り替えて検証
 *   - setInterval を vi.advanceTimersByTime で進めて再計算が走ることを確認
 */

import { renderHook, act } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useLocalTime } from '../useLocalTime';

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('useLocalTime', () => {
  describe('正常系', () => {
    it('timezone "Asia/Tokyo" を渡すと JST の時刻文字列を返す', () => {
      // UTC 04:30 → JST 13:30
      vi.setSystemTime(new Date('2026-05-10T04:30:00Z'));
      const { result } = renderHook(() => useLocalTime('Asia/Tokyo'));
      expect(result.current.formatted).toBe('13:30');
      expect(result.current.isLateNight).toBe(false);
    });

    it('timezone "America/New_York" を渡すと EST/EDT の時刻文字列を返す', () => {
      // 2026-05-10 は EDT (UTC-4)。UTC 16:00 → EDT 12:00
      vi.setSystemTime(new Date('2026-05-10T16:00:00Z'));
      const { result } = renderHook(() => useLocalTime('America/New_York'));
      expect(result.current.formatted).toBe('12:00');
      expect(result.current.isLateNight).toBe(false);
    });

    it('timezone "UTC" を渡すと UTC の時刻文字列を返す', () => {
      vi.setSystemTime(new Date('2026-05-10T10:15:00Z'));
      const { result } = renderHook(() => useLocalTime('UTC'));
      expect(result.current.formatted).toBe('10:15');
    });

    it('返却値は { localTime, formatted, isLateNight } 構造になっている', () => {
      vi.setSystemTime(new Date('2026-05-10T10:00:00Z'));
      const { result } = renderHook(() => useLocalTime('UTC'));
      expect(result.current).toEqual(
        expect.objectContaining({
          localTime: expect.any(Date),
          formatted: expect.any(String),
          isLateNight: expect.any(Boolean),
        }),
      );
    });
  });

  describe('未設定 / 異常系', () => {
    it('timezone が null のときは formatted/localTime が null になる', () => {
      const { result } = renderHook(() => useLocalTime(null));
      expect(result.current.formatted).toBeNull();
      expect(result.current.localTime).toBeNull();
      expect(result.current.isLateNight).toBe(false);
    });

    it('timezone が undefined のときは formatted/localTime が null になる', () => {
      const { result } = renderHook(() => useLocalTime(undefined));
      expect(result.current.formatted).toBeNull();
      expect(result.current.localTime).toBeNull();
    });

    it('timezone が空文字のときは formatted/localTime が null になる', () => {
      const { result } = renderHook(() => useLocalTime(''));
      expect(result.current.formatted).toBeNull();
      expect(result.current.localTime).toBeNull();
    });

    it('不正な IANA 値（例: "Foo/Bar"）を渡してもスローせず null を返す', () => {
      vi.setSystemTime(new Date('2026-05-10T10:00:00Z'));
      const { result } = renderHook(() => useLocalTime('Foo/Bar'));
      expect(result.current.formatted).toBeNull();
      expect(result.current.localTime).toBeNull();
      expect(result.current.isLateNight).toBe(false);
    });
  });

  describe('深夜帯判定', () => {
    it('現在時刻が 22:00 のとき isLateNight が true になる', () => {
      // UTC 22:00 を UTC タイムゾーンで見ると 22:00
      vi.setSystemTime(new Date('2026-05-10T22:00:00Z'));
      const { result } = renderHook(() => useLocalTime('UTC'));
      expect(result.current.isLateNight).toBe(true);
    });

    it('現在時刻が 0:00 のとき isLateNight が true になる', () => {
      vi.setSystemTime(new Date('2026-05-10T00:00:00Z'));
      const { result } = renderHook(() => useLocalTime('UTC'));
      expect(result.current.isLateNight).toBe(true);
    });

    it('現在時刻が 6:59 のとき isLateNight が true になる', () => {
      vi.setSystemTime(new Date('2026-05-10T06:59:00Z'));
      const { result } = renderHook(() => useLocalTime('UTC'));
      expect(result.current.isLateNight).toBe(true);
    });

    it('現在時刻が 7:00 のとき isLateNight が false になる', () => {
      vi.setSystemTime(new Date('2026-05-10T07:00:00Z'));
      const { result } = renderHook(() => useLocalTime('UTC'));
      expect(result.current.isLateNight).toBe(false);
    });

    it('現在時刻が 12:00 のとき isLateNight が false になる', () => {
      vi.setSystemTime(new Date('2026-05-10T12:00:00Z'));
      const { result } = renderHook(() => useLocalTime('UTC'));
      expect(result.current.isLateNight).toBe(false);
    });

    it('現在時刻が 21:59 のとき isLateNight が false になる', () => {
      vi.setSystemTime(new Date('2026-05-10T21:59:00Z'));
      const { result } = renderHook(() => useLocalTime('UTC'));
      expect(result.current.isLateNight).toBe(false);
    });
  });

  describe('時間経過による更新', () => {
    it('1分経過すると返却される time が更新される', () => {
      vi.setSystemTime(new Date('2026-05-10T10:00:00Z'));
      const { result } = renderHook(() => useLocalTime('UTC'));
      expect(result.current.formatted).toBe('10:00');

      // advanceTimersByTime はシステム時刻も同時に進めるので、
      // 60秒進めれば自動的に 10:01 になる
      act(() => {
        vi.advanceTimersByTime(60_000);
      });
      expect(result.current.formatted).toBe('10:01');
    });

    it('22:00 を跨ぐと isLateNight が false → true に切り替わる', () => {
      vi.setSystemTime(new Date('2026-05-10T21:59:00Z'));
      const { result } = renderHook(() => useLocalTime('UTC'));
      expect(result.current.isLateNight).toBe(false);

      act(() => {
        vi.advanceTimersByTime(60_000);
      });
      expect(result.current.isLateNight).toBe(true);
    });

    it('7:00 を跨ぐと isLateNight が true → false に切り替わる', () => {
      vi.setSystemTime(new Date('2026-05-10T06:59:00Z'));
      const { result } = renderHook(() => useLocalTime('UTC'));
      expect(result.current.isLateNight).toBe(true);

      act(() => {
        vi.advanceTimersByTime(60_000);
      });
      expect(result.current.isLateNight).toBe(false);
    });

    it('アンマウント時にタイマーがクリアされる（メモリリークしない）', () => {
      const clearSpy = vi.spyOn(globalThis, 'clearInterval');
      vi.setSystemTime(new Date('2026-05-10T10:00:00Z'));
      const { unmount } = renderHook(() => useLocalTime('UTC'));
      unmount();
      expect(clearSpy).toHaveBeenCalled();
      clearSpy.mockRestore();
    });
  });

  describe('引数変更', () => {
    it('timezone を変更すると即座に新しいタイムゾーンの時刻に切り替わる', () => {
      // UTC 04:30 → JST 13:30, NY (EDT) 00:30
      vi.setSystemTime(new Date('2026-05-10T04:30:00Z'));
      const { result, rerender } = renderHook(({ tz }: { tz: string }) => useLocalTime(tz), {
        initialProps: { tz: 'Asia/Tokyo' },
      });
      expect(result.current.formatted).toBe('13:30');

      rerender({ tz: 'UTC' });
      expect(result.current.formatted).toBe('04:30');
    });

    it('timezone を null から有効値に変えると null から時刻文字列に切り替わる', () => {
      vi.setSystemTime(new Date('2026-05-10T10:00:00Z'));
      const { result, rerender } = renderHook(({ tz }: { tz: string | null }) => useLocalTime(tz), {
        initialProps: { tz: null as string | null },
      });
      expect(result.current.formatted).toBeNull();

      rerender({ tz: 'UTC' });
      expect(result.current.formatted).toBe('10:00');
    });

    it('timezone を有効値から null に変えると null に切り替わる', () => {
      vi.setSystemTime(new Date('2026-05-10T10:00:00Z'));
      const { result, rerender } = renderHook(({ tz }: { tz: string | null }) => useLocalTime(tz), {
        initialProps: { tz: 'UTC' as string | null },
      });
      expect(result.current.formatted).toBe('10:00');

      rerender({ tz: null });
      expect(result.current.formatted).toBeNull();
    });
  });
});
