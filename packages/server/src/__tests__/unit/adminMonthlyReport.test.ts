/**
 * 月次レポート CSV ビルダーのユニットテスト（Issue #273）
 *
 * テスト対象: packages/server/src/services/adminService.ts に追加する
 *           buildMonthlyReportCsv 関数
 * 戦略:
 *   - pg-mem を使い、users / channels / messages / message_attachments を投入し
 *     ユーザー別投稿数・チャンネル別投稿数・ファイル容量の集計と CSV フォーマットを検証する
 *   - CSV は既存の audit log エクスポート（buildAuditLogsCsv）と同じ規約に従う:
 *     - UTF-8 BOM 先頭付与
 *     - 改行は CRLF
 *     - RFC 4180 準拠（カンマ・改行・ダブルクォートをエスケープ）
 *   - 月の境界（指定月の 1 日 00:00 UTC ～ 翌月 1 日 00:00 UTC）が正しいことを確認する
 */

import { createTestDatabase } from '../__fixtures__/pgTestHelper';

const testDb = createTestDatabase();

jest.mock('../../db/database', () => testDb);

import * as adminService from '../../services/adminService';

async function clearAll(): Promise<void> {
  await testDb.execute('DELETE FROM message_attachments', []);
  await testDb.execute('DELETE FROM messages', []);
  await testDb.execute('DELETE FROM channel_members', []);
  await testDb.execute('DELETE FROM channels', []);
  await testDb.execute('DELETE FROM users', []);
}

async function insertUser(username: string): Promise<number> {
  const result = await testDb.execute(
    `INSERT INTO users (username, email, password_hash) VALUES ($1, $2, 'h') RETURNING id`,
    [username, `${username}@e.com`],
  );
  return result.rows[0].id as number;
}

async function insertChannel(name: string): Promise<number> {
  const result = await testDb.execute(`INSERT INTO channels (name) VALUES ($1) RETURNING id`, [
    name,
  ]);
  return result.rows[0].id as number;
}

async function insertMessageAt(
  channelId: number,
  userId: number,
  content: string,
  createdAt: string,
  isDeleted = false,
): Promise<number> {
  const result = await testDb.execute(
    `INSERT INTO messages (channel_id, user_id, content, created_at, is_deleted)
     VALUES ($1, $2, $3, $4, $5) RETURNING id`,
    [channelId, userId, content, createdAt, isDeleted],
  );
  return result.rows[0].id as number;
}

async function insertAttachment(messageId: number, size: number, createdAt: string): Promise<void> {
  await testDb.execute(
    `INSERT INTO message_attachments (message_id, url, original_name, size, mime_type, created_at)
     VALUES ($1, 'http://x', 'f.bin', $2, 'application/octet-stream', $3)`,
    [messageId, size, createdAt],
  );
}

function decode(buf: Buffer): string {
  // BOM を取り除いてデコード
  if (buf[0] === 0xef && buf[1] === 0xbb && buf[2] === 0xbf) {
    return buf.subarray(3).toString('utf8');
  }
  return buf.toString('utf8');
}

describe('月次レポート CSV ビルダー（buildMonthlyReportCsv）', () => {
  beforeEach(async () => {
    await clearAll();
  });

  describe('対象月パラメータの解釈', () => {
    it('YYYY-MM 形式の文字列を受け取り、その月の UTC 1日 00:00:00 〜 翌月 1日 00:00:00 を集計範囲とする', async () => {
      const u = await insertUser('u1');
      const c = await insertChannel('c1');
      // 2026-04 内
      await insertMessageAt(c, u, 'inside', '2026-04-15T12:00:00Z');
      // 2026-04 の前後
      await insertMessageAt(c, u, 'before', '2026-03-31T23:59:59Z');
      await insertMessageAt(c, u, 'after', '2026-05-01T00:00:00Z');

      const buf = await adminService.buildMonthlyReportCsv({ year: 2026, month: 4 });
      const text = decode(buf);
      // ユーザー u1 の投稿数は 1
      expect(text).toMatch(/u1.*?,1/);
      // 投稿数 2 や 3 が含まれていないこと（境界が正しい）
      const userSection = text.split('# Channels')[0];
      expect(userSection).not.toMatch(/,2(\r|$)/);
      expect(userSection).not.toMatch(/,3(\r|$)/);
    });

    it('不正な月（例: month=13）を渡すと例外を投げる', async () => {
      await expect(adminService.buildMonthlyReportCsv({ year: 2026, month: 13 })).rejects.toThrow();
    });

    it('不正な月（例: month=0）を渡すと例外を投げる', async () => {
      await expect(adminService.buildMonthlyReportCsv({ year: 2026, month: 0 })).rejects.toThrow();
    });

    it('対象月の境界外（前月末・翌月初）のメッセージは集計に含まれない', async () => {
      const u = await insertUser('userA');
      const c = await insertChannel('chA');
      await insertMessageAt(c, u, 'in', '2026-04-01T00:00:00Z');
      await insertMessageAt(c, u, 'before', '2026-03-31T23:59:59Z');
      await insertMessageAt(c, u, 'after', '2026-05-01T00:00:01Z');

      const buf = await adminService.buildMonthlyReportCsv({ year: 2026, month: 4 });
      const text = decode(buf);
      // userA の投稿数は 1
      const usersSection = text.split('# Channels')[0];
      const lines = usersSection.split('\r\n').filter((l) => l.includes(',userA,'));
      expect(lines).toHaveLength(1);
      expect(lines[0]).toMatch(/,1$/);
    });
  });

  describe('ユーザー別投稿数の集計', () => {
    it('対象月内のユーザー別投稿数（is_deleted=false のみ）を正しく集計する', async () => {
      const u1 = await insertUser('alice');
      const u2 = await insertUser('bob');
      const c = await insertChannel('general');
      await insertMessageAt(c, u1, 'a', '2026-04-10T00:00:00Z');
      await insertMessageAt(c, u1, 'a', '2026-04-11T00:00:00Z');
      await insertMessageAt(c, u2, 'b', '2026-04-12T00:00:00Z');

      const buf = await adminService.buildMonthlyReportCsv({ year: 2026, month: 4 });
      const text = decode(buf);
      const users = text.split('# Channels')[0];
      expect(users).toMatch(/alice.*?,2/);
      expect(users).toMatch(/bob.*?,1/);
    });

    it('論理削除済みメッセージ（is_deleted=true）は集計対象外', async () => {
      const u = await insertUser('alice');
      const c = await insertChannel('g');
      await insertMessageAt(c, u, 'live', '2026-04-10T00:00:00Z');
      await insertMessageAt(c, u, 'dead', '2026-04-11T00:00:00Z', true);

      const buf = await adminService.buildMonthlyReportCsv({ year: 2026, month: 4 });
      const text = decode(buf);
      const users = text.split('# Channels')[0];
      expect(users).toMatch(/alice.*?,1/);
      expect(users).not.toMatch(/alice.*?,2/);
    });

    it('投稿数の多い順（降順）で並ぶ', async () => {
      const u1 = await insertUser('few');
      const u2 = await insertUser('many');
      const c = await insertChannel('g');
      await insertMessageAt(c, u1, 'x', '2026-04-10T00:00:00Z');
      await insertMessageAt(c, u2, 'x', '2026-04-10T00:00:00Z');
      await insertMessageAt(c, u2, 'x', '2026-04-11T00:00:00Z');
      await insertMessageAt(c, u2, 'x', '2026-04-12T00:00:00Z');

      const buf = await adminService.buildMonthlyReportCsv({ year: 2026, month: 4 });
      const text = decode(buf);
      const usersSection = text.split('# Channels')[0];
      const manyIdx = usersSection.indexOf('many');
      const fewIdx = usersSection.indexOf('few');
      expect(manyIdx).toBeGreaterThan(0);
      expect(fewIdx).toBeGreaterThan(manyIdx);
    });
  });

  describe('チャンネル別投稿数の集計', () => {
    it('対象月内のチャンネル別投稿数を正しく集計する', async () => {
      const u = await insertUser('u');
      const c1 = await insertChannel('alpha');
      const c2 = await insertChannel('beta');
      await insertMessageAt(c1, u, 'x', '2026-04-10T00:00:00Z');
      await insertMessageAt(c1, u, 'x', '2026-04-11T00:00:00Z');
      await insertMessageAt(c2, u, 'x', '2026-04-12T00:00:00Z');

      const buf = await adminService.buildMonthlyReportCsv({ year: 2026, month: 4 });
      const text = decode(buf);
      const channelsSection = text.split('# Channels')[1].split('# Files')[0];
      expect(channelsSection).toMatch(/alpha.*?,2/);
      expect(channelsSection).toMatch(/beta.*?,1/);
    });
  });

  describe('ファイル容量の集計', () => {
    it('対象月内に作成された message_attachments の size 合計と件数を計算する', async () => {
      const u = await insertUser('u');
      const c = await insertChannel('c');
      const m = await insertMessageAt(c, u, 'x', '2026-04-10T00:00:00Z');
      await insertAttachment(m, 1024, '2026-04-10T00:00:00Z');
      await insertAttachment(m, 2048, '2026-04-11T00:00:00Z');
      // 月外
      await insertAttachment(m, 9999, '2026-05-02T00:00:00Z');

      const buf = await adminService.buildMonthlyReportCsv({ year: 2026, month: 4 });
      const text = decode(buf);
      const filesSection = text.split('# Files')[1];
      // 1024 + 2048 = 3072, 件数 2
      expect(filesSection).toMatch(/3072,2/);
    });

    it('添付ファイルが0件の月は合計サイズ 0 / 件数 0 を返す', async () => {
      const u = await insertUser('u');
      const c = await insertChannel('c');
      await insertMessageAt(c, u, 'x', '2026-04-10T00:00:00Z');

      const buf = await adminService.buildMonthlyReportCsv({ year: 2026, month: 4 });
      const text = decode(buf);
      const filesSection = text.split('# Files')[1];
      expect(filesSection).toMatch(/0,0/);
    });
  });

  describe('CSV 出力フォーマット', () => {
    it('戻り値は Buffer 型であり UTF-8 BOM が先頭に付与されている', async () => {
      const buf = await adminService.buildMonthlyReportCsv({ year: 2026, month: 4 });
      expect(Buffer.isBuffer(buf)).toBe(true);
      expect(buf[0]).toBe(0xef);
      expect(buf[1]).toBe(0xbb);
      expect(buf[2]).toBe(0xbf);
    });

    it('改行コードは CRLF（\\r\\n）でセクション区切り（# Users / # Channels / # Files）を含む', async () => {
      const buf = await adminService.buildMonthlyReportCsv({ year: 2026, month: 4 });
      const text = decode(buf);
      expect(text).toContain('\r\n');
      expect(text).toContain('# Users');
      expect(text).toContain('# Channels');
      expect(text).toContain('# Files');
    });

    it('各セクションの先頭にヘッダー行が含まれ、対象月（YYYY-MM）が CSV の冒頭メタ情報に含まれる', async () => {
      const buf = await adminService.buildMonthlyReportCsv({ year: 2026, month: 4 });
      const text = decode(buf);
      expect(text).toContain('user_id,username,message_count');
      expect(text).toContain('channel_id,channel_name,message_count');
      expect(text).toContain('total_bytes,file_count');
      expect(text).toContain('2026-04');
    });
  });

  describe('CSV エスケープ（RFC 4180）', () => {
    it('username にカンマや改行・ダブルクォートを含む場合は適切にエスケープされる', async () => {
      const u = await insertUser('a,b"c\nd');
      const c = await insertChannel('chan');
      await insertMessageAt(c, u, 'x', '2026-04-10T00:00:00Z');

      const buf = await adminService.buildMonthlyReportCsv({ year: 2026, month: 4 });
      const text = decode(buf);
      // ダブルクォートで囲まれ、内部の " は "" にエスケープされる
      expect(text).toContain('"a,b""c\nd"');
    });
  });

  describe('UTF-8 エンコード', () => {
    it('日本語の username / channel_name が UTF-8 で正しくエンコードされる', async () => {
      const u = await insertUser('太郎');
      const c = await insertChannel('一般');
      await insertMessageAt(c, u, 'x', '2026-04-10T00:00:00Z');

      const buf = await adminService.buildMonthlyReportCsv({ year: 2026, month: 4 });
      const text = decode(buf);
      expect(text).toContain('太郎');
      expect(text).toContain('一般');
    });
  });
});
