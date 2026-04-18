/**
 * テスト対象: チャンネルカテゴリ（セクション）機能 - サーバーサイド
 *
 * 【仕様判断】
 * カテゴリは「ユーザー個人のサイドバー構成」として実装する（Slack方式）。
 * チャンネル自体はワークスペース共有のままで、カテゴリ分けは個人設定。
 * 他ユーザーのカテゴリ設定は一切参照されない。
 *
 * 【テーブル設計概要】
 * - channel_categories: id, user_id, name, position, is_collapsed, created_at, updated_at
 *   - user_id: カテゴリのオーナー（他ユーザーからは非表示）
 *   - position: 並び順（ユーザーが自由に変更可能）
 *   - is_collapsed: サイドバーでの折りたたみ状態
 * - channel_category_assignments: user_id, channel_id, category_id
 *   - user_id × channel_id がユニーク（1チャンネルは1カテゴリにのみ所属）
 *   - category_id が NULL の場合は「その他」扱い
 *
 * 戦略:
 *   - pg-mem のインメモリ PostgreSQL 互換 DB を使用
 *   - サービス層を直接テスト（unit系）と supertest で HTTP層をテスト（integration系）
 */

import { getSharedTestDatabase, resetTestData } from './__fixtures__/pgTestHelper';

const testDb = getSharedTestDatabase();

jest.mock('../db/database', () => testDb);

import request from 'supertest';
import { createApp } from '../app';
import { registerUser } from './__fixtures__/testHelpers';

const app = createApp();

// ────────────────────────────────────────────────────────────────────────────
// サービス層テスト（unit）
// ────────────────────────────────────────────────────────────────────────────

describe('カテゴリCRUD: サービス層', () => {
  beforeEach(async () => {
    await resetTestData(testDb);
  });

  describe('createCategory', () => {
    it('カテゴリを作成できる', async () => {
      // TODO
    });

    it('同じユーザーで同名カテゴリを作成するとエラーになる', async () => {
      // TODO
    });

    it('別ユーザーでは同名カテゴリを作成できる', async () => {
      // TODO
    });

    it('name が空文字のカテゴリ作成はエラーになる', async () => {
      // TODO
    });
  });

  describe('getCategoriesForUser', () => {
    it('ユーザーのカテゴリ一覧を position 昇順で返す', async () => {
      // TODO
    });

    it('カテゴリが存在しない場合は空配列を返す', async () => {
      // TODO
    });

    it('他のユーザーのカテゴリは含まれない', async () => {
      // TODO
    });
  });

  describe('updateCategory', () => {
    it('カテゴリ名を更新できる', async () => {
      // TODO
    });

    it('is_collapsed を更新できる', async () => {
      // TODO
    });

    it('position を更新できる', async () => {
      // TODO
    });

    it('他のユーザーのカテゴリは更新できない', async () => {
      // TODO
    });

    it('存在しないカテゴリの更新はエラーになる', async () => {
      // TODO
    });
  });

  describe('deleteCategory', () => {
    it('カテゴリを削除できる', async () => {
      // TODO
    });

    it('カテゴリを削除すると、そのカテゴリに割り当てられていたチャンネルの割当が解除される（チャンネル自体は削除されない）', async () => {
      // TODO
    });

    it('他のユーザーのカテゴリは削除できない', async () => {
      // TODO
    });

    it('存在しないカテゴリの削除はエラーになる', async () => {
      // TODO
    });
  });

  describe('reorderCategories', () => {
    it('カテゴリの並び順（position）を一括更新できる', async () => {
      // TODO
    });

    it('リクエストに含まれないカテゴリが存在する場合はエラーになる', async () => {
      // TODO
    });

    it('他のユーザーのカテゴリIDが含まれる場合はエラーになる', async () => {
      // TODO
    });
  });
});

describe('チャンネル割当: サービス層', () => {
  beforeEach(async () => {
    await resetTestData(testDb);
  });

  describe('assignChannelToCategory', () => {
    it('チャンネルをカテゴリに割り当てられる', async () => {
      // TODO
    });

    it('既に別カテゴリに割り当て済みのチャンネルを別カテゴリに移動できる（上書き更新）', async () => {
      // TODO
    });

    it('存在しないカテゴリへの割り当てはエラーになる', async () => {
      // TODO
    });

    it('存在しないチャンネルへの割り当てはエラーになる', async () => {
      // TODO
    });

    it('他のユーザーのカテゴリへの割り当てはエラーになる', async () => {
      // TODO
    });
  });

  describe('unassignChannelFromCategory', () => {
    it('チャンネルのカテゴリ割当を解除できる（「その他」に戻る）', async () => {
      // TODO
    });

    it('割り当てが存在しないチャンネルの解除はエラーになる', async () => {
      // TODO
    });
  });

  describe('getChannelsWithCategory', () => {
    it('ユーザーのチャンネル一覧をカテゴリ情報付きで返す', async () => {
      // TODO
    });

    it('カテゴリ未割当のチャンネルは categoryId が null で返される', async () => {
      // TODO
    });

    it('他のユーザーのカテゴリ割当は反映されない（ユーザーごとに独立）', async () => {
      // TODO
    });
  });
});

// ────────────────────────────────────────────────────────────────────────────
// REST API 統合テスト
// ────────────────────────────────────────────────────────────────────────────

describe('REST API: GET /api/channel-categories', () => {
  it('200 でログインユーザーのカテゴリ一覧を返す', async () => {
    // TODO
  });

  it('認証なしで 401 を返す', async () => {
    // TODO
  });
});

describe('REST API: POST /api/channel-categories', () => {
  it('カテゴリ作成成功で 201 を返す', async () => {
    // TODO
  });

  it('name が未指定で 400 を返す', async () => {
    // TODO
  });

  it('認証なしで 401 を返す', async () => {
    // TODO
  });

  it('同名カテゴリの重複作成で 409 を返す', async () => {
    // TODO
  });
});

describe('REST API: PATCH /api/channel-categories/:id', () => {
  it('カテゴリ更新成功で 200 を返す', async () => {
    // TODO
  });

  it('認証なしで 401 を返す', async () => {
    // TODO
  });

  it('他のユーザーのカテゴリ更新で 403 を返す', async () => {
    // TODO
  });

  it('存在しないカテゴリの更新で 404 を返す', async () => {
    // TODO
  });
});

describe('REST API: DELETE /api/channel-categories/:id', () => {
  it('カテゴリ削除成功で 204 を返す', async () => {
    // TODO
  });

  it('認証なしで 401 を返す', async () => {
    // TODO
  });

  it('他のユーザーのカテゴリ削除で 403 を返す', async () => {
    // TODO
  });

  it('存在しないカテゴリの削除で 404 を返す', async () => {
    // TODO
  });
});

describe('REST API: PATCH /api/channel-categories/reorder', () => {
  it('並び替え成功で 200 を返す', async () => {
    // TODO
  });

  it('認証なしで 401 を返す', async () => {
    // TODO
  });

  it('不正なペイロード（category_ids 未指定）で 400 を返す', async () => {
    // TODO
  });
});

describe('REST API: POST /api/channels/:id/category', () => {
  it('チャンネルをカテゴリに割り当てて 200 を返す', async () => {
    // TODO
  });

  it('categoryId が null のとき割当を解除して 200 を返す', async () => {
    // TODO
  });

  it('認証なしで 401 を返す', async () => {
    // TODO
  });

  it('存在しないカテゴリへの割り当てで 404 を返す', async () => {
    // TODO
  });

  it('他のユーザーのカテゴリへの割り当てで 403 を返す', async () => {
    // TODO
  });
});

// ────────────────────────────────────────────────────────────────────────────
// 境界条件テスト
// ────────────────────────────────────────────────────────────────────────────

describe('境界条件: カテゴリ削除時のチャンネルの扱い', () => {
  it('カテゴリを削除してもチャンネル自体は削除されない', async () => {
    // TODO
  });

  it('カテゴリを削除すると、割り当てチャンネルは「その他（未割当）」に移る', async () => {
    // TODO
  });
});

describe('境界条件: ユーザー分離', () => {
  it('ユーザーAのカテゴリはユーザーBのAPI応答に含まれない', async () => {
    // TODO
  });

  it('ユーザーAのチャンネル割当はユーザーBには影響しない', async () => {
    // TODO
  });
});

describe('境界条件: 空カテゴリ', () => {
  it('チャンネルが0件のカテゴリも一覧に表示される', async () => {
    // TODO
  });
});
