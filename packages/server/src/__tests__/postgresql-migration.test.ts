/**
 * テスト対象: PostgreSQL移行後のデータベース接続・クエリ実行
 * 戦略: database.ts の新しい非同期API（pg Pool）が正しく動作し、
 *        SQLite固有の構文がPostgreSQL方言に正しく変換されていることを検証する。
 *        テスト用には pg-mem を使用してインメモリ PostgreSQL 互換環境で実行する。
 */

import { createTestDatabase } from './__fixtures__/pgTestHelper';
import fs from 'fs';
import path from 'path';

const testDb = createTestDatabase();

jest.mock('../db/database', () => testDb);

describe('PostgreSQL移行: データベース接続', () => {
  describe('Pool初期化', () => {
    it('getPool()がPool instanceを返す', () => {
      const pool = testDb.getPool();
      expect(pool).toBeDefined();
      expect(typeof pool.query).toBe('function');
    });

    it('closeDatabase()がPromiseを返す（Pool終了APIが非同期）', async () => {
      await expect(testDb.closeDatabase()).resolves.not.toThrow();
    });
  });

  describe('クエリ実行ヘルパー', () => {
    it('query()がPostgreSQLのパラメータ記法($1,$2)で動作する', async () => {
      await testDb.execute(
        "INSERT INTO users (username, email, password_hash) VALUES ($1, $2, $3)",
        ['q_user1', 'q1@t.com', 'h'],
      );
      const rows = await testDb.query<{ username: string }>(
        'SELECT username FROM users WHERE username = $1',
        ['q_user1'],
      );
      expect(rows.length).toBe(1);
      expect(rows[0].username).toBe('q_user1');
    });

    it('queryOne()が単一行を返し、該当なしでnullを返す', async () => {
      const notFound = await testDb.queryOne(
        'SELECT id FROM users WHERE username = $1',
        ['no_such_user'],
      );
      expect(notFound).toBeNull();
    });

    it('execute()がRETURNING句で挿入行を返す', async () => {
      const result = await testDb.execute(
        "INSERT INTO users (username, email, password_hash) VALUES ($1, $2, $3) RETURNING id",
        ['ret_user1', 'ret1@t.com', 'h'],
      );
      expect(result.rows[0].id).toBeDefined();
      expect(typeof result.rows[0].id).toBe('number');
    });
  });
});

describe('PostgreSQL移行: SQLite→PostgreSQL方言変換', () => {
  describe('日時関数', () => {
    it("NOW()で現在日時が取得できる（datetime('now')の置き換え）", async () => {
      const rows = await testDb.query<{ now: string }>('SELECT NOW() as now');
      expect(rows[0].now).toBeDefined();
    });

    it("NOW() - INTERVAL で過去日時が計算できる（datetime('now', '-24 hours')の置き換え）", async () => {
      const rows = await testDb.query<{ past: string }>(
        "SELECT NOW() - INTERVAL '24 hours' as past",
      );
      expect(rows[0].past).toBeDefined();
    });
  });

  describe('UPSERT構文', () => {
    it('ON CONFLICT DO NOTHING が動作する（INSERT OR IGNORE の置き換え）', async () => {
      await testDb.execute(
        "INSERT INTO users (username, email, password_hash) VALUES ($1, $2, $3)",
        ['upsert_u1', 'up1@t.com', 'h'],
      );
      // 同じユーザー名で再度 INSERT → ON CONFLICT DO NOTHING でエラーにならない
      await testDb.execute(
        `INSERT INTO users (username, email, password_hash) VALUES ($1, $2, $3)
         ON CONFLICT (username) DO NOTHING`,
        ['upsert_u1', 'up1b@t.com', 'h'],
      );
      // 元のレコードが保持されている（email が更新されていない）ことを確認
      const row = await testDb.queryOne<{ email: string }>(
        'SELECT email FROM users WHERE username = $1',
        ['upsert_u1'],
      );
      expect(row?.email).toBe('up1@t.com');
    });

    it('ON CONFLICT DO UPDATE がPostgreSQL構文で動作する', async () => {
      const u = await testDb.execute(
        "INSERT INTO users (username, email, password_hash) VALUES ($1, $2, $3) RETURNING id",
        ['upsert_u2', 'up2@t.com', 'h'],
      );
      const userId = u.rows[0].id as number;

      const c = await testDb.execute(
        "INSERT INTO channels (name, created_by) VALUES ($1, $2) RETURNING id",
        ['upsert-ch1', userId],
      );
      const channelId = c.rows[0].id as number;

      await testDb.execute(
        `INSERT INTO channel_read_status (user_id, channel_id, last_read_message_id, updated_at)
         VALUES ($1, $2, $3, NOW())
         ON CONFLICT (user_id, channel_id) DO UPDATE SET
           last_read_message_id = EXCLUDED.last_read_message_id,
           updated_at = EXCLUDED.updated_at`,
        [userId, channelId, 1],
      );
      // 同一キーで再度 UPSERT
      await testDb.execute(
        `INSERT INTO channel_read_status (user_id, channel_id, last_read_message_id, updated_at)
         VALUES ($1, $2, $3, NOW())
         ON CONFLICT (user_id, channel_id) DO UPDATE SET
           last_read_message_id = EXCLUDED.last_read_message_id,
           updated_at = EXCLUDED.updated_at`,
        [userId, channelId, 2],
      );
      const row = await testDb.queryOne<{ last_read_message_id: number }>(
        'SELECT last_read_message_id FROM channel_read_status WHERE user_id = $1 AND channel_id = $2',
        [userId, channelId],
      );
      expect(row!.last_read_message_id).toBe(2);
    });
  });

  describe('自動採番', () => {
    it('SERIAL 主キーで INSERT 時に ID が自動生成される', async () => {
      const r1 = await testDb.execute(
        "INSERT INTO users (username, email, password_hash) VALUES ($1, $2, $3) RETURNING id",
        ['serial_u1', 's1@t.com', 'h'],
      );
      const r2 = await testDb.execute(
        "INSERT INTO users (username, email, password_hash) VALUES ($1, $2, $3) RETURNING id",
        ['serial_u2', 's2@t.com', 'h'],
      );
      expect(r2.rows[0].id as number).toBeGreaterThan(r1.rows[0].id as number);
    });

    it('INSERT で RETURNING id により挿入IDを取得できる', async () => {
      const r = await testDb.execute(
        "INSERT INTO users (username, email, password_hash) VALUES ($1, $2, $3) RETURNING id",
        ['ret_id_u', 'ri@t.com', 'h'],
      );
      expect(r.rows[0].id).toBeDefined();
      expect(typeof r.rows[0].id).toBe('number');
    });
  });

  describe('エラーコード', () => {
    it('UNIQUE制約違反が PostgreSQL のエラーコード 23505 で検出される', async () => {
      await testDb.execute(
        "INSERT INTO users (username, email, password_hash) VALUES ($1, $2, $3)",
        ['unique_u1', 'uq1@t.com', 'h'],
      );
      try {
        await testDb.execute(
          "INSERT INTO users (username, email, password_hash) VALUES ($1, $2, $3)",
          ['unique_u1', 'uq1b@t.com', 'h'],
        );
        throw new Error('expected unique violation');
      } catch (err) {
        // pg 互換のエラーコード 23505 を期待
        expect((err as { code?: string }).code).toBe('23505');
      }
    });
  });
});

describe('PostgreSQL移行: サービス層の非同期化', () => {
  describe('authService', () => {
    it('register() / getUserById() / getAllUsers() が Promise を返す（非同期）', async () => {
      const { register, getUserById, getAllUsers } = await import('../services/authService');

      const user = await register('svc_user1', 'svc1@t.com', 'password123');
      expect(user.id).toBeDefined();
      expect(user.username).toBe('svc_user1');

      const fetched = await getUserById(user.id);
      expect(fetched?.id).toBe(user.id);

      const all = await getAllUsers();
      expect(Array.isArray(all)).toBe(true);
    });
  });

  describe('channelService', () => {
    it('createChannel() / getChannelsForUser() / markChannelAsRead() が Promise を返す', async () => {
      const { createChannel, getChannelsForUser, markChannelAsRead } = await import(
        '../services/channelService'
      );
      const { register } = await import('../services/authService');

      const user = await register('svc_ch_u', 'svcch@t.com', 'password123');
      const ch = await createChannel('svc-channel-1', undefined, user.id);
      expect(ch.id).toBeDefined();

      const channels = await getChannelsForUser(user.id);
      expect(Array.isArray(channels)).toBe(true);

      await expect(markChannelAsRead(ch.id, user.id)).resolves.not.toThrow();
    });
  });

  describe('messageService', () => {
    it('createMessage() / editMessage() / searchMessages() が Promise を返す', async () => {
      const { createMessage, editMessage, searchMessages } = await import(
        '../services/messageService'
      );
      const { createChannel } = await import('../services/channelService');
      const { register } = await import('../services/authService');

      const user = await register('svc_msg_u', 'svcmsg@t.com', 'password123');
      const ch = await createChannel('svc-msg-channel', undefined, user.id);

      const msg = await createMessage(ch.id, user.id, 'hello search token');
      expect(msg.id).toBeDefined();

      const edited = await editMessage(msg.id, user.id, 'edited content');
      expect(edited.content).toBe('edited content');

      const results = await searchMessages('edited');
      expect(Array.isArray(results)).toBe(true);
    });
  });

  describe('dmService', () => {
    it('getOrCreateConversation() が冪等に動作し sendMessage() が Promise を返す', async () => {
      const dm = await import('../services/dmService');
      const { register } = await import('../services/authService');

      const a = await register('svc_dm_a', 'svcdma@t.com', 'password123');
      const b = await register('svc_dm_b', 'svcdmb@t.com', 'password123');

      const conv1 = await dm.getOrCreateConversation(a.id, b.id);
      const conv2 = await dm.getOrCreateConversation(a.id, b.id);
      expect(conv1.id).toBe(conv2.id);

      const msg = await dm.sendMessage(conv1.id, a.id, 'hello');
      expect(msg.content).toBe('hello');
    });
  });

  describe('bookmarkService', () => {
    it('addBookmark() が Promise を返し UNIQUE 制約違反を Error に変換する', async () => {
      const { addBookmark } = await import('../services/bookmarkService');
      const { createMessage } = await import('../services/messageService');
      const { createChannel } = await import('../services/channelService');
      const { register } = await import('../services/authService');

      const user = await register('svc_bm_u', 'svcbm@t.com', 'password123');
      const ch = await createChannel('svc-bm-channel', undefined, user.id);
      const msg = await createMessage(ch.id, user.id, 'bookmark target');

      const bm = await addBookmark(user.id, msg.id);
      expect(bm.id).toBeDefined();

      await expect(addBookmark(user.id, msg.id)).rejects.toThrow(/already bookmarked/);
    });
  });

  describe('pinMessageService', () => {
    it('pinMessage() が Promise を返し UNIQUE 制約違反を Error に変換する', async () => {
      const { pinMessage } = await import('../services/pinMessageService');
      const { createMessage } = await import('../services/messageService');
      const { createChannel } = await import('../services/channelService');
      const { register } = await import('../services/authService');

      const user = await register('svc_pin_u', 'svcpin@t.com', 'password123');
      const ch = await createChannel('svc-pin-channel', undefined, user.id);
      const msg = await createMessage(ch.id, user.id, 'pin target');

      const p = await pinMessage(msg.id, ch.id, user.id);
      expect(p.id).toBeDefined();

      await expect(pinMessage(msg.id, ch.id, user.id)).rejects.toThrow(/already pinned/);
    });
  });
});

describe('PostgreSQL移行: スキーマ', () => {
  const schemaHcl = fs.readFileSync(
    path.resolve(__dirname, '../../../../db/schema.hcl'),
    'utf-8',
  );

  describe('インデックス名の変更', () => {
    it('idx_users_username が定義されている', () => {
      expect(schemaHcl).toContain('idx_users_username');
    });

    it('idx_users_email が定義されている', () => {
      expect(schemaHcl).toContain('idx_users_email');
    });

    it('idx_channels_name が定義されている', () => {
      expect(schemaHcl).toContain('idx_channels_name');
    });

    it('idx_push_subscriptions_endpoint が定義されている', () => {
      expect(schemaHcl).toContain('idx_push_subscriptions_endpoint');
    });

    it('idx_pinned_messages_message_channel が定義されている', () => {
      expect(schemaHcl).toContain('idx_pinned_messages_message_channel');
    });

    it('idx_bookmarks_user_message が定義されている', () => {
      expect(schemaHcl).toContain('idx_bookmarks_user_message');
    });

    it('idx_dm_conversations_user_pair が定義されている', () => {
      expect(schemaHcl).toContain('idx_dm_conversations_user_pair');
    });

    it('idx_pinned_channels_user_channel が定義されている', () => {
      expect(schemaHcl).toContain('idx_pinned_channels_user_channel');
    });

    it('sqlite_autoindex_ のような SQLite 固有名が残っていない', () => {
      expect(schemaHcl).not.toContain('sqlite_autoindex');
    });
  });

  describe('型マッピング', () => {
    it('SERIAL 型の主キーが定義されている', () => {
      expect(schemaHcl).toContain('type    = serial');
    });

    it('timestamptz 型が timestamp カラムに使われている', () => {
      expect(schemaHcl).toContain('type    = timestamptz');
    });

    it('boolean 型が is_active 等のカラムに使われている', () => {
      expect(schemaHcl).toContain('type    = boolean');
    });
  });
});

describe('PostgreSQL移行: Docker環境', () => {
  const dockerfilePath = path.resolve(__dirname, '../../../../db/Dockerfile');

  describe('db/Dockerfile', () => {
    it('db/Dockerfile が存在する', () => {
      expect(fs.existsSync(dockerfilePath)).toBe(true);
    });

    it('PostgreSQL公式イメージを FROM している', () => {
      const content = fs.readFileSync(dockerfilePath, 'utf-8');
      expect(content.toLowerCase()).toMatch(/from\s+postgres/);
    });
  });
});
