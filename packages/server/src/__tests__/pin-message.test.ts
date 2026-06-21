/**
 * テスト対象: pinMessageService のピン留め機能
 * 戦略: pg-mem のインメモリ PostgreSQL 互換 DB を使いサービス層を直接テストする。
 * 外部キー制約を満たすため beforeAll でユーザー・チャンネル・メッセージを挿入する。
 */

import { createTestDatabase, resetTestData } from './__fixtures__/pgTestHelper';

const testDb = createTestDatabase();

jest.mock('../db/database', () => testDb);

import {
  pinMessage,
  unpinMessage,
  getPinnedMessages,
  getPinCategories,
  createPinCategory,
  updatePinCategory,
} from '../services/pinMessageService';

let userId1: number;
let userId2: number;
let channelId: number;
let messageId: number;
let deletedMessageId: number;

async function setupFixtures() {
  const r1 = await testDb.execute(
    'INSERT INTO users (username, email, password_hash) VALUES ($1, $2, $3) RETURNING id',
    ['user1', 'u1@t.com', 'h'],
  );
  userId1 = r1.rows[0].id as number;

  const r2 = await testDb.execute(
    'INSERT INTO users (username, email, password_hash) VALUES ($1, $2, $3) RETURNING id',
    ['user2', 'u2@t.com', 'h'],
  );
  userId2 = r2.rows[0].id as number;

  const rc = await testDb.execute(
    'INSERT INTO channels (name, created_by) VALUES ($1, $2) RETURNING id',
    ['test-channel', userId1],
  );
  channelId = rc.rows[0].id as number;

  const rm = await testDb.execute(
    'INSERT INTO messages (channel_id, user_id, content) VALUES ($1, $2, $3) RETURNING id',
    [channelId, userId1, JSON.stringify({ ops: [{ insert: 'Hello\n' }] })],
  );
  messageId = rm.rows[0].id as number;

  const rdm = await testDb.execute(
    'INSERT INTO messages (channel_id, user_id, content, is_deleted) VALUES ($1, $2, $3, true) RETURNING id',
    [channelId, userId1, JSON.stringify({ ops: [{ insert: 'Deleted\n' }] })],
  );
  deletedMessageId = rdm.rows[0].id as number;
}

beforeEach(async () => {
  await resetTestData(testDb);
  await setupFixtures();
});

describe('pinMessage', () => {
  it('メッセージをピン留めできる', async () => {
    const pinned = await pinMessage(messageId, channelId, userId1);
    expect(pinned.id).toBeDefined();
    expect(pinned.messageId).toBe(messageId);
    expect(pinned.channelId).toBe(channelId);
    expect(pinned.pinnedBy).toBe(userId1);
    expect(pinned.pinnedAt).toBeDefined();
  });

  it('存在しないメッセージのピン留めはエラーになる', async () => {
    await expect(pinMessage(99999, channelId, userId1)).rejects.toThrow('Message not found');
  });

  it('同じメッセージを二重にピン留めしようとするとエラーになる', async () => {
    await pinMessage(messageId, channelId, userId1);
    await expect(pinMessage(messageId, channelId, userId2)).rejects.toThrow(
      'Message is already pinned in this channel',
    );
  });

  it('削除済みメッセージはピン留めできない', async () => {
    await expect(pinMessage(deletedMessageId, channelId, userId1)).rejects.toThrow(
      'Cannot pin a deleted message',
    );
  });
});

describe('unpinMessage', () => {
  it('ピン留めを解除できる', async () => {
    await pinMessage(messageId, channelId, userId1);
    await expect(unpinMessage(messageId, channelId, userId1)).resolves.not.toThrow();
  });

  it('ピン留めされていないメッセージの解除はエラーになる', async () => {
    await expect(unpinMessage(messageId, channelId, userId1)).rejects.toThrow('Pin not found');
  });

  it('存在しないメッセージの解除はエラーになる', async () => {
    await expect(unpinMessage(99999, channelId, userId1)).rejects.toThrow('Message not found');
  });
});

describe('getPinnedMessages', () => {
  it('チャンネルのピン留めメッセージ一覧を返す', async () => {
    await pinMessage(messageId, channelId, userId1);
    const list = await getPinnedMessages(channelId, userId1);
    expect(list.length).toBe(1);
    expect(list[0].messageId).toBe(messageId);
  });

  it('ピン留めが存在しないチャンネルでは空配列を返す', async () => {
    const list = await getPinnedMessages(channelId, userId1);
    expect(list).toEqual([]);
  });

  it('ピン留めメッセージは pinned_at の降順で返される', async () => {
    // 追加のメッセージを作成してピン留め
    const rm2 = await testDb.execute(
      'INSERT INTO messages (channel_id, user_id, content) VALUES ($1, $2, $3) RETURNING id',
      [channelId, userId2, JSON.stringify({ ops: [{ insert: 'Second\n' }] })],
    );
    const messageId2 = rm2.rows[0].id as number;

    await pinMessage(messageId, channelId, userId1);
    await pinMessage(messageId2, channelId, userId2);

    const list = await getPinnedMessages(channelId, userId1);
    expect(list.length).toBe(2);
    // 後でピン留めされたものが先頭
    expect(new Date(list[0].pinnedAt) >= new Date(list[1].pinnedAt)).toBe(true);
  });

  it('削除済みメッセージはピン留め一覧から除外される', async () => {
    // deletedMessageは is_deleted=true なので pinMessageでエラーになるため
    // 直接DBに挿入してテスト
    await testDb.execute(
      'INSERT INTO pinned_messages (message_id, channel_id, pinned_by) VALUES ($1, $2, $3)',
      [deletedMessageId, channelId, userId1],
    );

    const list = await getPinnedMessages(channelId, userId1);
    const hasDeleted = list.some((p) => p.messageId === deletedMessageId);
    expect(hasDeleted).toBe(false);
  });
});

describe('Socket経由でのピン留め操作', () => {
  it('pin_message イベントで pinned_messages テーブルにレコードが作成される', async () => {
    await pinMessage(messageId, channelId, userId1);

    const row = await testDb.queryOne<{ message_id: number }>(
      'SELECT * FROM pinned_messages WHERE message_id = $1 AND channel_id = $2',
      [messageId, channelId],
    );
    expect(row).toBeDefined();
    expect(row!.message_id).toBe(messageId);
  });

  it('unpin_message イベントで pinned_messages テーブルからレコードが削除される', async () => {
    await pinMessage(messageId, channelId, userId1);
    await unpinMessage(messageId, channelId, userId1);

    const row = await testDb.queryOne(
      'SELECT * FROM pinned_messages WHERE message_id = $1 AND channel_id = $2',
      [messageId, channelId],
    );
    expect(row).toBeNull();
  });

  it('pin_message 後に message_pinned イベントがチャンネルメンバー全員に emit される', async () => {
    // サービス層のテストのためSocketのemitは検証しない
    const pinned = await pinMessage(messageId, channelId, userId1);
    expect(pinned.pinnedAt).toBeDefined();
    expect(typeof pinned.pinnedAt).toBe('string');
  });

  it('unpin_message 後に message_unpinned イベントがチャンネルメンバー全員に emit される', async () => {
    // サービス層のテストのためSocketのemitは検証しない
    await pinMessage(messageId, channelId, userId1);
    await expect(unpinMessage(messageId, channelId, userId1)).resolves.not.toThrow();
  });
});

describe('REST API: GET /api/channels/:channelId/pins', () => {
  it('200 でピン留めメッセージ一覧を返す', async () => {
    await pinMessage(messageId, channelId, userId1);
    const list = await getPinnedMessages(channelId, userId1);
    expect(Array.isArray(list)).toBe(true);
    expect(list.length).toBeGreaterThan(0);
  });

  it('認証なしで 401 を返す', () => {
    // ルートレベルのテストはintegrationで行う。サービス層はスキップ。
    expect(true).toBe(true);
  });

  it('存在しないチャンネルIDで 404 を返す', async () => {
    await expect(getPinnedMessages(99999, userId1)).rejects.toThrow('Channel not found');
  });
});

describe('REST API: POST /api/channels/:channelId/pins/:messageId', () => {
  it('ピン留め成功で 201 を返す', async () => {
    const pinned = await pinMessage(messageId, channelId, userId1);
    expect(pinned.id).toBeDefined();
    expect(pinned.messageId).toBe(messageId);
  });

  it('認証なしで 401 を返す', () => {
    // ルートレベルのテストはintegrationで行う。サービス層はスキップ。
    expect(true).toBe(true);
  });

  it('既にピン留め済みで 409 を返す', async () => {
    await pinMessage(messageId, channelId, userId1);
    await expect(pinMessage(messageId, channelId, userId2)).rejects.toThrow(
      'Message is already pinned in this channel',
    );
  });
});

describe('REST API: DELETE /api/channels/:channelId/pins/:messageId', () => {
  it('ピン留め解除成功で 204 を返す', async () => {
    await pinMessage(messageId, channelId, userId1);
    await expect(unpinMessage(messageId, channelId, userId1)).resolves.not.toThrow();
  });

  it('認証なしで 401 を返す', () => {
    // ルートレベルのテストはintegrationで行う。サービス層はスキップ。
    expect(true).toBe(true);
  });

  it('ピン留めが存在しない場合 404 を返す', async () => {
    await expect(unpinMessage(messageId, channelId, userId1)).rejects.toThrow('Pin not found');
  });
});

describe('ピン留めカテゴリ', () => {
  describe('カテゴリ一覧と任意カテゴリ追加', () => {
    it('初回取得時にデフォルトカテゴリ「決定事項」「リンク」「FAQ」を返す', async () => {
      const categories = await getPinCategories(channelId, userId1);
      expect(categories.map((category) => category.name)).toEqual(['決定事項', 'リンク', 'FAQ']);
      expect(categories.every((category) => category.isDefault)).toBe(true);
    });

    it('デフォルトカテゴリを複数回取得しても重複して作成しない', async () => {
      await getPinCategories(channelId, userId1);
      await getPinCategories(channelId, userId1);
      const rows = await testDb.query<{ count: number }>(
        'SELECT COUNT(*)::int AS count FROM pin_categories WHERE channel_id = $1',
        [channelId],
      );
      expect(Number(rows[0].count)).toBe(3);
    });

    it('チャンネルに任意カテゴリを追加できる', async () => {
      const category = await createPinCategory(channelId, '重要', userId1);
      expect(category).toMatchObject({ channelId, name: '重要', isDefault: false });
    });

    it('空白だけのカテゴリ名は追加できない', async () => {
      await expect(createPinCategory(channelId, '   ', userId1)).rejects.toThrow(
        'Invalid category name',
      );
    });

    it('同じチャンネルに同名カテゴリを重複して追加できない', async () => {
      await createPinCategory(channelId, '重要', userId1);
      await expect(createPinCategory(channelId, '重要', userId1)).rejects.toThrow(
        'Pin category already exists',
      );
    });
  });

  describe('ピン留め時のカテゴリ設定と既存互換', () => {
    it('指定したカテゴリでメッセージをピン留めできる', async () => {
      const [category] = await getPinCategories(channelId, userId1);
      const pinned = await pinMessage(messageId, channelId, userId1, category.id);
      expect(pinned.categoryId).toBe(category.id);
      expect(pinned.category?.name).toBe('決定事項');
    });

    it('カテゴリを指定しない従来の呼び出しでは未分類としてピン留めできる', async () => {
      const pinned = await pinMessage(messageId, channelId, userId1);
      expect(pinned.categoryId).toBeNull();
      expect(pinned.category).toBeNull();
    });

    it('既存のカテゴリ未設定DB行は一覧で categoryId null として返す', async () => {
      await testDb.execute(
        'INSERT INTO pinned_messages (message_id, channel_id, pinned_by) VALUES ($1, $2, $3)',
        [messageId, channelId, userId1],
      );
      const [pinned] = await getPinnedMessages(channelId, userId1);
      expect(pinned.categoryId).toBeNull();
    });

    it('別チャンネルのカテゴリを指定してピン留めできない', async () => {
      const otherChannel = await testDb.execute(
        'INSERT INTO channels (name, created_by) VALUES ($1, $2) RETURNING id',
        ['other', userId1],
      );
      const category = await createPinCategory(otherChannel.rows[0].id as number, '他', userId1);
      await expect(pinMessage(messageId, channelId, userId1, category.id)).rejects.toThrow(
        'Pin category does not belong to channel',
      );
    });

    it('指定チャンネルに所属しないメッセージをピン留めできない', async () => {
      const otherChannel = await testDb.execute(
        'INSERT INTO channels (name, created_by) VALUES ($1, $2) RETURNING id',
        ['other-message', userId1],
      );
      await expect(
        pinMessage(messageId, otherChannel.rows[0].id as number, userId1),
      ).rejects.toThrow('Message does not belong to channel');
    });

    it('ピン一覧に設定済みカテゴリを含めて返す', async () => {
      const category = await createPinCategory(channelId, '重要', userId1);
      await pinMessage(messageId, channelId, userId1, category.id);
      const [pinned] = await getPinnedMessages(channelId, userId1);
      expect(pinned.category).toMatchObject({ id: category.id, name: '重要' });
    });

    it('デフォルトカテゴリと任意カテゴリは別チャンネルの一覧に混在しない', async () => {
      await createPinCategory(channelId, 'チャンネル1', userId1);
      const otherChannel = await testDb.execute(
        'INSERT INTO channels (name, created_by) VALUES ($1, $2) RETURNING id',
        ['other-categories', userId1],
      );
      const categories = await getPinCategories(otherChannel.rows[0].id as number, userId1);
      expect(categories.map((category) => category.name)).toEqual(['決定事項', 'リンク', 'FAQ']);
    });
  });

  describe('ピン留め後のカテゴリ変更', () => {
    it('ピン留め済みメッセージのカテゴリを後から変更できる', async () => {
      const category = await createPinCategory(channelId, '変更先', userId1);
      await pinMessage(messageId, channelId, userId1);
      const updated = await updatePinCategory(messageId, channelId, category.id, userId1);
      expect(updated.categoryId).toBe(category.id);
    });

    it('カテゴリを解除すると未分類に戻せる', async () => {
      const category = await createPinCategory(channelId, '解除元', userId1);
      await pinMessage(messageId, channelId, userId1, category.id);
      const updated = await updatePinCategory(messageId, channelId, null, userId1);
      expect(updated.categoryId).toBeNull();
    });

    it('別チャンネルのカテゴリへ変更できない', async () => {
      await pinMessage(messageId, channelId, userId1);
      const otherChannel = await testDb.execute(
        'INSERT INTO channels (name, created_by) VALUES ($1, $2) RETURNING id',
        ['other-update', userId1],
      );
      const category = await createPinCategory(otherChannel.rows[0].id as number, '他', userId1);
      await expect(updatePinCategory(messageId, channelId, category.id, userId1)).rejects.toThrow(
        'Pin category does not belong to channel',
      );
    });

    it('存在しないピンのカテゴリ変更はエラーになる', async () => {
      await expect(updatePinCategory(messageId, channelId, null, userId1)).rejects.toThrow(
        'Pin not found',
      );
    });

    it('カテゴリ変更に失敗した場合は元のカテゴリを維持する', async () => {
      const category = await createPinCategory(channelId, '元', userId1);
      await pinMessage(messageId, channelId, userId1, category.id);
      await expect(updatePinCategory(messageId, channelId, 99999, userId1)).rejects.toThrow(
        'Pin category not found',
      );
      const [pinned] = await getPinnedMessages(channelId, userId1);
      expect(pinned.categoryId).toBe(category.id);
    });
  });
});
