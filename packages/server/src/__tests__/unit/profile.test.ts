/**
 * プロフィール更新機能のユニットテスト
 *
 * テスト対象: packages/server/src/services/authService.ts（updateProfile）
 * 戦略:
 *   - DB: pg-mem のインメモリ PostgreSQL 互換 DB を使用（本番 DB に影響を与えない）
 *   - テスト用ユーザーを事前に register して ID を取得してから updateProfile を呼ぶ
 *   - ユーザー名・メールの衝突を防ぐためカウンタで一意な値を生成する
 */

import { createTestDatabase } from '../__fixtures__/pgTestHelper';

const testDb = createTestDatabase();

jest.mock('../../db/database', () => testDb);

import { register, updateProfile, getUserById } from '../../services/authService';

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
      const updated = await updateProfile(id, { displayName: '山田太郎' });
      expect(updated.displayName).toBe('山田太郎');
    });

    it('displayName を空文字で更新すると null として保存される', async () => {
      const u = nextUser();
      const { id } = await register(u.username, u.email, u.password);
      await updateProfile(id, { displayName: '一時名' });
      const updated = await updateProfile(id, { displayName: '' });
      expect(updated.displayName).toBeNull();
    });
  });

  describe('勤務地（location）の更新', () => {
    it('location を更新するとユーザーオブジェクトに反映される', async () => {
      const u = nextUser();
      const { id } = await register(u.username, u.email, u.password);
      const updated = await updateProfile(id, { location: '東京' });
      expect(updated.location).toBe('東京');
    });

    it('location を空文字で更新すると null として保存される', async () => {
      const u = nextUser();
      const { id } = await register(u.username, u.email, u.password);
      await updateProfile(id, { location: '東京' });
      const updated = await updateProfile(id, { location: '' });
      expect(updated.location).toBeNull();
    });
  });

  describe('アバター URL の更新', () => {
    it('avatarUrl を更新するとユーザーオブジェクトに反映される', async () => {
      const u = nextUser();
      const { id } = await register(u.username, u.email, u.password);
      const updated = await updateProfile(id, { avatarUrl: 'data:image/png;base64,abc' });
      expect(updated.avatarUrl).toBe('data:image/png;base64,abc');
    });
  });

  describe('フィールドの部分更新', () => {
    it('displayName のみ指定した場合、location は変更されない', async () => {
      const u = nextUser();
      const { id } = await register(u.username, u.email, u.password);
      await updateProfile(id, { location: '大阪' });
      const updated = await updateProfile(id, { displayName: 'テスト太郎' });
      expect(updated.displayName).toBe('テスト太郎');
      expect(updated.location).toBe('大阪');
    });

    it('存在しないユーザー ID を指定すると 404 を投げる', async () => {
      await expect(updateProfile(99999, { displayName: 'test' })).rejects.toMatchObject({
        statusCode: 404,
      });
    });
  });
});

describe('getUserById - displayName と location を含む取得', () => {
  it('updateProfile 後に getUserById を呼ぶと displayName と location が返る', async () => {
    const u = nextUser();
    const { id } = await register(u.username, u.email, u.password);
    await updateProfile(id, { displayName: '田中花子', location: '名古屋' });
    const found = await getUserById(id);
    expect(found?.displayName).toBe('田中花子');
    expect(found?.location).toBe('名古屋');
  });
});
