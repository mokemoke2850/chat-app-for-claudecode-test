import { Pool, PoolClient, QueryResultRow } from 'pg';

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT) || 5432,
  database: process.env.DB_NAME || 'chatapp',
  user: process.env.DB_USER || 'chatapp',
  password: process.env.DB_PASSWORD || 'chatapp',
});

// アイドル接続でバックエンド/ネットワークエラーが発生したとき、Pool は 'error' を emit する。
// リスナーが無いと未処理例外としてプロセスを巻き込み落とす（pg 公式が警告する挙動）。
// テストの並列実行では、これが無関係な実行中テストを偽陽性で失敗させるフレーク要因になっていた。
pool.on('error', (err) => {
  console.error('[db pool] idle client error', err);
});

/** Pool を返す（テストでモック差し替え可能） */
export function getPool(): Pool {
  return pool;
}

/** 単純なクエリ実行。rows を返す */
export async function query<T extends QueryResultRow = QueryResultRow>(
  text: string,
  params?: unknown[],
): Promise<T[]> {
  const result = await pool.query<T>(text, params);
  return result.rows;
}

/** 1行だけ取得。該当なしで null */
export async function queryOne<T extends QueryResultRow = QueryResultRow>(
  text: string,
  params?: unknown[],
): Promise<T | null> {
  const result = await pool.query<T>(text, params);
  return result.rows[0] ?? null;
}

/** INSERT / UPDATE / DELETE の実行結果（rowCount + rows）を返す */
export async function execute(
  text: string,
  params?: unknown[],
): Promise<{ rowCount: number; rows: QueryResultRow[] }> {
  const result = await pool.query(text, params);
  return { rowCount: result.rowCount ?? 0, rows: result.rows };
}

/** トランザクション内で複数クエリを実行する */
export async function withTransaction<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

export async function closeDatabase(): Promise<void> {
  await pool.end();
}
