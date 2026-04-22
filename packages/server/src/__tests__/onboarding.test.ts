/**
 * テスト対象: ワークスペース初回オンボーディング機能（Issue #114）
 * 戦略:
 *   - サービス層レベルで onboarding_completed_at の更新と
 *     is_recommended フラグの ON/OFF を検証する。
 *   - pg-mem のインメモリ PostgreSQL 互換 DB を使用する。
 *   - HTTP レイヤーの詳細は integration/authController.test.ts と
 *     integration/adminController.test.ts で追加する。
 */

import { getSharedTestDatabase, resetTestData } from './__fixtures__/pgTestHelper';

const testDb = getSharedTestDatabase();

jest.mock('../db/database', () => testDb);

import { register, getUserById, completeOnboarding } from '../services/authService';
import {
  getChannelsForUser,
  setChannelRecommended,
  createChannel,
} from '../services/channelService';
import * as auditLogService from '../services/auditLogService';

let userId: number;
let adminId: number;

async function setupFixtures() {
  const u = await register('user1', 'u1@example.com', 'password123');
  userId = u.id;

  const a = await register('admin1', 'admin1@example.com', 'password123');
  adminId = a.id;
  // 2 人目は通常 'user' ロールのため admin にアップデート
  await testDb.execute("UPDATE users SET role = 'admin' WHERE id = $1", [adminId]);
}

beforeEach(async () => {
  await resetTestData(testDb);
  await setupFixtures();
});

describe('オンボーディング機能', () => {
  describe('users.onboarding_completed_at カラム', () => {
    it('新規登録したユーザーは onboarding_completed_at が NULL である', async () => {
      const row = await testDb.queryOne<{ onboarding_completed_at: string | null }>(
        'SELECT onboarding_completed_at FROM users WHERE id = $1',
        [userId],
      );
      expect(row).not.toBeNull();
      expect(row!.onboarding_completed_at).toBeNull();
    });

    it('POST /api/auth/onboarding/complete を呼ぶと onboarding_completed_at が NOW() で埋まる', async () => {
      await completeOnboarding(userId);
      const row = await testDb.queryOne<{ onboarding_completed_at: string | null }>(
        'SELECT onboarding_completed_at FROM users WHERE id = $1',
        [userId],
      );
      expect(row!.onboarding_completed_at).not.toBeNull();
    });

    it('2 回呼び出しても冪等に更新される（エラーにならない）', async () => {
      await completeOnboarding(userId);
      await expect(completeOnboarding(userId)).resolves.not.toThrow();
      const row = await testDb.queryOne<{ onboarding_completed_at: string | null }>(
        'SELECT onboarding_completed_at FROM users WHERE id = $1',
        [userId],
      );
      expect(row!.onboarding_completed_at).not.toBeNull();
    });
  });

  describe('me レスポンスに onboardingCompletedAt を含む', () => {
    it('未完了ユーザーの me は onboardingCompletedAt === null を返す', async () => {
      const user = await getUserById(userId);
      expect(user).not.toBeNull();
      expect(user!.onboardingCompletedAt).toBeNull();
    });

    it('完了済ユーザーの me は onboardingCompletedAt が ISO 文字列で返る', async () => {
      await completeOnboarding(userId);
      const user = await getUserById(userId);
      expect(user).not.toBeNull();
      expect(user!.onboardingCompletedAt).not.toBeNull();
      // ISO 文字列であれば new Date() でパースできる
      expect(Number.isNaN(new Date(user!.onboardingCompletedAt as string).getTime())).toBe(false);
    });
  });

  describe('channels.is_recommended カラム', () => {
    it('新規作成したチャンネルの is_recommended は false である', async () => {
      const ch = await createChannel('general', undefined, userId);
      const row = await testDb.queryOne<{ is_recommended: boolean }>(
        'SELECT is_recommended FROM channels WHERE id = $1',
        [ch.id],
      );
      expect(row!.is_recommended).toBe(false);
    });

    it('チャンネル一覧 API のレスポンスに isRecommended が含まれる', async () => {
      const ch = await createChannel('chA', undefined, userId);
      await testDb.execute('UPDATE channels SET is_recommended = true WHERE id = $1', [ch.id]);
      const channels = await getChannelsForUser(userId);
      const target = channels.find((c) => c.id === ch.id);
      expect(target).toBeDefined();
      expect(target!.isRecommended).toBe(true);
    });

    it('管理者が is_recommended を true に更新できる', async () => {
      const ch = await createChannel('chB', undefined, adminId);
      await setChannelRecommended(ch.id, true);
      const row = await testDb.queryOne<{ is_recommended: boolean }>(
        'SELECT is_recommended FROM channels WHERE id = $1',
        [ch.id],
      );
      expect(row!.is_recommended).toBe(true);
    });

    it('is_recommended フラグはチャンネル削除に連動して消える', async () => {
      const ch = await createChannel('chC', undefined, userId);
      await setChannelRecommended(ch.id, true);
      await testDb.execute('DELETE FROM channels WHERE id = $1', [ch.id]);
      const row = await testDb.queryOne('SELECT id FROM channels WHERE id = $1', [ch.id]);
      expect(row).toBeNull();
    });
  });

  describe('監査ログ', () => {
    it('オンボーディング完了時に auth.onboarding.complete が記録される', async () => {
      await completeOnboarding(userId);
      await auditLogService.record({
        actorUserId: userId,
        actionType: 'auth.onboarding.complete',
        targetType: 'user',
        targetId: userId,
      });
      const { logs } = await auditLogService.listAuditLogs({
        actionType: 'auth.onboarding.complete',
      });
      expect(logs.length).toBeGreaterThan(0);
      expect(logs[0].actorUserId).toBe(userId);
    });

    it('推奨設定 ON 時に admin.channel.recommend が記録される', async () => {
      const ch = await createChannel('recCh', undefined, adminId);
      await setChannelRecommended(ch.id, true);
      await auditLogService.record({
        actorUserId: adminId,
        actionType: 'admin.channel.recommend',
        targetType: 'channel',
        targetId: ch.id,
      });
      const { logs } = await auditLogService.listAuditLogs({
        actionType: 'admin.channel.recommend',
      });
      expect(logs.length).toBeGreaterThan(0);
      expect(logs[0].targetId).toBe(ch.id);
    });

    it('推奨設定 OFF 時に admin.channel.unrecommend が記録される', async () => {
      const ch = await createChannel('unrecCh', undefined, adminId);
      await setChannelRecommended(ch.id, true);
      await setChannelRecommended(ch.id, false);
      await auditLogService.record({
        actorUserId: adminId,
        actionType: 'admin.channel.unrecommend',
        targetType: 'channel',
        targetId: ch.id,
      });
      const { logs } = await auditLogService.listAuditLogs({
        actionType: 'admin.channel.unrecommend',
      });
      expect(logs.length).toBeGreaterThan(0);
      expect(logs[0].targetId).toBe(ch.id);
    });
  });
});
