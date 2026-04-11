/**
 * プロフィール更新機能のユニットテスト
 *
 * テスト対象: packages/server/src/services/authService.ts（updateProfile）
 * 戦略:
 *   - DB: better-sqlite3 のインメモリ DB を使用（本番 DB に影響を与えない）
 *   - テスト用ユーザーを事前に register して ID を取得してから updateProfile を呼ぶ
 *   - ユーザー名・メールの衝突を防ぐためカウンタで一意な値を生成する
 */

import { register, updateProfile, getUserById } from '../services/authService';
import { initializeSchema } from '../db/database';

jest.mock('../db/database', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const DatabaseLib = require('better-sqlite3') as typeof import('better-sqlite3');
  const db = new DatabaseLib(':memory:');
  db.pragma('foreign_keys = ON');
  const { initializeSchema: init } =
    jest.requireActual<typeof import('../db/database')>('../db/database');
  init(db);
  return {
    getDatabase: () => db,
    initializeSchema: init,
    closeDatabase: jest.fn(),
  };
});

void initializeSchema;

let counter = 0;
function nextUser() {
  counter++;
  return {
    username: `profile_user_${counter}`,
    email: `profile_user_${counter}@example.com`,
    password: 'password123',
  };
}

describe('AuthService - updateProfile', () => {
  describe('表示名（displayName）の更新', () => {
    it('displayName を更新するとユーザーオブジェクトに反映される', async () => {
      const u = nextUser();
      const { id } = await register(u.username, u.email, u.password);
      const updated = updateProfile(id, { displayName: '山田太郎' });
      expect(updated.displayName).toBe('山田太郎');
    });

    it('displayName を空文字で更新すると null として保存される', async () => {
      const u = nextUser();
      const { id } = await register(u.username, u.email, u.password);
      updateProfile(id, { displayName: '一時名' });
      const updated = updateProfile(id, { displayName: '' });
      expect(updated.displayName).toBeNull();
    });
  });

  describe('勤務地（location）の更新', () => {
    it('location を更新するとユーザーオブジェクトに反映される', async () => {
      const u = nextUser();
      const { id } = await register(u.username, u.email, u.password);
      const updated = updateProfile(id, { location: '東京' });
      expect(updated.location).toBe('東京');
    });

    it('location を空文字で更新すると null として保存される', async () => {
      const u = nextUser();
      const { id } = await register(u.username, u.email, u.password);
      updateProfile(id, { location: '東京' });
      const updated = updateProfile(id, { location: '' });
      expect(updated.location).toBeNull();
    });
  });

  describe('アバター URL の更新', () => {
    it('avatarUrl を更新するとユーザーオブジェクトに反映される', async () => {
      const u = nextUser();
      const { id } = await register(u.username, u.email, u.password);
      const updated = updateProfile(id, { avatarUrl: 'data:image/png;base64,abc' });
      expect(updated.avatarUrl).toBe('data:image/png;base64,abc');
    });
  });

  describe('フィールドの部分更新', () => {
    it('displayName のみ指定した場合、location は変更されない', async () => {
      const u = nextUser();
      const { id } = await register(u.username, u.email, u.password);
      updateProfile(id, { location: '大阪' });
      const updated = updateProfile(id, { displayName: 'テスト太郎' });
      expect(updated.displayName).toBe('テスト太郎');
      expect(updated.location).toBe('大阪');
    });

    it('存在しないユーザー ID を指定すると 404 を投げる', async () => {
      let thrownError: unknown;
      try {
        updateProfile(99999, { displayName: 'test' });
      } catch (e) {
        thrownError = e;
      }
      expect(thrownError).toMatchObject({ statusCode: 404 });
    });
  });
});

describe('getUserById - displayName と location を含む取得', () => {
  it('updateProfile 後に getUserById を呼ぶと displayName と location が返る', async () => {
    const u = nextUser();
    const { id } = await register(u.username, u.email, u.password);
    updateProfile(id, { displayName: '田中花子', location: '名古屋' });
    const found = getUserById(id);
    expect(found?.displayName).toBe('田中花子');
    expect(found?.location).toBe('名古屋');
  });
});
