import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

const DATA_DIR = path.join(__dirname, '../../data');
const DB_PATH = path.join(DATA_DIR, 'chat.db');

let db: Database.Database | null = null;

export function getDatabase(): Database.Database {
  if (!db) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    db = new Database(DB_PATH);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
    initializeSchema(db);
  }
  return db;
}

export function initializeSchema(database: Database.Database): void {
  database.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL UNIQUE,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      avatar_url TEXT,
      display_name TEXT,
      location TEXT,
      role TEXT NOT NULL DEFAULT 'user',
      is_active INTEGER NOT NULL DEFAULT 1,
      last_login_at TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS channels (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      description TEXT,
      created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
      is_private INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS channel_members (
      channel_id INTEGER NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      joined_at TEXT NOT NULL DEFAULT (datetime('now')),
      PRIMARY KEY (channel_id, user_id)
    );

    CREATE TABLE IF NOT EXISTS messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      channel_id INTEGER NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
      user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      content TEXT NOT NULL,
      is_edited INTEGER NOT NULL DEFAULT 0,
      is_deleted INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      parent_message_id INTEGER REFERENCES messages(id) ON DELETE CASCADE,
      root_message_id INTEGER REFERENCES messages(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS mentions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      message_id INTEGER NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
      mentioned_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS message_attachments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      message_id INTEGER REFERENCES messages(id) ON DELETE CASCADE,
      url TEXT NOT NULL,
      original_name TEXT NOT NULL,
      size INTEGER NOT NULL,
      mime_type TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS push_subscriptions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      endpoint TEXT NOT NULL UNIQUE,
      p256dh TEXT NOT NULL,
      auth TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS message_reactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      message_id INTEGER NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      emoji TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE (message_id, user_id, emoji)
    );

    CREATE TABLE IF NOT EXISTS channel_read_status (
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      channel_id INTEGER NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
      last_read_message_id INTEGER,
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      PRIMARY KEY (user_id, channel_id)
    );
  `);

  // 既存 DB に is_private カラムが存在しない場合は追加する
  const channelCols = database.prepare('PRAGMA table_info(channels)').all() as { name: string }[];
  if (!channelCols.some((r) => r.name === 'is_private')) {
    database.exec('ALTER TABLE channels ADD COLUMN is_private INTEGER NOT NULL DEFAULT 0');
  }

  // 既存 DB に display_name・location・role・is_active・last_login_at カラムが存在しない場合は追加する
  const userCols = () => database.prepare(`PRAGMA table_info(users)`).all() as { name: string }[];

  for (const col of ['display_name', 'location']) {
    if (!userCols().some((r) => r.name === col)) {
      database.exec(`ALTER TABLE users ADD COLUMN ${col} TEXT`);
    }
  }
  if (!userCols().some((r) => r.name === 'role')) {
    database.exec(`ALTER TABLE users ADD COLUMN role TEXT NOT NULL DEFAULT 'user'`);
  }
  if (!userCols().some((r) => r.name === 'is_active')) {
    database.exec(`ALTER TABLE users ADD COLUMN is_active INTEGER NOT NULL DEFAULT 1`);
  }
  if (!userCols().some((r) => r.name === 'last_login_at')) {
    database.exec(`ALTER TABLE users ADD COLUMN last_login_at TEXT`);
  }

  // channels.created_by が NOT NULL で作られていた場合は nullable + ON DELETE SET NULL に再作成する
  const channelColsAll = database.prepare('PRAGMA table_info(channels)').all() as {
    name: string;
    notnull: number;
  }[];
  const createdByCol = channelColsAll.find((c) => c.name === 'created_by');
  if (createdByCol && createdByCol.notnull === 1) {
    database.exec(`
      PRAGMA foreign_keys = OFF;
      CREATE TABLE channels_new (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL UNIQUE,
        description TEXT,
        created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
        is_private INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
      INSERT INTO channels_new SELECT * FROM channels;
      DROP TABLE channels;
      ALTER TABLE channels_new RENAME TO channels;
      PRAGMA foreign_keys = ON;
    `);
  }

  // messages.user_id が NOT NULL で作られていた場合は nullable + ON DELETE SET NULL に再作成する
  const messageColsAll = database.prepare('PRAGMA table_info(messages)').all() as {
    name: string;
    notnull: number;
  }[];
  const messageUserIdCol = messageColsAll.find((c) => c.name === 'user_id');
  if (messageUserIdCol && messageUserIdCol.notnull === 1) {
    database.exec(`
      PRAGMA foreign_keys = OFF;
      CREATE TABLE messages_new (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        channel_id INTEGER NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
        user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
        content TEXT NOT NULL,
        is_edited INTEGER NOT NULL DEFAULT 0,
        is_deleted INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now')),
        parent_message_id INTEGER REFERENCES messages(id) ON DELETE CASCADE,
        root_message_id INTEGER REFERENCES messages(id) ON DELETE CASCADE
      );
      INSERT INTO messages_new SELECT id, channel_id, user_id, content, is_edited, is_deleted, created_at, updated_at, NULL, NULL FROM messages;
      DROP TABLE messages;
      ALTER TABLE messages_new RENAME TO messages;
      PRAGMA foreign_keys = ON;
    `);
  }

  // parent_message_id / root_message_id カラムがない場合は追加する（既存DBへの移行）
  const messageColNames = (
    database.prepare('PRAGMA table_info(messages)').all() as { name: string }[]
  ).map((c) => c.name);
  if (!messageColNames.includes('parent_message_id')) {
    database.exec(
      'ALTER TABLE messages ADD COLUMN parent_message_id INTEGER REFERENCES messages(id) ON DELETE CASCADE',
    );
  }
  if (!messageColNames.includes('root_message_id')) {
    database.exec(
      'ALTER TABLE messages ADD COLUMN root_message_id INTEGER REFERENCES messages(id) ON DELETE CASCADE',
    );
    database.exec(
      'CREATE INDEX IF NOT EXISTS messages_root_message_id ON messages(root_message_id)',
    );
  }

  // message_attachments.message_id が NOT NULL 制約付きで作られていた場合は再作成する
  // （SQLite は ALTER COLUMN をサポートしないためテーブルを作り直す）
  const attachmentCols = database.prepare('PRAGMA table_info(message_attachments)').all() as {
    name: string;
    notnull: number;
  }[];
  const messageIdCol = attachmentCols.find((c) => c.name === 'message_id');
  if (messageIdCol && messageIdCol.notnull === 1) {
    database.exec(`
      PRAGMA foreign_keys = OFF;
      CREATE TABLE message_attachments_new (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        message_id INTEGER REFERENCES messages(id) ON DELETE CASCADE,
        url TEXT NOT NULL,
        original_name TEXT NOT NULL,
        size INTEGER NOT NULL,
        mime_type TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
      INSERT INTO message_attachments_new SELECT * FROM message_attachments;
      DROP TABLE message_attachments;
      ALTER TABLE message_attachments_new RENAME TO message_attachments;
      PRAGMA foreign_keys = ON;
    `);
  }
}

export function closeDatabase(): void {
  if (db) {
    db.close();
    db = null;
  }
}
