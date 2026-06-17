/**
 * adminService のユニットテスト
 *
 * テスト対象: packages/server/src/services/adminService.ts
 * - getAdminUsers: 全ユーザー一覧（role/is_active/last_login_at 含む）
 * - updateUserRole: ロール変更（自分自身は変更不可）
 * - updateUserStatus: アカウント停止・復活
 * - deleteUser: ユーザー削除
 * - getAdminChannels: 全チャンネル（プライベート含む・メンバー数含む）
 * - deleteChannel: 管理者権限での強制削除
 * - getStats: システム統計
 *
 * DB 戦略: pg-mem のインメモリ PostgreSQL 互換 DB を使用
 */

import { createTestDatabase } from '../__fixtures__/pgTestHelper';

const testDb = createTestDatabase();

jest.mock('../../db/database', () => testDb);

import {
  getAdminUsers,
  updateUserRole,
  updateUserStatus,
  deleteUser,
  getAdminChannels,
  deleteChannel,
  getStats,
  getMaintenanceModeSettings,
  updateMaintenanceModeSettings,
  isMaintenanceRestricted,
  exportSettings,
  previewSettingsImport,
  importSettings,
} from '../../services/adminService';

// テスト用ユーザーを DB に直接 INSERT するヘルパー
async function insertUser(
  username: string,
  email: string,
  role: 'user' | 'admin' = 'user',
): Promise<number> {
  const result = await testDb.execute(
    "INSERT INTO users (username, email, password_hash, role) VALUES ($1, $2, 'hash', $3) RETURNING id",
    [username, email, role],
  );
  return result.rows[0].id as number;
}

async function insertChannel(name: string, createdBy: number, isPrivate = false): Promise<number> {
  const result = await testDb.execute(
    'INSERT INTO channels (name, created_by, is_private) VALUES ($1, $2, $3) RETURNING id',
    [name, createdBy, isPrivate],
  );
  return result.rows[0].id as number;
}

async function insertMessage(channelId: number, userId: number): Promise<number> {
  const result = await testDb.execute(
    'INSERT INTO messages (channel_id, user_id, content) VALUES ($1, $2, $3) RETURNING id',
    [channelId, userId, 'test'],
  );
  return result.rows[0].id as number;
}

describe('getAdminUsers', () => {
  it('全ユーザーを role / is_active / last_login_at を含めて返す', async () => {
    const id = await insertUser('admin_test_user', 'atu@example.com', 'admin');
    const users = await getAdminUsers();
    const found = users.find((u) => u.id === id);
    expect(found).toBeDefined();
    expect(found?.role).toBe('admin');
    expect(found?.isActive).toBe(true);
    expect(found).toHaveProperty('lastLoginAt');
  });
});

describe('updateUserRole', () => {
  it('対象ユーザーのロールを変更できる', async () => {
    const adminId = await insertUser('role_admin', 'radmin@example.com', 'admin');
    const targetId = await insertUser('role_target', 'rtarget@example.com', 'user');
    await updateUserRole(targetId, 'admin', adminId);
    const users = await getAdminUsers();
    expect(users.find((u) => u.id === targetId)?.role).toBe('admin');
  });

  it('自分自身のロールを変更しようとすると例外を投げる', async () => {
    const adminId = await insertUser('role_self', 'rself@example.com', 'admin');
    await expect(updateUserRole(adminId, 'user', adminId)).rejects.toThrow();
  });

  it('存在しないユーザーIDを指定すると例外を投げる', async () => {
    const adminId = await insertUser('role_admin2', 'radmin2@example.com', 'admin');
    await expect(updateUserRole(99999, 'user', adminId)).rejects.toThrow();
  });
});

describe('updateUserStatus', () => {
  it('ユーザーを停止 (is_active = false) できる', async () => {
    const id = await insertUser('status_user1', 'su1@example.com');
    await updateUserStatus(id, false);
    const users = await getAdminUsers();
    expect(users.find((u) => u.id === id)?.isActive).toBe(false);
  });

  it('停止中ユーザーを復活 (is_active = true) できる', async () => {
    const id = await insertUser('status_user2', 'su2@example.com');
    await updateUserStatus(id, false);
    await updateUserStatus(id, true);
    const users = await getAdminUsers();
    expect(users.find((u) => u.id === id)?.isActive).toBe(true);
  });

  it('存在しないユーザーIDを指定すると例外を投げる', async () => {
    await expect(updateUserStatus(99999, false)).rejects.toThrow();
  });
});

describe('deleteUser', () => {
  it('ユーザーをDBから削除できる', async () => {
    const adminId = await insertUser('del_admin', 'dadmin@example.com', 'admin');
    const targetId = await insertUser('del_target', 'dtarget@example.com');
    await deleteUser(targetId, adminId);
    const users = await getAdminUsers();
    expect(users.find((u) => u.id === targetId)).toBeUndefined();
  });

  it('自分自身を削除しようとすると例外を投げる', async () => {
    const adminId = await insertUser('del_self', 'dself@example.com', 'admin');
    await expect(deleteUser(adminId, adminId)).rejects.toThrow();
  });

  it('削除後もそのユーザーのメッセージは残り user_id が NULL になる', async () => {
    const adminId = await insertUser('del_msg_admin', 'del_msg_admin@example.com', 'admin');
    const targetId = await insertUser('del_msg_target', 'del_msg_target@example.com');
    const chId = await insertChannel('del-msg-ch', adminId);
    await insertMessage(chId, targetId);

    await deleteUser(targetId, adminId);

    const msgs = await testDb.query<{ user_id: number | null }>(
      'SELECT user_id FROM messages WHERE channel_id = $1',
      [chId],
    );
    expect(msgs).toHaveLength(1);
    expect(msgs[0].user_id).toBeNull();
  });

  it('削除後もそのユーザーが作成したチャンネルは残り created_by が NULL になる', async () => {
    const adminId = await insertUser('del_ch_admin', 'del_ch_admin@example.com', 'admin');
    const targetId = await insertUser('del_ch_target', 'del_ch_target@example.com');
    const chId = await insertChannel('del-ch-owned', targetId);

    await deleteUser(targetId, adminId);

    const row = await testDb.queryOne<{ created_by: number | null }>(
      'SELECT created_by FROM channels WHERE id = $1',
      [chId],
    );
    expect(row).toBeDefined();
    expect(row!.created_by).toBeNull();
  });
});

describe('getAdminChannels', () => {
  it('プライベートチャンネルを含む全チャンネルを memberCount 付きで返す', async () => {
    const userId = await insertUser('ch_admin', 'chadmin@example.com', 'admin');
    const pubId = await insertChannel('admin-pub-ch', userId, false);
    const privId = await insertChannel('admin-priv-ch', userId, true);

    // pubId にメンバーを追加してカウントを確認
    await testDb.execute('INSERT INTO channel_members (channel_id, user_id) VALUES ($1, $2)', [
      pubId,
      userId,
    ]);

    const channels = await getAdminChannels();
    const pub = channels.find((c) => c.id === pubId);
    const priv = channels.find((c) => c.id === privId);

    expect(pub).toBeDefined();
    expect(pub?.memberCount).toBe(1);
    expect(priv).toBeDefined();
    expect(priv?.isPrivate).toBe(true);
  });
});

describe('deleteChannel', () => {
  it('任意のチャンネルを削除できる', async () => {
    const userId = await insertUser('delch_admin', 'delchadmin@example.com', 'admin');
    const chId = await insertChannel('admin-delete-ch', userId);
    await deleteChannel(chId);
    const channels = await getAdminChannels();
    expect(channels.find((c) => c.id === chId)).toBeUndefined();
  });

  it('存在しないチャンネルIDは例外を投げる', async () => {
    await expect(deleteChannel(99999)).rejects.toThrow();
  });
});

describe('getStats', () => {
  it('totalUsers/totalChannels/totalMessages が正しくカウントされる', async () => {
    const before = await getStats();
    // メッセージを追加して totalMessages が増加することを確認
    const userId = await insertUser('stats_user', 'stats@example.com');
    const chId = await insertChannel('stats-ch', userId);
    await insertMessage(chId, userId);
    const after = await getStats();
    expect(after.totalUsers).toBeGreaterThanOrEqual(before.totalUsers);
    expect(after.totalChannels).toBeGreaterThanOrEqual(before.totalChannels);
    expect(after.totalMessages).toBe(before.totalMessages + 1);
  });

  it('last_login_at が現在時刻のユーザーは activeUsersLast24h / activeUsersLast7d の両方に含まれる', async () => {
    const before = await getStats();
    const id = await insertUser('active_now', 'active_now@example.com');
    await testDb.execute('UPDATE users SET last_login_at = NOW() WHERE id = $1', [id]);
    const after = await getStats();
    expect(after.activeUsersLast24h).toBe(before.activeUsersLast24h + 1);
    expect(after.activeUsersLast7d).toBe(before.activeUsersLast7d + 1);
  });

  it('last_login_at が 8 日前のユーザーは activeUsersLast24h / activeUsersLast7d のどちらにも含まれない', async () => {
    const before = await getStats();
    const id = await insertUser('inactive_8d', 'inactive_8d@example.com');
    await testDb.execute(
      "UPDATE users SET last_login_at = NOW() - INTERVAL '8 days' WHERE id = $1",
      [id],
    );
    const after = await getStats();
    expect(after.activeUsersLast24h).toBe(before.activeUsersLast24h);
    expect(after.activeUsersLast7d).toBe(before.activeUsersLast7d);
  });

  it('last_login_at が 6 日前のユーザーは activeUsersLast7d にのみ含まれる', async () => {
    const before = await getStats();
    const id = await insertUser('active_6d', 'active_6d@example.com');
    await testDb.execute(
      "UPDATE users SET last_login_at = NOW() - INTERVAL '6 days' WHERE id = $1",
      [id],
    );
    const after = await getStats();
    expect(after.activeUsersLast24h).toBe(before.activeUsersLast24h);
    expect(after.activeUsersLast7d).toBe(before.activeUsersLast7d + 1);
  });
});

// #392 管理者向けメンテナンスモード
describe('maintenance mode service (#392)', () => {
  it('初期状態ではメンテナンスモードが OFF として取得される', async () => {
    const settings = await getMaintenanceModeSettings();
    expect(settings).toMatchObject({
      enabled: false,
      message: '',
      restrictedOperations: [],
    });
  });

  it('メンテナンスモードの ON/OFF と告知メッセージを保存できる', async () => {
    await updateMaintenanceModeSettings({
      enabled: true,
      message: '停止中です',
      restrictedOperations: [],
    });
    let settings = await getMaintenanceModeSettings();
    expect(settings.enabled).toBe(true);
    expect(settings.message).toBe('停止中です');

    await updateMaintenanceModeSettings({
      enabled: false,
      message: '',
      restrictedOperations: [],
    });
    settings = await getMaintenanceModeSettings();
    expect(settings.enabled).toBe(false);
  });

  it('投稿・アップロード・ログインの制限対象を保存できる', async () => {
    const settings = await updateMaintenanceModeSettings({
      enabled: true,
      restrictedOperations: ['posting', 'upload', 'login'],
    });
    expect(settings.restrictedOperations).toEqual(['posting', 'upload', 'login']);
  });

  it('不正な制限対象を指定すると例外を投げる', async () => {
    await expect(
      updateMaintenanceModeSettings({
        enabled: true,
        restrictedOperations: ['invalid'],
      }),
    ).rejects.toThrow();
  });

  it('制限対象ごとに一般ユーザーの操作可否を判定できる', async () => {
    await updateMaintenanceModeSettings({
      enabled: true,
      restrictedOperations: ['posting'],
    });
    await expect(isMaintenanceRestricted('posting')).resolves.toBe(true);
    await expect(isMaintenanceRestricted('upload')).resolves.toBe(false);
  });

  it('admin はメンテナンス制限中も管理操作可能として判定される', async () => {
    await updateMaintenanceModeSettings({
      enabled: true,
      restrictedOperations: ['login'],
    });
    await expect(isMaintenanceRestricted('login', 'admin')).resolves.toBe(false);
  });
});

// #394 設定エクスポート / インポート
describe('settings export/import service (#394)', () => {
  let seedSeq = 0;

  async function seedSettingsData() {
    seedSeq += 1;
    const suffix = String(seedSeq);
    const adminId = await insertUser(
      `settings_admin_${suffix}`,
      `settings_admin_${suffix}@example.com`,
      'admin',
    );
    const userId = await insertUser(
      `settings_user_${suffix}`,
      `settings_user_${suffix}@example.com`,
      'user',
    );
    const channelId = await insertChannel(`settings-channel-${suffix}`, adminId, true);
    await testDb.execute(
      'INSERT INTO channel_notification_settings (user_id, channel_id, level) VALUES ($1, $2, $3)',
      [userId, channelId, 'mentions'],
    );
    await testDb.execute(
      'INSERT INTO ng_words (pattern, is_regex, action, is_active, created_by) VALUES ($1, $2, $3, $4, $5)',
      ['forbidden', false, 'block', true, adminId],
    );
    return { adminId, userId, channelId, suffix };
  }

  it('チャンネル設定・通知設定・NG ワード・権限設定を JSON としてエクスポートできる', async () => {
    const { suffix } = await seedSettingsData();
    const data = await exportSettings();

    expect(data.channels).toEqual(
      expect.arrayContaining([expect.objectContaining({ name: `settings-channel-${suffix}` })]),
    );
    expect(data.notifications).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          username: `settings_user_${suffix}`,
          channelName: `settings-channel-${suffix}`,
        }),
      ]),
    );
    expect(data.ngWords).toEqual(
      expect.arrayContaining([expect.objectContaining({ pattern: 'forbidden' })]),
    );
    expect(data.permissions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ username: `settings_admin_${suffix}`, role: 'admin' }),
      ]),
    );
  });

  it('エクスポート JSON にスキーマバージョンと生成日時が含まれる', async () => {
    const data = await exportSettings();
    expect(data.schemaVersion).toBe(1);
    expect(Date.parse(data.exportedAt)).not.toBeNaN();
  });

  it('インポート前に追加・更新・削除の差分を算出できる', async () => {
    const { suffix } = await seedSettingsData();
    const preview = await previewSettingsImport({
      schemaVersion: 1,
      exportedAt: '2026-01-01T00:00:00.000Z',
      channels: [
        {
          name: `settings-channel-${suffix}`,
          description: 'changed',
          isPrivate: false,
          isArchived: false,
          isRecommended: true,
          postingPermission: 'admins',
        },
        {
          name: 'settings-new-channel',
          description: null,
          isPrivate: false,
          isArchived: false,
          isRecommended: false,
          postingPermission: 'everyone',
        },
      ],
      notifications: [],
      ngWords: [],
      permissions: [{ username: `settings_user_${suffix}`, role: 'admin' }],
    });

    expect(preview.diff.channels.added).toBe(1);
    expect(preview.diff.channels.updated).toBe(1);
    expect(preview.diff.permissions.updated).toBe(1);
  });

  it('プレビュー時点では DB を変更しない', async () => {
    await seedSettingsData();
    await previewSettingsImport({
      schemaVersion: 1,
      exportedAt: '2026-01-01T00:00:00.000Z',
      channels: [
        {
          name: 'preview-only-channel',
          description: null,
          isPrivate: false,
          isArchived: false,
          isRecommended: false,
          postingPermission: 'everyone',
        },
      ],
      notifications: [],
      ngWords: [],
      permissions: [],
    });
    const row = await testDb.queryOne('SELECT id FROM channels WHERE name = $1', [
      'preview-only-channel',
    ]);
    expect(row).toBeNull();
  });

  it('有効な JSON をインポートすると対象設定が復元される', async () => {
    const userId = await insertUser('settings_restore_user', 'settings_restore_user@example.com');
    await importSettings({
      schemaVersion: 1,
      exportedAt: '2026-01-01T00:00:00.000Z',
      channels: [
        {
          name: 'restored-channel',
          description: 'restored',
          isPrivate: true,
          isArchived: false,
          isRecommended: true,
          postingPermission: 'admins',
        },
      ],
      notifications: [
        {
          username: 'settings_restore_user',
          channelName: 'restored-channel',
          level: 'mentions',
        },
      ],
      ngWords: [{ pattern: 'restored-ng', isRegex: false, action: 'warn', isActive: true }],
      permissions: [{ username: 'settings_restore_user', role: 'admin' }],
    });

    const channel = await testDb.queryOne<{ id: number; posting_permission: string }>(
      'SELECT id, posting_permission FROM channels WHERE name = $1',
      ['restored-channel'],
    );
    const notification = await testDb.queryOne<{ level: string }>(
      'SELECT level FROM channel_notification_settings WHERE user_id = $1 AND channel_id = $2',
      [userId, channel!.id],
    );
    const user = await testDb.queryOne<{ role: string }>('SELECT role FROM users WHERE id = $1', [
      userId,
    ]);
    expect(channel?.posting_permission).toBe('admins');
    expect(notification?.level).toBe('mentions');
    expect(user?.role).toBe('admin');
  });

  it('不正な JSON を指定すると例外を投げる', async () => {
    await expect(importSettings(null)).rejects.toThrow();
  });

  it('スキーマバージョン不一致または必須項目不足の場合は例外を投げる', async () => {
    await expect(importSettings({ schemaVersion: 2 })).rejects.toThrow();
    await expect(importSettings({ schemaVersion: 1, channels: [] })).rejects.toThrow();
  });
});
