/**
 * テスト対象: services/permissionService.ts（#373 権限判定ロジックの集約）
 * 戦略: pg-mem のインメモリ DB を使用し、サービス層を直接呼び出して権限判定を検証する。
 *   - isAdmin / isChannelMember / assertOwnerOrAdmin の新規共通関数を対象とする
 *   - canPost は移動元の channel-posting-permission.test.ts が網羅済みのため重複させない
 *     （permissionService からも参照できることのみ確認する）
 */

import { createTestDatabase } from '../__fixtures__/pgTestHelper';

const testDb = createTestDatabase();
jest.mock('../../db/database', () => testDb);

import { describe, it, expect, beforeEach } from '@jest/globals';
import * as permissionService from '../../services/permissionService';
import * as channelService from '../../services/channelService';
import { AppError } from '../../middleware/errorHandler';

async function createUser(username: string, role: 'user' | 'admin' = 'user'): Promise<number> {
  const row = await testDb.queryOne<{ id: number }>(
    'INSERT INTO users (username, email, password_hash, role) VALUES ($1, $2, $3, $4) RETURNING id',
    [username, `${username}@example.com`, 'h', role],
  );
  return row!.id;
}

async function createChannel(name: string, createdBy: number): Promise<number> {
  const row = await testDb.queryOne<{ id: number }>(
    'INSERT INTO channels (name, created_by) VALUES ($1, $2) RETURNING id',
    [name, createdBy],
  );
  return row!.id;
}

async function addMember(channelId: number, userId: number): Promise<void> {
  await testDb.execute('INSERT INTO channel_members (channel_id, user_id) VALUES ($1, $2)', [
    channelId,
    userId,
  ]);
}

describe('permissionService.isAdmin', () => {
  it('role = admin のユーザーに true を返す', async () => {
    const id = await createUser('perm_admin', 'admin');
    expect(await permissionService.isAdmin(id)).toBe(true);
  });

  it('role = user のユーザーに false を返す', async () => {
    const id = await createUser('perm_user', 'user');
    expect(await permissionService.isAdmin(id)).toBe(false);
  });

  it('存在しないユーザー ID に false を返す', async () => {
    expect(await permissionService.isAdmin(999999)).toBe(false);
  });
});

describe('permissionService.isChannelMember', () => {
  let ownerId: number;
  let channelId: number;

  beforeEach(async () => {
    ownerId = await createUser(`perm_owner_${Math.random().toString(36).slice(2)}`);
    channelId = await createChannel(`perm-ch-${Math.random().toString(36).slice(2)}`, ownerId);
  });

  it('チャンネルメンバーに true を返す', async () => {
    const memberId = await createUser(`perm_m_${Math.random().toString(36).slice(2)}`);
    await addMember(channelId, memberId);
    expect(await permissionService.isChannelMember(memberId, channelId)).toBe(true);
  });

  it('非メンバーに false を返す', async () => {
    const outsiderId = await createUser(`perm_out_${Math.random().toString(36).slice(2)}`);
    expect(await permissionService.isChannelMember(outsiderId, channelId)).toBe(false);
  });

  it('存在しないチャンネルに false を返す', async () => {
    expect(await permissionService.isChannelMember(ownerId, 999999)).toBe(false);
  });
});

describe('permissionService.assertOwnerOrAdmin', () => {
  it('所有者本人なら例外を投げない', () => {
    expect(() => permissionService.assertOwnerOrAdmin(10, 10, false)).not.toThrow();
  });

  it('管理者なら（所有者でなくても）例外を投げない', () => {
    expect(() => permissionService.assertOwnerOrAdmin(10, 20, true)).not.toThrow();
  });

  it('非所有者かつ非管理者なら 403 の AppError を投げる', () => {
    let caught: AppError | undefined;
    try {
      permissionService.assertOwnerOrAdmin(10, 20, false);
    } catch (e) {
      caught = e as AppError;
    }
    expect(caught?.statusCode).toBe(403);
  });

  it('指定したメッセージを 403 エラーの message に使う', () => {
    expect(() => permissionService.assertOwnerOrAdmin(10, 20, false, '権限がありません')).toThrow(
      '権限がありません',
    );
  });

  it('ownerId が null かつ非管理者なら 403 を投げる', () => {
    expect(() => permissionService.assertOwnerOrAdmin(null, 20, false)).toThrow();
  });
});

describe('permissionService.canPost（channelService から移動・再エクスポート）', () => {
  it('permissionService から canPost を呼び出せる（移動先で同等に動作する）', async () => {
    const ownerId = await createUser(`cp_owner_${Math.random().toString(36).slice(2)}`);
    const channelId = await createChannel(`cp-ch-${Math.random().toString(36).slice(2)}`, ownerId);
    // パブリック・everyone はメンバーでなくても投稿可
    expect(await permissionService.canPost(ownerId, channelId)).toBe(true);
  });

  it('channelService.canPost が permissionService.canPost と同一参照である（後方互換の再エクスポート）', () => {
    expect(channelService.canPost).toBe(permissionService.canPost);
  });
});
