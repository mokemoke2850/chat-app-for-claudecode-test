/**
 * 管理者向け孤立ファイルクリーンアップのサービステスト
 *
 * テスト対象: packages/server/src/services/adminService.ts
 * 戦略: pg-mem と fs モックを使い、孤立判定・保護期間・メタデータ・
 * DB/実ファイル削除の整合性を検証する。
 */

import fs from 'fs';
import path from 'path';
import { getSharedTestDatabase, resetTestData } from '../__fixtures__/pgTestHelper';

const testDb = getSharedTestDatabase();

jest.mock('../../db/database', () => testDb);

import { deleteOrphanFiles, getOrphanFiles } from '../../services/adminService';

const NOW = new Date('2026-06-21T12:00:00.000Z');
const OLD = '2026-06-20T11:59:59.000Z';
const BOUNDARY = '2026-06-20T12:00:00.000Z';
const RECENT = '2026-06-20T12:00:01.000Z';

let uploaderId: number;
let messageId: number;
let draftId: number;
let scheduledMessageId: number;

async function insertAttachment(
  overrides: {
    messageId?: number | null;
    draftId?: number | null;
    scheduledMessageId?: number | null;
    uploadedBy?: number | null;
    url?: string;
    originalName?: string;
    size?: number;
    createdAt?: string;
  } = {},
): Promise<number> {
  const result = await testDb.execute(
    `INSERT INTO message_attachments
       (message_id, draft_id, scheduled_message_id, uploaded_by, url, original_name, size, mime_type, created_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, 'text/plain', $8)
     RETURNING id`,
    [
      overrides.messageId ?? null,
      overrides.draftId ?? null,
      overrides.scheduledMessageId ?? null,
      overrides.uploadedBy === undefined ? uploaderId : overrides.uploadedBy,
      overrides.url ?? '/uploads/orphan.txt',
      overrides.originalName ?? 'orphan.txt',
      overrides.size ?? 1234,
      overrides.createdAt ?? OLD,
    ],
  );
  return Number(result.rows[0].id);
}

beforeEach(async () => {
  await resetTestData(testDb);
  jest.restoreAllMocks();

  const user = await testDb.execute(
    `INSERT INTO users (username, email, password_hash)
     VALUES ('uploader', 'uploader@example.com', 'hash') RETURNING id`,
  );
  uploaderId = Number(user.rows[0].id);
  const channel = await testDb.execute(
    `INSERT INTO channels (name, created_by) VALUES ('cleanup', $1) RETURNING id`,
    [uploaderId],
  );
  const channelId = Number(channel.rows[0].id);
  const message = await testDb.execute(
    `INSERT INTO messages (channel_id, user_id, content) VALUES ($1, $2, '{}') RETURNING id`,
    [channelId, uploaderId],
  );
  messageId = Number(message.rows[0].id);
  const draft = await testDb.execute(
    `INSERT INTO drafts (user_id, channel_id, content) VALUES ($1, $2, '{}') RETURNING id`,
    [uploaderId, channelId],
  );
  draftId = Number(draft.rows[0].id);
  const scheduled = await testDb.execute(
    `INSERT INTO scheduled_messages (user_id, channel_id, content, scheduled_at)
     VALUES ($1, $2, '{}', '2026-06-22T12:00:00.000Z') RETURNING id`,
    [uploaderId, channelId],
  );
  scheduledMessageId = Number(scheduled.rows[0].id);
});

describe('管理者向け孤立ファイルクリーンアップ', () => {
  describe('孤立ファイル一覧', () => {
    it('3つの参照IDがすべてNULLでアップロードから24時間以上経過したファイルを返す', async () => {
      const id = await insertAttachment();
      expect(await getOrphanFiles(NOW)).toEqual([
        expect.objectContaining({ id, originalName: 'orphan.txt' }),
      ]);
    });

    it('message_idでメッセージに参照されたファイルを候補から除外する', async () => {
      await insertAttachment({ messageId });
      expect(await getOrphanFiles(NOW)).toEqual([]);
    });

    it('draft_idで下書きに参照されたファイルを候補から除外する', async () => {
      await insertAttachment({ draftId });
      expect(await getOrphanFiles(NOW)).toEqual([]);
    });

    it('scheduled_message_idで予約送信に参照されたファイルを候補から除外する', async () => {
      await insertAttachment({ scheduledMessageId });
      expect(await getOrphanFiles(NOW)).toEqual([]);
    });

    it('アップロードから24時間未満の未参照ファイルを候補から除外する', async () => {
      await insertAttachment({ createdAt: RECENT });
      expect(await getOrphanFiles(NOW)).toEqual([]);
    });

    it('アップロードからちょうど24時間経過した未参照ファイルを候補に含める', async () => {
      const id = await insertAttachment({ createdAt: BOUNDARY });
      expect((await getOrphanFiles(NOW)).map((file) => file.id)).toEqual([id]);
    });

    it('候補のID・ファイル名・サイズ・アップロード日時・アップロード者を返す', async () => {
      const id = await insertAttachment();
      expect(await getOrphanFiles(NOW)).toEqual([
        {
          id,
          originalName: 'orphan.txt',
          size: 1234,
          createdAt: new Date(OLD).toISOString(),
          uploader: { id: uploaderId, username: 'uploader' },
        },
      ]);
    });

    it('アップロード者が削除済みまたは不明な場合も一覧取得できる', async () => {
      const id = await insertAttachment({ uploadedBy: null });
      expect(await getOrphanFiles(NOW)).toEqual([expect.objectContaining({ id, uploader: null })]);
    });
  });

  describe('孤立ファイル削除', () => {
    it('孤立ファイルをDBとアップロードディレクトリの両方から削除する', async () => {
      const id = await insertAttachment();
      const unlink = jest.spyOn(fs, 'unlinkSync').mockImplementation(() => undefined);

      expect(await deleteOrphanFiles([id], NOW)).toEqual({
        deletedIds: [id],
        skippedIds: [],
        failed: [],
      });
      expect(unlink).toHaveBeenCalledWith(path.join(process.cwd(), 'uploads', 'orphan.txt'));
      expect(
        (await testDb.execute('SELECT id FROM message_attachments WHERE id = $1', [id])).rows,
      ).toEqual([]);
    });

    it('パーセントエンコードされたファイルURLから対象の実ファイルを削除する', async () => {
      const id = await insertAttachment({ url: '/uploads/%E8%B3%87%E6%96%99.txt' });
      const unlink = jest.spyOn(fs, 'unlinkSync').mockImplementation(() => undefined);

      await deleteOrphanFiles([id], NOW);

      expect(unlink).toHaveBeenCalledWith(path.join(process.cwd(), 'uploads', '資料.txt'));
    });

    it('実ファイルが存在しない孤立ファイルはDBから削除する', async () => {
      const id = await insertAttachment();
      jest.spyOn(fs, 'unlinkSync').mockImplementation(() => {
        throw Object.assign(new Error('not found'), { code: 'ENOENT' });
      });

      expect((await deleteOrphanFiles([id], NOW)).deletedIds).toEqual([id]);
      expect(
        (await testDb.execute('SELECT id FROM message_attachments WHERE id = $1', [id])).rows,
      ).toEqual([]);
    });

    it('複数の孤立ファイルを一括削除する', async () => {
      const first = await insertAttachment({ url: '/uploads/first.txt' });
      const second = await insertAttachment({ url: '/uploads/second.txt' });
      jest.spyOn(fs, 'unlinkSync').mockImplementation(() => undefined);

      expect(await deleteOrphanFiles([first, second], NOW)).toEqual({
        deletedIds: [first, second],
        skippedIds: [],
        failed: [],
      });
    });

    it('削除時点で参照済みまたは24時間未満のファイルを再判定して削除しない', async () => {
      const referenced = await insertAttachment({ messageId });
      const recent = await insertAttachment({ createdAt: RECENT });
      const unlink = jest.spyOn(fs, 'unlinkSync').mockImplementation(() => undefined);

      expect(await deleteOrphanFiles([referenced, recent], NOW)).toEqual({
        deletedIds: [],
        skippedIds: [referenced, recent],
        failed: [],
      });
      expect(unlink).not.toHaveBeenCalled();
    });

    it('実ファイルの削除に失敗したファイルはDBレコードを残して失敗結果を返す', async () => {
      const id = await insertAttachment();
      jest.spyOn(fs, 'unlinkSync').mockImplementation(() => {
        throw new Error('permission denied');
      });

      expect(await deleteOrphanFiles([id], NOW)).toEqual({
        deletedIds: [],
        skippedIds: [],
        failed: [{ id, error: 'permission denied' }],
      });
      expect(
        (await testDb.execute('SELECT id FROM message_attachments WHERE id = $1', [id])).rows,
      ).toHaveLength(1);
    });

    it('アップロードディレクトリ外を指す不正なURLのファイルを削除しない', async () => {
      const id = await insertAttachment({ url: '/uploads/..%2Fsecret.txt' });
      const unlink = jest.spyOn(fs, 'unlinkSync').mockImplementation(() => undefined);

      expect((await deleteOrphanFiles([id], NOW)).failed).toEqual([
        { id, error: '不正なファイルURLです' },
      ]);
      expect(unlink).not.toHaveBeenCalled();
    });
  });
});
