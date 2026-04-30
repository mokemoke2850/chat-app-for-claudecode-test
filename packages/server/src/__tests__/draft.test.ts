/**
 * テスト対象: draftService — 下書き保存機能
 * 戦略:
 *   - pg-mem のインメモリ PostgreSQL 互換 DB を使いサービス層を直接テストする
 *   - チャンネル下書き / DM下書き それぞれの CRUD 操作と一意制約を検証する
 *   - メッセージ送信成功時に対応する下書きが削除されることを統合的に検証する
 *   - 下書き削除時に紐付く一時添付（draft_id）も削除されることを検証する
 */

import { getSharedTestDatabase, resetTestData } from './__fixtures__/pgTestHelper';

const testDb = getSharedTestDatabase();

jest.mock('../db/database', () => testDb);

import {
  upsertChannelDraft,
  upsertDmDraft,
  getDraftsByUser,
  deleteDraft,
  deleteChannelDraft,
  deleteDmDraft,
} from '../services/draftService';
import { sendMessage } from '../services/messageService';
import { sendDmMessage } from '../services/dmService';

let userId1: number;
let userId2: number;
let channelId: number;
let conversationId: number;

async function setupFixtures() {
  const r1 = await testDb.execute(
    'INSERT INTO users (username, email, password_hash) VALUES ($1, $2, $3) RETURNING id',
    ['user1', 'u1@draft.com', 'h'],
  );
  userId1 = r1.rows[0].id as number;

  const r2 = await testDb.execute(
    'INSERT INTO users (username, email, password_hash) VALUES ($1, $2, $3) RETURNING id',
    ['user2', 'u2@draft.com', 'h'],
  );
  userId2 = r2.rows[0].id as number;

  const rc = await testDb.execute(
    'INSERT INTO channels (name, created_by) VALUES ($1, $2) RETURNING id',
    ['draft-test-channel', userId1],
  );
  channelId = rc.rows[0].id as number;

  await testDb.execute('INSERT INTO channel_members (channel_id, user_id) VALUES ($1, $2)', [
    channelId,
    userId1,
  ]);

  const rdm = await testDb.execute(
    'INSERT INTO dm_conversations (user_a_id, user_b_id) VALUES ($1, $2) RETURNING id',
    [userId1, userId2],
  );
  conversationId = rdm.rows[0].id as number;
}

beforeEach(async () => {
  await resetTestData(testDb);
  await setupFixtures();
});

// ─────────────────────────────────────────────────────────
// draftService ユニット: チャンネル下書き
// ─────────────────────────────────────────────────────────

describe('draftService: チャンネル下書き', () => {
  describe('下書き作成', () => {
    it('チャンネルに下書きを新規作成できる', async () => {
      // TODO
    });

    it('作成した下書きが getDraftsByUser で取得できる', async () => {
      // TODO
    });
  });

  describe('下書き上書き（upsert）', () => {
    it('同一ユーザー × 同一チャンネルで2回保存すると1件に集約される', async () => {
      // TODO
    });

    it('upsert 後の内容が最新のものに更新される', async () => {
      // TODO
    });
  });

  describe('下書き削除', () => {
    it('チャンネル下書きを削除できる', async () => {
      // TODO
    });

    it('存在しない下書きを削除してもエラーにならない', async () => {
      // TODO
    });
  });

  describe('チャンネルとDMで別エントリが管理される', () => {
    it('チャンネル下書きとDM下書きは互いに独立して管理される', async () => {
      // TODO
    });
  });
});

// ─────────────────────────────────────────────────────────
// draftService ユニット: DM下書き
// ─────────────────────────────────────────────────────────

describe('draftService: DM下書き', () => {
  describe('下書き作成', () => {
    it('DM会話に下書きを新規作成できる', async () => {
      // TODO
    });

    it('作成したDM下書きが getDraftsByUser で取得できる', async () => {
      // TODO
    });
  });

  describe('下書き上書き（upsert）', () => {
    it('同一ユーザー × 同一DM会話で2回保存すると1件に集約される', async () => {
      // TODO
    });
  });

  describe('下書き削除', () => {
    it('DM下書きを削除できる', async () => {
      // TODO
    });
  });
});

// ─────────────────────────────────────────────────────────
// draftService ユニット: ユーザー別管理
// ─────────────────────────────────────────────────────────

describe('draftService: ユーザー別管理', () => {
  it('別ユーザーの下書きは getDraftsByUser に混入しない', async () => {
    // TODO
  });

  it('同じチャンネルでも異なるユーザーはそれぞれ独立した下書きを持つ', async () => {
    // TODO
  });
});

// ─────────────────────────────────────────────────────────
// 統合: 下書き保存後にメッセージ送信すると下書きが消える
// ─────────────────────────────────────────────────────────

describe('統合: 送信成功時の下書き自動削除', () => {
  it('チャンネルへの下書きを保存後にメッセージを送信すると下書きが削除される', async () => {
    // TODO
  });

  it('DMへの下書きを保存後にDMを送信すると下書きが削除される', async () => {
    // TODO
  });
});

// ─────────────────────────────────────────────────────────
// 統合: 空文字列で下書きを削除
// ─────────────────────────────────────────────────────────

describe('統合: 空文字列で下書きを削除', () => {
  it('content が空文字列の場合 upsertChannelDraft は下書きを削除する', async () => {
    // TODO
  });

  it('content が空文字列の場合 upsertDmDraft は下書きを削除する', async () => {
    // TODO
  });
});

// ─────────────────────────────────────────────────────────
// 統合: 下書き削除時に紐付く一時添付も削除される
// ─────────────────────────────────────────────────────────

describe('統合: 下書き削除時の添付ファイル連動削除', () => {
  it('下書き削除時に draft_id で紐付く message_attachments も削除される', async () => {
    // TODO
  });

  it('draft_id が紐付かない添付ファイルは削除されない', async () => {
    // TODO
  });
});
