/**
 * MessageService のユニットテスト
 *
 * テスト対象: packages/server/src/services/messageService.ts
 * - createMessage: メッセージ作成（メンション付き投稿も対応）
 * - getChannelMessages: チャンネルのメッセージ一覧取得（カーソルページネーション）
 * - editMessage: メッセージ編集（投稿者のみ許可）
 * - deleteMessage: メッセージのソフトデリート（投稿者のみ許可）
 * - getMessageById: ID でメッセージを取得
 *
 * DB 戦略: pg-mem のインメモリ PostgreSQL 互換 DB を使用。
 * メッセージは users と channels への外部キーを持つため、
 * beforeAll でテスト用ユーザー・チャンネルを直接 INSERT している。
 */

import { createTestDatabase } from '../__fixtures__/pgTestHelper';

const testDb = createTestDatabase();

jest.mock('../../db/database', () => testDb);

import {
  createMessage,
  getChannelMessages,
  editMessage,
  deleteMessage,
  getMessageById,
} from '../../services/messageService';

// テスト全体で共有するユーザー・チャンネルの ID
let userId1: number;
let userId2: number;
let channelId: number;

beforeAll(async () => {
  // messageService の外部キー制約を満たすため、
  // 2ユーザー（投稿者・第三者）とテスト用チャンネルを直接 DB に挿入する
  const r1 = await testDb.execute(
    "INSERT INTO users (username, email, password_hash) VALUES ($1, $2, $3) RETURNING id",
    ['user1', 'u1@t.com', 'h'],
  );
  userId1 = r1.rows[0].id as number;

  const r2 = await testDb.execute(
    "INSERT INTO users (username, email, password_hash) VALUES ($1, $2, $3) RETURNING id",
    ['user2', 'u2@t.com', 'h'],
  );
  userId2 = r2.rows[0].id as number;

  const rc = await testDb.execute(
    "INSERT INTO channels (name, created_by) VALUES ($1, $2) RETURNING id",
    ['test-channel', userId1],
  );
  channelId = rc.rows[0].id as number;
});

// ProseMirror JSON 形式のサンプルメッセージコンテンツ
const sampleContent = JSON.stringify({ type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Hello' }] }] });

describe('MessageService', () => {
  describe('createMessage', () => {
    it('メッセージを作成し、必要なフィールドをすべて持つオブジェクトを返す', async () => {
      const msg = await createMessage(channelId, userId1, sampleContent);

      expect(msg.id).toBeDefined();
      expect(msg.channelId).toBe(channelId);
      expect(msg.userId).toBe(userId1);
      expect(msg.content).toBe(sampleContent);
      // 新規作成直後は未編集・未削除状態
      expect(msg.isEdited).toBe(false);
      expect(msg.isDeleted).toBe(false);
    });

    it('mentionedUserIds を渡すと mentions フィールドにユーザー ID が含まれる', async () => {
      // @メンション機能: mentions テーブルへの挿入と取得の確認
      const msg = await createMessage(channelId, userId1, sampleContent, [userId2]);
      expect(msg.mentions).toContain(userId2);
    });
  });

  describe('getChannelMessages', () => {
    it('メッセージを昇順（古い順）で返す', async () => {
      await createMessage(channelId, userId1, sampleContent);
      await createMessage(channelId, userId2, sampleContent);
      const messages = await getChannelMessages(channelId);

      expect(messages.length).toBeGreaterThan(0);
      // id の昇順になっていること（内部では DESC で取得して reverse() している）
      for (let i = 1; i < messages.length; i++) {
        expect(messages[i].id).toBeGreaterThanOrEqual(messages[i - 1].id);
      }
    });

    it('before パラメータを指定するとカーソル以前のメッセージだけを返す', async () => {
      const first = await createMessage(channelId, userId1, sampleContent);
      const second = await createMessage(channelId, userId1, sampleContent);

      // second.id をカーソルとして指定 → second 自身は含まれず first は含まれる
      const page = await getChannelMessages(channelId, 10, second.id);
      const ids = page.map((m) => m.id);

      expect(ids).not.toContain(second.id);
      expect(ids).toContain(first.id);
    });
  });

  describe('editMessage', () => {
    it('投稿者がメッセージを編集すると内容が更新され isEdited が true になる', async () => {
      const msg = await createMessage(channelId, userId1, sampleContent);
      const newContent = JSON.stringify({ type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Updated' }] }] });

      const edited = await editMessage(msg.id, userId1, newContent);

      expect(edited.content).toBe(newContent);
      // 編集済みフラグが立っていること
      expect(edited.isEdited).toBe(true);
    });

    it('投稿者以外が編集しようとすると 403 を投げる', async () => {
      const msg = await createMessage(channelId, userId1, sampleContent);

      // userId2 は投稿者ではないため編集不可 → 403 Forbidden
      await expect(editMessage(msg.id, userId2, sampleContent)).rejects.toMatchObject({
        statusCode: 403,
      });
    });

    it('存在しないメッセージを編集しようとすると 404 を投げる', async () => {
      await expect(editMessage(99999, userId1, sampleContent)).rejects.toMatchObject({
        statusCode: 404,
      });
    });
  });

  describe('deleteMessage', () => {
    it('投稿者が削除するとソフトデリートされ isDeleted が true になる', async () => {
      const msg = await createMessage(channelId, userId1, sampleContent);

      // 物理削除ではなくソフトデリート（is_deleted = true）
      await deleteMessage(msg.id, userId1);
      const found = await getMessageById(msg.id);
      expect(found?.isDeleted).toBe(true);
    });

    it('投稿者以外が削除しようとすると 403 を投げる', async () => {
      const msg = await createMessage(channelId, userId1, sampleContent);

      // userId2 は投稿者ではないため削除不可 → 403 Forbidden
      await expect(deleteMessage(msg.id, userId2)).rejects.toMatchObject({
        statusCode: 403,
      });
    });

    it('存在しないメッセージを削除しようとすると 404 を投げる', async () => {
      await expect(deleteMessage(99999, userId1)).rejects.toMatchObject({
        statusCode: 404,
      });
    });
  });

  describe('getMessageById', () => {
    it('存在する ID を渡すとメッセージを返す', async () => {
      const msg = await createMessage(channelId, userId1, sampleContent);
      expect(await getMessageById(msg.id)).not.toBeNull();
    });

    it('存在しない ID を渡すと null を返す', async () => {
      expect(await getMessageById(99999)).toBeNull();
    });
  });
});
