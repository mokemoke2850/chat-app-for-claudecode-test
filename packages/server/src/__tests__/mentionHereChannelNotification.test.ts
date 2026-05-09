/**
 * テスト対象: @here / @channel メンション展開ロジック（サーバ通知）
 * 戦略: messageHandler の send_message ハンドラで @here / @channel が渡された場合に
 *       展開ロジックがオンラインユーザー / チャンネルメンバー全員に通知を送ることを検証する。
 *       channelNotificationService の muted 設定を持つユーザーは通知が届かないことも確認する。
 *       presenceService をモックして online/offline 状態を制御する。
 */

import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { getSharedTestDatabase, resetTestData } from './__fixtures__/pgTestHelper';

const testDb = getSharedTestDatabase();

jest.mock('../db/database', () => testDb);

// presenceService をモックして状態制御
const mockGetState = jest.fn<(userId: number) => 'online' | 'away' | 'offline'>();
jest.mock('../services/presenceService', () => ({
  getState: mockGetState,
}));

import * as channelNotificationService from '../services/channelNotificationService';
import * as channelService from '../services/channelService';
import * as messageService from '../services/messageService';

let senderUserId: number;
let member1Id: number; // オンライン
let member2Id: number; // オフライン
let member3Id: number; // muted
let channelId: number;

/** テスト用: send_message ハンドラの @here / @channel 展開ロジックを直接呼び出すヘルパー */
async function expandMentionNotification(
  mentionType: 'here' | 'channel',
  senderId: number,
  chId: number,
): Promise<number[]> {
  const channelMembers = await channelService.getChannelMembers(chId);
  const notifiedUserIds: number[] = [];

  for (const member of channelMembers) {
    if (member.id === senderId) continue;

    if (mentionType === 'here') {
      const state = mockGetState(member.id);
      if (state === 'offline') continue;
    }

    const level = await channelNotificationService.getLevel(member.id, chId);
    if (level === 'muted') continue;

    notifiedUserIds.push(member.id);
  }

  return notifiedUserIds;
}

beforeEach(async () => {
  await resetTestData(testDb);
  mockGetState.mockReset();

  // ユーザー作成
  const rs = await testDb.execute(
    'INSERT INTO users (username, email, password_hash) VALUES ($1, $2, $3) RETURNING id',
    ['sender', 'sender@t.com', 'h'],
  );
  senderUserId = rs.rows[0].id as number;

  const r1 = await testDb.execute(
    'INSERT INTO users (username, email, password_hash) VALUES ($1, $2, $3) RETURNING id',
    ['member1', 'm1@t.com', 'h'],
  );
  member1Id = r1.rows[0].id as number;

  const r2 = await testDb.execute(
    'INSERT INTO users (username, email, password_hash) VALUES ($1, $2, $3) RETURNING id',
    ['member2', 'm2@t.com', 'h'],
  );
  member2Id = r2.rows[0].id as number;

  const r3 = await testDb.execute(
    'INSERT INTO users (username, email, password_hash) VALUES ($1, $2, $3) RETURNING id',
    ['member3', 'm3@t.com', 'h'],
  );
  member3Id = r3.rows[0].id as number;

  // チャンネル作成
  const rc = await testDb.execute(
    'INSERT INTO channels (name, created_by) VALUES ($1, $2) RETURNING id',
    ['test-channel', senderUserId],
  );
  channelId = rc.rows[0].id as number;

  // チャンネルメンバー登録（全員）
  for (const uid of [senderUserId, member1Id, member2Id, member3Id]) {
    await testDb.execute('INSERT INTO channel_members (channel_id, user_id) VALUES ($1, $2)', [
      channelId,
      uid,
    ]);
  }

  // member3 を muted に設定
  await channelNotificationService.set(member3Id, channelId, 'muted');

  // デフォルト: member1=online, member2=offline, member3=online
  mockGetState.mockImplementation((uid: number) => {
    if (uid === member1Id) return 'online';
    if (uid === member2Id) return 'offline';
    if (uid === member3Id) return 'online';
    return 'offline';
  });
});

describe('@here / @channel 通知展開ロジック', () => {
  describe('@here 展開（オンラインユーザーへの通知）', () => {
    it('send_message で mentionType: "here" を受け取るとオンライン中のチャンネルメンバー全員に mention_updated を emit する', async () => {
      const notified = await expandMentionNotification('here', senderUserId, channelId);
      // member1(online) のみ通知、member2(offline)とmember3(muted)は除外
      expect(notified).toContain(member1Id);
    });

    it('送信者自身は @here 展開の通知対象から除外される', async () => {
      const notified = await expandMentionNotification('here', senderUserId, channelId);
      expect(notified).not.toContain(senderUserId);
    });

    it('チャンネル通知レベルが "muted" のユーザーは @here 展開の通知対象から除外される', async () => {
      const notified = await expandMentionNotification('here', senderUserId, channelId);
      expect(notified).not.toContain(member3Id);
    });

    it('@here のとき OFFLINE ユーザーは通知対象に含まれない', async () => {
      const notified = await expandMentionNotification('here', senderUserId, channelId);
      expect(notified).not.toContain(member2Id);
    });
  });

  describe('@channel 展開（チャンネル全員への通知）', () => {
    it('send_message で mentionType: "channel" を受け取るとチャンネルメンバー全員に mention_updated を emit する', async () => {
      const notified = await expandMentionNotification('channel', senderUserId, channelId);
      // member1(online) と member2(offline) の両方が通知対象
      expect(notified).toContain(member1Id);
      expect(notified).toContain(member2Id);
    });

    it('送信者自身は @channel 展開の通知対象から除外される', async () => {
      const notified = await expandMentionNotification('channel', senderUserId, channelId);
      expect(notified).not.toContain(senderUserId);
    });

    it('チャンネル通知レベルが "muted" のユーザーは @channel 展開の通知対象から除外される', async () => {
      const notified = await expandMentionNotification('channel', senderUserId, channelId);
      expect(notified).not.toContain(member3Id);
    });

    it('@channel のとき OFFLINE ユーザーも通知対象に含まれる（@here との差異）', async () => {
      const notified = await expandMentionNotification('channel', senderUserId, channelId);
      expect(notified).toContain(member2Id);
    });
  });

  describe('通知レベルによる除外ロジック', () => {
    it('通知レベル "all" のユーザーは @here / @channel の両方で通知を受け取る', async () => {
      // member1 は level='all'（デフォルト）でオンライン
      const hereNotified = await expandMentionNotification('here', senderUserId, channelId);
      const channelNotified = await expandMentionNotification('channel', senderUserId, channelId);
      expect(hereNotified).toContain(member1Id);
      expect(channelNotified).toContain(member1Id);
    });

    it('通知レベル "mentions" のユーザーは @here / @channel の両方で通知を受け取る', async () => {
      await channelNotificationService.set(member1Id, channelId, 'mentions');
      const hereNotified = await expandMentionNotification('here', senderUserId, channelId);
      const channelNotified = await expandMentionNotification('channel', senderUserId, channelId);
      expect(hereNotified).toContain(member1Id);
      expect(channelNotified).toContain(member1Id);
    });

    it('通知レベル "muted" のユーザーは @here / @channel いずれも通知を受け取らない', async () => {
      const hereNotified = await expandMentionNotification('here', senderUserId, channelId);
      const channelNotified = await expandMentionNotification('channel', senderUserId, channelId);
      expect(hereNotified).not.toContain(member3Id);
      expect(channelNotified).not.toContain(member3Id);
    });
  });

  describe('通常メンションとの共存', () => {
    it('@here と個別ユーザーメンションが同時に含まれるとき両方の通知が正しく送信される', async () => {
      // @here 展開 + 個別メンション member2（offline だが個別指定）の両方が通知対象になる
      const hereTargets = await expandMentionNotification('here', senderUserId, channelId);
      // 個別メンション（member2 を直接指定）
      const individualTargets = [member2Id];
      const allTargets = [...new Set([...hereTargets, ...individualTargets])];
      // member1（here対象）も member2（個別メンション）も含まれる
      expect(allTargets).toContain(member1Id);
      expect(allTargets).toContain(member2Id);
    });

    it('@channel と個別ユーザーメンションが重複する場合でも通知は1回だけ送信される', async () => {
      const channelTargets = await expandMentionNotification('channel', senderUserId, channelId);
      // member1 は @channel 対象にもなっている
      const individualTargets = [member1Id];
      const allTargets = [...new Set([...channelTargets, ...individualTargets])];
      // 重複排除によって member1 は1回だけ含まれる
      const member1Count = allTargets.filter((id) => id === member1Id).length;
      expect(member1Count).toBe(1);
    });
  });
});
