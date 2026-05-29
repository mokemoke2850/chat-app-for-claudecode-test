/**
 * オフセットページング共通フック useOffsetPagination のテスト
 *
 * テスト対象: src/hooks/useOffsetPagination.ts
 * 戦略:
 *   - オフセットページング状態（offset/limit、ページ送り、total/hasNext/hasPrev 算出、
 *     フィルタ変更での offset リセット）を共通化するフック。
 *   - React 19 の use() + Suspense 構成に合わせ、本フックは安定化済みの fetchPromise と
 *     ページャ制御値を返す（items 自体は呼び出し側が use(fetchPromise) で読む）。
 *   - フェッチ関数を vi.fn で注入し、renderHook で状態遷移と呼び出し引数を検証する。
 *   - 複数コンポーネント（AuditLogView / SearchPage 等）が共用するため機能名ファイルとして配置する（AGENTS.md 準拠）。
 */

import { renderHook, waitFor, act } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { useOffsetPagination } from '../hooks/useOffsetPagination';
import type { OffsetPaged } from '@chat-app/shared';

type Row = { id: number };

function makePage(overrides: Partial<OffsetPaged<Row>> = {}): OffsetPaged<Row> {
  return { items: [{ id: 1 }], total: 100, limit: 10, offset: 0, ...overrides };
}

describe('useOffsetPagination（#375 一覧取得の共通パターン）', () => {
  it('初期状態で offset=0 のページを取得し total を保持する', async () => {
    const fetchPage = vi.fn().mockResolvedValue(makePage());
    const { result } = renderHook(() => useOffsetPagination(fetchPage, { q: 'x' }, { limit: 10 }));

    await waitFor(() => expect(result.current.total).toBe(100));
    expect(result.current.offset).toBe(0);
    expect(fetchPage).toHaveBeenCalledWith(
      expect.objectContaining({ q: 'x', limit: 10, offset: 0 }),
    );
  });

  it('nextPage で offset が limit 単位で進み再取得される', async () => {
    const fetchPage = vi.fn().mockResolvedValue(makePage());
    const { result } = renderHook(() => useOffsetPagination(fetchPage, { q: 'x' }, { limit: 10 }));
    await waitFor(() => expect(result.current.total).toBe(100));

    act(() => result.current.nextPage());

    await waitFor(() => expect(result.current.offset).toBe(10));
    expect(fetchPage).toHaveBeenLastCalledWith(expect.objectContaining({ offset: 10 }));
  });

  it('prevPage で offset が limit 単位で戻り、0 未満にはならない', async () => {
    const fetchPage = vi.fn().mockResolvedValue(makePage());
    const { result } = renderHook(() => useOffsetPagination(fetchPage, { q: 'x' }, { limit: 10 }));
    await waitFor(() => expect(result.current.total).toBe(100));

    act(() => result.current.nextPage());
    await waitFor(() => expect(result.current.offset).toBe(10));

    act(() => result.current.prevPage());
    await waitFor(() => expect(result.current.offset).toBe(0));

    // すでに先頭なので prevPage を呼んでも 0 のまま
    act(() => result.current.prevPage());
    expect(result.current.offset).toBe(0);
  });

  it('offset + limit < total のとき hasNext=true / offset>0 のとき hasPrev=true を返す', async () => {
    const fetchPage = vi.fn().mockResolvedValue(makePage({ total: 25, limit: 10 }));
    const { result } = renderHook(() => useOffsetPagination(fetchPage, { q: 'x' }, { limit: 10 }));
    await waitFor(() => expect(result.current.total).toBe(25));

    expect(result.current.hasPrev).toBe(false);
    expect(result.current.hasNext).toBe(true);

    act(() => result.current.nextPage());
    await waitFor(() => expect(result.current.offset).toBe(10));
    expect(result.current.hasPrev).toBe(true);
  });

  it('最終ページでは hasNext=false となり nextPage で範囲外に進まない', async () => {
    // total=10, limit=10 → 1ページのみ。offset 0 で hasNext=false
    const fetchPage = vi.fn().mockResolvedValue(makePage({ total: 10, limit: 10 }));
    const { result } = renderHook(() => useOffsetPagination(fetchPage, { q: 'x' }, { limit: 10 }));
    await waitFor(() => expect(result.current.total).toBe(10));

    expect(result.current.hasNext).toBe(false);
  });

  it('フィルタ依存が変わると offset を 0 にリセットして取得し直す', async () => {
    const fetchPage = vi.fn().mockResolvedValue(makePage());
    const { result, rerender } = renderHook(
      ({ filters }) => useOffsetPagination(fetchPage, filters, { limit: 10 }),
      { initialProps: { filters: { q: 'x' } } },
    );
    await waitFor(() => expect(result.current.total).toBe(100));

    act(() => result.current.nextPage());
    await waitFor(() => expect(result.current.offset).toBe(10));

    // フィルタ変更 → offset が 0 に戻り、新フィルタで再取得される
    rerender({ filters: { q: 'y' } });
    await waitFor(() => expect(result.current.offset).toBe(0));
    expect(fetchPage).toHaveBeenLastCalledWith(expect.objectContaining({ q: 'y', offset: 0 }));
  });
});
