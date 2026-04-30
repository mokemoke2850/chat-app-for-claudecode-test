/**
 * テスト対象: routes/guestLinks.ts — /api/guest-links および /api/guest-links/:token/* エンドポイント（#149）
 * 戦略:
 *   - supertest で HTTP エンドポイントを叩き、認可（管理ルートは認証必須・公開ルートは未認証可）と
 *     ステータスコード／レスポンス形状を中心に検証する
 *   - 投稿系エンドポイントへゲストトークン経由でアクセスすると 403 になることを横断的に検証する
 *   - 既存 routes/messages.ts や middleware/auth.ts への副作用がないことを境界として確認する
 */

import { getSharedTestDatabase, resetTestData } from '../__fixtures__/pgTestHelper';

const testDb = getSharedTestDatabase();

jest.mock('../../db/database', () => testDb);

// NOTE: 実装は本 PR 後段で追加する。ここではテスト項目骨子のみ列挙する。

describe('ゲスト閲覧リンクルート', () => {
  describe('POST /api/channels/:id/guest-links — ゲストリンク発行', () => {
    it('チャンネルメンバーがゲストリンクを発行できる（201）', async () => {
      // TODO
    });

    it('admin は任意のチャンネルのゲストリンクを発行できる（201）', async () => {
      // TODO
    });

    it('チャンネルメンバーでない一般ユーザーは 403 になる', async () => {
      // TODO
    });

    it('認証なしでは 401 になる', async () => {
      // TODO
    });

    it('パスワード・有効期限を指定して発行できる', async () => {
      // TODO
    });

    it('レスポンスの guestLink には token / channelId / expiresAt / hasPassword が含まれる', async () => {
      // TODO
    });

    it('レスポンスに password_hash 平文は含まれない', async () => {
      // TODO
    });

    it('存在しないチャンネル ID では 404 になる', async () => {
      // TODO
    });
  });

  describe('GET /api/channels/:id/guest-links — ゲストリンク一覧', () => {
    it('チャンネルメンバーが一覧を取得できる', async () => {
      // TODO
    });

    it('チャンネルメンバーでない一般ユーザーは 403 になる', async () => {
      // TODO
    });

    it('認証なしでは 401 になる', async () => {
      // TODO
    });
  });

  describe('DELETE /api/guest-links/:id — ゲストリンク失効', () => {
    it('作成者が自分のリンクを失効できる（200）', async () => {
      // TODO
    });

    it('admin は他ユーザーのリンクも失効できる（200）', async () => {
      // TODO
    });

    it('作成者でも admin でもないユーザーは 403 になる', async () => {
      // TODO
    });

    it('存在しないリンク ID は 404 になる', async () => {
      // TODO
    });

    it('認証なしでは 401 になる', async () => {
      // TODO
    });
  });

  describe('GET /api/guest-links/:token — トークン情報取得（公開・未認証可）', () => {
    it('有効なトークンの情報を返す（チャンネル名・hasPassword・isExpired・isRevoked）', async () => {
      // TODO
    });

    it('存在しないトークンは 404 になる', async () => {
      // TODO
    });

    it('期限切れトークンでも 200 を返し isExpired: true になる', async () => {
      // TODO
    });

    it('失効済みトークンでも 200 を返し isRevoked: true になる', async () => {
      // TODO
    });

    it('未認証でもアクセスできる（200）', async () => {
      // TODO
    });

    it('レスポンスに password_hash 平文は含まれない', async () => {
      // TODO
    });
  });

  describe('POST /api/guest-links/:token/verify — パスワード検証 + ゲストセッション発行', () => {
    it('パスワード未設定リンクは空文字でも 200 と guestToken を返す', async () => {
      // TODO
    });

    it('パスワード設定済みリンクで正しいパスワードを送ると 200 と guestToken を返す', async () => {
      // TODO
    });

    it('パスワード設定済みリンクで誤ったパスワードを送ると 401 になる', async () => {
      // TODO
    });

    it('失効済みリンクは 410 になる', async () => {
      // TODO
    });

    it('期限切れリンクは 410 になる', async () => {
      // TODO
    });

    it('連続して誤パスワードを送ると 429 でブロックされる（短期）', async () => {
      // TODO
    });

    it('発行された guestToken は短期 JWT である', async () => {
      // TODO
    });
  });

  describe('GET /api/guest-links/:token/messages — 公開メッセージ取得', () => {
    it('有効な guestToken（Authorization ヘッダ）でメッセージ一覧が取得できる', async () => {
      // TODO
    });

    it('guestToken なしでは 401 になる', async () => {
      // TODO
    });

    it('別トークンの guestToken では 403 になる', async () => {
      // TODO
    });

    it('失効済みリンクでは 410 になる', async () => {
      // TODO
    });

    it('期限切れリンクでは 410 になる', async () => {
      // TODO
    });

    it('スレッド返信は応答に含まれない（トップレベルメッセージのみ）', async () => {
      // TODO
    });

    it('レスポンスに添付ファイルのメタデータが含まれる', async () => {
      // TODO
    });
  });

  describe('投稿系エンドポイントへのゲストトークン拒否', () => {
    it('POST /api/messages にゲストトークンを Authorization で送っても 401 になる', async () => {
      // TODO
    });

    it('POST /api/dm/conversations/:id/messages にゲストトークンを Authorization で送っても 401 になる', async () => {
      // TODO
    });

    it('POST /api/scheduled-messages にゲストトークンを Authorization で送っても 401 になる', async () => {
      // TODO
    });

    it('既存 cookie ベース認証（authenticateToken）は guest JWT を受け入れない', async () => {
      // TODO
    });
  });
});
