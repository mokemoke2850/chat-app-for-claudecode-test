/**
 * テスト対象: inviteService（token 生成・redeem トランザクション）
 * 戦略: pg-mem のインメモリ DB でサービス層を直接テストする。
 *       token 生成アルゴリズムの品質確認と、
 *       redeem のトランザクション整合性（行ロック・条件付き UPDATE）を重点検証する。
 */

import { getSharedTestDatabase, resetTestData } from '../__fixtures__/pgTestHelper';

const testDb = getSharedTestDatabase();

jest.mock('../../db/database', () => testDb);

// サービスはモック適用後にインポートする
import * as inviteService from '../../services/inviteService';

let userId: number;
let channelId: number;
let publicChannelId2: number;
let privateChannelId: number;

async function setupFixtures() {
  const r1 = await testDb.execute(
    'INSERT INTO users (username, email, password_hash) VALUES ($1, $2, $3) RETURNING id',
    ['creator', 'creator@t.com', 'h'],
  );
  userId = r1.rows[0].id as number;

  const rc = await testDb.execute(
    'INSERT INTO channels (name, created_by, is_private) VALUES ($1, $2, false) RETURNING id',
    ['general', userId],
  );
  channelId = rc.rows[0].id as number;

  const rc2 = await testDb.execute(
    'INSERT INTO channels (name, created_by, is_private) VALUES ($1, $2, false) RETURNING id',
    ['random', userId],
  );
  publicChannelId2 = rc2.rows[0].id as number;

  const rcp = await testDb.execute(
    'INSERT INTO channels (name, created_by, is_private) VALUES ($1, $2, true) RETURNING id',
    ['private-ch', userId],
  );
  privateChannelId = rcp.rows[0].id as number;
}

beforeAll(async () => {
  await setupFixtures();
});

beforeEach(async () => {
  await resetTestData(testDb);
  await setupFixtures();
});

describe('inviteService', () => {
  describe('create — 招待リンク作成', () => {
    it('token が crypto.randomBytes(24).toString("base64url") で生成され 32 文字以上になる', async () => {
      const invite = await inviteService.create(userId, { channelId });
      expect(invite.token.length).toBeGreaterThanOrEqual(32);
    });

    it('token は URL セーフ文字（A-Z a-z 0-9 - _）のみで構成される', async () => {
      const invite = await inviteService.create(userId, { channelId });
      expect(invite.token).toMatch(/^[A-Za-z0-9_-]+$/);
    });

    it('同一の channelId で複数作成しても token は一意になる', async () => {
      const a = await inviteService.create(userId, { channelId });
      const b = await inviteService.create(userId, { channelId });
      expect(a.token).not.toBe(b.token);
    });

    it('expiresInHours を渡すと expires_at が現在時刻 + 指定時間後になる', async () => {
      const before = Date.now();
      const invite = await inviteService.create(userId, { channelId, expiresInHours: 24 });
      const after = Date.now();
      expect(invite.expiresAt).not.toBeNull();
      const expiresMs = new Date(invite.expiresAt!).getTime();
      expect(expiresMs).toBeGreaterThanOrEqual(before + 24 * 3600 * 1000 - 1000);
      expect(expiresMs).toBeLessThanOrEqual(after + 24 * 3600 * 1000 + 1000);
    });

    it('expiresInHours を省略すると expires_at が null になる', async () => {
      const invite = await inviteService.create(userId, { channelId });
      expect(invite.expiresAt).toBeNull();
    });

    it('maxUses を省略すると max_uses が null になる', async () => {
      const invite = await inviteService.create(userId, { channelId });
      expect(invite.maxUses).toBeNull();
    });

    it('channelId を省略すると channel_id が null（ワークスペース全体招待）になる', async () => {
      const invite = await inviteService.create(userId, {});
      expect(invite.channelId).toBeNull();
    });
  });

  describe('listByChannel — チャンネル別一覧', () => {
    it('指定チャンネルの招待リンク一覧が返る', async () => {
      await inviteService.create(userId, { channelId });
      await inviteService.create(userId, { channelId });
      const list = await inviteService.listByChannel(channelId);
      expect(list).toHaveLength(2);
      list.forEach((l) => expect(l.channelId).toBe(channelId));
    });

    it('他チャンネルの招待リンクは含まれない', async () => {
      await inviteService.create(userId, { channelId });
      await inviteService.create(userId, { channelId: publicChannelId2 });
      const list = await inviteService.listByChannel(channelId);
      expect(list).toHaveLength(1);
    });
  });

  describe('listAll — 全件取得（管理者用）', () => {
    it('全チャンネルの招待リンクが返る', async () => {
      await inviteService.create(userId, { channelId });
      await inviteService.create(userId, { channelId: publicChannelId2 });
      const list = await inviteService.listAll();
      expect(list.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('revoke — 無効化', () => {
    it('is_revoked が true に更新される', async () => {
      const invite = await inviteService.create(userId, { channelId });
      const revoked = await inviteService.revoke(userId, invite.id, false);
      expect(revoked.isRevoked).toBe(true);
    });

    it('他ユーザーのリンクを revoke しようとすると権限エラーになる', async () => {
      const r2 = await testDb.execute(
        'INSERT INTO users (username, email, password_hash) VALUES ($1, $2, $3) RETURNING id',
        ['other', 'other@t.com', 'h'],
      );
      const otherId = r2.rows[0].id as number;
      const invite = await inviteService.create(userId, { channelId });
      await expect(inviteService.revoke(otherId, invite.id, false)).rejects.toMatchObject({
        statusCode: 403,
      });
    });

    it('存在しない id を指定すると 404 エラーになる', async () => {
      await expect(inviteService.revoke(userId, 99999, false)).rejects.toMatchObject({
        statusCode: 404,
      });
    });
  });

  describe('redeem — 使用（トランザクション）', () => {
    it('有効なトークンで redeem するとメンバー追加・used_count 増加・uses レコード挿入が一括で行われる', async () => {
      const r2 = await testDb.execute(
        'INSERT INTO users (username, email, password_hash) VALUES ($1, $2, $3) RETURNING id',
        ['redeemer', 'redeemer@t.com', 'h'],
      );
      const redeemerId = r2.rows[0].id as number;
      const invite = await inviteService.create(userId, { channelId, maxUses: 5 });

      await inviteService.redeem(invite.token, redeemerId);

      const member = await testDb.execute(
        'SELECT 1 FROM channel_members WHERE channel_id = $1 AND user_id = $2',
        [channelId, redeemerId],
      );
      expect(member.rowCount).toBe(1);

      const updated = await testDb.execute('SELECT used_count FROM invite_links WHERE id = $1', [
        invite.id,
      ]);
      expect(Number(updated.rows[0].used_count)).toBe(1);

      const uses = await testDb.execute(
        'SELECT 1 FROM invite_link_uses WHERE invite_id = $1 AND user_id = $2',
        [invite.id, redeemerId],
      );
      expect(uses.rowCount).toBe(1);
    });

    it('max_uses 到達時に redeem するとエラーになり used_count は増加しない', async () => {
      const row = await testDb.execute(
        `INSERT INTO invite_links (token, channel_id, created_by, max_uses, used_count)
         VALUES ($1, $2, $3, $4, $5) RETURNING id, token`,
        ['exhausted-token', channelId, userId, 3, 3],
      );
      const token = row.rows[0].token as string;
      const r2 = await testDb.execute(
        'INSERT INTO users (username, email, password_hash) VALUES ($1, $2, $3) RETURNING id',
        ['redeemer2', 'redeemer2@t.com', 'h'],
      );
      const redeemerId = r2.rows[0].id as number;

      await expect(inviteService.redeem(token, redeemerId)).rejects.toMatchObject({
        statusCode: 410,
      });

      const check = await testDb.execute('SELECT used_count FROM invite_links WHERE id = $1', [
        row.rows[0].id,
      ]);
      expect(Number(check.rows[0].used_count)).toBe(3);
    });

    it('expires_at 過去のトークンで redeem するとエラーになる', async () => {
      const row = await testDb.execute(
        `INSERT INTO invite_links (token, channel_id, created_by, expires_at)
         VALUES ($1, $2, $3, $4) RETURNING token`,
        ['expired-token', channelId, userId, new Date(Date.now() - 1000).toISOString()],
      );
      const token = row.rows[0].token as string;
      const r2 = await testDb.execute(
        'INSERT INTO users (username, email, password_hash) VALUES ($1, $2, $3) RETURNING id',
        ['redeemer3', 'redeemer3@t.com', 'h'],
      );
      const redeemerId = r2.rows[0].id as number;

      await expect(inviteService.redeem(token, redeemerId)).rejects.toMatchObject({
        statusCode: 410,
      });
    });

    it('is_revoked = true のトークンで redeem するとエラーになる', async () => {
      const invite = await inviteService.create(userId, { channelId });
      await inviteService.revoke(userId, invite.id, false);
      const r2 = await testDb.execute(
        'INSERT INTO users (username, email, password_hash) VALUES ($1, $2, $3) RETURNING id',
        ['redeemer4', 'redeemer4@t.com', 'h'],
      );
      const redeemerId = r2.rows[0].id as number;

      await expect(inviteService.redeem(invite.token, redeemerId)).rejects.toMatchObject({
        statusCode: 410,
      });
    });

    it('既にメンバーのユーザーが redeem しても成功し used_count は増加しない', async () => {
      const r2 = await testDb.execute(
        'INSERT INTO users (username, email, password_hash) VALUES ($1, $2, $3) RETURNING id',
        ['already-member', 'already@t.com', 'h'],
      );
      const redeemerId = r2.rows[0].id as number;
      await testDb.execute('INSERT INTO channel_members (channel_id, user_id) VALUES ($1, $2)', [
        channelId,
        redeemerId,
      ]);

      const invite = await inviteService.create(userId, { channelId, maxUses: 5 });
      const result = await inviteService.redeem(invite.token, redeemerId);
      expect(result.channelId).toBe(channelId);

      const check = await testDb.execute('SELECT used_count FROM invite_links WHERE id = $1', [
        invite.id,
      ]);
      expect(Number(check.rows[0].used_count)).toBe(0);
    });

    it('行ロックにより同時実行時に used_count が max_uses を超えない', async () => {
      const invite = await inviteService.create(userId, { channelId, maxUses: 2 });

      const userIds: number[] = [];
      for (let i = 0; i < 3; i++) {
        const r = await testDb.execute(
          'INSERT INTO users (username, email, password_hash) VALUES ($1, $2, $3) RETURNING id',
          [`race-user-${i}`, `race${i}@t.com`, 'h'],
        );
        userIds.push(r.rows[0].id as number);
      }

      const results = await Promise.allSettled(
        userIds.map((uid) => inviteService.redeem(invite.token, uid)),
      );

      const successCount = results.filter((r) => r.status === 'fulfilled').length;
      expect(successCount).toBeLessThanOrEqual(2);

      const check = await testDb.execute('SELECT used_count FROM invite_links WHERE id = $1', [
        invite.id,
      ]);
      expect(Number(check.rows[0].used_count)).toBeLessThanOrEqual(2);
    });

    it('ワークスペース招待（channel_id = null）で全公開チャンネルに addMember が呼ばれる', async () => {
      const invite = await inviteService.create(userId, {});
      const r2 = await testDb.execute(
        'INSERT INTO users (username, email, password_hash) VALUES ($1, $2, $3) RETURNING id',
        ['ws-redeemer', 'ws@t.com', 'h'],
      );
      const redeemerId = r2.rows[0].id as number;

      await inviteService.redeem(invite.token, redeemerId);

      const memberGeneral = await testDb.execute(
        'SELECT 1 FROM channel_members WHERE channel_id = $1 AND user_id = $2',
        [channelId, redeemerId],
      );
      expect(memberGeneral.rowCount).toBe(1);

      const memberRandom = await testDb.execute(
        'SELECT 1 FROM channel_members WHERE channel_id = $1 AND user_id = $2',
        [publicChannelId2, redeemerId],
      );
      expect(memberRandom.rowCount).toBe(1);

      const memberPrivate = await testDb.execute(
        'SELECT 1 FROM channel_members WHERE channel_id = $1 AND user_id = $2',
        [privateChannelId, redeemerId],
      );
      expect(memberPrivate.rowCount).toBe(0);
    });
  });

  describe('lookup — token 情報取得', () => {
    it('有効なトークンの情報を返す（isExpired: false, isRevoked: false, isExhausted: false）', async () => {
      const invite = await inviteService.create(userId, { channelId, maxUses: 5 });
      const result = await inviteService.lookup(invite.token);
      expect(result).not.toBeNull();
      expect(result!.isExpired).toBe(false);
      expect(result!.isRevoked).toBe(false);
      expect(result!.isExhausted).toBe(false);
      expect(result!.channelId).toBe(channelId);
    });

    it('期限切れトークンで isExpired: true を返す', async () => {
      const row = await testDb.execute(
        `INSERT INTO invite_links (token, channel_id, created_by, expires_at)
         VALUES ($1, $2, $3, $4) RETURNING token`,
        ['expired-lookup', channelId, userId, new Date(Date.now() - 1000).toISOString()],
      );
      const result = await inviteService.lookup(row.rows[0].token as string);
      expect(result!.isExpired).toBe(true);
    });

    it('revoke 済みトークンで isRevoked: true を返す', async () => {
      const invite = await inviteService.create(userId, { channelId });
      await inviteService.revoke(userId, invite.id, false);
      const result = await inviteService.lookup(invite.token);
      expect(result!.isRevoked).toBe(true);
    });

    it('maxUses 到達トークンで isExhausted: true を返す', async () => {
      const row = await testDb.execute(
        `INSERT INTO invite_links (token, channel_id, created_by, max_uses, used_count)
         VALUES ($1, $2, $3, $4, $5) RETURNING token`,
        ['exhausted-lookup', channelId, userId, 3, 3],
      );
      const result = await inviteService.lookup(row.rows[0].token as string);
      expect(result!.isExhausted).toBe(true);
    });

    it('存在しないトークンで null を返す', async () => {
      const result = await inviteService.lookup('nonexistent-token');
      expect(result).toBeNull();
    });
  });
});
