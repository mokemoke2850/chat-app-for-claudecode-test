/**
 * テスト対象: タグ機能（CRUD・付与・解除・候補取得）
 * 戦略:
 *   - pg-mem のインメモリ PostgreSQL 互換 DB を使いサービス層を直接テストする。
 *   - tags / message_tags / channel_tags の整合性とユースケース全体を検証する。
 *   - HTTP レイヤーは別途 routes 経由のテストを設けず、サービス層で十分カバーできるよう設計する。
 *   - 外部キー制約を満たすため beforeEach でユーザー・チャンネル・メッセージを挿入する。
 *   - getForMessages の N+1 検証のため、testDb.query を spy 化してサービスから観測する。
 */

import { createTestDatabase } from './__fixtures__/pgTestHelper';

const baseDb = createTestDatabase();
const querySpy = jest.fn(baseDb.query);
const testDb = {
  ...baseDb,
  query: ((text: string, params?: unknown[]) => querySpy(text, params)) as typeof baseDb.query,
};

jest.mock('../db/database', () => testDb);

import {
  findOrCreate,
  attachToMessage,
  detachFromMessage,
  attachToChannel,
  detachFromChannel,
  listSuggestions,
  getForMessages,
} from '../services/tagService';

let userMember: number;
let userOther: number;
let publicChannelId: number;
let privateChannelId: number;
let publicMessageId: number;
let privateMessageId: number;

async function resetDb() {
  await testDb.execute('DELETE FROM message_tags', []);
  await testDb.execute('DELETE FROM channel_tags', []);
  await testDb.execute('DELETE FROM tags', []);
  await testDb.execute('DELETE FROM messages', []);
  await testDb.execute('DELETE FROM channel_members', []);
  await testDb.execute('DELETE FROM channels', []);
  await testDb.execute('DELETE FROM users', []);
}

async function setupBaseData() {
  const u1 = await testDb.queryOne<{ id: number }>(
    "INSERT INTO users (username, email, password_hash) VALUES ('member', 'm@x.com', 'hash') RETURNING id",
    [],
  );
  const u2 = await testDb.queryOne<{ id: number }>(
    "INSERT INTO users (username, email, password_hash) VALUES ('other', 'o@x.com', 'hash') RETURNING id",
    [],
  );
  userMember = u1!.id;
  userOther = u2!.id;

  const cPub = await testDb.queryOne<{ id: number }>(
    "INSERT INTO channels (name, created_by, is_private) VALUES ('public', $1, false) RETURNING id",
    [userMember],
  );
  const cPriv = await testDb.queryOne<{ id: number }>(
    "INSERT INTO channels (name, created_by, is_private) VALUES ('private', $1, true) RETURNING id",
    [userMember],
  );
  publicChannelId = cPub!.id;
  privateChannelId = cPriv!.id;

  // private のメンバーは userMember のみ
  await testDb.execute('INSERT INTO channel_members (channel_id, user_id) VALUES ($1, $2)', [
    privateChannelId,
    userMember,
  ]);

  const m1 = await testDb.queryOne<{ id: number }>(
    "INSERT INTO messages (channel_id, user_id, content) VALUES ($1, $2, 'pub') RETURNING id",
    [publicChannelId, userMember],
  );
  const m2 = await testDb.queryOne<{ id: number }>(
    "INSERT INTO messages (channel_id, user_id, content) VALUES ($1, $2, 'priv') RETURNING id",
    [privateChannelId, userMember],
  );
  publicMessageId = m1!.id;
  privateMessageId = m2!.id;
}

beforeEach(async () => {
  await resetDb();
  await setupBaseData();
  querySpy.mockClear();
});

describe('タグ機能', () => {
  describe('タグの作成・取得 (findOrCreate)', () => {
    it('新規タグ名を渡すと新しいタグレコードが INSERT され ID が返る', async () => {
      const tag = await findOrCreate('newtag', userMember);
      expect(tag.id).toBeGreaterThan(0);
      expect(tag.name).toBe('newtag');
      const rows = await testDb.query("SELECT id FROM tags WHERE name = 'newtag'", []);
      expect(rows.length).toBe(1);
    });

    it('既存タグと同じ名前を渡すと新規 INSERT されず既存 ID が返る', async () => {
      const a = await findOrCreate('foo', userMember);
      const b = await findOrCreate('foo', userMember);
      expect(b.id).toBe(a.id);
      const rows = await testDb.query("SELECT id FROM tags WHERE name = 'foo'", []);
      expect(rows.length).toBe(1);
    });

    it('タグ名は小文字に正規化されて保存される (例: "Bug" → "bug")', async () => {
      const t = await findOrCreate('Bug', userMember);
      expect(t.name).toBe('bug');
    });

    it('大文字小文字違いの同名タグは同一タグとして扱われる ("BUG" と "bug" は同じ ID)', async () => {
      const a = await findOrCreate('BUG', userMember);
      const b = await findOrCreate('bug', userMember);
      expect(b.id).toBe(a.id);
    });

    it('空文字または空白のみの名前を渡すとエラーになる', async () => {
      await expect(findOrCreate('', userMember)).rejects.toThrow();
      await expect(findOrCreate('   ', userMember)).rejects.toThrow();
    });

    it('50 文字を超える名前を渡すとエラーになる', async () => {
      await expect(findOrCreate('a'.repeat(51), userMember)).rejects.toThrow();
    });

    it('名前に空白文字や "#" を含む場合はエラーになる', async () => {
      await expect(findOrCreate('bu g', userMember)).rejects.toThrow();
      await expect(findOrCreate('#bug', userMember)).rejects.toThrow();
    });
  });

  describe('メッセージへのタグ付与 (attachToMessage)', () => {
    it('単一タグを付与すると message_tags に行が追加される', async () => {
      const tag = await findOrCreate('a', userMember);
      await attachToMessage(publicMessageId, [tag.id], userMember);
      const rows = await testDb.query(
        'SELECT * FROM message_tags WHERE message_id = $1 AND tag_id = $2',
        [publicMessageId, tag.id],
      );
      expect(rows.length).toBe(1);
    });

    it('複数タグを一括付与すると message_tags に複数行が追加される', async () => {
      const t1 = await findOrCreate('t1', userMember);
      const t2 = await findOrCreate('t2', userMember);
      await attachToMessage(publicMessageId, [t1.id, t2.id], userMember);
      const rows = await testDb.query('SELECT * FROM message_tags WHERE message_id = $1', [
        publicMessageId,
      ]);
      expect(rows.length).toBe(2);
    });

    it('付与時に対象タグの use_count が +1 される', async () => {
      const tag = await findOrCreate('cnt', userMember);
      await attachToMessage(publicMessageId, [tag.id], userMember);
      const row = await testDb.queryOne<{ use_count: number }>(
        'SELECT use_count FROM tags WHERE id = $1',
        [tag.id],
      );
      expect(row!.use_count).toBe(1);
    });

    it('既に付与済みのタグを再付与しても重複行は作られず use_count も増えない', async () => {
      const tag = await findOrCreate('dup', userMember);
      await attachToMessage(publicMessageId, [tag.id], userMember);
      await attachToMessage(publicMessageId, [tag.id], userMember);
      const rows = await testDb.query(
        'SELECT * FROM message_tags WHERE message_id = $1 AND tag_id = $2',
        [publicMessageId, tag.id],
      );
      expect(rows.length).toBe(1);
      const row = await testDb.queryOne<{ use_count: number }>(
        'SELECT use_count FROM tags WHERE id = $1',
        [tag.id],
      );
      expect(row!.use_count).toBe(1);
    });

    it('チャンネルメンバーであれば自分以外のメッセージにもタグを付与できる', async () => {
      // userOther を private channel メンバーに追加 → 別ユーザーが userMember 投稿の
      // メッセージにタグ付け
      await testDb.execute('INSERT INTO channel_members (channel_id, user_id) VALUES ($1, $2)', [
        privateChannelId,
        userOther,
      ]);
      const tag = await findOrCreate('peer', userOther);
      await expect(attachToMessage(privateMessageId, [tag.id], userOther)).resolves.not.toThrow();
    });

    it('プライベートチャンネルでチャンネル非メンバーのユーザーが付与しようとすると 403 エラーになる', async () => {
      const tag = await findOrCreate('p', userMember);
      await expect(attachToMessage(privateMessageId, [tag.id], userOther)).rejects.toThrow();
    });

    it('パブリックチャンネル (is_private=false) では非メンバーでもタグを付与できる', async () => {
      const tag = await findOrCreate('publ', userMember);
      await expect(attachToMessage(publicMessageId, [tag.id], userOther)).resolves.not.toThrow();
    });

    it('存在しないメッセージ ID への付与はエラーになる', async () => {
      const tag = await findOrCreate('q', userMember);
      await expect(attachToMessage(999999, [tag.id], userMember)).rejects.toThrow();
    });
  });

  describe('メッセージからのタグ解除 (detachFromMessage)', () => {
    it('指定したタグの message_tags 行が削除される', async () => {
      const tag = await findOrCreate('det', userMember);
      await attachToMessage(publicMessageId, [tag.id], userMember);
      await detachFromMessage(publicMessageId, [tag.id]);
      const rows = await testDb.query(
        'SELECT * FROM message_tags WHERE message_id = $1 AND tag_id = $2',
        [publicMessageId, tag.id],
      );
      expect(rows.length).toBe(0);
    });

    it('解除時に対象タグの use_count が -1 される', async () => {
      const tag = await findOrCreate('dec', userMember);
      await attachToMessage(publicMessageId, [tag.id], userMember);
      await detachFromMessage(publicMessageId, [tag.id]);
      const row = await testDb.queryOne<{ use_count: number }>(
        'SELECT use_count FROM tags WHERE id = $1',
        [tag.id],
      );
      expect(row!.use_count).toBe(0);
    });

    it('use_count は 0 未満にならない (下限ガード)', async () => {
      // タグだけ作成して付与せず、use_count=0 の状態で detach しても 0 のままを期待
      const tag = await findOrCreate('zero', userMember);
      // 直接 use_count を負に下げないことを確認するため SQL で 1 行作って試す
      await testDb.execute(
        'INSERT INTO message_tags (message_id, tag_id, created_by) VALUES ($1, $2, $3)',
        [publicMessageId, tag.id, userMember],
      );
      // この時点で行は存在するが tags.use_count は 0 のまま（attach 経由でない）
      await detachFromMessage(publicMessageId, [tag.id]);
      const row = await testDb.queryOne<{ use_count: number }>(
        'SELECT use_count FROM tags WHERE id = $1',
        [tag.id],
      );
      expect(row!.use_count).toBe(0);
    });

    it('付与されていないタグの解除を要求しても例外を投げず、use_count も変動しない', async () => {
      const tag = await findOrCreate('nope', userMember);
      await expect(detachFromMessage(publicMessageId, [tag.id])).resolves.not.toThrow();
      const row = await testDb.queryOne<{ use_count: number }>(
        'SELECT use_count FROM tags WHERE id = $1',
        [tag.id],
      );
      expect(row!.use_count).toBe(0);
    });
  });

  describe('チャンネルへのタグ付与・解除', () => {
    it('attachToChannel で channel_tags に行が追加され use_count が +1 される', async () => {
      const tag = await findOrCreate('ct1', userMember);
      await attachToChannel(publicChannelId, [tag.id]);
      const rows = await testDb.query(
        'SELECT * FROM channel_tags WHERE channel_id = $1 AND tag_id = $2',
        [publicChannelId, tag.id],
      );
      expect(rows.length).toBe(1);
      const row = await testDb.queryOne<{ use_count: number }>(
        'SELECT use_count FROM tags WHERE id = $1',
        [tag.id],
      );
      expect(row!.use_count).toBe(1);
    });

    it('detachFromChannel で channel_tags から削除され use_count が -1 される', async () => {
      const tag = await findOrCreate('ct2', userMember);
      await attachToChannel(publicChannelId, [tag.id]);
      await detachFromChannel(publicChannelId, [tag.id]);
      const rows = await testDb.query(
        'SELECT * FROM channel_tags WHERE channel_id = $1 AND tag_id = $2',
        [publicChannelId, tag.id],
      );
      expect(rows.length).toBe(0);
      const row = await testDb.queryOne<{ use_count: number }>(
        'SELECT use_count FROM tags WHERE id = $1',
        [tag.id],
      );
      expect(row!.use_count).toBe(0);
    });

    it('既に付与済みのタグをチャンネルに再付与しても重複行は作られない', async () => {
      const tag = await findOrCreate('ctd', userMember);
      await attachToChannel(publicChannelId, [tag.id]);
      await attachToChannel(publicChannelId, [tag.id]);
      const rows = await testDb.query(
        'SELECT * FROM channel_tags WHERE channel_id = $1 AND tag_id = $2',
        [publicChannelId, tag.id],
      );
      expect(rows.length).toBe(1);
    });
  });

  describe('タグ候補取得 (listSuggestions)', () => {
    it('use_count 降順で候補が返る', async () => {
      const tA = await findOrCreate('alpha', userMember);
      const tB = await findOrCreate('beta', userMember);
      // alpha に2回、beta に1回
      await attachToMessage(publicMessageId, [tA.id], userMember);
      await attachToChannel(publicChannelId, [tA.id]);
      await attachToMessage(publicMessageId, [tB.id], userMember);
      const list = await listSuggestions();
      const names = list.map((s) => s.name);
      expect(names.indexOf('alpha')).toBeLessThan(names.indexOf('beta'));
    });

    it('use_count が同値のときは name 昇順で返る', async () => {
      await findOrCreate('zoo', userMember);
      await findOrCreate('apple', userMember);
      await findOrCreate('mango', userMember);
      const list = await listSuggestions();
      const names = list.map((s) => s.name);
      expect(names).toEqual(['apple', 'mango', 'zoo']);
    });

    it('prefix を指定するとその文字列で前方一致する候補のみ返る', async () => {
      await findOrCreate('apple', userMember);
      await findOrCreate('apricot', userMember);
      await findOrCreate('banana', userMember);
      const list = await listSuggestions('ap');
      const names = list.map((s) => s.name);
      expect(names).toContain('apple');
      expect(names).toContain('apricot');
      expect(names).not.toContain('banana');
    });

    it('prefix のマッチングは大文字小文字を無視する (prefix="BU" でも "bug" がヒットする)', async () => {
      await findOrCreate('bug', userMember);
      const list = await listSuggestions('BU');
      const names = list.map((s) => s.name);
      expect(names).toContain('bug');
    });

    it('limit を指定すると最大件数を超えない', async () => {
      for (let i = 0; i < 5; i++) {
        await findOrCreate(`tag${i}`, userMember);
      }
      const list = await listSuggestions('', 3);
      expect(list.length).toBe(3);
    });

    it('use_count が 0 のタグも候補に含まれる', async () => {
      await findOrCreate('zerocnt', userMember);
      const list = await listSuggestions();
      const names = list.map((s) => s.name);
      expect(names).toContain('zerocnt');
    });
  });

  describe('メッセージ単位のタグ取得 (getForMessages)', () => {
    it('複数メッセージ ID を渡すと messageId ごとに Tag[] のマップが返る', async () => {
      const t1 = await findOrCreate('m1', userMember);
      const t2 = await findOrCreate('m2', userMember);
      const m2 = await testDb.queryOne<{ id: number }>(
        "INSERT INTO messages (channel_id, user_id, content) VALUES ($1, $2, 'm2') RETURNING id",
        [publicChannelId, userMember],
      );
      await attachToMessage(publicMessageId, [t1.id, t2.id], userMember);
      await attachToMessage(m2!.id, [t1.id], userMember);
      const map = await getForMessages([publicMessageId, m2!.id]);
      expect(map.get(publicMessageId)!.length).toBe(2);
      expect(map.get(m2!.id)!.length).toBe(1);
    });

    it('タグが付与されていないメッセージ ID には空配列が返る', async () => {
      const map = await getForMessages([publicMessageId]);
      expect(map.get(publicMessageId)).toEqual([]);
    });

    it('1 回のクエリで bulk fetch される (N+1 にならない)', async () => {
      const t = await findOrCreate('bulk', userMember);
      const ids: number[] = [publicMessageId];
      for (let i = 0; i < 2; i++) {
        const m = await testDb.queryOne<{ id: number }>(
          'INSERT INTO messages (channel_id, user_id, content) VALUES ($1, $2, $3) RETURNING id',
          [publicChannelId, userMember, `m-${i}`],
        );
        ids.push(m!.id);
      }
      await attachToMessage(publicMessageId, [t.id], userMember);
      querySpy.mockClear();
      await getForMessages(ids);
      expect(querySpy).toHaveBeenCalledTimes(1);
    });
  });

  describe('CASCADE 削除', () => {
    it('メッセージを削除すると message_tags の関連行も削除される', async () => {
      const tag = await findOrCreate('cascade1', userMember);
      await attachToMessage(publicMessageId, [tag.id], userMember);
      await testDb.execute('DELETE FROM messages WHERE id = $1', [publicMessageId]);
      const rows = await testDb.query('SELECT * FROM message_tags WHERE message_id = $1', [
        publicMessageId,
      ]);
      expect(rows.length).toBe(0);
    });

    it('チャンネルを削除すると channel_tags の関連行も削除される', async () => {
      const tag = await findOrCreate('cascade2', userMember);
      await attachToChannel(publicChannelId, [tag.id]);
      await testDb.execute('DELETE FROM channels WHERE id = $1', [publicChannelId]);
      const rows = await testDb.query('SELECT * FROM channel_tags WHERE channel_id = $1', [
        publicChannelId,
      ]);
      expect(rows.length).toBe(0);
    });

    it('タグ自体を削除すると message_tags / channel_tags の関連行も削除される', async () => {
      const tag = await findOrCreate('cascade3', userMember);
      await attachToMessage(publicMessageId, [tag.id], userMember);
      await attachToChannel(publicChannelId, [tag.id]);
      await testDb.execute('DELETE FROM tags WHERE id = $1', [tag.id]);
      const m = await testDb.query('SELECT * FROM message_tags WHERE tag_id = $1', [tag.id]);
      const c = await testDb.query('SELECT * FROM channel_tags WHERE tag_id = $1', [tag.id]);
      expect(m.length).toBe(0);
      expect(c.length).toBe(0);
    });

    it('タグ作成者ユーザーが削除されても tags 行は残り created_by が NULL になる', async () => {
      const tag = await findOrCreate('cascade4', userMember);
      await testDb.execute('DELETE FROM users WHERE id = $1', [userMember]);
      const row = await testDb.queryOne<{ id: number; created_by: number | null }>(
        'SELECT id, created_by FROM tags WHERE id = $1',
        [tag.id],
      );
      expect(row).not.toBeNull();
      expect(row!.created_by).toBeNull();
    });
  });
});
