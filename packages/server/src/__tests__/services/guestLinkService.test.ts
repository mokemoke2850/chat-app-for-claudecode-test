/**
 * テスト対象: services/guestLinkService.ts — ゲスト閲覧リンク機能（#149）
 * 戦略:
 *   - pg-mem のインメモリ PostgreSQL 互換 DB を使ってサービス層を直接テストする
 *   - URL セーフトークン生成・パスワードハッシュ化・有効期限/失効/総当たり防止のビジネスロジックを検証する
 *   - ゲストセッション JWT の発行・検証フローを検証する
 *   - 公開メッセージ取得が読み取り専用（DM・スレッド・リアクションを含まない）であることを検証する
 */

import { createTestDatabase, resetTestData } from '../__fixtures__/pgTestHelper';

const testDb = createTestDatabase();

jest.mock('../../db/database', () => testDb);

import jwt from 'jsonwebtoken';
import * as guestLinkService from '../../services/guestLinkService';

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-please-change-in-production';

let userId: number;
let adminId: number;
let otherId: number;
let channelId: number;

async function setupFixtures() {
  const r1 = await testDb.execute(
    'INSERT INTO users (username, email, password_hash, role) VALUES ($1, $2, $3, $4) RETURNING id',
    ['creator', 'c@t.com', 'h', 'user'],
  );
  userId = r1.rows[0].id as number;

  const r2 = await testDb.execute(
    'INSERT INTO users (username, email, password_hash, role) VALUES ($1, $2, $3, $4) RETURNING id',
    ['admin', 'a@t.com', 'h', 'admin'],
  );
  adminId = r2.rows[0].id as number;

  const r3 = await testDb.execute(
    'INSERT INTO users (username, email, password_hash, role) VALUES ($1, $2, $3, $4) RETURNING id',
    ['other', 'o@t.com', 'h', 'user'],
  );
  otherId = r3.rows[0].id as number;

  const rc = await testDb.execute(
    'INSERT INTO channels (name, created_by) VALUES ($1, $2) RETURNING id',
    ['guest-test-channel', userId],
  );
  channelId = rc.rows[0].id as number;
}

beforeEach(async () => {
  await resetTestData(testDb);
  guestLinkService._resetFailureMap();
  await setupFixtures();
});

describe('ゲスト閲覧リンクサービス', () => {
  describe('token 生成', () => {
    it('生成された token は 32 文字以上である', () => {
      const t = guestLinkService.generateGuestToken();
      expect(t.length).toBeGreaterThanOrEqual(32);
    });

    it('生成された token は URL セーフ文字（base64url）のみで構成される', () => {
      const t = guestLinkService.generateGuestToken();
      expect(t).toMatch(/^[A-Za-z0-9_-]+$/);
    });

    it('複数回生成した token は重複しない', () => {
      const a = guestLinkService.generateGuestToken();
      const b = guestLinkService.generateGuestToken();
      expect(a).not.toBe(b);
    });
  });

  describe('ゲストリンク作成', () => {
    it('チャンネルメンバーがパスワードなしでゲストリンクを作成できる', async () => {
      const link = await guestLinkService.create(userId, { channelId });
      expect(link.id).toBeDefined();
      expect(link.channelId).toBe(channelId);
      expect(link.hasPassword).toBe(false);
    });

    it('パスワードを指定するとハッシュ化されて保存される（平文では保存されない）', async () => {
      const link = await guestLinkService.create(userId, { channelId, password: 'secret123' });
      expect(link.hasPassword).toBe(true);
      const row = await testDb.queryOne<{ password_hash: string | null }>(
        'SELECT password_hash FROM guest_links WHERE id = $1',
        [link.id],
      );
      expect(row?.password_hash).not.toBe('secret123');
      expect(row?.password_hash).toBeTruthy();
    });

    it('有効期限（expiresInHours）を指定して作成できる', async () => {
      const link = await guestLinkService.create(userId, { channelId, expiresInHours: 24 });
      expect(link.expiresAt).not.toBeNull();
    });

    it('有効期限を省略すると expires_at が NULL になる（無期限）', async () => {
      const link = await guestLinkService.create(userId, { channelId });
      expect(link.expiresAt).toBeNull();
    });

    it('存在しないチャンネル ID では作成できない', async () => {
      await expect(guestLinkService.create(userId, { channelId: 999999 })).rejects.toThrow();
    });
  });

  describe('ゲストリンク失効（revoke）', () => {
    it('作成者が自分のリンクを失効できる', async () => {
      const link = await guestLinkService.create(userId, { channelId });
      const revoked = await guestLinkService.revoke(userId, link.id, false);
      expect(revoked.isRevoked).toBe(true);
    });

    it('admin は他ユーザーのリンクも失効できる', async () => {
      const link = await guestLinkService.create(userId, { channelId });
      const revoked = await guestLinkService.revoke(adminId, link.id, true);
      expect(revoked.isRevoked).toBe(true);
    });

    it('作成者でも admin でもないユーザーは失効できない', async () => {
      const link = await guestLinkService.create(userId, { channelId });
      await expect(guestLinkService.revoke(otherId, link.id, false)).rejects.toThrow();
    });

    it('失効後は is_revoked = true になる', async () => {
      const link = await guestLinkService.create(userId, { channelId });
      await guestLinkService.revoke(userId, link.id, false);
      const found = await guestLinkService.findById(link.id);
      expect(found?.isRevoked).toBe(true);
    });
  });

  describe('ゲストリンク一覧取得', () => {
    it('チャンネル ID を指定するとそのチャンネルのリンク一覧を取得できる', async () => {
      await guestLinkService.create(userId, { channelId });
      await guestLinkService.create(userId, { channelId });
      const list = await guestLinkService.listByChannel(channelId);
      expect(list.length).toBe(2);
    });

    it('一覧結果の password_hash は平文で返さない（hasPassword フラグのみ）', async () => {
      await guestLinkService.create(userId, { channelId, password: 'secret' });
      const list = await guestLinkService.listByChannel(channelId);
      // GuestLink 型に password_hash プロパティが存在しないこと
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expect((list[0] as any).password_hash).toBeUndefined();
      expect(list[0].hasPassword).toBe(true);
    });
  });

  describe('トークン情報取得（lookup）', () => {
    it('有効なトークンの情報（チャンネル名・期限・パスワード要否）を返す', async () => {
      const link = await guestLinkService.create(userId, { channelId, password: 'p' });
      const r = await guestLinkService.lookup(link.token);
      expect(r?.channelId).toBe(channelId);
      expect(r?.hasPassword).toBe(true);
      expect(r?.isRevoked).toBe(false);
    });

    it('存在しないトークンは null を返す', async () => {
      const r = await guestLinkService.lookup('nonexistent-token');
      expect(r).toBeNull();
    });

    it('失効済みトークンでも情報を返すが isRevoked: true になる', async () => {
      const link = await guestLinkService.create(userId, { channelId });
      await guestLinkService.revoke(userId, link.id, false);
      const r = await guestLinkService.lookup(link.token);
      expect(r?.isRevoked).toBe(true);
    });

    it('lookup 結果には password_hash 平文を含めない', async () => {
      const link = await guestLinkService.create(userId, { channelId, password: 'p' });
      const r = await guestLinkService.lookup(link.token);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expect((r as any)?.password_hash).toBeUndefined();
    });
  });

  describe('パスワード検証 + ゲストセッション発行', () => {
    it('パスワード未設定リンクは空文字または未指定で検証成功する', async () => {
      const link = await guestLinkService.create(userId, { channelId });
      const r = await guestLinkService.verifyAndIssueSession(link.token, '');
      expect(r.guestToken).toBeTruthy();
    });

    it('パスワード設定済みリンクで正しいパスワードを与えると検証成功し JWT が発行される', async () => {
      const link = await guestLinkService.create(userId, { channelId, password: 'pw' });
      const r = await guestLinkService.verifyAndIssueSession(link.token, 'pw');
      expect(r.guestToken).toBeTruthy();
    });

    it('パスワード設定済みリンクで誤ったパスワードを与えると検証失敗する', async () => {
      const link = await guestLinkService.create(userId, { channelId, password: 'pw' });
      await expect(guestLinkService.verifyAndIssueSession(link.token, 'wrong')).rejects.toThrow();
    });

    it('発行されるゲスト JWT の payload に token と channelId が含まれる', async () => {
      const link = await guestLinkService.create(userId, { channelId });
      const r = await guestLinkService.verifyAndIssueSession(link.token, '');
      const payload = jwt.verify(r.guestToken, JWT_SECRET) as {
        type: string;
        token: string;
        channelId: number;
      };
      expect(payload.type).toBe('guest');
      expect(payload.token).toBe(link.token);
      expect(payload.channelId).toBe(channelId);
    });

    it('発行されるゲスト JWT は短期（数十分〜数時間）で有効期限切れになる設定である', async () => {
      const link = await guestLinkService.create(userId, { channelId });
      const r = await guestLinkService.verifyAndIssueSession(link.token, '');
      const payload = jwt.verify(r.guestToken, JWT_SECRET) as { exp: number; iat: number };
      const lifetimeSec = payload.exp - payload.iat;
      // 24 時間以下であることを「短期」の定義として確認
      expect(lifetimeSec).toBeLessThanOrEqual(24 * 60 * 60);
    });

    it('失効済みリンクではパスワードが正しくても検証失敗する', async () => {
      const link = await guestLinkService.create(userId, { channelId, password: 'pw' });
      await guestLinkService.revoke(userId, link.id, false);
      await expect(guestLinkService.verifyAndIssueSession(link.token, 'pw')).rejects.toThrow();
    });

    it('期限切れリンクではパスワードが正しくても検証失敗する', async () => {
      // 期限切れを作るために直接 INSERT
      const past = new Date(Date.now() - 60 * 1000).toISOString();
      const r = await testDb.execute(
        `INSERT INTO guest_links (token, channel_id, created_by, expires_at)
         VALUES ($1, $2, $3, $4) RETURNING token`,
        ['expired-token', channelId, userId, past],
      );
      const tk = r.rows[0].token as string;
      await expect(guestLinkService.verifyAndIssueSession(tk, '')).rejects.toThrow();
    });
  });

  describe('パスワード総当たり対策（短期ブロック）', () => {
    it('同一トークンに対する連続検証失敗が閾値を超えると短期間ブロックされる', async () => {
      const link = await guestLinkService.create(userId, { channelId, password: 'pw' });
      // 5 回失敗させてからもう一度試行すると 429 系になる
      for (let i = 0; i < 5; i++) {
        await guestLinkService.verifyAndIssueSession(link.token, 'wrong').catch(() => undefined);
      }
      await expect(guestLinkService.verifyAndIssueSession(link.token, 'pw')).rejects.toThrow();
    });

    it('検証成功が混ざると失敗カウンタはリセットされる', async () => {
      const link = await guestLinkService.create(userId, { channelId, password: 'pw' });
      await guestLinkService.verifyAndIssueSession(link.token, 'wrong').catch(() => undefined);
      await guestLinkService.verifyAndIssueSession(link.token, 'pw');
      // 再度失敗してもブロックされない（カウンタが 0 から）
      await guestLinkService.verifyAndIssueSession(link.token, 'wrong').catch(() => undefined);
      const r = await guestLinkService.verifyAndIssueSession(link.token, 'pw');
      expect(r.guestToken).toBeTruthy();
    });
  });

  describe('ゲスト用メッセージ取得', () => {
    it('チャンネル本体メッセージ（is_deleted=false）のみ取得する', async () => {
      await testDb.execute(
        'INSERT INTO messages (channel_id, user_id, content) VALUES ($1, $2, $3)',
        [channelId, userId, 'hi'],
      );
      await testDb.execute(
        'INSERT INTO messages (channel_id, user_id, content, is_deleted) VALUES ($1, $2, $3, true)',
        [channelId, userId, 'gone'],
      );
      const list = await guestLinkService.listGuestMessages(channelId);
      expect(list.length).toBe(1);
      expect(list[0].content).toBe('hi');
    });

    it('スレッド返信（parent_message_id != null）はトップレベル一覧に含まれない', async () => {
      const r = await testDb.execute(
        'INSERT INTO messages (channel_id, user_id, content) VALUES ($1, $2, $3) RETURNING id',
        [channelId, userId, 'parent'],
      );
      const parentId = r.rows[0].id as number;
      await testDb.execute(
        'INSERT INTO messages (channel_id, user_id, content, parent_message_id) VALUES ($1, $2, $3, $4)',
        [channelId, userId, 'reply', parentId],
      );
      const list = await guestLinkService.listGuestMessages(channelId);
      expect(list.length).toBe(1);
      expect(list[0].id).toBe(parentId);
    });

    it('別チャンネルのメッセージは含まれない', async () => {
      const r = await testDb.execute(
        'INSERT INTO channels (name, created_by) VALUES ($1, $2) RETURNING id',
        ['other-ch', userId],
      );
      const otherChannelId = r.rows[0].id as number;
      await testDb.execute(
        'INSERT INTO messages (channel_id, user_id, content) VALUES ($1, $2, $3)',
        [otherChannelId, userId, 'other'],
      );
      const list = await guestLinkService.listGuestMessages(channelId);
      expect(list.length).toBe(0);
    });
  });
});
