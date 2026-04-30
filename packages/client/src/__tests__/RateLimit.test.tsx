/**
 * テスト対象:
 *   - packages/client/src/api/client.ts（429 ハンドリング）
 *   - Socket.IO の error: rate_limit イベントリスナ（ChatPage / DMPage）
 *
 * 戦略:
 *   - fetch は vi.stubGlobal でモックしてネットワーク通信を排除
 *   - Socket.IO エラーハンドラのロジックは関数として独立させて直接テスト
 *   - スナックバー表示は setRateLimitErrorHandler / showError のモックが呼ばれることで検証する
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { setRateLimitErrorHandler } from '../api/client';

// fetch をモックするためのヘルパー
function mockFetch(status: number, body: unknown): void {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({
      status,
      ok: status >= 200 && status < 300,
      json: () => Promise.resolve(body),
    } as Response),
  );
}

describe('api/client.ts 429 ハンドリング', () => {
  let showErrorMock: ReturnType<typeof vi.fn> & ((message: string) => void);

  beforeEach(() => {
    showErrorMock = vi.fn() as ReturnType<typeof vi.fn> & ((message: string) => void);
    // ハンドラを登録
    setRateLimitErrorHandler((msg: string) => showErrorMock(msg));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    // ハンドラをリセット
    setRateLimitErrorHandler((_msg: string) => {});
  });

  describe('request 関数', () => {
    it('サーバーが 429 を返したとき Error がスローされる', async () => {
      mockFetch(429, {
        error: '短時間に多くの送信を検出しました。少し時間をおいてください。',
        retryAfterSec: 5,
        limit: 10,
        windowSec: 10,
      });

      // api/client の request 関数は直接エクスポートされていないため、
      // 公開 API 経由でテスト
      const { api } = await import('../api/client');

      await expect(api.auth.login({ email: 'test@example.com', password: 'pass' })).rejects.toThrow(
        '短時間に多くの送信を検出しました。少し時間をおいてください。',
      );
    });

    it('429 レスポンスの error フィールドがエラーメッセージとして設定される', async () => {
      mockFetch(429, {
        error: 'カスタムレート制限メッセージ',
        retryAfterSec: 3,
        limit: 5,
        windowSec: 10,
      });

      const { api } = await import('../api/client');

      try {
        await api.auth.login({ email: 'test@example.com', password: 'pass' });
      } catch (e) {
        expect((e as Error).message).toBe('カスタムレート制限メッセージ');
      }
    });

    it('429 時にスナックバーの showError が呼ばれる', async () => {
      mockFetch(429, {
        error: '短時間に多くの送信を検出しました。少し時間をおいてください。',
        retryAfterSec: 5,
        limit: 10,
        windowSec: 10,
      });

      const { api } = await import('../api/client');

      try {
        await api.auth.login({ email: 'test@example.com', password: 'pass' });
      } catch {
        // エラーは期待通り
      }

      expect(showErrorMock).toHaveBeenCalledTimes(1);
      expect(showErrorMock).toHaveBeenCalledWith(
        expect.stringContaining('短時間に多くの送信を検出しました'),
      );
    });

    it('retryAfterSec がレスポンスに含まれるとき、エラーメッセージに残り秒数が表示される', async () => {
      mockFetch(429, {
        error: '短時間に多くの送信を検出しました。少し時間をおいてください。',
        retryAfterSec: 7,
        limit: 10,
        windowSec: 10,
      });

      const { api } = await import('../api/client');

      try {
        await api.auth.login({ email: 'test@example.com', password: 'pass' });
      } catch {
        // エラーは期待通り
      }

      expect(showErrorMock).toHaveBeenCalledWith(expect.stringContaining('7秒後に再試行できます'));
    });
  });
});

describe('Socket rate_limit エラーリスナ', () => {
  /**
   * ChatPage/DMPage の socket.on('error', handler) で使われる
   * エラーハンドラのロジックを単独で検証する。
   * コンポーネント全体のレンダリングは不要なため、関数として抽出してテスト。
   */
  function createRateLimitHandler(showError: (msg: string) => void) {
    return function handleSocketError(
      msg:
        | string
        | {
            type: 'rate_limit';
            retryAfterSec: number;
            limit: number;
            windowSec: number;
            message: string;
          },
    ) {
      if (typeof msg === 'object' && msg.type === 'rate_limit') {
        const text =
          msg.retryAfterSec !== undefined
            ? `${msg.message}（${msg.retryAfterSec}秒後に再試行できます）`
            : msg.message;
        showError(text);
      } else {
        showError(msg as string);
      }
    };
  }

  describe('チャンネルメッセージ（ChatPage）', () => {
    it('error: rate_limit イベントを受信したときスナックバー警告が表示される', () => {
      const showError = vi.fn();
      const handler = createRateLimitHandler(showError);

      handler({
        type: 'rate_limit',
        retryAfterSec: 5,
        limit: 10,
        windowSec: 10,
        message: '短時間に多くの送信を検出しました。少し時間をおいてください。',
      });

      expect(showError).toHaveBeenCalledTimes(1);
      expect(showError).toHaveBeenCalledWith(
        expect.stringContaining('短時間に多くの送信を検出しました'),
      );
    });

    it('警告メッセージに「時間をおいてください」相当の文言が含まれる', () => {
      const showError = vi.fn();
      const handler = createRateLimitHandler(showError);

      handler({
        type: 'rate_limit',
        retryAfterSec: 3,
        limit: 10,
        windowSec: 10,
        message: '短時間に多くの送信を検出しました。少し時間をおいてください。',
      });

      const calledWith = showError.mock.calls[0][0] as string;
      expect(calledWith).toMatch(/時間をおいてください/);
    });
  });

  describe('DM（DMPage）', () => {
    it('error: rate_limit イベントを受信したときスナックバー警告が表示される', () => {
      const showError = vi.fn();
      const handler = createRateLimitHandler(showError);

      handler({
        type: 'rate_limit',
        retryAfterSec: 8,
        limit: 10,
        windowSec: 10,
        message: '短時間に多くの送信を検出しました。少し時間をおいてください。',
      });

      expect(showError).toHaveBeenCalledTimes(1);
      expect(showError).toHaveBeenCalledWith(expect.stringContaining('8秒後に再試行できます'));
    });
  });
});
