/**
 * テスト対象: messageService のスレッド返信関連機能
 * 戦略: better-sqlite3 のインメモリ DB を使いサービス層を直接テストする。
 * 外部キー制約を満たすため beforeAll でユーザー・チャンネルを挿入する。
 */

import {
  getChannelMessages,
  createMessage,
  createThreadReply,
  getThreadReplies,
  searchMessages,
} from '../services/messageService';
import DatabaseLib from 'better-sqlite3';
import type { Message } from '@chat-app/shared';

let userId1: number;
let userId2: number;
let channelId: number;

jest.mock('../db/database', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const DB = require('better-sqlite3') as typeof import('better-sqlite3');
  const db = new DB(':memory:');
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

beforeAll(() => {
  const DB = DatabaseLib;
  const { getDatabase } = jest.requireMock<typeof import('../db/database')>('../db/database');
  const db = getDatabase() as InstanceType<typeof DB>;

  const r1 = db
    .prepare("INSERT INTO users (username, email, password_hash) VALUES ('user1', 'u1@t.com', 'h')")
    .run();
  userId1 = r1.lastInsertRowid as number;

  const r2 = db
    .prepare("INSERT INTO users (username, email, password_hash) VALUES ('user2', 'u2@t.com', 'h')")
    .run();
  userId2 = r2.lastInsertRowid as number;

  const rc = db
    .prepare("INSERT INTO channels (name, created_by) VALUES ('test-channel', ?)")
    .run(userId1);
  channelId = rc.lastInsertRowid as number;
});

const sampleContent = JSON.stringify({ ops: [{ insert: 'Hello\n' }] });
const replyContent = JSON.stringify({ ops: [{ insert: 'Reply\n' }] });

describe('getChannelMessages（スレッド対応）', () => {
  let rootId: number;

  beforeEach(() => {
    const { getDatabase } = jest.requireMock<typeof import('../db/database')>('../db/database');
    const db = getDatabase() as InstanceType<typeof DatabaseLib>;
    db.prepare('DELETE FROM messages').run();

    const root = createMessage(channelId, userId1, sampleContent);
    rootId = root.id;
    createThreadReply(rootId, rootId, userId2, replyContent);
  });

  it('ルートメッセージのみ返す（root_message_id IS NULL のもの）', () => {
    const messages = getChannelMessages(channelId);
    expect(messages.every((m: Message) => m.rootMessageId === null)).toBe(true);
    expect(messages.length).toBe(1);
  });

  it('ルートメッセージに replyCount が付与される', () => {
    const messages = getChannelMessages(channelId);
    expect(messages[0].replyCount).toBe(1);
  });

  it('ルートメッセージに parentMessageId / rootMessageId が null で付与される', () => {
    const messages = getChannelMessages(channelId);
    expect(messages[0].parentMessageId).toBeNull();
    expect(messages[0].rootMessageId).toBeNull();
  });
});

describe('createThreadReply', () => {
  let rootId: number;

  beforeEach(() => {
    const { getDatabase } = jest.requireMock<typeof import('../db/database')>('../db/database');
    const db = getDatabase() as InstanceType<typeof DatabaseLib>;
    db.prepare('DELETE FROM messages').run();

    const root = createMessage(channelId, userId1, sampleContent);
    rootId = root.id;
  });

  it('スレッド返信を作成し Message を返す', () => {
    const reply = createThreadReply(rootId, rootId, userId2, replyContent);
    expect(reply.id).toBeDefined();
    expect(reply.content).toBe(replyContent);
    expect(reply.userId).toBe(userId2);
  });

  it('返信の parent_message_id / root_message_id が正しく設定される', () => {
    const reply = createThreadReply(rootId, rootId, userId2, replyContent);
    expect(reply.parentMessageId).toBe(rootId);
    expect(reply.rootMessageId).toBe(rootId);
  });

  it('メンション付き返信が作成できる', () => {
    const reply = createThreadReply(rootId, rootId, userId2, replyContent, [userId1]);
    expect(reply.mentions).toContain(userId1);
  });
});

describe('getThreadReplies', () => {
  let rootId: number;

  beforeEach(() => {
    const { getDatabase } = jest.requireMock<typeof import('../db/database')>('../db/database');
    const db = getDatabase() as InstanceType<typeof DatabaseLib>;
    db.prepare('DELETE FROM messages').run();

    const root = createMessage(channelId, userId1, sampleContent);
    rootId = root.id;
  });

  it('rootMessageId に紐づく全返信を created_at ASC で返す', () => {
    createThreadReply(rootId, rootId, userId1, replyContent);
    createThreadReply(rootId, rootId, userId2, replyContent);

    const replies = getThreadReplies(rootId);
    expect(replies.length).toBe(2);
    expect(replies[0].id).toBeLessThan(replies[1].id);
  });

  it('返信が 0 件のとき空配列を返す', () => {
    const replies = getThreadReplies(rootId);
    expect(replies).toEqual([]);
  });
});

describe('searchMessages（スレッド対応）', () => {
  let rootId: number;

  beforeEach(() => {
    const { getDatabase } = jest.requireMock<typeof import('../db/database')>('../db/database');
    const db = getDatabase() as InstanceType<typeof DatabaseLib>;
    db.prepare('DELETE FROM messages').run();

    const rootContent = JSON.stringify({ ops: [{ insert: 'ルートメッセージ\n' }] });
    const root = createMessage(channelId, userId1, rootContent);
    rootId = root.id;

    const replyC = JSON.stringify({ ops: [{ insert: '検索対象の返信\n' }] });
    createThreadReply(rootId, rootId, userId2, replyC);
  });

  it('スレッド返信も検索対象に含まれる', () => {
    const results = searchMessages('検索対象');
    expect(results.length).toBeGreaterThan(0);
    expect(results.some((r: Message) => r.rootMessageId === rootId)).toBe(true);
  });

  it('スレッド返信の結果に rootMessageContent が付与される', () => {
    const results = searchMessages('検索対象');
    const reply = results.find((r: Message) => r.rootMessageId === rootId);
    expect(reply).toBeDefined();
    expect(reply!.rootMessageContent).not.toBeNull();
  });

  it('ルートメッセージの検索結果には rootMessageContent が null になる', () => {
    const results = searchMessages('ルートメッセージ');
    const root = results.find((r: Message) => r.id === rootId);
    expect(root).toBeDefined();
    expect(root!.rootMessageContent).toBeNull();
  });
});
