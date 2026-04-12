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
 * DB 戦略: better-sqlite3 のインメモリ DB を使用
 */

import {
  getAdminUsers,
  updateUserRole,
  updateUserStatus,
  deleteUser,
  getAdminChannels,
  deleteChannel,
  getStats,
} from '../../services/adminService';
import { getDatabase } from '../../db/database';

jest.mock('../../db/database', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const DatabaseLib = require('better-sqlite3') as typeof import('better-sqlite3');
  const db = new DatabaseLib(':memory:');
  db.pragma('foreign_keys = ON');
  const { initializeSchema: init } =
    jest.requireActual<typeof import('../../db/database')>('../../db/database');
  init(db);
  return {
    getDatabase: () => db,
    initializeSchema: init,
    closeDatabase: jest.fn(),
  };
});

// テスト用ユーザーを DB に直接 INSERT するヘルパー
function insertUser(username: string, email: string, role: 'user' | 'admin' = 'user'): number {
  const db = getDatabase();
  const result = db
    .prepare("INSERT INTO users (username, email, password_hash, role) VALUES (?, ?, 'hash', ?)")
    .run(username, email, role);
  return result.lastInsertRowid as number;
}

function insertChannel(name: string, createdBy: number, isPrivate = false): number {
  const db = getDatabase();
  const result = db
    .prepare('INSERT INTO channels (name, created_by, is_private) VALUES (?, ?, ?)')
    .run(name, createdBy, isPrivate ? 1 : 0);
  return result.lastInsertRowid as number;
}

function insertMessage(channelId: number, userId: number): number {
  const db = getDatabase();
  const result = db
    .prepare('INSERT INTO messages (channel_id, user_id, content) VALUES (?, ?, ?)')
    .run(channelId, userId, 'test');
  return result.lastInsertRowid as number;
}

describe('getAdminUsers', () => {
  it('全ユーザーを role / is_active / last_login_at を含めて返す', () => {
    const id = insertUser('admin_test_user', 'atu@example.com', 'admin');
    const users = getAdminUsers();
    const found = users.find((u) => u.id === id);
    expect(found).toBeDefined();
    expect(found?.role).toBe('admin');
    expect(found?.isActive).toBe(true);
    expect(found).toHaveProperty('lastLoginAt');
  });
});

describe('updateUserRole', () => {
  it('対象ユーザーのロールを変更できる', () => {
    const adminId = insertUser('role_admin', 'radmin@example.com', 'admin');
    const targetId = insertUser('role_target', 'rtarget@example.com', 'user');
    updateUserRole(targetId, 'admin', adminId);
    const users = getAdminUsers();
    expect(users.find((u) => u.id === targetId)?.role).toBe('admin');
  });

  it('自分自身のロールを変更しようとすると例外を投げる', () => {
    const adminId = insertUser('role_self', 'rself@example.com', 'admin');
    expect(() => updateUserRole(adminId, 'user', adminId)).toThrow();
  });

  it('存在しないユーザーIDを指定すると例外を投げる', () => {
    const adminId = insertUser('role_admin2', 'radmin2@example.com', 'admin');
    expect(() => updateUserRole(99999, 'user', adminId)).toThrow();
  });
});

describe('updateUserStatus', () => {
  it('ユーザーを停止 (is_active = 0) できる', () => {
    const id = insertUser('status_user1', 'su1@example.com');
    updateUserStatus(id, false);
    const users = getAdminUsers();
    expect(users.find((u) => u.id === id)?.isActive).toBe(false);
  });

  it('停止中ユーザーを復活 (is_active = 1) できる', () => {
    const id = insertUser('status_user2', 'su2@example.com');
    updateUserStatus(id, false);
    updateUserStatus(id, true);
    const users = getAdminUsers();
    expect(users.find((u) => u.id === id)?.isActive).toBe(true);
  });

  it('存在しないユーザーIDを指定すると例外を投げる', () => {
    expect(() => updateUserStatus(99999, false)).toThrow();
  });
});

describe('deleteUser', () => {
  it('ユーザーをDBから削除できる', () => {
    const adminId = insertUser('del_admin', 'dadmin@example.com', 'admin');
    const targetId = insertUser('del_target', 'dtarget@example.com');
    deleteUser(targetId, adminId);
    const users = getAdminUsers();
    expect(users.find((u) => u.id === targetId)).toBeUndefined();
  });

  it('自分自身を削除しようとすると例外を投げる', () => {
    const adminId = insertUser('del_self', 'dself@example.com', 'admin');
    expect(() => deleteUser(adminId, adminId)).toThrow();
  });
});

describe('getAdminChannels', () => {
  it('プライベートチャンネルを含む全チャンネルを memberCount 付きで返す', () => {
    const userId = insertUser('ch_admin', 'chadmin@example.com', 'admin');
    const pubId = insertChannel('admin-pub-ch', userId, false);
    const privId = insertChannel('admin-priv-ch', userId, true);

    // pubId にメンバーを追加してカウントを確認
    getDatabase()
      .prepare('INSERT INTO channel_members (channel_id, user_id) VALUES (?, ?)')
      .run(pubId, userId);

    const channels = getAdminChannels();
    const pub = channels.find((c) => c.id === pubId);
    const priv = channels.find((c) => c.id === privId);

    expect(pub).toBeDefined();
    expect(pub?.memberCount).toBe(1);
    expect(priv).toBeDefined();
    expect(priv?.isPrivate).toBe(true);
  });
});

describe('deleteChannel', () => {
  it('任意のチャンネルを削除できる', () => {
    const userId = insertUser('delch_admin', 'delchadmin@example.com', 'admin');
    const chId = insertChannel('admin-delete-ch', userId);
    deleteChannel(chId);
    expect(getAdminChannels().find((c) => c.id === chId)).toBeUndefined();
  });

  it('存在しないチャンネルIDは例外を投げる', () => {
    expect(() => deleteChannel(99999)).toThrow();
  });
});

describe('getStats', () => {
  it('totalUsers/totalChannels/totalMessages が正しくカウントされる', () => {
    const before = getStats();
    // メッセージを追加して totalMessages が増加することを確認
    const userId = insertUser('stats_user', 'stats@example.com');
    const chId = insertChannel('stats-ch', userId);
    insertMessage(chId, userId);
    const after = getStats();
    expect(after.totalUsers).toBeGreaterThanOrEqual(before.totalUsers);
    expect(after.totalChannels).toBeGreaterThanOrEqual(before.totalChannels);
    expect(after.totalMessages).toBe(before.totalMessages + 1);
  });

  it('last_login_at が現在時刻のユーザーは activeUsersLast24h / activeUsersLast7d の両方に含まれる', () => {
    const before = getStats();
    const id = insertUser('active_now', 'active_now@example.com');
    getDatabase().prepare("UPDATE users SET last_login_at = datetime('now') WHERE id = ?").run(id);
    const after = getStats();
    expect(after.activeUsersLast24h).toBe(before.activeUsersLast24h + 1);
    expect(after.activeUsersLast7d).toBe(before.activeUsersLast7d + 1);
  });

  it('last_login_at が 8 日前のユーザーは activeUsersLast24h / activeUsersLast7d のどちらにも含まれない', () => {
    const before = getStats();
    const id = insertUser('inactive_8d', 'inactive_8d@example.com');
    getDatabase()
      .prepare("UPDATE users SET last_login_at = datetime('now', '-8 days') WHERE id = ?")
      .run(id);
    const after = getStats();
    expect(after.activeUsersLast24h).toBe(before.activeUsersLast24h);
    expect(after.activeUsersLast7d).toBe(before.activeUsersLast7d);
  });

  it('last_login_at が 6 日前のユーザーは activeUsersLast7d にのみ含まれる', () => {
    const before = getStats();
    const id = insertUser('active_6d', 'active_6d@example.com');
    getDatabase()
      .prepare("UPDATE users SET last_login_at = datetime('now', '-6 days') WHERE id = ?")
      .run(id);
    const after = getStats();
    expect(after.activeUsersLast24h).toBe(before.activeUsersLast24h);
    expect(after.activeUsersLast7d).toBe(before.activeUsersLast7d + 1);
  });
});
