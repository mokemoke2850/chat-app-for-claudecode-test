/**
 * api/client.ts のユニットテスト
 *
 * テスト対象: fetch ラッパー関数 `request` および `api` オブジェクト
 * 戦略: グローバルの fetch を vi.stubGlobal でモックし、
 *       実際のネットワーク通信を行わずにロジックだけを検証する
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { api } from '../api/client';

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
      expect(fetch).toHaveBeenCalledWith('/api/auth/me', expect.objectContaining({ credentials: 'include' }));
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

      await expect(api.auth.login({ email: 'x@x.com', password: 'wrong' }))
        .rejects.toThrow('Invalid credentials');
    });

    it('error フィールドがないエラーレスポンスのとき "Request failed" を throw する', async () => {
      vi.stubGlobal('fetch', mockFetch({}, 500));

      await expect(api.auth.me()).rejects.toThrow('Request failed');
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
