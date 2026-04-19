/**
 * テスト対象: messageTemplateService / REST API（/api/templates）
 * 戦略:
 *   - pg-mem のインメモリ PostgreSQL 互換 DB を使いサービス層を直接テストする
 *   - CRUD・並び順整合性・他人の ID でのアクセス禁止を重点的に検証する
 *   - REST API テストでは supertest を使い HTTP 契約のみを確認する
 */

import { getSharedTestDatabase, resetTestData } from './__fixtures__/pgTestHelper';

const testDb = getSharedTestDatabase();

jest.mock('../db/database', () => testDb);

import request from 'supertest';
import { createApp } from '../app';
import { registerUser } from './__fixtures__/testHelpers';

const app = createApp();

let userId1: number;
let userId2: number;

async function setupFixtures() {
  const r1 = await testDb.execute(
    'INSERT INTO users (username, email, password_hash) VALUES ($1, $2, $3) RETURNING id',
    ['tpl_user1', 'tpl1@t.com', 'h'],
  );
  userId1 = r1.rows[0].id as number;

  const r2 = await testDb.execute(
    'INSERT INTO users (username, email, password_hash) VALUES ($1, $2, $3) RETURNING id',
    ['tpl_user2', 'tpl2@t.com', 'h'],
  );
  userId2 = r2.rows[0].id as number;
}

beforeEach(async () => {
  await resetTestData(testDb);
  await setupFixtures();
});

// ─── サービス層テスト ─────────────────────────────────────────────────────────

describe('createTemplate', () => {
  it('タイトルと本文を指定してテンプレートを作成できる', () => {
    // TODO
  });

  it('タイトルが空文字の場合はエラーになる', () => {
    // TODO
  });

  it('本文が空文字の場合はエラーになる', () => {
    // TODO
  });

  it('タイトルが100文字を超える場合はエラーになる', () => {
    // TODO
  });

  it('作成されたテンプレートの position はリストの末尾に設定される', () => {
    // TODO
  });
});

describe('listTemplates', () => {
  it('ユーザーのテンプレート一覧を position 昇順で返す', () => {
    // TODO
  });

  it('テンプレートが存在しないユーザーでは空配列を返す', () => {
    // TODO
  });

  it('他のユーザーのテンプレートは含まれない', () => {
    // TODO
  });
});

describe('updateTemplate', () => {
  it('タイトルを更新できる', () => {
    // TODO
  });

  it('本文を更新できる', () => {
    // TODO
  });

  it('存在しないテンプレートIDの更新はエラーになる', () => {
    // TODO
  });

  it('他のユーザーのテンプレートを更新しようとしても変更されない（404扱い）', () => {
    // TODO
  });

  it('タイトルを空文字に更新しようとするとエラーになる', () => {
    // TODO
  });
});

describe('removeTemplate', () => {
  it('テンプレートを削除できる', () => {
    // TODO
  });

  it('存在しないテンプレートIDの削除はエラーになる', () => {
    // TODO
  });

  it('他のユーザーのテンプレートは削除できない（404扱い）', () => {
    // TODO
  });
});

describe('reorderTemplates', () => {
  it('指定した順序で position が更新される', () => {
    // TODO
  });

  it('自分のテンプレートIDのみが含まれている場合に正常に処理される', () => {
    // TODO
  });

  it('他のユーザーのテンプレートIDが含まれていた場合はエラーになる', () => {
    // TODO
  });

  it('存在しない ID が含まれていた場合はエラーになる', () => {
    // TODO
  });
});

// ─── REST API テスト ──────────────────────────────────────────────────────────

describe('REST API: GET /api/templates', () => {
  it('認証済みユーザーが自分のテンプレート一覧を 200 で取得できる', () => {
    // TODO
  });

  it('認証なしで 401 を返す', () => {
    // TODO
  });
});

describe('REST API: POST /api/templates', () => {
  it('テンプレート作成成功で 201 を返す', () => {
    // TODO
  });

  it('認証なしで 401 を返す', () => {
    // TODO
  });

  it('タイトル未指定で 400 を返す', () => {
    // TODO
  });

  it('本文未指定で 400 を返す', () => {
    // TODO
  });
});

describe('REST API: PATCH /api/templates/:id', () => {
  it('テンプレート更新成功で 200 を返す', () => {
    // TODO
  });

  it('認証なしで 401 を返す', () => {
    // TODO
  });

  it('他のユーザーのテンプレートIDで 404 を返す', () => {
    // TODO
  });

  it('存在しない ID で 404 を返す', () => {
    // TODO
  });
});

describe('REST API: DELETE /api/templates/:id', () => {
  it('テンプレート削除成功で 204 を返す', () => {
    // TODO
  });

  it('認証なしで 401 を返す', () => {
    // TODO
  });

  it('他のユーザーのテンプレートIDで 404 を返す', () => {
    // TODO
  });
});

describe('REST API: PUT /api/templates/reorder', () => {
  it('並び替え成功で 200 を返す', () => {
    // TODO
  });

  it('認証なしで 401 を返す', () => {
    // TODO
  });

  it('orderedIds が配列でない場合 400 を返す', () => {
    // TODO
  });
});
