/**
 * PostgreSQL テスト用ヘルパー
 *
 * pg-mem を使ってインメモリ PostgreSQL 互換 DB を構築し、
 * database.ts のモジュールをモックする共通関数群。
 *
 * 使い方:
 *   1. jest.mock('../../db/database') で database モジュールをモックする
 *   2. このファイルの setupTestDatabase() を beforeAll で呼び出す
 *   3. テストファイル内で database モジュールをインポートして使う
 */

import { newDb, DataType } from 'pg-mem';
import type { Pool, QueryResultRow } from 'pg';

/** pg-mem のインメモリ DB から疑似 Pool を作成してテスト用モック関数群を返す */
export function createTestDatabase() {
  const mem = newDb();

  // pg-mem は NOW() をサポートしているがレジスタが必要な場合がある
  // 基本的な関数をregister
  mem.public.registerFunction({
    name: 'gen_random_uuid',
    returns: DataType.text,
    implementation: () => 'test-uuid-' + Math.random().toString(36).slice(2),
  });

  // スキーマ作成
  mem.public.none(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      username TEXT NOT NULL UNIQUE,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      avatar_url TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      display_name TEXT,
      location TEXT,
      role TEXT NOT NULL DEFAULT 'user',
      is_active BOOLEAN NOT NULL DEFAULT true,
      last_login_at TIMESTAMPTZ,
      theme TEXT NOT NULL DEFAULT 'light'
    );

    CREATE TABLE IF NOT EXISTS channels (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      description TEXT,
      created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
      is_private BOOLEAN NOT NULL DEFAULT false,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      topic TEXT
    );

    CREATE TABLE IF NOT EXISTS channel_members (
      channel_id INTEGER NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (channel_id, user_id)
    );

    CREATE TABLE IF NOT EXISTS messages (
      id SERIAL PRIMARY KEY,
      channel_id INTEGER NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
      user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      content TEXT NOT NULL,
      is_edited BOOLEAN NOT NULL DEFAULT false,
      is_deleted BOOLEAN NOT NULL DEFAULT false,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      parent_message_id INTEGER REFERENCES messages(id) ON DELETE CASCADE,
      root_message_id INTEGER REFERENCES messages(id) ON DELETE CASCADE,
      quoted_message_id INTEGER
    );

    CREATE TABLE IF NOT EXISTS mentions (
      id SERIAL PRIMARY KEY,
      message_id INTEGER NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
      mentioned_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      channel_id INTEGER NOT NULL DEFAULT 0,
      is_read BOOLEAN NOT NULL DEFAULT false
    );

    CREATE TABLE IF NOT EXISTS message_attachments (
      id SERIAL PRIMARY KEY,
      message_id INTEGER REFERENCES messages(id) ON DELETE CASCADE,
      url TEXT NOT NULL,
      original_name TEXT NOT NULL,
      size INTEGER NOT NULL,
      mime_type TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS push_subscriptions (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      endpoint TEXT NOT NULL UNIQUE,
      p256dh TEXT NOT NULL,
      auth TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS message_reactions (
      id SERIAL PRIMARY KEY,
      message_id INTEGER NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      emoji TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (message_id, user_id, emoji)
    );

    CREATE TABLE IF NOT EXISTS channel_read_status (
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      channel_id INTEGER NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
      last_read_message_id INTEGER,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (user_id, channel_id)
    );

    CREATE TABLE IF NOT EXISTS pinned_messages (
      id SERIAL PRIMARY KEY,
      message_id INTEGER NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
      channel_id INTEGER NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
      pinned_by INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      pinned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (message_id, channel_id)
    );

    CREATE TABLE IF NOT EXISTS bookmarks (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      message_id INTEGER NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
      bookmarked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (user_id, message_id)
    );

    CREATE TABLE IF NOT EXISTS dm_conversations (
      id SERIAL PRIMARY KEY,
      user_a_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      user_b_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (user_a_id, user_b_id)
    );

    CREATE TABLE IF NOT EXISTS dm_messages (
      id SERIAL PRIMARY KEY,
      conversation_id INTEGER NOT NULL REFERENCES dm_conversations(id) ON DELETE CASCADE,
      sender_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      content TEXT NOT NULL,
      is_read BOOLEAN NOT NULL DEFAULT false,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS pinned_channels (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      channel_id INTEGER NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (user_id, channel_id)
    );

    CREATE TABLE IF NOT EXISTS reminders (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      message_id INTEGER NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
      remind_at TIMESTAMPTZ NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  // pg-mem で作った Pool アダプタ
  const { Pool: PgMemPool } = mem.adapters.createPg();
  const pool = new PgMemPool() as unknown as Pool;

  // database.ts のエクスポートと同じインターフェースを返す
  async function queryFn<T extends QueryResultRow = QueryResultRow>(
    text: string,
    params?: unknown[],
  ): Promise<T[]> {
    const result = await pool.query<T>(text, params);
    return result.rows;
  }

  async function queryOneFn<T extends QueryResultRow = QueryResultRow>(
    text: string,
    params?: unknown[],
  ): Promise<T | null> {
    const result = await pool.query<T>(text, params);
    return result.rows[0] ?? null;
  }

  async function executeFn(
    text: string,
    params?: unknown[],
  ): Promise<{ rowCount: number; rows: QueryResultRow[] }> {
    const result = await pool.query(text, params);
    return { rowCount: result.rowCount ?? 0, rows: result.rows };
  }

  return {
    pool,
    getPool: () => pool,
    query: queryFn,
    queryOne: queryOneFn,
    execute: executeFn,
    closeDatabase: async () => { /* noop */ },
    withTransaction: async <T>(fn: (client: unknown) => Promise<T>): Promise<T> => {
      // pg-mem はトランザクションを簡易的にサポートしている
      return fn(pool);
    },
  };
}
