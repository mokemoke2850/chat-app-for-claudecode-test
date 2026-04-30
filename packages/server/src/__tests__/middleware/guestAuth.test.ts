/**
 * テスト対象: middleware/guestAuth.ts — ゲストトークン認証ミドルウェア（#149）
 * 戦略:
 *   - Express の Request/Response/Next をモックしてミドルウェアの分岐を直接検証する
 *   - JWT の secret / payload / 有効期限・revoke / channelId 一致を中心に検証する
 *   - middleware/auth.ts には触らない方針（#153 とのコンフリクト回避）。本ミドルウェアは独立して動作することを境界として確認する
 */

import { getSharedTestDatabase, resetTestData } from '../__fixtures__/pgTestHelper';

const testDb = getSharedTestDatabase();

jest.mock('../../db/database', () => testDb);

// NOTE: guestAuth ミドルウェア本体は本 PR 後段で実装する。ここでは骨子のみ。

describe('guestAuth ミドルウェア', () => {
  describe('Authorization ヘッダ解析', () => {
    it('Authorization ヘッダがない場合は 401 を返す', async () => {
      // TODO
    });

    it('Authorization ヘッダが Bearer 形式でない場合は 401 を返す', async () => {
      // TODO
    });

    it('有効な Bearer ゲストトークンは next() を呼ぶ', async () => {
      // TODO
    });

    it('Cookie に通常ユーザーの token があってもゲストフローでは無視する', async () => {
      // TODO
    });
  });

  describe('JWT 検証', () => {
    it('別 secret で署名された JWT は 401 になる', async () => {
      // TODO
    });

    it('既に有効期限切れの JWT は 401 になる', async () => {
      // TODO
    });

    it('payload に token が含まれない JWT は 401 になる', async () => {
      // TODO
    });

    it('payload に channelId が含まれない JWT は 401 になる', async () => {
      // TODO
    });
  });

  describe('リンク状態の検証', () => {
    it('payload の token が DB に存在しない場合は 401 になる', async () => {
      // TODO
    });

    it('payload の token が is_revoked = true の場合は 410 になる', async () => {
      // TODO
    });

    it('payload の token が expires_at < now の場合は 410 になる', async () => {
      // TODO
    });

    it('payload の channelId が DB の channel_id と一致しない場合は 403 になる', async () => {
      // TODO
    });
  });

  describe('req に注入する情報', () => {
    it('検証成功時に req.guest = { token, channelId, linkId } を設定する', async () => {
      // TODO
    });

    it('検証成功時に req.userId は設定しない（通常ユーザーと区別する）', async () => {
      // TODO
    });
  });

  describe('既存 authenticateToken との独立性', () => {
    it('guestAuth ミドルウェアは middleware/auth.ts の関数を import しない（依存なし）', () => {
      // TODO
    });

    it('通常ユーザーの cookie token を guestAuth に渡しても 401 になる（payload 形が違う）', async () => {
      // TODO
    });
  });
});
