/**
 * チャンネル投稿権限制御 (#113) のテスト
 *
 * テスト対象:
 *   - channelService.canPost(userId, channelId): 権限判定ヘルパー
 *   - channelService.createChannel: 作成時に postingPermission を受け取れる
 *   - channelService.updateChannelPostingPermission: 権限変更（管理者または作成者のみ）
 *   - PATCH /api/channels/:id/posting-permission: HTTP エンドポイント
 *   - POST /api/channels: 作成時に postingPermission を受け取り反映する
 *   - messageService.sendMessage: 権限のないユーザーは投稿時に 403 になる
 *
 * 戦略: pg-mem のインメモリ PostgreSQL 互換 DB を使用。supertest で HTTP 経由でも検証する。
 */

import { getSharedTestDatabase } from './__fixtures__/pgTestHelper';

const testDb = getSharedTestDatabase();
jest.mock('../db/database', () => testDb);

import request from 'supertest';
import { createApp } from '../app';
import { registerUser, createChannelReq } from './__fixtures__/testHelpers';
import * as channelService from '../services/channelService';
import * as messageService from '../services/messageService';
import { listAuditLogs } from '../services/auditLogService';

const app = createApp();

/** users テーブルから ID 指定で role を更新するヘルパー */
async function promoteToAdmin(userId: number): Promise<void> {
  await testDb.execute('UPDATE users SET role = $1 WHERE id = $2', ['admin', userId]);
}

describe('channelService.canPost', () => {
  describe('postingPermission = "everyone"', () => {
    it('チャンネルメンバーである一般ユーザーは投稿できる', async () => {
      const { token, userId } = await registerUser(app, 'cp_e_member', 'cp_e_member@example.com');
      const channelId = await createChannelReq(app, token, 'cp-everyone-1');
      expect(await channelService.canPost(userId, channelId)).toBe(true);
    });

    it('チャンネルメンバーである管理者は投稿できる', async () => {
      const { token, userId } = await registerUser(app, 'cp_e_admin', 'cp_e_admin@example.com');
      await promoteToAdmin(userId);
      const channelId = await createChannelReq(app, token, 'cp-everyone-2');
      expect(await channelService.canPost(userId, channelId)).toBe(true);
    });

    it('プライベートチャンネルでメンバーでないユーザーは投稿できない', async () => {
      const { token: ownerToken } = await registerUser(app, 'cp_e_owner', 'cp_e_owner@example.com');
      const { userId: outsiderId } = await registerUser(
        app,
        'cp_e_outsider',
        'cp_e_outsider@example.com',
      );
      const res = await request(app)
        .post('/api/channels')
        .set('Cookie', `token=${ownerToken}`)
        .send({ name: 'cp-everyone-private', is_private: true });
      const channelId = (res.body as { channel: { id: number } }).channel.id;
      expect(await channelService.canPost(outsiderId, channelId)).toBe(false);
    });
  });

  describe('postingPermission = "admins"', () => {
    it('管理者ロール (users.role = "admin") のユーザーは投稿できる', async () => {
      const { token, userId } = await registerUser(app, 'cp_a_admin', 'cp_a_admin@example.com');
      await promoteToAdmin(userId);
      const channel = await channelService.createChannel(
        'cp-admins-1',
        undefined,
        userId,
        'admins',
      );
      expect(await channelService.canPost(userId, channel.id)).toBe(true);
    });

    it('一般ユーザー (users.role = "user") は投稿できない', async () => {
      const { userId: ownerId } = await registerUser(app, 'cp_a_owner', 'cp_a_owner@example.com');
      await promoteToAdmin(ownerId);
      const channel = await channelService.createChannel(
        'cp-admins-2',
        undefined,
        ownerId,
        'admins',
      );
      const { userId: memberId } = await registerUser(
        app,
        'cp_a_member',
        'cp_a_member@example.com',
      );
      await channelService.joinChannel(channel.id, memberId);
      expect(await channelService.canPost(memberId, channel.id)).toBe(false);
    });
  });

  describe('postingPermission = "readonly"', () => {
    it('一般ユーザーは投稿できない', async () => {
      const { userId: ownerId } = await registerUser(app, 'cp_r_owner', 'cp_r_owner@example.com');
      const channel = await channelService.createChannel(
        'cp-readonly-1',
        undefined,
        ownerId,
        'readonly',
      );
      const { userId: memberId } = await registerUser(
        app,
        'cp_r_member',
        'cp_r_member@example.com',
      );
      await channelService.joinChannel(channel.id, memberId);
      expect(await channelService.canPost(memberId, channel.id)).toBe(false);
    });

    it('管理者ロールでも投稿できない（readonly は全員拒否）', async () => {
      const { userId: adminId } = await registerUser(app, 'cp_r_admin', 'cp_r_admin@example.com');
      await promoteToAdmin(adminId);
      const channel = await channelService.createChannel(
        'cp-readonly-2',
        undefined,
        adminId,
        'readonly',
      );
      expect(await channelService.canPost(adminId, channel.id)).toBe(false);
    });

    it('チャンネル作成者でも投稿できない', async () => {
      const { userId: ownerId } = await registerUser(
        app,
        'cp_r_creator',
        'cp_r_creator@example.com',
      );
      const channel = await channelService.createChannel(
        'cp-readonly-3',
        undefined,
        ownerId,
        'readonly',
      );
      expect(await channelService.canPost(ownerId, channel.id)).toBe(false);
    });
  });

  describe('チャンネルが存在しない場合', () => {
    it('false を返す', async () => {
      const { userId } = await registerUser(app, 'cp_nf_user', 'cp_nf_user@example.com');
      expect(await channelService.canPost(userId, 999999)).toBe(false);
    });
  });
});

describe('channelService.createChannel', () => {
  it('postingPermission を省略するとデフォルトで "everyone" になる', async () => {
    const { userId } = await registerUser(app, 'cc_default', 'cc_default@example.com');
    const channel = await channelService.createChannel('cc-default', undefined, userId);
    expect(channel.postingPermission).toBe('everyone');
  });

  it('postingPermission を "admins" 指定して作成できる', async () => {
    const { userId } = await registerUser(app, 'cc_admins', 'cc_admins@example.com');
    const channel = await channelService.createChannel('cc-admins', undefined, userId, 'admins');
    expect(channel.postingPermission).toBe('admins');
  });

  it('postingPermission を "readonly" 指定して作成できる', async () => {
    const { userId } = await registerUser(app, 'cc_readonly', 'cc_readonly@example.com');
    const channel = await channelService.createChannel(
      'cc-readonly',
      undefined,
      userId,
      'readonly',
    );
    expect(channel.postingPermission).toBe('readonly');
  });
});

describe('channelService.updateChannelPostingPermission', () => {
  it('管理者ロールのユーザーは権限を変更できる', async () => {
    const { userId: ownerId } = await registerUser(app, 'up_owner1', 'up_owner1@example.com');
    const channel = await channelService.createChannel('up-1', undefined, ownerId);
    const { userId: adminId } = await registerUser(app, 'up_admin1', 'up_admin1@example.com');
    await promoteToAdmin(adminId);
    const updated = await channelService.updateChannelPostingPermission(
      channel.id,
      adminId,
      'admins',
      true,
    );
    expect(updated.postingPermission).toBe('admins');
  });

  it('チャンネル作成者は権限を変更できる', async () => {
    const { userId: ownerId } = await registerUser(app, 'up_owner2', 'up_owner2@example.com');
    const channel = await channelService.createChannel('up-2', undefined, ownerId);
    const updated = await channelService.updateChannelPostingPermission(
      channel.id,
      ownerId,
      'readonly',
      false,
    );
    expect(updated.postingPermission).toBe('readonly');
  });

  it('作成者でも管理者でもない一般ユーザーは 403 になる', async () => {
    const { userId: ownerId } = await registerUser(app, 'up_owner3', 'up_owner3@example.com');
    const channel = await channelService.createChannel('up-3', undefined, ownerId);
    const { userId: otherId } = await registerUser(app, 'up_other', 'up_other@example.com');
    await expect(
      channelService.updateChannelPostingPermission(channel.id, otherId, 'admins', false),
    ).rejects.toMatchObject({ statusCode: 403 });
  });

  it('存在しないチャンネルを指定すると 404 になる', async () => {
    const { userId } = await registerUser(app, 'up_nf', 'up_nf@example.com');
    await expect(
      channelService.updateChannelPostingPermission(999999, userId, 'admins', true),
    ).rejects.toMatchObject({ statusCode: 404 });
  });

  it('不正な権限値を指定すると 400 になる', async () => {
    const { userId } = await registerUser(app, 'up_inv', 'up_inv@example.com');
    const channel = await channelService.createChannel('up-inv', undefined, userId);
    await expect(
      channelService.updateChannelPostingPermission(channel.id, userId, 'invalid' as never, true),
    ).rejects.toMatchObject({ statusCode: 400 });
  });
});

describe('POST /api/channels (postingPermission 受け取り)', () => {
  it('postingPermission 未指定で作成すると "everyone" になる', async () => {
    const { token } = await registerUser(app, 'pc_default', 'pc_default@example.com');
    const res = await request(app)
      .post('/api/channels')
      .set('Cookie', `token=${token}`)
      .send({ name: 'pc-default' });
    expect(res.status).toBe(201);
    expect(res.body.channel.postingPermission).toBe('everyone');
  });

  it('postingPermission を指定して作成できる', async () => {
    const { token } = await registerUser(app, 'pc_admins', 'pc_admins@example.com');
    const res = await request(app)
      .post('/api/channels')
      .set('Cookie', `token=${token}`)
      .send({ name: 'pc-admins', postingPermission: 'admins' });
    expect(res.status).toBe(201);
    expect(res.body.channel.postingPermission).toBe('admins');
  });

  it('不正な権限値で作成すると 400 になる', async () => {
    const { token } = await registerUser(app, 'pc_invalid', 'pc_invalid@example.com');
    const res = await request(app)
      .post('/api/channels')
      .set('Cookie', `token=${token}`)
      .send({ name: 'pc-invalid', postingPermission: 'wrong-value' });
    expect(res.status).toBe(400);
  });
});

describe('PATCH /api/channels/:id/posting-permission', () => {
  it('管理者がリクエストすると 200 で更新できレスポンスに新しい権限が含まれる', async () => {
    const { token: ownerToken } = await registerUser(app, 'pp_owner1', 'pp_owner1@example.com');
    const channelId = await createChannelReq(app, ownerToken, 'pp-1');
    const { token: adminToken, userId: adminId } = await registerUser(
      app,
      'pp_admin1',
      'pp_admin1@example.com',
    );
    await promoteToAdmin(adminId);
    const res = await request(app)
      .patch(`/api/channels/${channelId}/posting-permission`)
      .set('Cookie', `token=${adminToken}`)
      .send({ postingPermission: 'readonly' });
    expect(res.status).toBe(200);
    expect(res.body.channel.postingPermission).toBe('readonly');
  });

  it('一般ユーザー（非作成者・非管理者）は 403 になる', async () => {
    const { token: ownerToken } = await registerUser(app, 'pp_owner2', 'pp_owner2@example.com');
    const channelId = await createChannelReq(app, ownerToken, 'pp-2');
    const { token: otherToken } = await registerUser(app, 'pp_other', 'pp_other@example.com');
    const res = await request(app)
      .patch(`/api/channels/${channelId}/posting-permission`)
      .set('Cookie', `token=${otherToken}`)
      .send({ postingPermission: 'admins' });
    expect(res.status).toBe(403);
  });

  it('未認証ユーザーは 401 になる', async () => {
    const { token: ownerToken } = await registerUser(app, 'pp_owner3', 'pp_owner3@example.com');
    const channelId = await createChannelReq(app, ownerToken, 'pp-3');
    const res = await request(app)
      .patch(`/api/channels/${channelId}/posting-permission`)
      .send({ postingPermission: 'admins' });
    expect(res.status).toBe(401);
  });
});

describe('messageService.createMessage 投稿権限チェック', () => {
  it('readonly チャンネルへの投稿は 403 で拒否される', async () => {
    const { userId } = await registerUser(app, 'mc_readonly', 'mc_readonly@example.com');
    const channel = await channelService.createChannel(
      'mc-readonly',
      undefined,
      userId,
      'readonly',
    );
    await expect(messageService.createMessage(channel.id, userId, 'hello')).rejects.toMatchObject({
      statusCode: 403,
    });
  });

  it('admins チャンネルへ一般ユーザーが投稿すると 403 で拒否される', async () => {
    const { userId: ownerId } = await registerUser(app, 'mc_a_owner', 'mc_a_owner@example.com');
    await promoteToAdmin(ownerId);
    const channel = await channelService.createChannel('mc-admins', undefined, ownerId, 'admins');
    const { userId: memberId } = await registerUser(app, 'mc_a_member', 'mc_a_member@example.com');
    await channelService.joinChannel(channel.id, memberId);
    await expect(messageService.createMessage(channel.id, memberId, 'hello')).rejects.toMatchObject(
      { statusCode: 403 },
    );
  });

  it('admins チャンネルへ管理者が投稿すると成功する', async () => {
    const { userId } = await registerUser(app, 'mc_a_ok', 'mc_a_ok@example.com');
    await promoteToAdmin(userId);
    const channel = await channelService.createChannel('mc-admins-ok', undefined, userId, 'admins');
    const message = await messageService.createMessage(channel.id, userId, 'hi');
    expect(message.content).toBe('hi');
  });

  it('everyone チャンネル（既存チャンネルのデフォルト）への投稿は従来通り成功する', async () => {
    const { token, userId } = await registerUser(app, 'mc_everyone', 'mc_everyone@example.com');
    const channelId = await createChannelReq(app, token, 'mc-everyone');
    const message = await messageService.createMessage(channelId, userId, 'hi');
    expect(message.content).toBe('hi');
  });
});

describe('既存チャンネルの後方互換', () => {
  it('カラム追加前から存在するチャンネルは posting_permission のデフォルト "everyone" として扱われる', async () => {
    const { userId } = await registerUser(app, 'bc_legacy', 'bc_legacy@example.com');
    // posting_permission を明示せずに INSERT（DBデフォルトの 'everyone' が入る想定）
    const result = await testDb.execute(
      'INSERT INTO channels (name, description, created_by) VALUES ($1, $2, $3) RETURNING id',
      ['bc-legacy', null, userId],
    );
    const channelId = (result.rows[0] as { id: number }).id;
    const fetched = await channelService.getChannelById(channelId);
    expect(fetched?.postingPermission).toBe('everyone');
  });

  it('レスポンスの Channel オブジェクトに postingPermission フィールドが含まれる', async () => {
    const { token } = await registerUser(app, 'bc_resp', 'bc_resp@example.com');
    const res = await request(app)
      .post('/api/channels')
      .set('Cookie', `token=${token}`)
      .send({ name: 'bc-resp' });
    expect(res.body.channel.postingPermission).toBeDefined();
    expect(['everyone', 'admins', 'readonly']).toContain(res.body.channel.postingPermission);
  });
});

describe('監査ログ', () => {
  it('権限変更時に AuditActionType "channel.permission.update" が記録される', async () => {
    const { token: ownerToken } = await registerUser(app, 'al_owner', 'al_owner@example.com');
    const channelId = await createChannelReq(app, ownerToken, 'al-permission');
    const { token: adminToken, userId: adminId } = await registerUser(
      app,
      'al_admin',
      'al_admin@example.com',
    );
    await promoteToAdmin(adminId);

    await request(app)
      .patch(`/api/channels/${channelId}/posting-permission`)
      .set('Cookie', `token=${adminToken}`)
      .send({ postingPermission: 'readonly' });

    const { logs } = await listAuditLogs({ actionType: 'channel.permission.update' });
    const log = logs.find(
      (l) => l.targetId === channelId && l.actionType === 'channel.permission.update',
    );
    expect(log).toBeDefined();
    expect(log!.actorUserId).toBe(adminId);
    expect(log!.metadata).toMatchObject({ postingPermission: 'readonly' });
  });
});
