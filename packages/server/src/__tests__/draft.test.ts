/**
 * テスト対象: draftService — 下書き保存機能
 * 戦略:
 *   - pg-mem のインメモリ PostgreSQL 互換 DB を使いサービス層を直接テストする
 *   - チャンネル下書き / DM下書き それぞれの CRUD 操作と一意制約を検証する
 *   - メッセージ送信成功時に対応する下書きが削除されることを統合的に検証する
 *   - 下書き削除時に紐付く一時添付（draft_id）も削除されることを検証する
 */

import { createTestDatabase, resetTestData } from './__fixtures__/pgTestHelper';

const testDb = createTestDatabase();

jest.mock('../db/database', () => testDb);

import {
  upsertChannelDraft,
  upsertDmDraft,
  getDraftsByUser,
  deleteDraft,
  deleteChannelDraft,
  deleteDmDraft,
} from '../services/draftService';
import { createMessage } from '../services/messageService';
import { sendMessage as sendDmMessage } from '../services/dmService';

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
      const draft = await upsertChannelDraft(userId1, channelId, 'テスト下書き');
      expect(draft).not.toBeNull();
      expect(draft!.userId).toBe(userId1);
      expect(draft!.channelId).toBe(channelId);
      expect(draft!.content).toBe('テスト下書き');
    });

    it('作成した下書きが getDraftsByUser で取得できる', async () => {
      await upsertChannelDraft(userId1, channelId, 'テスト下書き');
      const drafts = await getDraftsByUser(userId1);
      expect(drafts).toHaveLength(1);
      expect(drafts[0].channelId).toBe(channelId);
      expect(drafts[0].content).toBe('テスト下書き');
    });
  });

  describe('下書き上書き（upsert）', () => {
    it('同一ユーザー × 同一チャンネルで2回保存すると1件に集約される', async () => {
      await upsertChannelDraft(userId1, channelId, '1回目');
      await upsertChannelDraft(userId1, channelId, '2回目');
      const drafts = await getDraftsByUser(userId1);
      expect(drafts).toHaveLength(1);
    });

    it('upsert 後の内容が最新のものに更新される', async () => {
      await upsertChannelDraft(userId1, channelId, '1回目');
      await upsertChannelDraft(userId1, channelId, '2回目');
      const drafts = await getDraftsByUser(userId1);
      expect(drafts[0].content).toBe('2回目');
    });
  });

  describe('下書き削除', () => {
    it('チャンネル下書きを削除できる', async () => {
      await upsertChannelDraft(userId1, channelId, 'テスト下書き');
      await deleteChannelDraft(userId1, channelId);
      const drafts = await getDraftsByUser(userId1);
      expect(drafts).toHaveLength(0);
    });

    it('存在しない下書きを削除してもエラーにならない', async () => {
      await expect(deleteChannelDraft(userId1, 99999)).resolves.not.toThrow();
    });
  });

  describe('チャンネルとDMで別エントリが管理される', () => {
    it('チャンネル下書きとDM下書きは互いに独立して管理される', async () => {
      await upsertChannelDraft(userId1, channelId, 'チャンネル下書き');
      await upsertDmDraft(userId1, conversationId, 'DM下書き');
      const drafts = await getDraftsByUser(userId1);
      expect(drafts).toHaveLength(2);
      const channelDraft = drafts.find((d) => d.channelId === channelId);
      const dmDraft = drafts.find((d) => d.dmConversationId === conversationId);
      expect(channelDraft).toBeDefined();
      expect(dmDraft).toBeDefined();
    });
  });
});

// ─────────────────────────────────────────────────────────
// draftService ユニット: DM下書き
// ─────────────────────────────────────────────────────────

describe('draftService: DM下書き', () => {
  describe('下書き作成', () => {
    it('DM会話に下書きを新規作成できる', async () => {
      const draft = await upsertDmDraft(userId1, conversationId, 'DM下書き');
      expect(draft).not.toBeNull();
      expect(draft!.userId).toBe(userId1);
      expect(draft!.dmConversationId).toBe(conversationId);
      expect(draft!.content).toBe('DM下書き');
    });

    it('作成したDM下書きが getDraftsByUser で取得できる', async () => {
      await upsertDmDraft(userId1, conversationId, 'DM下書き');
      const drafts = await getDraftsByUser(userId1);
      expect(drafts).toHaveLength(1);
      expect(drafts[0].dmConversationId).toBe(conversationId);
    });
  });

  describe('下書き上書き（upsert）', () => {
    it('同一ユーザー × 同一DM会話で2回保存すると1件に集約される', async () => {
      await upsertDmDraft(userId1, conversationId, '1回目');
      await upsertDmDraft(userId1, conversationId, '2回目');
      const drafts = await getDraftsByUser(userId1);
      expect(drafts).toHaveLength(1);
      expect(drafts[0].content).toBe('2回目');
    });
  });

  describe('下書き削除', () => {
    it('DM下書きを削除できる', async () => {
      await upsertDmDraft(userId1, conversationId, 'DM下書き');
      await deleteDmDraft(userId1, conversationId);
      const drafts = await getDraftsByUser(userId1);
      expect(drafts).toHaveLength(0);
    });
  });
});

// ─────────────────────────────────────────────────────────
// draftService ユニット: ユーザー別管理
// ─────────────────────────────────────────────────────────

describe('draftService: ユーザー別管理', () => {
  it('別ユーザーの下書きは getDraftsByUser に混入しない', async () => {
    await upsertChannelDraft(userId1, channelId, 'user1の下書き');
    await testDb.execute('INSERT INTO channel_members (channel_id, user_id) VALUES ($1, $2)', [
      channelId,
      userId2,
    ]);
    await upsertChannelDraft(userId2, channelId, 'user2の下書き');
    const user1Drafts = await getDraftsByUser(userId1);
    expect(user1Drafts).toHaveLength(1);
    expect(user1Drafts[0].content).toBe('user1の下書き');
  });

  it('同じチャンネルでも異なるユーザーはそれぞれ独立した下書きを持つ', async () => {
    await testDb.execute('INSERT INTO channel_members (channel_id, user_id) VALUES ($1, $2)', [
      channelId,
      userId2,
    ]);
    await upsertChannelDraft(userId1, channelId, 'user1の下書き');
    await upsertChannelDraft(userId2, channelId, 'user2の下書き');
    const user1Drafts = await getDraftsByUser(userId1);
    const user2Drafts = await getDraftsByUser(userId2);
    expect(user1Drafts[0].content).toBe('user1の下書き');
    expect(user2Drafts[0].content).toBe('user2の下書き');
  });
});

// ─────────────────────────────────────────────────────────
// 統合: 下書き保存後にメッセージ送信すると下書きが消える
// ─────────────────────────────────────────────────────────

describe('統合: 送信成功時の下書き自動削除', () => {
  it('チャンネルへの下書きを保存後にメッセージを送信すると下書きが削除される', async () => {
    await upsertChannelDraft(userId1, channelId, '送信前の下書き');
    const beforeDrafts = await getDraftsByUser(userId1);
    expect(beforeDrafts).toHaveLength(1);

    await createMessage(channelId, userId1, 'メッセージ送信');
    const afterDrafts = await getDraftsByUser(userId1);
    expect(afterDrafts).toHaveLength(0);
  });

  it('DMへの下書きを保存後にDMを送信すると下書きが削除される', async () => {
    await upsertDmDraft(userId1, conversationId, 'DM送信前の下書き');
    const beforeDrafts = await getDraftsByUser(userId1);
    expect(beforeDrafts).toHaveLength(1);

    await sendDmMessage(conversationId, userId1, 'DMメッセージ送信');
    const afterDrafts = await getDraftsByUser(userId1);
    expect(afterDrafts).toHaveLength(0);
  });
});

// ─────────────────────────────────────────────────────────
// 統合: 空文字列で下書きを削除
// ─────────────────────────────────────────────────────────

describe('統合: 空文字列で下書きを削除', () => {
  it('content が空文字列の場合 upsertChannelDraft は下書きを削除する', async () => {
    await upsertChannelDraft(userId1, channelId, '既存の下書き');
    const result = await upsertChannelDraft(userId1, channelId, '');
    expect(result).toBeNull();
    const drafts = await getDraftsByUser(userId1);
    expect(drafts).toHaveLength(0);
  });

  it('content が空文字列の場合 upsertDmDraft は下書きを削除する', async () => {
    await upsertDmDraft(userId1, conversationId, '既存のDM下書き');
    const result = await upsertDmDraft(userId1, conversationId, '');
    expect(result).toBeNull();
    const drafts = await getDraftsByUser(userId1);
    expect(drafts).toHaveLength(0);
  });
});

// ─────────────────────────────────────────────────────────
// 統合: 下書き削除時に紐付く一時添付も削除される
// ─────────────────────────────────────────────────────────

describe('統合: 下書き削除時の添付ファイル連動削除', () => {
  it('下書き削除時に draft_id で紐付く message_attachments も削除される', async () => {
    const draft = await upsertChannelDraft(userId1, channelId, '添付付き下書き');
    expect(draft).not.toBeNull();
    const draftId = draft!.id;

    // 一時添付ファイルを下書きに紐付け
    await testDb.execute(
      'INSERT INTO message_attachments (url, original_name, size, mime_type, draft_id) VALUES ($1, $2, $3, $4, $5)',
      ['https://example.com/file.png', 'file.png', 1024, 'image/png', draftId],
    );

    // 下書き削除（CASCADE で添付も削除される）
    await deleteDraft(draftId);

    const attachments = await testDb.execute(
      'SELECT * FROM message_attachments WHERE draft_id = $1',
      [draftId],
    );
    expect(attachments.rows).toHaveLength(0);
  });

  it('draft_id が紐付かない添付ファイルは削除されない', async () => {
    const draft = await upsertChannelDraft(userId1, channelId, '下書き');
    expect(draft).not.toBeNull();

    // draft_id なしの添付ファイル（通常のメッセージ添付）
    const msg = await testDb.execute(
      'INSERT INTO messages (channel_id, user_id, content) VALUES ($1, $2, $3) RETURNING id',
      [channelId, userId1, 'メッセージ'],
    );
    const msgId = msg.rows[0].id as number;
    await testDb.execute(
      'INSERT INTO message_attachments (message_id, url, original_name, size, mime_type) VALUES ($1, $2, $3, $4, $5)',
      [msgId, 'https://example.com/other.png', 'other.png', 512, 'image/png'],
    );

    // 下書きを削除
    await deleteDraft(draft!.id);

    const attachments = await testDb.execute(
      'SELECT * FROM message_attachments WHERE message_id = $1',
      [msgId],
    );
    expect(attachments.rows).toHaveLength(1);
  });
});
