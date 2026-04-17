/**
 * pgTestHelper の最適化動作を検証するテスト項目
 *
 * テスト対象: packages/server/src/__tests__/__fixtures__/pgTestHelper.ts
 * 目的: DB初期化の共通化・軽量化が正しく機能するかを検証する。
 *
 * 検証観点:
 *   - createTestDatabase() が返すオブジェクトのインターフェース整合性
 *   - 複数テストファイルで createTestDatabase() を呼び出した場合の分離性
 *   - スキーマ初期化（全テーブル）が1回の呼び出しで完了することの確認
 *   - 各テストケース間のデータ分離（beforeEach でのリセット相当）
 */

import { createTestDatabase, getSharedTestDatabase, resetTestData } from './__fixtures__/pgTestHelper';

describe('createTestDatabase() のインターフェース検証', () => {
  it('query / queryOne / execute / withTransaction / closeDatabase がエクスポートされている', () => {
    const db = createTestDatabase();
    expect(typeof db.query).toBe('function');
    expect(typeof db.queryOne).toBe('function');
    expect(typeof db.execute).toBe('function');
    expect(typeof db.withTransaction).toBe('function');
    expect(typeof db.closeDatabase).toBe('function');
  });

  it('pool および getPool() が同一インスタンスを返す', () => {
    const db = createTestDatabase();
    expect(db.getPool()).toBe(db.pool);
  });
});

describe('スキーマ初期化の完全性', () => {
  const db = createTestDatabase();

  it('users テーブルが存在し、必須カラム（id, username, email, password_hash）を持つ', async () => {
    const result = await db.execute(
      "INSERT INTO users (username, email, password_hash) VALUES ($1, $2, $3) RETURNING id, username, email, password_hash",
      ['schema-test-user', 'schema@test.com', 'hash'],
    );
    expect(result.rows[0]).toMatchObject({
      username: 'schema-test-user',
      email: 'schema@test.com',
      password_hash: 'hash',
    });
    expect(result.rows[0].id).toBeDefined();
  });

  it('channels テーブルが存在し、外部キー created_by が users.id を参照する', async () => {
    const userResult = await db.execute(
      "INSERT INTO users (username, email, password_hash) VALUES ($1, $2, $3) RETURNING id",
      ['channel-fk-user', 'channel-fk@test.com', 'hash'],
    );
    const userId = userResult.rows[0].id as number;
    const result = await db.execute(
      "INSERT INTO channels (name, created_by) VALUES ($1, $2) RETURNING id, created_by",
      ['fk-test-channel', userId],
    );
    expect(result.rows[0].created_by).toBe(userId);
  });

  it('messages テーブルが存在し、parent_message_id / root_message_id の自己参照制約を持つ', async () => {
    const userRes = await db.execute(
      "INSERT INTO users (username, email, password_hash) VALUES ($1, $2, $3) RETURNING id",
      ['msg-self-user', 'msg-self@test.com', 'hash'],
    );
    const uid = userRes.rows[0].id as number;
    const chRes = await db.execute(
      "INSERT INTO channels (name, created_by) VALUES ($1, $2) RETURNING id",
      ['msg-self-ch', uid],
    );
    const cid = chRes.rows[0].id as number;
    const parentRes = await db.execute(
      "INSERT INTO messages (channel_id, user_id, content) VALUES ($1, $2, $3) RETURNING id",
      [cid, uid, 'parent'],
    );
    const parentId = parentRes.rows[0].id as number;
    const childRes = await db.execute(
      "INSERT INTO messages (channel_id, user_id, content, parent_message_id, root_message_id) VALUES ($1, $2, $3, $4, $5) RETURNING id, parent_message_id, root_message_id",
      [cid, uid, 'child', parentId, parentId],
    );
    expect(childRes.rows[0].parent_message_id).toBe(parentId);
    expect(childRes.rows[0].root_message_id).toBe(parentId);
  });

  it('reminders テーブルが存在し、message_id と user_id の外部キーが機能する', async () => {
    const userRes = await db.execute(
      "INSERT INTO users (username, email, password_hash) VALUES ($1, $2, $3) RETURNING id",
      ['reminder-fk-user', 'reminder-fk@test.com', 'hash'],
    );
    const uid = userRes.rows[0].id as number;
    const chRes = await db.execute(
      "INSERT INTO channels (name, created_by) VALUES ($1, $2) RETURNING id",
      ['reminder-fk-ch', uid],
    );
    const cid = chRes.rows[0].id as number;
    const msgRes = await db.execute(
      "INSERT INTO messages (channel_id, user_id, content) VALUES ($1, $2, $3) RETURNING id",
      [cid, uid, 'reminder msg'],
    );
    const msgId = msgRes.rows[0].id as number;
    const remResult = await db.execute(
      "INSERT INTO reminders (user_id, message_id, remind_at) VALUES ($1, $2, $3) RETURNING id, user_id, message_id",
      [uid, msgId, new Date(Date.now() + 3600000).toISOString()],
    );
    expect(remResult.rows[0].user_id).toBe(uid);
    expect(remResult.rows[0].message_id).toBe(msgId);
  });

  it('初期化後に全14テーブルが存在することを確認する', async () => {
    const expectedTables = [
      'users', 'channels', 'channel_members', 'messages', 'mentions',
      'message_attachments', 'push_subscriptions', 'message_reactions',
      'channel_read_status', 'pinned_messages', 'bookmarks',
      'dm_conversations', 'dm_messages', 'pinned_channels', 'reminders',
    ];
    for (const tableName of expectedTables) {
      const result = await db.execute(
        `SELECT COUNT(*) as count FROM ${tableName}`,
        [],
      );
      expect(result.rowCount).toBeGreaterThanOrEqual(0);
    }
  });
});

describe('複数 createTestDatabase() インスタンスの分離性', () => {
  it('2つの createTestDatabase() は独立したメモリ DB を持ち、データを共有しない', async () => {
    const db1 = createTestDatabase();
    const db2 = createTestDatabase();

    await db1.execute(
      "INSERT INTO users (username, email, password_hash) VALUES ($1, $2, $3)",
      ['isolation-user-a', 'iso-a@test.com', 'hash'],
    );

    const result = await db2.query<{ count: string | number }>(
      "SELECT COUNT(*) as count FROM users WHERE username = $1",
      ['isolation-user-a'],
    );
    // pg-mem は COUNT() を数値で返す場合がある
    expect(Number(result[0].count)).toBe(0);
  });

  it('一方のインスタンスへの INSERT が他方に影響しない', async () => {
    const db1 = createTestDatabase();
    const db2 = createTestDatabase();

    await db1.execute(
      "INSERT INTO users (username, email, password_hash) VALUES ($1, $2, $3)",
      ['only-in-db1', 'db1-only@test.com', 'hash'],
    );

    const inDb2 = await db2.queryOne<{ username: string }>(
      "SELECT username FROM users WHERE username = $1",
      ['only-in-db1'],
    );
    expect(inDb2).toBeNull();
  });
});

describe('query() / execute() の動作', () => {
  const db = createTestDatabase();

  beforeAll(async () => {
    await db.execute(
      "INSERT INTO users (username, email, password_hash) VALUES ($1, $2, $3)",
      ['query-test-user', 'query@test.com', 'hash'],
    );
  });

  it('query() は結果行の配列を返す', async () => {
    const result = await db.query<{ username: string }>(
      "SELECT username FROM users WHERE username = $1",
      ['query-test-user'],
    );
    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBe(1);
  });

  it('query() でパラメータバインディング（$1, $2）が正しく機能する', async () => {
    const result = await db.query<{ username: string; email: string }>(
      "SELECT username, email FROM users WHERE username = $1 AND email = $2",
      ['query-test-user', 'query@test.com'],
    );
    expect(result[0].username).toBe('query-test-user');
    expect(result[0].email).toBe('query@test.com');
  });

  it('queryOne() は行が1件のとき最初の行オブジェクトを返す', async () => {
    const result = await db.queryOne<{ username: string }>(
      "SELECT username FROM users WHERE username = $1",
      ['query-test-user'],
    );
    expect(result).not.toBeNull();
    expect(result!.username).toBe('query-test-user');
  });

  it('queryOne() は行が0件のとき null を返す', async () => {
    const result = await db.queryOne(
      "SELECT username FROM users WHERE username = $1",
      ['nonexistent-user-xyz'],
    );
    expect(result).toBeNull();
  });

  it('execute() は rowCount と rows を含むオブジェクトを返す', async () => {
    const result = await db.execute(
      "INSERT INTO users (username, email, password_hash) VALUES ($1, $2, $3) RETURNING id",
      ['execute-test-user', 'exec@test.com', 'hash'],
    );
    expect(result).toHaveProperty('rowCount');
    expect(result).toHaveProperty('rows');
    expect(Array.isArray(result.rows)).toBe(true);
  });
});

describe('withTransaction() の動作', () => {
  const db = createTestDatabase();

  it('withTransaction() に渡したコールバックが pool を受け取って実行される', async () => {
    let receivedClient: unknown = undefined;
    await db.withTransaction(async (client) => {
      receivedClient = client;
    });
    expect(receivedClient).toBeDefined();
  });

  it('withTransaction() はコールバックの戻り値をそのまま返す', async () => {
    const result = await db.withTransaction(async () => 'returned-value');
    expect(result).toBe('returned-value');
  });
});

describe('closeDatabase() の動作', () => {
  it('closeDatabase() を呼び出してもエラーが発生しない（noop）', async () => {
    const db = createTestDatabase();
    await expect(db.closeDatabase()).resolves.not.toThrow();
  });
});

describe('テストヘルパーとの組み合わせ', () => {
  const db = createTestDatabase();

  it('beforeAll でユーザー・チャンネル・メッセージを INSERT するパターンが正常に動作する', async () => {
    const userRes = await db.execute(
      "INSERT INTO users (username, email, password_hash) VALUES ($1, $2, $3) RETURNING id",
      ['combo-user', 'combo@test.com', 'hash'],
    );
    const uid = userRes.rows[0].id as number;

    const chRes = await db.execute(
      "INSERT INTO channels (name, created_by) VALUES ($1, $2) RETURNING id",
      ['combo-channel', uid],
    );
    const cid = chRes.rows[0].id as number;

    const msgRes = await db.execute(
      "INSERT INTO messages (channel_id, user_id, content) VALUES ($1, $2, $3) RETURNING id",
      [cid, uid, 'combo message'],
    );
    const msgId = msgRes.rows[0].id as number;

    expect(uid).toBeGreaterThan(0);
    expect(cid).toBeGreaterThan(0);
    expect(msgId).toBeGreaterThan(0);
  });
});

describe('gen_random_uuid カスタム関数', () => {
  const db = createTestDatabase();

  it('gen_random_uuid() が "test-uuid-" で始まる文字列を返す', async () => {
    const result = await db.queryOne<{ uuid: string }>(
      "SELECT gen_random_uuid() as uuid",
    );
    expect(result).not.toBeNull();
    expect(result!.uuid).toMatch(/^test-uuid-/);
  });

  it('複数回呼び出した結果がユニークである', async () => {
    // generate_series は pg-mem でサポートされないため、複数回個別に呼び出す
    const results = await Promise.all([
      db.queryOne<{ uuid: string }>("SELECT gen_random_uuid() as uuid"),
      db.queryOne<{ uuid: string }>("SELECT gen_random_uuid() as uuid"),
      db.queryOne<{ uuid: string }>("SELECT gen_random_uuid() as uuid"),
    ]);
    const uuids = results.map((r) => r!.uuid);
    const uniqueUuids = new Set(uuids);
    expect(uniqueUuids.size).toBe(uuids.length);
  });
});

describe('getSharedTestDatabase() のシングルトン動作', () => {
  it('複数回呼び出しても同一インスタンスを返す', () => {
    const db1 = getSharedTestDatabase();
    const db2 = getSharedTestDatabase();
    expect(db1).toBe(db2);
  });

  it('getSharedTestDatabase() のインターフェースが createTestDatabase() と同一である', () => {
    const db = getSharedTestDatabase();
    expect(typeof db.query).toBe('function');
    expect(typeof db.queryOne).toBe('function');
    expect(typeof db.execute).toBe('function');
    expect(typeof db.withTransaction).toBe('function');
    expect(typeof db.closeDatabase).toBe('function');
  });
});

describe('resetTestData() の動作', () => {
  it('resetTestData() を呼び出すと全テーブルのデータが削除される', async () => {
    const db = createTestDatabase();
    await db.execute(
      "INSERT INTO users (username, email, password_hash) VALUES ($1, $2, $3)",
      ['reset-test-user', 'reset@test.com', 'hash'],
    );

    const before = await db.query<{ count: string | number }>("SELECT COUNT(*) as count FROM users");
    expect(Number(before[0].count)).toBeGreaterThan(0);

    await resetTestData(db);

    const after = await db.query<{ count: string | number }>("SELECT COUNT(*) as count FROM users");
    expect(Number(after[0].count)).toBe(0);
  });
});
