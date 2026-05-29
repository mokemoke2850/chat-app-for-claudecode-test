/**
 * api/client.ts のユニットテスト
 *
 * テスト対象: fetch ラッパー関数 `request` および `api` オブジェクト
 * 戦略: グローバルの fetch を vi.stubGlobal でモックし、
 *       実際のネットワーク通信を行わずにロジックだけを検証する
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { api, setRateLimitErrorHandler } from '../api/client';

// fetch のレスポンスを組み立てるヘルパー
function mockFetch(body: unknown, status = 200) {
  return vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
  });
}

beforeEach(() => {
  vi.restoreAllMocks();
});

describe('request (fetch ラッパー)', () => {
  describe('正常系', () => {
    it('200 レスポンスのとき JSON をパースして返す', async () => {
      vi.stubGlobal('fetch', mockFetch({ user: { id: 1, username: 'alice' } }));

      const result = await api.auth.me();

      // fetch が正しいエンドポイントで呼ばれていること
      expect(fetch).toHaveBeenCalledWith(
        '/api/auth/me',
        expect.objectContaining({ credentials: 'include' }),
      );
      expect(result.user.username).toBe('alice');
    });

    it('204 No Content のとき undefined を返す', async () => {
      // status=204 のとき json() は呼ばれず undefined を返す実装になっている
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, status: 204 }));

      const result = await api.auth.logout();

      expect(result).toBeUndefined();
    });
  });

  describe('エラー系', () => {
    it('レスポンスが ok でないとき、ボディの error フィールドをメッセージに持つ Error を throw する', async () => {
      vi.stubGlobal('fetch', mockFetch({ error: 'Invalid credentials' }, 401));

      await expect(api.auth.login({ email: 'x@x.com', password: 'wrong' })).rejects.toThrow(
        'Invalid credentials',
      );
    });

    it('error フィールドがないエラーレスポンスのとき "Request failed" を throw する', async () => {
      vi.stubGlobal('fetch', mockFetch({}, 500));

      await expect(api.auth.me()).rejects.toThrow('Request failed');
    });
  });

  // #372 統一エラー形式 { error: { code, message, details? } } への対応
  describe('エラー系（#372 統一エラー形式）', () => {
    it('error が { code, message } オブジェクトのとき message を持つ Error を throw する', async () => {
      vi.stubGlobal(
        'fetch',
        mockFetch({ error: { code: 'NOT_FOUND', message: '見つかりません' } }, 404),
      );

      await expect(api.auth.me()).rejects.toThrow('見つかりません');
    });

    it('error.code を Error のプロパティとして保持する（フロントが code で分岐できる）', async () => {
      vi.stubGlobal('fetch', mockFetch({ error: { code: 'FORBIDDEN', message: '権限なし' } }, 403));

      await expect(api.auth.me()).rejects.toMatchObject({ code: 'FORBIDDEN' });
    });

    it('旧来の文字列 error にもフォールバックして message に使う（後方互換・防御的）', async () => {
      vi.stubGlobal('fetch', mockFetch({ error: 'legacy string error' }, 400));

      await expect(api.auth.me()).rejects.toThrow('legacy string error');
    });

    it('新形式でもない・文字列でもないときは "Request failed" を使う', async () => {
      vi.stubGlobal('fetch', mockFetch({ error: {} }, 500));

      await expect(api.auth.me()).rejects.toThrow('Request failed');
    });

    it('429 のとき error.message と retryAfterSec でレート制限ハンドラを呼ぶ', async () => {
      const handler = vi.fn();
      setRateLimitErrorHandler(handler);
      vi.stubGlobal('fetch', mockFetch({ error: 'レート制限です', retryAfterSec: 30 }, 429));

      await expect(api.auth.me()).rejects.toThrow('レート制限です');
      expect(handler).toHaveBeenCalledWith(expect.stringContaining('30秒後'));
    });
  });
});

describe('api.auth', () => {
  it('login は POST /api/auth/login を呼び出す', async () => {
    vi.stubGlobal('fetch', mockFetch({ user: { id: 1 } }));

    await api.auth.login({ email: 'a@b.com', password: 'pass' });

    expect(fetch).toHaveBeenCalledWith(
      '/api/auth/login',
      expect.objectContaining({ method: 'POST' }),
    );
  });

  it('logout は POST /api/auth/logout を呼び出す', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, status: 204 }));

    await api.auth.logout();

    expect(fetch).toHaveBeenCalledWith(
      '/api/auth/logout',
      expect.objectContaining({ method: 'POST' }),
    );
  });

  it('me は GET /api/auth/me を呼び出す', async () => {
    vi.stubGlobal('fetch', mockFetch({ user: { id: 1 } }));

    await api.auth.me();

    // GET はデフォルトなので method 指定なし（またはなし）で呼ばれる
    expect(fetch).toHaveBeenCalledWith('/api/auth/me', expect.objectContaining({}));
  });
});

describe('api.messages.list', () => {
  it('limit と before のクエリパラメータを URL に付与する', async () => {
    vi.stubGlobal('fetch', mockFetch({ messages: [] }));

    await api.messages.list(1, { limit: 20, before: 100 });

    const calledUrl = (fetch as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
    expect(calledUrl).toContain('limit=20');
    expect(calledUrl).toContain('before=100');
  });

  it('before を省略した場合はクエリパラメータを付与しない', async () => {
    vi.stubGlobal('fetch', mockFetch({ messages: [] }));

    await api.messages.list(1, { limit: 50 });

    const calledUrl = (fetch as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
    expect(calledUrl).not.toContain('before=');
  });
});

describe('api.messages.search', () => {
  it('q をクエリパラメータとして付与する', async () => {
    vi.stubGlobal('fetch', mockFetch({ messages: [] }));

    await api.messages.search('hello');

    const calledUrl = (fetch as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
    expect(calledUrl).toContain('/api/messages/search?');
    expect(calledUrl).toContain('q=hello');
  });

  it('tagIds が指定された場合はカンマ区切り文字列としてクエリに付与する (#115)', async () => {
    vi.stubGlobal('fetch', mockFetch({ messages: [] }));

    await api.messages.search('hello', { tagIds: [10, 11] });

    const calledUrl = (fetch as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
    // URLSearchParams は "," を %2C にエンコードするため両方をデコードして比較する
    const decoded = decodeURIComponent(calledUrl);
    expect(decoded).toContain('tagIds=10,11');
  });

  it('tagIds が空配列の場合はクエリに付与しない', async () => {
    vi.stubGlobal('fetch', mockFetch({ messages: [] }));

    await api.messages.search('hello', { tagIds: [] });

    const calledUrl = (fetch as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
    expect(calledUrl).not.toContain('tagIds=');
  });

  it('tagIds が undefined の場合はクエリに付与しない', async () => {
    vi.stubGlobal('fetch', mockFetch({ messages: [] }));

    await api.messages.search('hello', { dateFrom: '2024-01-01' });

    const calledUrl = (fetch as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
    expect(calledUrl).not.toContain('tagIds=');
    expect(calledUrl).toContain('dateFrom=2024-01-01');
  });
});

// #375 ページング仕様統一: API クライアントが標準封筒を返す
describe('api ページング封筒（#375）', () => {
  it('api.messages.list が CursorPaged（items / nextCursor / hasMore）を返す', async () => {
    vi.stubGlobal('fetch', mockFetch({ items: [{ id: 1 }], nextCursor: '1', hasMore: true }));

    const res = await api.messages.list(1, { limit: 50 });

    expect(res.items).toEqual([{ id: 1 }]);
    expect(res.nextCursor).toBe('1');
    expect(res.hasMore).toBe(true);
  });

  it('api.messages.list が cursor（before）と limit をクエリに付与する', async () => {
    vi.stubGlobal('fetch', mockFetch({ items: [], nextCursor: null, hasMore: false }));

    await api.messages.list(1, { limit: 30, before: '99' });

    const calledUrl = (fetch as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
    expect(calledUrl).toContain('limit=30');
    expect(calledUrl).toContain('before=99');
  });

  it('api.messages.search が OffsetPaged（items / total / limit / offset）を返す', async () => {
    vi.stubGlobal('fetch', mockFetch({ items: [{ id: 5 }], total: 12, limit: 50, offset: 0 }));

    const res = await api.messages.search('hello');

    expect(res.items).toEqual([{ id: 5 }]);
    expect(res.total).toBe(12);
    expect(res.limit).toBe(50);
    expect(res.offset).toBe(0);
  });

  it('api.messages.search が limit / offset をクエリに付与できる', async () => {
    vi.stubGlobal('fetch', mockFetch({ items: [], total: 0, limit: 10, offset: 20 }));

    await api.messages.search('hello', { limit: 10, offset: 20 });

    const calledUrl = (fetch as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
    expect(calledUrl).toContain('limit=10');
    expect(calledUrl).toContain('offset=20');
  });

  it('api.admin.getAuditLogs が OffsetPaged（items / total / limit / offset）を返す', async () => {
    vi.stubGlobal('fetch', mockFetch({ items: [{ id: 1 }], total: 3, limit: 50, offset: 0 }));

    const res = await api.admin.getAuditLogs();

    expect(res.items).toEqual([{ id: 1 }]);
    expect(res.total).toBe(3);
    expect(res.limit).toBe(50);
    expect(res.offset).toBe(0);
  });
});

// #386 カーソル系へ移行した残りの API クライアント封筒
describe('api カーソル封筒の追従移行（#386）', () => {
  it('api.dm.getMessages が CursorPaged（items / nextCursor / hasMore）を返す', async () => {
    vi.stubGlobal('fetch', mockFetch({ items: [{ id: 1 }], nextCursor: '1', hasMore: true }));

    const res = await api.dm.getMessages(7, { limit: 50 });

    expect(res.items).toEqual([{ id: 1 }]);
    expect(res.nextCursor).toBe('1');
    expect(res.hasMore).toBe(true);
  });

  it('api.dm.getMessages が limit / before をクエリに付与する', async () => {
    vi.stubGlobal('fetch', mockFetch({ items: [], nextCursor: null, hasMore: false }));

    await api.dm.getMessages(7, { limit: 30, before: '99' });

    const calledUrl = (fetch as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
    expect(calledUrl).toContain('limit=30');
    expect(calledUrl).toContain('before=99');
  });

  it('api.messages.getReplies が CursorPaged（items / nextCursor / hasMore）を返す', async () => {
    vi.stubGlobal('fetch', mockFetch({ items: [{ id: 5 }], nextCursor: null, hasMore: false }));

    const res = await api.messages.getReplies(42);

    expect(res.items).toEqual([{ id: 5 }]);
    expect(res.nextCursor).toBeNull();
    expect(res.hasMore).toBe(false);
  });

  it('api.guestLinks.messages が CursorPaged（items / nextCursor / hasMore）を返す', async () => {
    vi.stubGlobal('fetch', mockFetch({ items: [{ id: 3 }], nextCursor: '3', hasMore: true }));

    const res = await api.guestLinks.messages('tok', 'guest-tok');

    expect(res.items).toEqual([{ id: 3 }]);
    expect(res.nextCursor).toBe('3');
    expect(res.hasMore).toBe(true);
  });
});
