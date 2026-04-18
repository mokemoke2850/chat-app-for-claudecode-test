/**
 * テスト対象: messageService のスレッド返信関連機能
 * 戦略: pg-mem のインメモリ PostgreSQL 互換 DB を使いサービス層を直接テストする。
 * 外部キー制約を満たすため beforeAll でユーザー・チャンネルを挿入する。
 */

import { getSharedTestDatabase, resetTestData } from './__fixtures__/pgTestHelper';

const testDb = getSharedTestDatabase();

jest.mock('../db/database', () => testDb);

import {
  getChannelMessages,
  createMessage,
  createThreadReply,
  getThreadReplies,
  searchMessages,
} from '../services/messageService';
import type { Message } from '@chat-app/shared';

let userId1: number;
let userId2: number;
let channelId: number;

beforeAll(async () => {
  await resetTestData(testDb);

  const r1 = await testDb.execute(
    "INSERT INTO users (username, email, password_hash) VALUES ($1, $2, $3) RETURNING id",
    ['user1', 'u1@t.com', 'h'],
  );
  userId1 = r1.rows[0].id as number;

  const r2 = await testDb.execute(
    "INSERT INTO users (username, email, password_hash) VALUES ($1, $2, $3) RETURNING id",
    ['user2', 'u2@t.com', 'h'],
  );
  userId2 = r2.rows[0].id as number;

  const rc = await testDb.execute(
    "INSERT INTO channels (name, created_by) VALUES ($1, $2) RETURNING id",
    ['test-channel', userId1],
  );
  channelId = rc.rows[0].id as number;
});

const sampleContent = JSON.stringify({ ops: [{ insert: 'Hello\n' }] });
const replyContent = JSON.stringify({ ops: [{ insert: 'Reply\n' }] });

describe('getChannelMessages（スレッド対応）', () => {
  let rootId: number;

  beforeEach(async () => {
    await testDb.execute('DELETE FROM messages');

    const root = await createMessage(channelId, userId1, sampleContent);
    rootId = root.id;
    await createThreadReply(rootId, rootId, userId2, replyContent);
  });

  it('ルートメッセージのみ返す（root_message_id IS NULL のもの）', async () => {
    const messages = await getChannelMessages(channelId);
    expect(messages.every((m: Message) => m.rootMessageId === null)).toBe(true);
    expect(messages.length).toBe(1);
  });

  it('ルートメッセージに replyCount が付与される', async () => {
    const messages = await getChannelMessages(channelId);
    expect(messages[0].replyCount).toBe(1);
  });

  it('ルートメッセージに parentMessageId / rootMessageId が null で付与される', async () => {
    const messages = await getChannelMessages(channelId);
    expect(messages[0].parentMessageId).toBeNull();
    expect(messages[0].rootMessageId).toBeNull();
  });
});

describe('createThreadReply', () => {
  let rootId: number;

  beforeEach(async () => {
    await testDb.execute('DELETE FROM messages');

    const root = await createMessage(channelId, userId1, sampleContent);
    rootId = root.id;
  });

  it('スレッド返信を作成し Message を返す', async () => {
    const reply = await createThreadReply(rootId, rootId, userId2, replyContent);
    expect(reply.id).toBeDefined();
    expect(reply.content).toBe(replyContent);
    expect(reply.userId).toBe(userId2);
  });

  it('返信の parent_message_id / root_message_id が正しく設定される', async () => {
    const reply = await createThreadReply(rootId, rootId, userId2, replyContent);
    expect(reply.parentMessageId).toBe(rootId);
    expect(reply.rootMessageId).toBe(rootId);
  });

  it('メンション付き返信が作成できる', async () => {
    const reply = await createThreadReply(rootId, rootId, userId2, replyContent, [userId1]);
    expect(reply.mentions).toContain(userId1);
  });
});

describe('getThreadReplies', () => {
  let rootId: number;

  beforeEach(async () => {
    await testDb.execute('DELETE FROM messages');

    const root = await createMessage(channelId, userId1, sampleContent);
    rootId = root.id;
  });

  it('rootMessageId に紐づく全返信を created_at ASC で返す', async () => {
    await createThreadReply(rootId, rootId, userId1, replyContent);
    await createThreadReply(rootId, rootId, userId2, replyContent);

    const replies = await getThreadReplies(rootId);
    expect(replies.length).toBe(2);
    expect(replies[0].id).toBeLessThan(replies[1].id);
  });

  it('返信が 0 件のとき空配列を返す', async () => {
    const replies = await getThreadReplies(rootId);
    expect(replies).toEqual([]);
  });
});

describe('searchMessages（スレッド対応）', () => {
  let rootId: number;

  beforeEach(async () => {
    await testDb.execute('DELETE FROM messages');

    const rootContent = JSON.stringify({ ops: [{ insert: 'ルートメッセージ\n' }] });
    const root = await createMessage(channelId, userId1, rootContent);
    rootId = root.id;

    const replyC = JSON.stringify({ ops: [{ insert: '検索対象の返信\n' }] });
    await createThreadReply(rootId, rootId, userId2, replyC);
  });

  it('スレッド返信も検索対象に含まれる', async () => {
    const results = await searchMessages('検索対象');
    expect(results.length).toBeGreaterThan(0);
    expect(results.some((r: Message) => r.rootMessageId === rootId)).toBe(true);
  });

  it('スレッド返信の結果に rootMessageContent が付与される', async () => {
    const results = await searchMessages('検索対象');
    const reply = results.find((r: Message) => r.rootMessageId === rootId);
    expect(reply).toBeDefined();
    expect(reply!.rootMessageContent).not.toBeNull();
  });

  it('ルートメッセージの検索結果には rootMessageContent が null になる', async () => {
    const results = await searchMessages('ルートメッセージ');
    const root = results.find((r: Message) => r.id === rootId);
    expect(root).toBeDefined();
    expect(root!.rootMessageContent).toBeNull();
  });
});
