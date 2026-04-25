/**
 * NG ワード / 添付制限 (#117) のテスト
 *
 * テスト対象:
 *   - moderationService.checkContent: NG ワード判定（block / warn / null）+ キャッシュ
 *   - moderationService.checkExtension: 添付拡張子判定
 *   - moderationService の CRUD（NG ワード / ブロック拡張子）
 *   - 管理者 HTTP API
 *     - GET/POST/PATCH/DELETE /api/admin/ng-words
 *     - GET/POST/DELETE /api/admin/attachment-blocklist
 *   - Socket send_message での block / warn 伝播
 *   - POST /api/files/upload の拡張子検証
 *   - 監査ログ記録
 *
 * 戦略:
 *   - pg-mem のインメモリ PostgreSQL 互換 DB を使用
 *   - moderationService はキャッシュを持つため、各テスト前に invalidateCaches() を呼ぶ
 *   - Socket テストは registerMessageHandlers をモックソケットで直接呼ぶ
 */

import { getSharedTestDatabase, resetTestData } from './__fixtures__/pgTestHelper';

const testDb = getSharedTestDatabase();
jest.mock('../db/database', () => testDb);

import request from 'supertest';
import { createApp } from '../app';
import { registerUser, createChannelReq } from './__fixtures__/testHelpers';
import * as moderationService from '../services/moderationService';
import * as messageService from '../services/messageService';
import { listAuditLogs } from '../services/auditLogService';
import { registerMessageHandlers } from '../socket/messageHandler';

const app = createApp();

async function promoteToAdmin(userId: number): Promise<void> {
  await testDb.execute('UPDATE users SET role = $1 WHERE id = $2', ['admin', userId]);
}

beforeEach(async () => {
  moderationService.invalidateCaches();
  await resetTestData(testDb);
});

/** registerMessageHandlers 内の void async IIFE の完了を待つためのヘルパー */
async function flushAsync(ms = 100): Promise<void> {
  await new Promise((r) => setTimeout(r, ms));
}

describe('moderationService.checkContent', () => {
  describe('block ワード', () => {
    it('完全一致するワードを含む投稿は { action: "block", matchedPattern } を返す', async () => {
      const { userId } = await registerUser(app, 'mc_b1', 'mc_b1@example.com');
      await moderationService.createNgWord({ pattern: 'badword', action: 'block' }, userId);
      const result = await moderationService.checkContent('this contains badword in it');
      expect(result).toEqual({ action: 'block', matchedPattern: 'badword' });
    });

    it('部分一致でも検出される', async () => {
      const { userId } = await registerUser(app, 'mc_b2', 'mc_b2@example.com');
      await moderationService.createNgWord({ pattern: 'spam', action: 'block' }, userId);
      const result = await moderationService.checkContent('spammy message');
      expect(result?.action).toBe('block');
    });

    it('大文字・全角を NFKC + lowercase 正規化して照合する', async () => {
      const { userId } = await registerUser(app, 'mc_b3', 'mc_b3@example.com');
      // 全角英字で登録 → 半角小文字でマッチすることを確認
      await moderationService.createNgWord({ pattern: 'ＡＢＣ', action: 'block' }, userId);
      const result = await moderationService.checkContent('hello abc world');
      expect(result?.action).toBe('block');
    });

    it('is_active = false のワードは無視される', async () => {
      const { userId } = await registerUser(app, 'mc_b4', 'mc_b4@example.com');
      await moderationService.createNgWord(
        { pattern: 'inactive', action: 'block', isActive: false },
        userId,
      );
      const result = await moderationService.checkContent('this contains inactive');
      expect(result).toBeNull();
    });
  });

  describe('warn ワード', () => {
    it('warn 設定のワードは { action: "warn", matchedPattern } を返す', async () => {
      const { userId } = await registerUser(app, 'mc_w1', 'mc_w1@example.com');
      await moderationService.createNgWord({ pattern: 'careful', action: 'warn' }, userId);
      const result = await moderationService.checkContent('be careful here');
      expect(result).toEqual({ action: 'warn', matchedPattern: 'careful' });
    });

    it('block と warn 両方マッチする場合、block が優先される', async () => {
      const { userId } = await registerUser(app, 'mc_w2', 'mc_w2@example.com');
      await moderationService.createNgWord({ pattern: 'soft', action: 'warn' }, userId);
      await moderationService.createNgWord({ pattern: 'hard', action: 'block' }, userId);
      const result = await moderationService.checkContent('soft and hard');
      expect(result?.action).toBe('block');
    });
  });

  describe('未マッチ', () => {
    it('どのワードにもマッチしない投稿は null を返す', async () => {
      const { userId } = await registerUser(app, 'mc_n1', 'mc_n1@example.com');
      await moderationService.createNgWord({ pattern: 'foo', action: 'block' }, userId);
      const result = await moderationService.checkContent('clean message');
      expect(result).toBeNull();
    });

    it('NG ワードが 1 件も登録されていない場合は null を返す', async () => {
      const result = await moderationService.checkContent('any text');
      expect(result).toBeNull();
    });
  });

  describe('キャッシュ (30 秒 TTL)', () => {
    it('CRUD 操作（create）でキャッシュが invalidate される', async () => {
      const { userId } = await registerUser(app, 'mc_c1', 'mc_c1@example.com');
      // 初回呼び出しでキャッシュを温める（空状態）
      expect(await moderationService.checkContent('foo')).toBeNull();
      // create するとキャッシュが invalidate されるので次回 fetch される
      await moderationService.createNgWord({ pattern: 'foo', action: 'block' }, userId);
      const result = await moderationService.checkContent('foo');
      expect(result?.action).toBe('block');
    });

    it('CRUD 操作（update）でキャッシュが invalidate される', async () => {
      const { userId } = await registerUser(app, 'mc_c2', 'mc_c2@example.com');
      const created = await moderationService.createNgWord(
        { pattern: 'old', action: 'block' },
        userId,
      );
      // 既存値をキャッシュに乗せる
      expect((await moderationService.checkContent('old'))?.action).toBe('block');
      await moderationService.updateNgWord(created.id, { isActive: false });
      // 無効化されたので null になる
      expect(await moderationService.checkContent('old')).toBeNull();
    });

    it('CRUD 操作（delete）でキャッシュが invalidate される', async () => {
      const { userId } = await registerUser(app, 'mc_c3', 'mc_c3@example.com');
      const created = await moderationService.createNgWord(
        { pattern: 'gone', action: 'block' },
        userId,
      );
      expect((await moderationService.checkContent('gone'))?.action).toBe('block');
      await moderationService.deleteNgWord(created.id);
      expect(await moderationService.checkContent('gone')).toBeNull();
    });
  });
});

describe('moderationService.checkExtension', () => {
  it('ブロック対象の拡張子は true を返す', async () => {
    const { userId } = await registerUser(app, 'me_1', 'me_1@example.com');
    await moderationService.createBlockedExtension({ extension: 'exe' }, userId);
    expect(await moderationService.checkExtension('virus.exe')).toBe(true);
  });

  it('大文字拡張子（例: "EXE"）でも小文字化して判定する', async () => {
    const { userId } = await registerUser(app, 'me_2', 'me_2@example.com');
    await moderationService.createBlockedExtension({ extension: 'exe' }, userId);
    expect(await moderationService.checkExtension('VIRUS.EXE')).toBe(true);
  });

  it('originalName から拡張子を抽出する（複合拡張子は最後の部分のみ）', async () => {
    const { userId } = await registerUser(app, 'me_3', 'me_3@example.com');
    await moderationService.createBlockedExtension({ extension: 'exe' }, userId);
    expect(await moderationService.checkExtension('malware.tar.exe')).toBe(true);
  });

  it('ブロック対象でない拡張子は false を返す', async () => {
    const { userId } = await registerUser(app, 'me_4', 'me_4@example.com');
    await moderationService.createBlockedExtension({ extension: 'exe' }, userId);
    expect(await moderationService.checkExtension('photo.png')).toBe(false);
  });

  it('拡張子が無いファイルは false を返す', async () => {
    const { userId } = await registerUser(app, 'me_5', 'me_5@example.com');
    await moderationService.createBlockedExtension({ extension: 'exe' }, userId);
    expect(await moderationService.checkExtension('README')).toBe(false);
  });
});

describe('moderationService NG ワード CRUD', () => {
  it('createNgWord: 新規追加できる', async () => {
    const { userId } = await registerUser(app, 'mn_c', 'mn_c@example.com');
    const created = await moderationService.createNgWord(
      { pattern: 'spam', action: 'block' },
      userId,
    );
    expect(created.pattern).toBe('spam');
    expect(created.action).toBe('block');
    expect(created.isActive).toBe(true);
  });

  it('listNgWords: 登録済みワードを返す', async () => {
    const { userId } = await registerUser(app, 'mn_l', 'mn_l@example.com');
    await moderationService.createNgWord({ pattern: 'a' }, userId);
    await moderationService.createNgWord({ pattern: 'b' }, userId);
    const list = await moderationService.listNgWords();
    expect(list.length).toBeGreaterThanOrEqual(2);
    expect(list.map((x) => x.pattern)).toEqual(expect.arrayContaining(['a', 'b']));
  });

  it('updateNgWord: pattern / action / isActive を更新できる', async () => {
    const { userId } = await registerUser(app, 'mn_u', 'mn_u@example.com');
    const created = await moderationService.createNgWord({ pattern: 'old' }, userId);
    const updated = await moderationService.updateNgWord(created.id, {
      pattern: 'new',
      action: 'warn',
      isActive: false,
    });
    expect(updated.pattern).toBe('new');
    expect(updated.action).toBe('warn');
    expect(updated.isActive).toBe(false);
  });

  it('deleteNgWord: 削除できる', async () => {
    const { userId } = await registerUser(app, 'mn_d', 'mn_d@example.com');
    const created = await moderationService.createNgWord({ pattern: 'temp' }, userId);
    await moderationService.deleteNgWord(created.id);
    const all = await moderationService.listNgWords();
    expect(all.find((x) => x.id === created.id)).toBeUndefined();
  });
});

describe('moderationService 拡張子ブロックリスト CRUD', () => {
  it('createBlockedExtension: 拡張子を小文字化して保存する', async () => {
    const { userId } = await registerUser(app, 'mb_c', 'mb_c@example.com');
    const created = await moderationService.createBlockedExtension({ extension: 'EXE' }, userId);
    expect(created.extension).toBe('exe');
  });

  it('createBlockedExtension: 同じ拡張子を 2 回登録すると 409 になる', async () => {
    const { userId } = await registerUser(app, 'mb_dup', 'mb_dup@example.com');
    await moderationService.createBlockedExtension({ extension: 'bat' }, userId);
    await expect(
      moderationService.createBlockedExtension({ extension: 'bat' }, userId),
    ).rejects.toMatchObject({ statusCode: 409 });
  });

  it('listBlockedExtensions: 登録済み拡張子を返す', async () => {
    const { userId } = await registerUser(app, 'mb_l', 'mb_l@example.com');
    await moderationService.createBlockedExtension({ extension: 'cmd' }, userId);
    const list = await moderationService.listBlockedExtensions();
    expect(list.map((x) => x.extension)).toEqual(expect.arrayContaining(['cmd']));
  });

  it('deleteBlockedExtension: 削除できる', async () => {
    const { userId } = await registerUser(app, 'mb_d', 'mb_d@example.com');
    const created = await moderationService.createBlockedExtension({ extension: 'tmp' }, userId);
    await moderationService.deleteBlockedExtension(created.id);
    const all = await moderationService.listBlockedExtensions();
    expect(all.find((x) => x.id === created.id)).toBeUndefined();
  });
});

describe('GET/POST/PATCH/DELETE /api/admin/ng-words', () => {
  it('管理者は GET で一覧を取得できる', async () => {
    const { token, userId } = await registerUser(app, 'ng_g_a', 'ng_g_a@example.com');
    await promoteToAdmin(userId);
    const res = await request(app).get('/api/admin/ng-words').set('Cookie', `token=${token}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.ngWords)).toBe(true);
  });

  it('一般ユーザーは GET で 403 になる', async () => {
    // register は users が空のとき最初のユーザーを admin にするので、
    // 先にダミーを登録して 2 人目を一般ユーザーにする
    await registerUser(app, 'ng_g_first', 'ng_g_first@example.com');
    const { token } = await registerUser(app, 'ng_g_u', 'ng_g_u@example.com');
    const res = await request(app).get('/api/admin/ng-words').set('Cookie', `token=${token}`);
    expect(res.status).toBe(403);
  });

  it('管理者は POST で追加できる', async () => {
    const { token, userId } = await registerUser(app, 'ng_p_a', 'ng_p_a@example.com');
    await promoteToAdmin(userId);
    const res = await request(app)
      .post('/api/admin/ng-words')
      .set('Cookie', `token=${token}`)
      .send({ pattern: 'evil', action: 'block' });
    expect(res.status).toBe(201);
    expect(res.body.ngWord.pattern).toBe('evil');
  });

  it('POST で pattern が空文字なら 400 になる', async () => {
    const { token, userId } = await registerUser(app, 'ng_p_e', 'ng_p_e@example.com');
    await promoteToAdmin(userId);
    const res = await request(app)
      .post('/api/admin/ng-words')
      .set('Cookie', `token=${token}`)
      .send({ pattern: '', action: 'block' });
    expect(res.status).toBe(400);
  });

  it('管理者は PATCH で更新できる', async () => {
    const { token, userId } = await registerUser(app, 'ng_pa', 'ng_pa@example.com');
    await promoteToAdmin(userId);
    const created = await moderationService.createNgWord({ pattern: 'foo' }, userId);
    const res = await request(app)
      .patch(`/api/admin/ng-words/${created.id}`)
      .set('Cookie', `token=${token}`)
      .send({ action: 'warn' });
    expect(res.status).toBe(200);
    expect(res.body.ngWord.action).toBe('warn');
  });

  it('管理者は DELETE で削除できる', async () => {
    const { token, userId } = await registerUser(app, 'ng_d', 'ng_d@example.com');
    await promoteToAdmin(userId);
    const created = await moderationService.createNgWord({ pattern: 'gone' }, userId);
    const res = await request(app)
      .delete(`/api/admin/ng-words/${created.id}`)
      .set('Cookie', `token=${token}`);
    expect(res.status).toBe(204);
  });
});

describe('GET/POST/DELETE /api/admin/attachment-blocklist', () => {
  it('管理者は GET で一覧を取得できる', async () => {
    const { token, userId } = await registerUser(app, 'bl_g_a', 'bl_g_a@example.com');
    await promoteToAdmin(userId);
    const res = await request(app)
      .get('/api/admin/attachment-blocklist')
      .set('Cookie', `token=${token}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.blockedExtensions)).toBe(true);
  });

  it('一般ユーザーは GET で 403 になる', async () => {
    await registerUser(app, 'bl_g_first', 'bl_g_first@example.com');
    const { token } = await registerUser(app, 'bl_g_u', 'bl_g_u@example.com');
    const res = await request(app)
      .get('/api/admin/attachment-blocklist')
      .set('Cookie', `token=${token}`);
    expect(res.status).toBe(403);
  });

  it('管理者は POST で追加できる', async () => {
    const { token, userId } = await registerUser(app, 'bl_p_a', 'bl_p_a@example.com');
    await promoteToAdmin(userId);
    const res = await request(app)
      .post('/api/admin/attachment-blocklist')
      .set('Cookie', `token=${token}`)
      .send({ extension: 'sh' });
    expect(res.status).toBe(201);
    expect(res.body.blockedExtension.extension).toBe('sh');
  });

  it('POST で extension が空文字なら 400 になる', async () => {
    const { token, userId } = await registerUser(app, 'bl_p_e', 'bl_p_e@example.com');
    await promoteToAdmin(userId);
    const res = await request(app)
      .post('/api/admin/attachment-blocklist')
      .set('Cookie', `token=${token}`)
      .send({ extension: '' });
    expect(res.status).toBe(400);
  });

  it('管理者は DELETE で削除できる', async () => {
    const { token, userId } = await registerUser(app, 'bl_d', 'bl_d@example.com');
    await promoteToAdmin(userId);
    const created = await moderationService.createBlockedExtension({ extension: 'jar' }, userId);
    const res = await request(app)
      .delete(`/api/admin/attachment-blocklist/${created.id}`)
      .set('Cookie', `token=${token}`);
    expect(res.status).toBe(204);
  });
});

describe('messageService.createMessage 経由のモデレーション (block)', () => {
  it('block ワードを含む投稿は 400 で拒否される', async () => {
    const { token, userId } = await registerUser(app, 'mb_block', 'mb_block@example.com');
    const channelId = await createChannelReq(app, token, 'mb-block-ch');
    await moderationService.createNgWord({ pattern: 'forbidden', action: 'block' }, userId);
    await expect(
      messageService.createMessage(channelId, userId, 'this is forbidden text'),
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  it('warn ワードを含む投稿は messageService からは正常に保存される（呼び出し側で warn 通知）', async () => {
    const { token, userId } = await registerUser(app, 'mb_warn', 'mb_warn@example.com');
    const channelId = await createChannelReq(app, token, 'mb-warn-ch');
    await moderationService.createNgWord({ pattern: 'caution', action: 'warn' }, userId);
    const message = await messageService.createMessage(channelId, userId, 'caution sign');
    expect(message.content).toBe('caution sign');
  });

  it('NG ワードを含まない通常投稿は成功する', async () => {
    const { token, userId } = await registerUser(app, 'mb_ok', 'mb_ok@example.com');
    const channelId = await createChannelReq(app, token, 'mb-ok-ch');
    const message = await messageService.createMessage(channelId, userId, 'hello world');
    expect(message.content).toBe('hello world');
  });
});

describe('Socket send_message 経由のモデレーション', () => {
  /** Socket emit / on を記録するモックを返す */
  function makeSocket(userId: number, username: string) {
    const eventHandlers: Record<string, (...args: unknown[]) => void> = {};
    const emitted: { event: string; payload: unknown }[] = [];
    const socket = {
      data: { userId, username },
      on: jest.fn((event: string, h: (...args: unknown[]) => void) => {
        eventHandlers[event] = h;
      }),
      emit: jest.fn((event: string, payload: unknown) => {
        emitted.push({ event, payload });
      }),
    };
    const io = {
      to: jest.fn().mockReturnThis(),
      emit: jest.fn(),
    };
    return { socket, io, eventHandlers, emitted };
  }

  it('block ワードを含む投稿は new_message が emit されず error イベントが送信者に届く', async () => {
    const { userId, username } = (await registerUser(
      app,
      'sk_block',
      'sk_block@example.com',
    )) as unknown as { userId: number; token: string; username: string };
    // testHelpers.registerUser は username を返さないため自前で取得
    const channel = await testDb.queryOne<{ id: number }>(
      "INSERT INTO channels (name, created_by) VALUES ('sk-block-ch', $1) RETURNING id",
      [userId],
    );
    await testDb.execute('INSERT INTO channel_members (channel_id, user_id) VALUES ($1, $2)', [
      channel!.id,
      userId,
    ]);
    await moderationService.createNgWord({ pattern: 'banned', action: 'block' }, userId);

    const { socket, io, eventHandlers, emitted } = makeSocket(userId, username ?? 'sk_block');
    registerMessageHandlers(io as never, socket as never);
    const handler = eventHandlers['send_message'];
    expect(handler).toBeDefined();
    handler({
      channelId: channel!.id,
      content: 'this is banned',
      mentionedUserIds: [],
    });
    await flushAsync();

    // io.to(channel:N).emit('new_message') が呼ばれていないこと
    expect(io.emit).not.toHaveBeenCalledWith('new_message', expect.anything());
    // socket に error が emit されていること
    expect(emitted.some((e) => e.event === 'error')).toBe(true);
  });

  it('warn ワードを含む投稿は new_message が emit されつつ message_warning が送信者にだけ届く', async () => {
    const { userId } = await registerUser(app, 'sk_warn', 'sk_warn@example.com');
    const channel = await testDb.queryOne<{ id: number }>(
      "INSERT INTO channels (name, created_by) VALUES ('sk-warn-ch', $1) RETURNING id",
      [userId],
    );
    await testDb.execute('INSERT INTO channel_members (channel_id, user_id) VALUES ($1, $2)', [
      channel!.id,
      userId,
    ]);
    await moderationService.createNgWord({ pattern: 'careful', action: 'warn' }, userId);

    const { socket, io, eventHandlers, emitted } = makeSocket(userId, 'sk_warn');
    registerMessageHandlers(io as never, socket as never);
    const handler = eventHandlers['send_message'];
    handler({
      channelId: channel!.id,
      content: 'careful here',
      mentionedUserIds: [],
    });
    await flushAsync();

    // 送信者にだけ message_warning が emit
    expect(emitted.some((e) => e.event === 'message_warning')).toBe(true);
    // チャンネルへの new_message も emit
    expect(io.emit).toHaveBeenCalledWith('new_message', expect.anything());
  });

  it('NG ワードを含まない通常投稿では message_warning は発火しない', async () => {
    const { userId } = await registerUser(app, 'sk_ok', 'sk_ok@example.com');
    const channel = await testDb.queryOne<{ id: number }>(
      "INSERT INTO channels (name, created_by) VALUES ('sk-ok-ch', $1) RETURNING id",
      [userId],
    );
    await testDb.execute('INSERT INTO channel_members (channel_id, user_id) VALUES ($1, $2)', [
      channel!.id,
      userId,
    ]);

    const { socket, io, eventHandlers, emitted } = makeSocket(userId, 'sk_ok');
    registerMessageHandlers(io as never, socket as never);
    const handler = eventHandlers['send_message'];
    handler({
      channelId: channel!.id,
      content: 'hello clean',
      mentionedUserIds: [],
    });
    await flushAsync();

    expect(emitted.some((e) => e.event === 'message_warning')).toBe(false);
  });
});

describe('POST /api/files/upload の拡張子検証', () => {
  it('ブロック対象の拡張子のアップロードは 400 で拒否される', async () => {
    const { token, userId } = await registerUser(app, 'fu_blk', 'fu_blk@example.com');
    await promoteToAdmin(userId);
    await moderationService.createBlockedExtension({ extension: 'exe' }, userId);

    const res = await request(app)
      .post('/api/files/upload')
      .set('Cookie', `token=${token}`)
      .attach('file', Buffer.from('binary'), { filename: 'malware.exe' });
    expect(res.status).toBe(400);
  });

  it('大文字拡張子（例: "EVIL.EXE"）も小文字判定で拒否される', async () => {
    const { token, userId } = await registerUser(app, 'fu_upper', 'fu_upper@example.com');
    await promoteToAdmin(userId);
    await moderationService.createBlockedExtension({ extension: 'exe' }, userId);

    const res = await request(app)
      .post('/api/files/upload')
      .set('Cookie', `token=${token}`)
      .attach('file', Buffer.from('binary'), { filename: 'EVIL.EXE' });
    expect(res.status).toBe(400);
  });

  it('ブロック対象でない拡張子のアップロードは成功する', async () => {
    const { token, userId } = await registerUser(app, 'fu_ok', 'fu_ok@example.com');
    await promoteToAdmin(userId);
    await moderationService.createBlockedExtension({ extension: 'exe' }, userId);

    const res = await request(app)
      .post('/api/files/upload')
      .set('Cookie', `token=${token}`)
      .attach('file', Buffer.from('hello'), { filename: 'note.txt' });
    expect(res.status).toBe(200);
  });
});

describe('監査ログ', () => {
  it('NG ワード追加時に "moderation.ngword.create" が記録される', async () => {
    const { token, userId } = await registerUser(app, 'al_nc', 'al_nc@example.com');
    await promoteToAdmin(userId);
    await request(app)
      .post('/api/admin/ng-words')
      .set('Cookie', `token=${token}`)
      .send({ pattern: 'logme', action: 'block' });
    const { logs } = await listAuditLogs({ actionType: 'moderation.ngword.create' });
    expect(logs.find((l) => l.actorUserId === userId)).toBeDefined();
  });

  it('NG ワード更新時に "moderation.ngword.update" が記録される', async () => {
    const { token, userId } = await registerUser(app, 'al_nu', 'al_nu@example.com');
    await promoteToAdmin(userId);
    const created = await moderationService.createNgWord({ pattern: 'patch_me' }, userId);
    await request(app)
      .patch(`/api/admin/ng-words/${created.id}`)
      .set('Cookie', `token=${token}`)
      .send({ action: 'warn' });
    const { logs } = await listAuditLogs({ actionType: 'moderation.ngword.update' });
    expect(logs.find((l) => l.actorUserId === userId)).toBeDefined();
  });

  it('NG ワード削除時に "moderation.ngword.delete" が記録される', async () => {
    const { token, userId } = await registerUser(app, 'al_nd', 'al_nd@example.com');
    await promoteToAdmin(userId);
    const created = await moderationService.createNgWord({ pattern: 'delme' }, userId);
    await request(app).delete(`/api/admin/ng-words/${created.id}`).set('Cookie', `token=${token}`);
    const { logs } = await listAuditLogs({ actionType: 'moderation.ngword.delete' });
    expect(logs.find((l) => l.actorUserId === userId)).toBeDefined();
  });

  it('拡張子追加時に "moderation.blocklist.add" が記録される', async () => {
    const { token, userId } = await registerUser(app, 'al_ba', 'al_ba@example.com');
    await promoteToAdmin(userId);
    await request(app)
      .post('/api/admin/attachment-blocklist')
      .set('Cookie', `token=${token}`)
      .send({ extension: 'msi' });
    const { logs } = await listAuditLogs({ actionType: 'moderation.blocklist.add' });
    expect(logs.find((l) => l.actorUserId === userId)).toBeDefined();
  });

  it('拡張子削除時に "moderation.blocklist.remove" が記録される', async () => {
    const { token, userId } = await registerUser(app, 'al_br', 'al_br@example.com');
    await promoteToAdmin(userId);
    const created = await moderationService.createBlockedExtension({ extension: 'vbs' }, userId);
    await request(app)
      .delete(`/api/admin/attachment-blocklist/${created.id}`)
      .set('Cookie', `token=${token}`);
    const { logs } = await listAuditLogs({ actionType: 'moderation.blocklist.remove' });
    expect(logs.find((l) => l.actorUserId === userId)).toBeDefined();
  });
});
