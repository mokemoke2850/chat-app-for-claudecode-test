/**
 * テスト対象: 保存ビュー機能 - サーバーサイド
 *
 * 【仕様概要】
 * ユーザーが検索条件（キーワード・期間・投稿者・チャンネル・タグ）に名前を付けて保存できる機能。
 * 保存ビューは個人専用（user_id で隔離）、件数上限なし。
 * 並べ替えは position フィールドで管理し、上下ボタンで操作する。
 *
 * 【テーブル: saved_views】
 *   id serial pk, user_id fk users, name text, query jsonb, position integer,
 *   created_at, updated_at
 *   一意制約: (user_id, name)
 *
 * 戦略:
 *   - getSharedTestDatabase() + resetTestData() でインメモリDB共有
 *   - savedViewService 関数を直接呼び出すユニットテスト
 *   - HTTP エンドポイントを supertest で検証する統合テスト
 */

import { getSharedTestDatabase, resetTestData } from './__fixtures__/pgTestHelper';

const testDb = getSharedTestDatabase();

jest.mock('../db/database', () => testDb);

import request from 'supertest';
import { createApp } from '../app';
import { registerUser, registerAndGetCookie } from './__fixtures__/testHelpers';

const app = createApp();

// ────────────────────────────────────────────────────────────────────────────
// フィクスチャセットアップ
// ────────────────────────────────────────────────────────────────────────────

let userId1: number;
let userId2: number;

async function setupFixtures() {
  const r1 = await testDb.execute(
    'INSERT INTO users (username, email, password_hash) VALUES ($1, $2, $3) RETURNING id',
    ['svuser1', 'sv1@t.com', 'h'],
  );
  userId1 = r1.rows[0].id as number;

  const r2 = await testDb.execute(
    'INSERT INTO users (username, email, password_hash) VALUES ($1, $2, $3) RETURNING id',
    ['svuser2', 'sv2@t.com', 'h'],
  );
  userId2 = r2.rows[0].id as number;
}

beforeEach(async () => {
  await resetTestData(testDb);
  await setupFixtures();
});

// ────────────────────────────────────────────────────────────────────────────
// サービス層ユニットテスト
// ────────────────────────────────────────────────────────────────────────────

describe('savedViewService', () => {
  describe('保存ビュー作成', () => {
    it('名前と query を指定して保存ビューを作成できる', () => {
      // TODO
    });

    it('作成された保存ビューの position はデフォルト 0 になる', () => {
      // TODO
    });

    it('同一ユーザーで同じ名前を再度作成すると一意制約エラーになる', () => {
      // TODO
    });

    it('異なるユーザーが同じ名前で作成しても一意制約エラーにならない', () => {
      // TODO
    });

    it('query の中身は jsonb としてそのまま保存される（キーワード・期間・userId・tagIds を含む）', () => {
      // TODO
    });
  });

  describe('保存ビュー取得', () => {
    it('ユーザーの保存ビュー一覧を position 昇順で取得できる', () => {
      // TODO
    });

    it('他ユーザーの保存ビューは取得されない', () => {
      // TODO
    });

    it('保存ビューが 0 件のとき空配列を返す', () => {
      // TODO
    });
  });

  describe('保存ビュー更新', () => {
    it('名前を変更できる', () => {
      // TODO
    });

    it('query を変更できる', () => {
      // TODO
    });

    it('他ユーザーの保存ビューを更新しようとするとエラーになる', () => {
      // TODO
    });

    it('存在しない id を更新しようとするとエラーになる', () => {
      // TODO
    });

    it('変更後の名前が同一ユーザーの既存保存ビュー名と重複する場合はエラーになる', () => {
      // TODO
    });
  });

  describe('保存ビュー削除', () => {
    it('自分の保存ビューを削除できる', () => {
      // TODO
    });

    it('他ユーザーの保存ビューを削除しようとするとエラーになる', () => {
      // TODO
    });

    it('存在しない id を削除しようとするとエラーになる', () => {
      // TODO
    });
  });

  describe('並べ替え', () => {
    it('保存ビューの順序を id 配列で指定して並べ替えできる', () => {
      // TODO
    });

    it('自分の保存ビューのみ並べ替えでき、他ユーザーの id が含まれてもエラーになる', () => {
      // TODO
    });

    it('並べ替え後に取得すると新しい position 順で返る', () => {
      // TODO
    });
  });
});

// ────────────────────────────────────────────────────────────────────────────
// HTTP 統合テスト
// ────────────────────────────────────────────────────────────────────────────

describe('保存ビュー APIエンドポイント', () => {
  describe('GET /saved-views', () => {
    it('認証済みユーザーが自分の保存ビュー一覧を取得できる (200)', () => {
      // TODO
    });

    it('認証なしで 401 を返す', () => {
      // TODO
    });
  });

  describe('POST /saved-views', () => {
    it('保存ビューを新規作成すると 201 と作成データが返る', () => {
      // TODO
    });

    it('同名保存ビューを作成すると 409 を返す', () => {
      // TODO
    });

    it('name が空文字の場合は 400 を返す', () => {
      // TODO
    });

    it('認証なしで 401 を返す', () => {
      // TODO
    });
  });

  describe('PUT /saved-views/:id', () => {
    it('保存ビューの名前・query を更新すると 200 と更新後データが返る', () => {
      // TODO
    });

    it('他ユーザーの保存ビューを更新しようとすると 403 を返す', () => {
      // TODO
    });

    it('存在しない id を更新しようとすると 404 を返す', () => {
      // TODO
    });

    it('認証なしで 401 を返す', () => {
      // TODO
    });
  });

  describe('DELETE /saved-views/:id', () => {
    it('保存ビューを削除すると 204 を返す', () => {
      // TODO
    });

    it('他ユーザーの保存ビューを削除しようとすると 403 を返す', () => {
      // TODO
    });

    it('存在しない id を削除しようとすると 404 を返す', () => {
      // TODO
    });

    it('認証なしで 401 を返す', () => {
      // TODO
    });
  });

  describe('PUT /saved-views/order', () => {
    it('id 配列の順序で保存ビューを並べ替えると 200 を返す', () => {
      // TODO
    });

    it('他ユーザーの id が含まれていると 403 を返す', () => {
      // TODO
    });

    it('認証なしで 401 を返す', () => {
      // TODO
    });
  });
});
