/**
 * テスト対象: ブックマーク内検索とタグ付け機能（バックエンド）
 *
 * 検証観点:
 *   - GET /api/bookmarks の search クエリパラメータでメッセージ本文・送信者名を絞り込む
 *   - bookmark_tags / bookmark_tag_relations テーブルでタグの CRUD ができる
 *   - タグ ID によるフィルタ（単一・複数 AND/OR）
 *   - タグの編集・削除でブックマークのデータ整合性が保たれる
 *   - 既存ブックマーク（タグなし）が引き続き取得できる後方互換性
 */

import { createTestDatabase, resetTestData } from './__fixtures__/pgTestHelper';

const testDb = createTestDatabase();

jest.mock('../db/database', () => testDb);

import request from 'supertest';
import { createApp } from '../app';
import {
  addBookmark,
  getBookmarks,
  createTag,
  listTags,
  updateTag,
  deleteTag,
  setBookmarkTags,
} from '../services/bookmarkService';
import { registerUser } from './__fixtures__/testHelpers';

const app = createApp();

let userId1: number;
let userId2: number;
let channelId: number;
let messageHello: number;
let messageWorld: number;
let messageJa: number;
let messageBob: number;

async function setupFixtures() {
  const r1 = await testDb.execute(
    'INSERT INTO users (username, email, password_hash) VALUES ($1, $2, $3) RETURNING id',
    ['alice', 'a@t.com', 'h'],
  );
  userId1 = r1.rows[0].id as number;

  const r2 = await testDb.execute(
    'INSERT INTO users (username, email, password_hash) VALUES ($1, $2, $3) RETURNING id',
    ['Bob', 'b@t.com', 'h'],
  );
  userId2 = r2.rows[0].id as number;

  const rc = await testDb.execute(
    'INSERT INTO channels (name, created_by) VALUES ($1, $2) RETURNING id',
    ['general', userId1],
  );
  channelId = rc.rows[0].id as number;

  const ins = async (uid: number, content: string): Promise<number> => {
    const r = await testDb.execute(
      'INSERT INTO messages (channel_id, user_id, content) VALUES ($1, $2, $3) RETURNING id',
      [channelId, uid, content],
    );
    return r.rows[0].id as number;
  };

  messageHello = await ins(userId1, 'Hello world');
  messageWorld = await ins(userId1, 'Foo Bar baz');
  messageJa = await ins(userId1, 'こんにちは世界');
  messageBob = await ins(userId2, 'Bob says hi');
}

beforeEach(async () => {
  await resetTestData(testDb);
  await setupFixtures();
});

describe('GET /api/bookmarks - キーワード検索', () => {
  describe('search クエリパラメータ', () => {
    it('search を指定すると本文に部分一致するブックマークのみ返す', async () => {
      await addBookmark(userId1, messageHello);
      await addBookmark(userId1, messageWorld);
      const result = await getBookmarks(userId1, { search: 'Hello' });
      expect(result.length).toBe(1);
      expect(result[0].messageId).toBe(messageHello);
    });

    it('search を指定すると送信者名に部分一致するブックマークも返す', async () => {
      await addBookmark(userId1, messageHello);
      await addBookmark(userId1, messageBob);
      const result = await getBookmarks(userId1, { search: 'Bob' });
      // Bob の投稿（送信者名一致）が返る
      expect(result.some((b) => b.messageId === messageBob)).toBe(true);
    });

    it('search が大文字小文字を区別せずマッチングする', async () => {
      await addBookmark(userId1, messageHello);
      const upper = await getBookmarks(userId1, { search: 'HELLO' });
      const lower = await getBookmarks(userId1, { search: 'hello' });
      expect(upper.length).toBe(1);
      expect(lower.length).toBe(1);
    });

    it('search に日本語を渡してもマッチングできる', async () => {
      await addBookmark(userId1, messageJa);
      const result = await getBookmarks(userId1, { search: '世界' });
      expect(result.length).toBe(1);
      expect(result[0].messageId).toBe(messageJa);
    });

    it('search が空文字のときは全ブックマークを返す', async () => {
      await addBookmark(userId1, messageHello);
      await addBookmark(userId1, messageWorld);
      const result = await getBookmarks(userId1, { search: '' });
      expect(result.length).toBe(2);
    });

    it('search が一致しないときは空配列を返す', async () => {
      await addBookmark(userId1, messageHello);
      const result = await getBookmarks(userId1, { search: 'NOMATCH' });
      expect(result).toEqual([]);
    });

    it('SQL インジェクション文字列を渡しても安全にエスケープされる', async () => {
      await addBookmark(userId1, messageHello);
      // パラメタライズドクエリで安全に扱われる
      const result = await getBookmarks(userId1, { search: "'; DROP TABLE bookmarks; --" });
      expect(result).toEqual([]);
      // テーブルは残っている
      const rows = await testDb.query('SELECT id FROM bookmarks WHERE user_id = $1', [userId1]);
      expect(rows.length).toBe(1);
    });
  });

  describe('レスポンス検証', () => {
    it('レスポンスは { bookmarks: Bookmark[] } 形式で返る', async () => {
      const { token } = await registerUser(app, 'reg1', 'reg1@e.com');
      const res = await request(app).get('/api/bookmarks').set('Cookie', `token=${token}`);
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.bookmarks)).toBe(true);
    });

    it('Bookmark に tags 配列が含まれる', async () => {
      await addBookmark(userId1, messageHello);
      const result = await getBookmarks(userId1);
      expect(Array.isArray(result[0].tags)).toBe(true);
    });

    it('検索結果はブックマーク日時の降順でソートされる', async () => {
      await addBookmark(userId1, messageHello);
      await new Promise((r) => setTimeout(r, 10));
      await addBookmark(userId1, messageWorld);
      const result = await getBookmarks(userId1);
      expect(new Date(result[0].bookmarkedAt).getTime()).toBeGreaterThanOrEqual(
        new Date(result[1].bookmarkedAt).getTime(),
      );
    });
  });
});

describe('POST /api/bookmark-tags - タグ作成', () => {
  it('認証済みユーザーがタグを新規作成できる（201 を返す）', async () => {
    const { token } = await registerUser(app, 'tagcreate1', 'tc1@e.com');
    const res = await request(app)
      .post('/api/bookmark-tags')
      .set('Cookie', `token=${token}`)
      .send({ name: 'work' });
    expect(res.status).toBe(201);
    expect(res.body.tag.name).toBe('work');
  });

  it('未認証では 401 を返す', async () => {
    const res = await request(app).post('/api/bookmark-tags').send({ name: 'work' });
    expect(res.status).toBe(401);
  });

  it('タグ名が空文字のときは 400 を返す', async () => {
    const { token } = await registerUser(app, 'tagcreate2', 'tc2@e.com');
    const res = await request(app)
      .post('/api/bookmark-tags')
      .set('Cookie', `token=${token}`)
      .send({ name: '   ' });
    expect(res.status).toBe(400);
  });

  it('同一ユーザーで同名のタグを再作成すると 409 を返す', async () => {
    const { token } = await registerUser(app, 'tagcreate3', 'tc3@e.com');
    await request(app)
      .post('/api/bookmark-tags')
      .set('Cookie', `token=${token}`)
      .send({ name: 'dup' });
    const res = await request(app)
      .post('/api/bookmark-tags')
      .set('Cookie', `token=${token}`)
      .send({ name: 'dup' });
    expect(res.status).toBe(409);
  });

  it('別ユーザー同士は同名タグを独立して所有できる', async () => {
    await createTag(userId1, 'shared');
    const tag2 = await createTag(userId2, 'shared');
    expect(tag2.name).toBe('shared');
    expect(tag2.userId).toBe(userId2);
  });

  it('レスポンスに id, name, userId, createdAt が含まれる', async () => {
    const tag = await createTag(userId1, 'meta');
    expect(tag.id).toBeDefined();
    expect(tag.name).toBe('meta');
    expect(tag.userId).toBe(userId1);
    expect(tag.createdAt).toBeDefined();
  });
});

describe('GET /api/bookmark-tags - タグ一覧', () => {
  it('ログインユーザー自身のタグのみ取得できる', async () => {
    await createTag(userId1, 'mine');
    await createTag(userId2, 'theirs');
    const tags = await listTags(userId1);
    expect(tags.length).toBe(1);
    expect(tags[0].name).toBe('mine');
  });

  it('他ユーザーのタグは含まれない', async () => {
    await createTag(userId1, 'a');
    await createTag(userId2, 'b');
    const tags = await listTags(userId1);
    expect(tags.every((t) => t.userId === userId1)).toBe(true);
  });

  it('レスポンスは作成日時の昇順でソートされる', async () => {
    const t1 = await createTag(userId1, 'first');
    await new Promise((r) => setTimeout(r, 10));
    const t2 = await createTag(userId1, 'second');
    const tags = await listTags(userId1);
    expect(tags[0].id).toBe(t1.id);
    expect(tags[1].id).toBe(t2.id);
  });

  it('タグごとに紐づくブックマーク数が含まれる', async () => {
    const tag = await createTag(userId1, 'count');
    const bookmark = await addBookmark(userId1, messageHello);
    await setBookmarkTags(userId1, bookmark.messageId, [tag.id]);
    const tags = await listTags(userId1);
    expect(tags[0].bookmarkCount).toBe(1);
  });
});

describe('PATCH /api/bookmark-tags/:tagId - タグ編集', () => {
  it('タグ名をリネームできる（200 を返す）', async () => {
    const tag = await createTag(userId1, 'old');
    const updated = await updateTag(userId1, tag.id, { name: 'renamed' });
    expect(updated.name).toBe('renamed');
  });

  it('他ユーザーのタグを編集しようとすると 403 もしくは 404 を返す', async () => {
    const tag = await createTag(userId2, 'theirs');
    await expect(updateTag(userId1, tag.id, { name: 'hijacked' })).rejects.toThrow('Forbidden');
  });

  it('存在しない tagId では 404 を返す', async () => {
    await expect(updateTag(userId1, 99999, { name: 'x' })).rejects.toThrow('Tag not found');
  });

  it('既存の同名タグへリネームしようとすると 409 を返す', async () => {
    await createTag(userId1, 'first');
    const second = await createTag(userId1, 'second');
    await expect(updateTag(userId1, second.id, { name: 'first' })).rejects.toThrow(
      'Tag name already exists',
    );
  });

  it('リネーム後、関連ブックマークの tags も新しい名前で取得できる', async () => {
    const tag = await createTag(userId1, 'before');
    const bookmark = await addBookmark(userId1, messageHello);
    await setBookmarkTags(userId1, bookmark.messageId, [tag.id]);
    await updateTag(userId1, tag.id, { name: 'after' });
    const result = await getBookmarks(userId1);
    expect(result[0].tags?.[0].name).toBe('after');
  });
});

describe('DELETE /api/bookmark-tags/:tagId - タグ削除', () => {
  it('自身が所有するタグを削除できる（204 を返す）', async () => {
    const tag = await createTag(userId1, 'todelete');
    await expect(deleteTag(userId1, tag.id)).resolves.not.toThrow();
    const remaining = await listTags(userId1);
    expect(remaining.find((t) => t.id === tag.id)).toBeUndefined();
  });

  it('他ユーザーのタグを削除しようとすると 403 もしくは 404 を返す', async () => {
    const tag = await createTag(userId2, 'theirs');
    await expect(deleteTag(userId1, tag.id)).rejects.toThrow('Forbidden');
  });

  it('タグ削除時に bookmark_tag_relations の関連レコードも削除される', async () => {
    const tag = await createTag(userId1, 'rel');
    const bookmark = await addBookmark(userId1, messageHello);
    await setBookmarkTags(userId1, bookmark.messageId, [tag.id]);
    await deleteTag(userId1, tag.id);
    const rows = await testDb.query('SELECT * FROM bookmark_tag_relations WHERE tag_id = $1', [
      tag.id,
    ]);
    expect(rows.length).toBe(0);
  });

  it('タグ削除後もブックマーク本体は残る', async () => {
    const tag = await createTag(userId1, 'rel');
    const bookmark = await addBookmark(userId1, messageHello);
    await setBookmarkTags(userId1, bookmark.messageId, [tag.id]);
    await deleteTag(userId1, tag.id);
    const remaining = await getBookmarks(userId1);
    expect(remaining.length).toBe(1);
    expect(remaining[0].id).toBe(bookmark.id);
  });

  it('存在しない tagId では 404 を返す', async () => {
    await expect(deleteTag(userId1, 99999)).rejects.toThrow('Tag not found');
  });
});

describe('POST /api/bookmarks/:messageId - ブックマーク追加時のタグ付与', () => {
  it('リクエストボディの tagIds 配列でタグを同時に付与できる', async () => {
    const tag = await createTag(userId1, 't1');
    const bookmark = await addBookmark(userId1, messageHello, [tag.id]);
    expect(bookmark.tags?.length).toBe(1);
    expect(bookmark.tags?.[0].id).toBe(tag.id);
  });

  it('tagIds が他ユーザーのタグ ID を含む場合は 400 を返す', async () => {
    const otherTag = await createTag(userId2, 'other');
    await expect(addBookmark(userId1, messageHello, [otherTag.id])).rejects.toThrow(
      'Invalid tag ids',
    );
  });

  it('存在しない tagId が含まれる場合は 400 を返す', async () => {
    await expect(addBookmark(userId1, messageHello, [99999])).rejects.toThrow('Invalid tag ids');
  });

  it('tagIds が空配列ならタグ無しでブックマーク作成できる', async () => {
    const bookmark = await addBookmark(userId1, messageHello, []);
    expect(bookmark.tags).toEqual([]);
  });

  it('tagIds 未指定でも従来通りブックマーク作成できる（後方互換）', async () => {
    const bookmark = await addBookmark(userId1, messageHello);
    expect(bookmark.id).toBeDefined();
  });
});

describe('PATCH /api/bookmarks/:messageId/tags - ブックマークのタグ更新', () => {
  it('既存ブックマークに対してタグを追加できる', async () => {
    const tag = await createTag(userId1, 't');
    const bookmark = await addBookmark(userId1, messageHello);
    const updated = await setBookmarkTags(userId1, bookmark.messageId, [tag.id]);
    expect(updated.tags?.length).toBe(1);
  });

  it('既存ブックマークからタグを外せる', async () => {
    const t1 = await createTag(userId1, 't1');
    const t2 = await createTag(userId1, 't2');
    const bookmark = await addBookmark(userId1, messageHello, [t1.id, t2.id]);
    const updated = await setBookmarkTags(userId1, bookmark.messageId, [t2.id]);
    expect(updated.tags?.length).toBe(1);
    expect(updated.tags?.[0].id).toBe(t2.id);
  });

  it('tagIds を空配列にするとすべてのタグ紐付けが解除される', async () => {
    const t1 = await createTag(userId1, 't1');
    const bookmark = await addBookmark(userId1, messageHello, [t1.id]);
    const updated = await setBookmarkTags(userId1, bookmark.messageId, []);
    expect(updated.tags).toEqual([]);
  });

  it('他ユーザーのブックマークを更新しようとすると 403 もしくは 404 を返す', async () => {
    await addBookmark(userId1, messageHello);
    await expect(setBookmarkTags(userId2, messageHello, [])).rejects.toThrow('Bookmark not found');
  });

  it('存在しないブックマークでは 404 を返す', async () => {
    await expect(setBookmarkTags(userId1, 99999, [])).rejects.toThrow('Bookmark not found');
  });
});

describe('GET /api/bookmarks - タグフィルタ', () => {
  describe('単一タグ', () => {
    it('tagIds=1 を渡すとタグ ID 1 を持つブックマークのみ返す', async () => {
      const tag = await createTag(userId1, 'only');
      await addBookmark(userId1, messageHello, [tag.id]);
      await addBookmark(userId1, messageWorld);
      const result = await getBookmarks(userId1, { tagIds: [tag.id] });
      expect(result.length).toBe(1);
      expect(result[0].messageId).toBe(messageHello);
    });

    it('該当するブックマークが無いときは空配列を返す', async () => {
      const tag = await createTag(userId1, 'only');
      await addBookmark(userId1, messageHello);
      const result = await getBookmarks(userId1, { tagIds: [tag.id] });
      expect(result).toEqual([]);
    });
  });

  describe('複数タグの組み合わせ', () => {
    it('tagIds=1,2 と tagMode=and ですべてのタグを持つブックマークのみ返す', async () => {
      const t1 = await createTag(userId1, 't1');
      const t2 = await createTag(userId1, 't2');
      await addBookmark(userId1, messageHello, [t1.id, t2.id]);
      await addBookmark(userId1, messageWorld, [t1.id]);
      const result = await getBookmarks(userId1, {
        tagIds: [t1.id, t2.id],
        tagMode: 'and',
      });
      expect(result.length).toBe(1);
      expect(result[0].messageId).toBe(messageHello);
    });

    it('tagIds=1,2 と tagMode=or でいずれかのタグを持つブックマークを返す', async () => {
      const t1 = await createTag(userId1, 't1');
      const t2 = await createTag(userId1, 't2');
      await addBookmark(userId1, messageHello, [t1.id]);
      await addBookmark(userId1, messageWorld, [t2.id]);
      await addBookmark(userId1, messageJa);
      const result = await getBookmarks(userId1, {
        tagIds: [t1.id, t2.id],
        tagMode: 'or',
      });
      expect(result.length).toBe(2);
    });

    it('tagMode が未指定の場合のデフォルト挙動が定義されている（OR）', async () => {
      const t1 = await createTag(userId1, 't1');
      const t2 = await createTag(userId1, 't2');
      await addBookmark(userId1, messageHello, [t1.id]);
      await addBookmark(userId1, messageWorld, [t2.id]);
      const result = await getBookmarks(userId1, { tagIds: [t1.id, t2.id] });
      expect(result.length).toBe(2);
    });

    it('untagged=true で未タグ付けのブックマークのみ取得できる', async () => {
      const tag = await createTag(userId1, 't1');
      await addBookmark(userId1, messageHello, [tag.id]);
      await addBookmark(userId1, messageWorld);
      const result = await getBookmarks(userId1, { untagged: true });
      expect(result.length).toBe(1);
      expect(result[0].messageId).toBe(messageWorld);
    });
  });

  describe('検索とタグの併用', () => {
    it('search と tagIds を同時指定すると両条件で絞り込める', async () => {
      const tag = await createTag(userId1, 'work');
      await addBookmark(userId1, messageHello, [tag.id]);
      await addBookmark(userId1, messageWorld, [tag.id]);
      const result = await getBookmarks(userId1, {
        search: 'Hello',
        tagIds: [tag.id],
      });
      expect(result.length).toBe(1);
      expect(result[0].messageId).toBe(messageHello);
    });
  });
});

describe('既存ブックマークとの後方互換性', () => {
  it('タグが付与されていない既存レコードも取得できる', async () => {
    await addBookmark(userId1, messageHello);
    const result = await getBookmarks(userId1);
    expect(result.length).toBe(1);
  });

  it('GET /api/bookmarks のレスポンスは tags フィールドが空配列で返る', async () => {
    await addBookmark(userId1, messageHello);
    const result = await getBookmarks(userId1);
    expect(result[0].tags).toEqual([]);
  });

  it('スキーマ移行で既存 bookmarks レコードが破壊されない', async () => {
    // 直接 INSERT した古いレコードも取得できることを確認
    await testDb.execute('INSERT INTO bookmarks (user_id, message_id) VALUES ($1, $2)', [
      userId1,
      messageHello,
    ]);
    const result = await getBookmarks(userId1);
    expect(result.length).toBe(1);
  });

  it('既存の POST/DELETE /api/bookmarks/:messageId エンドポイントが従来通り動作する', async () => {
    const { token, userId } = await registerUser(app, 'compat1', 'compat1@e.com');
    const rc = await testDb.execute(
      'INSERT INTO channels (name, created_by) VALUES ($1, $2) RETURNING id',
      ['compat-ch', userId],
    );
    const rm = await testDb.execute(
      'INSERT INTO messages (channel_id, user_id, content) VALUES ($1, $2, $3) RETURNING id',
      [rc.rows[0].id as number, userId, 'hi'],
    );
    const mid = rm.rows[0].id as number;

    const post = await request(app).post(`/api/bookmarks/${mid}`).set('Cookie', `token=${token}`);
    expect(post.status).toBe(201);

    const del = await request(app).delete(`/api/bookmarks/${mid}`).set('Cookie', `token=${token}`);
    expect(del.status).toBe(204);
  });
});

describe('スキーマ・サービス層の整合性', () => {
  it('bookmark_tags テーブルが (user_id, name) のユニーク制約を持つ', async () => {
    await createTag(userId1, 'unique');
    await expect(createTag(userId1, 'unique')).rejects.toThrow('Tag name already exists');
  });

  it('bookmark_tag_relations テーブルが (bookmark_id, tag_id) のユニーク制約を持つ', async () => {
    const tag = await createTag(userId1, 'rel');
    const bookmark = await addBookmark(userId1, messageHello, [tag.id]);
    // 同じ関連を再 INSERT すると主キー制約で失敗する
    await expect(
      testDb.execute('INSERT INTO bookmark_tag_relations (bookmark_id, tag_id) VALUES ($1, $2)', [
        bookmark.id,
        tag.id,
      ]),
    ).rejects.toThrow();
  });

  it('ブックマーク削除時に bookmark_tag_relations が CASCADE 削除される', async () => {
    const tag = await createTag(userId1, 'rel');
    const bookmark = await addBookmark(userId1, messageHello, [tag.id]);
    await testDb.execute('DELETE FROM bookmarks WHERE id = $1', [bookmark.id]);
    const rows = await testDb.query('SELECT * FROM bookmark_tag_relations WHERE bookmark_id = $1', [
      bookmark.id,
    ]);
    expect(rows.length).toBe(0);
  });

  it('ユーザー削除時に bookmark_tags が CASCADE 削除される', async () => {
    await createTag(userId1, 'a');
    await testDb.execute('DELETE FROM users WHERE id = $1', [userId1]);
    const rows = await testDb.query('SELECT * FROM bookmark_tags WHERE user_id = $1', [userId1]);
    expect(rows.length).toBe(0);
  });
});
