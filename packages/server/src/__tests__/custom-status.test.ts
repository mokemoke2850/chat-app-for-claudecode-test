/**
 * テスト対象: カスタムステータス機能（サーバサイド）
 *
 * 戦略:
 *   - pg-mem のインメモリ PostgreSQL 互換 DB を使いサービス層・HTTP エンドポイントを検証する
 *   - PATCH /users/me/status エンドポイントのバリデーション・更新・取得を検証する
 *   - 期限切れ自動クリアのロジック（GET 時のフィルタ）を検証する
 *   - 絵文字のみ・テキストのみ・両方空でのクリアの各ケースを網羅する
 */

import { getSharedTestDatabase, resetTestData } from './__fixtures__/pgTestHelper';

const testDb = getSharedTestDatabase();

jest.mock('../db/database', () => testDb);

import request from 'supertest';
import { createApp } from '../app';

const app = createApp();

describe('カスタムステータス機能', () => {
  let userId: number;
  let authToken: string;

  beforeEach(async () => {
    resetTestData();
    // TODO
  });

  describe('PATCH /users/me/status', () => {
    describe('ステータス設定', () => {
      it('絵文字とテキストと期限を設定できる', async () => {
        // TODO
      });

      it('絵文字のみでステータスを設定できる（テキストは省略可）', async () => {
        // TODO
      });

      it('テキストのみでステータスを設定できる（絵文字は省略可）', async () => {
        // TODO
      });

      it('絵文字とテキストが両方空ならステータスをクリアできる', async () => {
        // TODO
      });

      it('expires_at に過去日時を指定するとバリデーションエラーになる', async () => {
        // TODO
      });

      it('認証なしでアクセスすると 401 が返る', async () => {
        // TODO
      });
    });

    describe('有効期限プリセット', () => {
      it('expires_at に未来日時（1時間後）を指定してステータスを設定できる', async () => {
        // TODO
      });

      it('expires_at を null にするとステータスが無期限になる', async () => {
        // TODO
      });
    });
  });

  describe('GET /api/auth/me（ステータス情報の返却）', () => {
    describe('期限切れフィルタ', () => {
      it('expires_at が現在時刻より未来ならステータスが返る', async () => {
        // TODO
      });

      it('expires_at が現在時刻より過去なら status が null として返る', async () => {
        // TODO
      });

      it('expires_at が null（無期限）のステータスは常に返る', async () => {
        // TODO
      });
    });

    describe('ステータス情報の形式', () => {
      it('status フィールドに emoji / text / expiresAt が含まれる', async () => {
        // TODO
      });

      it('ステータス未設定のユーザーは status が null として返る', async () => {
        // TODO
      });
    });
  });

  describe('GET /api/auth/users（ユーザー一覧）', () => {
    it('ユーザー一覧にも各ユーザーのステータスが含まれる', async () => {
      // TODO
    });

    it('期限切れのステータスは null として返る', async () => {
      // TODO
    });
  });
});
