/**
 * テスト対象: wikiPageService の Wiki ページ管理機能（#355）
 * 戦略:
 *   - pg-mem のインメモリ PostgreSQL 互換 DB を使いサービス層を直接テストする
 *   - 外部キー制約を満たすため beforeAll でユーザー・チャンネルを挿入する
 *   - 作成・更新・削除・一覧+検索・タグ付与・楽観ロック・権限チェックの
 *     ビジネスロジックを網羅する
 */

import { createTestDatabase } from './__fixtures__/pgTestHelper';

const testDb = createTestDatabase();

jest.mock('../db/database', () => testDb);

import * as wikiPageService from '../services/wikiPageService';

let userId1: number;
let userId2: number;
let userIdAdmin: number;
let channelId1: number;
let channelId2: number;
let tagId1: number;
let tagId2: number;

beforeAll(async () => {
  const u1 = await testDb.queryOne<{ id: number }>(
    `INSERT INTO users (username, email, password_hash) VALUES ('w_user1', 'w1@test.com', 'h') RETURNING id`,
    [],
  );
  const u2 = await testDb.queryOne<{ id: number }>(
    `INSERT INTO users (username, email, password_hash) VALUES ('w_user2', 'w2@test.com', 'h') RETURNING id`,
    [],
  );
  const ua = await testDb.queryOne<{ id: number }>(
    `INSERT INTO users (username, email, password_hash, role) VALUES ('w_admin', 'wa@test.com', 'h', 'admin') RETURNING id`,
    [],
  );
  userId1 = u1!.id;
  userId2 = u2!.id;
  userIdAdmin = ua!.id;

  const c1 = await testDb.queryOne<{ id: number }>(
    `INSERT INTO channels (name, created_by) VALUES ('w_ch1', $1) RETURNING id`,
    [userId1],
  );
  const c2 = await testDb.queryOne<{ id: number }>(
    `INSERT INTO channels (name, created_by) VALUES ('w_ch2', $1) RETURNING id`,
    [userId2],
  );
  channelId1 = c1!.id;
  channelId2 = c2!.id;

  const t1 = await testDb.queryOne<{ id: number }>(
    `INSERT INTO tags (name) VALUES ('faq') RETURNING id`,
    [],
  );
  const t2 = await testDb.queryOne<{ id: number }>(
    `INSERT INTO tags (name) VALUES ('runbook') RETURNING id`,
    [],
  );
  tagId1 = t1!.id;
  tagId2 = t2!.id;
});

beforeEach(async () => {
  await testDb.execute('DELETE FROM wiki_page_tags', []);
  await testDb.execute('DELETE FROM wiki_pages', []);
});

describe('Wikiページ管理機能（wikiPageService）', () => {
  describe('ページ作成', () => {
    it('タイトル・本文・チャンネルIDを指定してWikiページを作成できる', async () => {
      const page = await wikiPageService.createWikiPage(channelId1, userId1, {
        title: 'テストページ',
        content: '本文',
      });
      expect(page.id).toBeDefined();
      expect(page.title).toBe('テストページ');
      expect(page.content).toBe('本文');
      expect(page.channelId).toBe(channelId1);
    });

    it('作成時にcreated_byとupdated_byが同じユーザーIDで設定される', async () => {
      const page = await wikiPageService.createWikiPage(channelId1, userId1, { title: 'a' });
      expect(page.createdBy).toBe(userId1);
      expect(page.updatedBy).toBe(userId1);
    });

    it('作成時のcreated_atとupdated_atがほぼ同時刻に設定される', async () => {
      const page = await wikiPageService.createWikiPage(channelId1, userId1, { title: 'a' });
      const c = new Date(page.createdAt).getTime();
      const u = new Date(page.updatedAt).getTime();
      expect(Math.abs(u - c)).toBeLessThan(2000);
    });

    it('タイトルが空文字列の場合はエラーになる', async () => {
      await expect(
        wikiPageService.createWikiPage(channelId1, userId1, { title: '   ' }),
      ).rejects.toThrow();
    });

    it('本文が空文字列でも作成できる（空のWikiページは許容）', async () => {
      const page = await wikiPageService.createWikiPage(channelId1, userId1, {
        title: 't',
        content: '',
      });
      expect(page.content).toBe('');
    });

    it('存在しないチャンネルIDを指定するとエラーになる', async () => {
      await expect(
        wikiPageService.createWikiPage(99999, userId1, { title: 't' }),
      ).rejects.toThrow();
    });

    it('同一チャンネル内でタイトル重複を許容する', async () => {
      const a = await wikiPageService.createWikiPage(channelId1, userId1, { title: 'dup' });
      const b = await wikiPageService.createWikiPage(channelId1, userId1, { title: 'dup' });
      expect(a.id).not.toBe(b.id);
    });

    it('タグIDリストを指定するとwiki_page_tagsに紐付けが作成される', async () => {
      const page = await wikiPageService.createWikiPage(channelId1, userId1, {
        title: 't',
        tagIds: [tagId1, tagId2],
      });
      expect(page.tags.map((t) => t.id).sort()).toEqual([tagId1, tagId2].sort());
    });

    it('存在しないタグIDを含めるとエラーになる', async () => {
      await expect(
        wikiPageService.createWikiPage(channelId1, userId1, {
          title: 't',
          tagIds: [99999],
        }),
      ).rejects.toThrow();
    });
  });

  describe('ページ取得', () => {
    it('IDを指定して単一ページを取得できる', async () => {
      const created = await wikiPageService.createWikiPage(channelId1, userId1, { title: 'g' });
      const got = await wikiPageService.getWikiPage(created.id);
      expect(got?.id).toBe(created.id);
    });

    it('取得結果にタイトル・本文・作成者・更新者・作成日時・更新日時が含まれる', async () => {
      const created = await wikiPageService.createWikiPage(channelId1, userId1, {
        title: 'g2',
        content: 'c',
      });
      const got = await wikiPageService.getWikiPage(created.id);
      expect(got).toMatchObject({
        title: 'g2',
        content: 'c',
        createdBy: userId1,
        updatedBy: userId1,
      });
      expect(got?.createdAt).toBeDefined();
      expect(got?.updatedAt).toBeDefined();
    });

    it('取得結果に紐づくタグ一覧が含まれる', async () => {
      const created = await wikiPageService.createWikiPage(channelId1, userId1, {
        title: 'g3',
        tagIds: [tagId1],
      });
      const got = await wikiPageService.getWikiPage(created.id);
      expect(got?.tags.length).toBe(1);
      expect(got?.tags[0].id).toBe(tagId1);
    });

    it('存在しないIDを指定するとnullを返す', async () => {
      const got = await wikiPageService.getWikiPage(99999);
      expect(got).toBeNull();
    });
  });

  describe('ページ一覧（チャンネル単位）', () => {
    it('チャンネルIDを指定してそのチャンネルのページのみ返す', async () => {
      await wikiPageService.createWikiPage(channelId1, userId1, { title: 'a' });
      await wikiPageService.createWikiPage(channelId2, userId2, { title: 'b' });
      const list = await wikiPageService.listWikiPages(channelId1);
      expect(list.length).toBe(1);
      expect(list[0].title).toBe('a');
    });

    it('他のチャンネルのページは含まれない', async () => {
      await wikiPageService.createWikiPage(channelId2, userId2, { title: 'b' });
      const list = await wikiPageService.listWikiPages(channelId1);
      expect(list.length).toBe(0);
    });

    it('更新日時の降順で返す', async () => {
      const p1 = await wikiPageService.createWikiPage(channelId1, userId1, { title: 'old' });
      await testDb.execute(
        `UPDATE wiki_pages SET updated_at = NOW() - INTERVAL '1 hour' WHERE id = $1`,
        [p1.id],
      );
      await wikiPageService.createWikiPage(channelId1, userId1, { title: 'new' });
      const list = await wikiPageService.listWikiPages(channelId1);
      expect(list[0].title).toBe('new');
      expect(list[1].title).toBe('old');
    });

    it('検索クエリqを指定するとタイトル部分一致でフィルタされる', async () => {
      await wikiPageService.createWikiPage(channelId1, userId1, { title: 'apple pie' });
      await wikiPageService.createWikiPage(channelId1, userId1, { title: 'banana' });
      const list = await wikiPageService.listWikiPages(channelId1, 'apple');
      expect(list.length).toBe(1);
      expect(list[0].title).toBe('apple pie');
    });

    it('検索クエリqを指定すると本文部分一致でもフィルタされる', async () => {
      await wikiPageService.createWikiPage(channelId1, userId1, {
        title: 'x',
        content: 'apple in body',
      });
      await wikiPageService.createWikiPage(channelId1, userId1, { title: 'y', content: 'other' });
      const list = await wikiPageService.listWikiPages(channelId1, 'apple');
      expect(list.length).toBe(1);
      expect(list[0].title).toBe('x');
    });

    it('検索クエリqは大文字小文字を区別しない（ILIKE）', async () => {
      await wikiPageService.createWikiPage(channelId1, userId1, { title: 'Apple' });
      const list = await wikiPageService.listWikiPages(channelId1, 'apple');
      expect(list.length).toBe(1);
    });

    it('検索クエリが空文字列のときは全件返す', async () => {
      await wikiPageService.createWikiPage(channelId1, userId1, { title: 'a' });
      await wikiPageService.createWikiPage(channelId1, userId1, { title: 'b' });
      const list = await wikiPageService.listWikiPages(channelId1, '');
      expect(list.length).toBe(2);
    });
  });

  describe('ページ更新', () => {
    it('タイトル・本文を更新できる', async () => {
      const p = await wikiPageService.createWikiPage(channelId1, userId1, { title: 'old' });
      const updated = await wikiPageService.updateWikiPage(p.id, userId1, {
        title: 'new',
        content: 'body',
        expectedUpdatedAt: p.updatedAt,
      });
      expect(updated.title).toBe('new');
      expect(updated.content).toBe('body');
    });

    it('更新するとupdated_atが新しい時刻になる', async () => {
      const p = await wikiPageService.createWikiPage(channelId1, userId1, { title: 'a' });
      await new Promise((r) => setTimeout(r, 10));
      const updated = await wikiPageService.updateWikiPage(p.id, userId1, {
        title: 'b',
        expectedUpdatedAt: p.updatedAt,
      });
      expect(new Date(updated.updatedAt).getTime()).toBeGreaterThanOrEqual(
        new Date(p.updatedAt).getTime(),
      );
    });

    it('更新するとupdated_byが更新者のIDになる', async () => {
      const p = await wikiPageService.createWikiPage(channelId1, userId1, { title: 'a' });
      const updated = await wikiPageService.updateWikiPage(p.id, userId2, {
        title: 'b',
        expectedUpdatedAt: p.updatedAt,
      });
      expect(updated.updatedBy).toBe(userId2);
    });

    it('expectedUpdatedAtが現在のupdated_atと一致しないと409相当のエラーになる（楽観ロック）', async () => {
      const p = await wikiPageService.createWikiPage(channelId1, userId1, { title: 'a' });
      const stale = '2000-01-01T00:00:00.000Z';
      await expect(
        wikiPageService.updateWikiPage(p.id, userId1, {
          title: 'b',
          expectedUpdatedAt: stale,
        }),
      ).rejects.toMatchObject({ statusCode: 409 });
    });

    it('expectedUpdatedAtが一致すれば正常に更新される', async () => {
      const p = await wikiPageService.createWikiPage(channelId1, userId1, { title: 'a' });
      const updated = await wikiPageService.updateWikiPage(p.id, userId1, {
        title: 'b',
        expectedUpdatedAt: p.updatedAt,
      });
      expect(updated.title).toBe('b');
    });

    it('タグIDリストを更新すると既存の紐付けが置換される', async () => {
      const p = await wikiPageService.createWikiPage(channelId1, userId1, {
        title: 'a',
        tagIds: [tagId1],
      });
      const updated = await wikiPageService.updateWikiPage(p.id, userId1, {
        tagIds: [tagId2],
        expectedUpdatedAt: p.updatedAt,
      });
      expect(updated.tags.map((t) => t.id)).toEqual([tagId2]);
    });

    it('存在しないページIDを更新しようとするとエラーになる', async () => {
      await expect(
        wikiPageService.updateWikiPage(99999, userId1, {
          title: 'a',
          expectedUpdatedAt: '2020-01-01T00:00:00.000Z',
        }),
      ).rejects.toMatchObject({ statusCode: 404 });
    });
  });

  describe('ページ削除', () => {
    it('IDを指定してページを削除できる（ハードデリート）', async () => {
      const p = await wikiPageService.createWikiPage(channelId1, userId1, { title: 'a' });
      await wikiPageService.deleteWikiPage(p.id);
      const got = await wikiPageService.getWikiPage(p.id);
      expect(got).toBeNull();
    });

    it('削除するとwiki_page_tagsの紐付けもCASCADEで削除される', async () => {
      const p = await wikiPageService.createWikiPage(channelId1, userId1, {
        title: 'a',
        tagIds: [tagId1],
      });
      await wikiPageService.deleteWikiPage(p.id);
      const rows = await testDb.query(`SELECT * FROM wiki_page_tags WHERE wiki_page_id = $1`, [
        p.id,
      ]);
      expect(rows.length).toBe(0);
    });

    it('存在しないIDを削除しようとするとエラーになる', async () => {
      await expect(wikiPageService.deleteWikiPage(99999)).rejects.toMatchObject({
        statusCode: 404,
      });
    });
  });

  describe('権限チェック（canEdit）', () => {
    it('ページ作成者本人は編集可能', async () => {
      const p = await wikiPageService.createWikiPage(channelId1, userId1, { title: 'a' });
      const info = await wikiPageService.loadPageAuthInfo(p.id);
      expect(wikiPageService.canEdit(info!, { userId: userId1, userRole: 'user' })).toBe(true);
    });

    it('チャンネル作成者（channels.created_by）は編集可能', async () => {
      // channelId1 の作成者は userId1。userId2 作成のページを直接 INSERT し、
      // userId1（チャンネル作成者）が編集可能であることを確認する。
      const inserted = await testDb.queryOne<{ id: number }>(
        `INSERT INTO wiki_pages (channel_id, title, created_by, updated_by) VALUES ($1, 'x', $2, $2) RETURNING id`,
        [channelId1, userId2],
      );
      const info = await wikiPageService.loadPageAuthInfo(inserted!.id);
      expect(wikiPageService.canEdit(info!, { userId: userId1, userRole: 'user' })).toBe(true);
    });

    it('管理者（users.role=admin）は編集可能', async () => {
      const p = await wikiPageService.createWikiPage(channelId1, userId1, { title: 'a' });
      const info = await wikiPageService.loadPageAuthInfo(p.id);
      expect(wikiPageService.canEdit(info!, { userId: userIdAdmin, userRole: 'admin' })).toBe(true);
    });

    it('上記いずれにも該当しない一般メンバーは編集不可（403相当）', async () => {
      const p = await wikiPageService.createWikiPage(channelId1, userId1, { title: 'a' });
      const info = await wikiPageService.loadPageAuthInfo(p.id);
      expect(wikiPageService.canEdit(info!, { userId: userId2, userRole: 'user' })).toBe(false);
    });
  });

  describe('権限チェック（canDelete）', () => {
    it('チャンネル作成者は削除可能', async () => {
      const p = await wikiPageService.createWikiPage(channelId1, userId1, { title: 'a' });
      const info = await wikiPageService.loadPageAuthInfo(p.id);
      expect(wikiPageService.canDelete(info!, { userId: userId1, userRole: 'user' })).toBe(true);
    });

    it('管理者は削除可能', async () => {
      const p = await wikiPageService.createWikiPage(channelId1, userId1, { title: 'a' });
      const info = await wikiPageService.loadPageAuthInfo(p.id);
      expect(wikiPageService.canDelete(info!, { userId: userIdAdmin, userRole: 'admin' })).toBe(
        true,
      );
    });

    it('ページ作成者であってもチャンネル作成者でなければ削除不可', async () => {
      // channelId1 の作成者は userId1。userId2 がページを作成したと仮定して直接 INSERT する。
      const inserted = await testDb.queryOne<{ id: number }>(
        `INSERT INTO wiki_pages (channel_id, title, created_by, updated_by) VALUES ($1, 'x', $2, $2) RETURNING id`,
        [channelId1, userId2],
      );
      const info = await wikiPageService.loadPageAuthInfo(inserted!.id);
      expect(wikiPageService.canDelete(info!, { userId: userId2, userRole: 'user' })).toBe(false);
    });

    it('一般メンバーは削除不可', async () => {
      const p = await wikiPageService.createWikiPage(channelId1, userId1, { title: 'a' });
      const info = await wikiPageService.loadPageAuthInfo(p.id);
      expect(wikiPageService.canDelete(info!, { userId: userId2, userRole: 'user' })).toBe(false);
    });
  });
});
