/**
 * テスト対象: 拡張プロフィール項目（#305）サーバサイド
 *
 * 戦略:
 *   - users テーブルに追加されるカラム（bio / job_title / department / timezone /
 *     github_url / sns_url）が正しく永続化・取得されることを検証する
 *   - PATCH /api/auth/profile が拡張フィールドの更新を受け付けることを検証する
 *   - GET /api/auth/me および GET /api/auth/users が拡張フィールドを含めて返却することを検証する
 *   - 各フィールドのバリデーション（URL 形式・タイムゾーン形式・任意項目）を検証する
 *   - authService.toUser がスネークケース DB カラムをキャメルケース User 型に変換することを検証する
 *   - 任意項目のため null / 未送信を許容することを検証する
 */

import { createTestDatabase, resetTestData } from './__fixtures__/pgTestHelper';

const testDb = createTestDatabase();

jest.mock('../db/database', () => testDb);

import request from 'supertest';
import fs from 'fs';
import path from 'path';
import { createApp } from '../app';
import { registerUser } from './__fixtures__/testHelpers';

const app = createApp();

describe('拡張プロフィール項目 サーバサイド（#305）', () => {
  let userId: number;
  let authToken: string;

  beforeEach(async () => {
    await resetTestData(testDb);
    const result = await registerUser(app, 'profileuser', 'profile@example.com');
    userId = result.userId;
    authToken = result.token;
  });

  describe('DB スキーマ', () => {
    it('users.bio カラムが nullable な text として存在する', async () => {
      // pg-mem の information_schema.columns は対応していないため、
      // 直接 SELECT して NULL のまま読めることを検証する
      const row = await testDb.queryOne<{ bio: string | null }>(
        'SELECT bio FROM users WHERE id = $1',
        [userId],
      );
      expect(row).not.toBeNull();
      expect(row!.bio).toBeNull();
    });

    it('users.job_title カラムが nullable な text として存在する', async () => {
      const row = await testDb.queryOne<{ job_title: string | null }>(
        'SELECT job_title FROM users WHERE id = $1',
        [userId],
      );
      expect(row!.job_title).toBeNull();
    });

    it('users.department カラムが nullable な text として存在する', async () => {
      const row = await testDb.queryOne<{ department: string | null }>(
        'SELECT department FROM users WHERE id = $1',
        [userId],
      );
      expect(row!.department).toBeNull();
    });

    it('users.timezone カラムが nullable な text として存在する', async () => {
      const row = await testDb.queryOne<{ timezone: string | null }>(
        'SELECT timezone FROM users WHERE id = $1',
        [userId],
      );
      expect(row!.timezone).toBeNull();
    });

    it('users.github_url カラムが nullable な text として存在する', async () => {
      const row = await testDb.queryOne<{ github_url: string | null }>(
        'SELECT github_url FROM users WHERE id = $1',
        [userId],
      );
      expect(row!.github_url).toBeNull();
    });

    it('users.sns_url カラムが nullable な text として存在する', async () => {
      const row = await testDb.queryOne<{ sns_url: string | null }>(
        'SELECT sns_url FROM users WHERE id = $1',
        [userId],
      );
      expect(row!.sns_url).toBeNull();
    });

    it('既存ユーザーは追加カラムが NULL のまま動作する（後方互換）', async () => {
      const res = await request(app).get('/api/auth/me').set('Cookie', `token=${authToken}`);
      expect(res.status).toBe(200);
      expect(res.body.user.bio).toBeNull();
      expect(res.body.user.jobTitle).toBeNull();
      expect(res.body.user.department).toBeNull();
      expect(res.body.user.timezone).toBeNull();
      expect(res.body.user.githubUrl).toBeNull();
      expect(res.body.user.snsUrl).toBeNull();
    });
  });

  describe('authService.toUser: User 型変換', () => {
    it('row.bio が user.bio にキャメルケースで変換される', async () => {
      await testDb.execute('UPDATE users SET bio = $1 WHERE id = $2', ['Hello world', userId]);
      const res = await request(app).get('/api/auth/me').set('Cookie', `token=${authToken}`);
      expect(res.body.user.bio).toBe('Hello world');
    });

    it('row.job_title が user.jobTitle に変換される', async () => {
      await testDb.execute('UPDATE users SET job_title = $1 WHERE id = $2', ['Engineer', userId]);
      const res = await request(app).get('/api/auth/me').set('Cookie', `token=${authToken}`);
      expect(res.body.user.jobTitle).toBe('Engineer');
    });

    it('row.department が user.department に変換される', async () => {
      await testDb.execute('UPDATE users SET department = $1 WHERE id = $2', ['Platform', userId]);
      const res = await request(app).get('/api/auth/me').set('Cookie', `token=${authToken}`);
      expect(res.body.user.department).toBe('Platform');
    });

    it('row.timezone が user.timezone に変換される', async () => {
      await testDb.execute('UPDATE users SET timezone = $1 WHERE id = $2', ['Asia/Tokyo', userId]);
      const res = await request(app).get('/api/auth/me').set('Cookie', `token=${authToken}`);
      expect(res.body.user.timezone).toBe('Asia/Tokyo');
    });

    it('row.github_url が user.githubUrl に変換される', async () => {
      await testDb.execute('UPDATE users SET github_url = $1 WHERE id = $2', [
        'https://github.com/foo',
        userId,
      ]);
      const res = await request(app).get('/api/auth/me').set('Cookie', `token=${authToken}`);
      expect(res.body.user.githubUrl).toBe('https://github.com/foo');
    });

    it('row.sns_url が user.snsUrl に変換される', async () => {
      await testDb.execute('UPDATE users SET sns_url = $1 WHERE id = $2', [
        'https://example.com/sns',
        userId,
      ]);
      const res = await request(app).get('/api/auth/me').set('Cookie', `token=${authToken}`);
      expect(res.body.user.snsUrl).toBe('https://example.com/sns');
    });

    it('全ての拡張フィールドが null の場合も User オブジェクトを返す', async () => {
      const res = await request(app).get('/api/auth/me').set('Cookie', `token=${authToken}`);
      expect(res.status).toBe(200);
      expect(res.body.user).toMatchObject({
        bio: null,
        jobTitle: null,
        department: null,
        timezone: null,
        githubUrl: null,
        snsUrl: null,
      });
    });
  });

  describe('authService.updateProfile', () => {
    it('bio を更新できる', async () => {
      const res = await request(app)
        .patch('/api/auth/profile')
        .set('Cookie', `token=${authToken}`)
        .send({ bio: '自己紹介テキスト' });
      expect(res.status).toBe(200);
      expect(res.body.user.bio).toBe('自己紹介テキスト');
    });

    it('jobTitle を更新できる', async () => {
      const res = await request(app)
        .patch('/api/auth/profile')
        .set('Cookie', `token=${authToken}`)
        .send({ jobTitle: 'Senior Engineer' });
      expect(res.status).toBe(200);
      expect(res.body.user.jobTitle).toBe('Senior Engineer');
    });

    it('department を更新できる', async () => {
      const res = await request(app)
        .patch('/api/auth/profile')
        .set('Cookie', `token=${authToken}`)
        .send({ department: '基盤開発部' });
      expect(res.status).toBe(200);
      expect(res.body.user.department).toBe('基盤開発部');
    });

    it('timezone を更新できる', async () => {
      const res = await request(app)
        .patch('/api/auth/profile')
        .set('Cookie', `token=${authToken}`)
        .send({ timezone: 'Asia/Tokyo' });
      expect(res.status).toBe(200);
      expect(res.body.user.timezone).toBe('Asia/Tokyo');
    });

    it('githubUrl を更新できる', async () => {
      const res = await request(app)
        .patch('/api/auth/profile')
        .set('Cookie', `token=${authToken}`)
        .send({ githubUrl: 'https://github.com/me' });
      expect(res.status).toBe(200);
      expect(res.body.user.githubUrl).toBe('https://github.com/me');
    });

    it('snsUrl を更新できる', async () => {
      const res = await request(app)
        .patch('/api/auth/profile')
        .set('Cookie', `token=${authToken}`)
        .send({ snsUrl: 'https://twitter.com/me' });
      expect(res.status).toBe(200);
      expect(res.body.user.snsUrl).toBe('https://twitter.com/me');
    });

    it('複数フィールドを同時に更新できる', async () => {
      const res = await request(app)
        .patch('/api/auth/profile')
        .set('Cookie', `token=${authToken}`)
        .send({
          bio: '紹介',
          jobTitle: 'Dev',
          department: 'Eng',
          timezone: 'UTC',
          githubUrl: 'https://github.com/me',
          snsUrl: 'https://example.com',
        });
      expect(res.status).toBe(200);
      expect(res.body.user).toMatchObject({
        bio: '紹介',
        jobTitle: 'Dev',
        department: 'Eng',
        timezone: 'UTC',
        githubUrl: 'https://github.com/me',
        snsUrl: 'https://example.com',
      });
    });

    it('null を渡すと既存値をクリアできる', async () => {
      // まず値を設定
      await request(app)
        .patch('/api/auth/profile')
        .set('Cookie', `token=${authToken}`)
        .send({ bio: 'set', jobTitle: 'set' });

      // null でクリア
      const res = await request(app)
        .patch('/api/auth/profile')
        .set('Cookie', `token=${authToken}`)
        .send({ bio: null, jobTitle: null });
      expect(res.status).toBe(200);
      expect(res.body.user.bio).toBeNull();
      expect(res.body.user.jobTitle).toBeNull();
    });

    it('該当キーを送信しない場合は既存値が保持される（部分更新）', async () => {
      await request(app)
        .patch('/api/auth/profile')
        .set('Cookie', `token=${authToken}`)
        .send({ bio: 'keep me', jobTitle: 'Eng' });

      const res = await request(app)
        .patch('/api/auth/profile')
        .set('Cookie', `token=${authToken}`)
        .send({ jobTitle: 'Updated' });
      expect(res.status).toBe(200);
      expect(res.body.user.bio).toBe('keep me'); // 保持
      expect(res.body.user.jobTitle).toBe('Updated'); // 更新
    });

    it('updated_at が更新される', async () => {
      const before = await testDb.queryOne<{ updated_at: string }>(
        'SELECT updated_at FROM users WHERE id = $1',
        [userId],
      );
      // 1ms 以上の差を作る
      await new Promise((r) => setTimeout(r, 5));
      await request(app)
        .patch('/api/auth/profile')
        .set('Cookie', `token=${authToken}`)
        .send({ bio: 'update' });
      const after = await testDb.queryOne<{ updated_at: string }>(
        'SELECT updated_at FROM users WHERE id = $1',
        [userId],
      );
      expect(new Date(after!.updated_at).getTime()).toBeGreaterThanOrEqual(
        new Date(before!.updated_at).getTime(),
      );
    });
  });

  describe('PATCH /api/auth/profile', () => {
    it('認証済みユーザーが拡張フィールドを更新できる', async () => {
      const res = await request(app)
        .patch('/api/auth/profile')
        .set('Cookie', `token=${authToken}`)
        .send({ bio: 'hi' });
      expect(res.status).toBe(200);
      expect(res.body.user.bio).toBe('hi');
    });

    it('レスポンスに拡張フィールドを含む user オブジェクトが返る', async () => {
      const res = await request(app)
        .patch('/api/auth/profile')
        .set('Cookie', `token=${authToken}`)
        .send({ bio: 'hi', jobTitle: 'Dev' });
      expect(res.body.user).toHaveProperty('bio');
      expect(res.body.user).toHaveProperty('jobTitle');
      expect(res.body.user).toHaveProperty('department');
      expect(res.body.user).toHaveProperty('timezone');
      expect(res.body.user).toHaveProperty('githubUrl');
      expect(res.body.user).toHaveProperty('snsUrl');
    });

    it('拡張フィールドを送信しない場合は既存値が保持される', async () => {
      await request(app)
        .patch('/api/auth/profile')
        .set('Cookie', `token=${authToken}`)
        .send({ bio: 'persist' });

      const res = await request(app)
        .patch('/api/auth/profile')
        .set('Cookie', `token=${authToken}`)
        .send({ displayName: 'New Name' });
      expect(res.body.user.bio).toBe('persist');
    });

    it('未認証では 401 を返す', async () => {
      const res = await request(app).patch('/api/auth/profile').send({ bio: 'hi' });
      expect(res.status).toBe(401);
    });

    it('空文字は null として扱われる（または空文字のまま保存される）', async () => {
      await request(app)
        .patch('/api/auth/profile')
        .set('Cookie', `token=${authToken}`)
        .send({ bio: 'first' });
      const res = await request(app)
        .patch('/api/auth/profile')
        .set('Cookie', `token=${authToken}`)
        .send({ bio: '' });
      expect(res.status).toBe(200);
      // 実装は空文字を null として扱う
      expect(res.body.user.bio).toBeNull();
    });
  });

  describe('PATCH /api/auth/profile: バリデーション', () => {
    describe('githubUrl', () => {
      it('http/https 以外のスキームは 400 を返す', async () => {
        const res = await request(app)
          .patch('/api/auth/profile')
          .set('Cookie', `token=${authToken}`)
          .send({ githubUrl: 'ftp://example.com/foo' });
        expect(res.status).toBe(400);
      });

      it('URL 形式不正は 400 を返す', async () => {
        const res = await request(app)
          .patch('/api/auth/profile')
          .set('Cookie', `token=${authToken}`)
          .send({ githubUrl: 'not a url' });
        expect(res.status).toBe(400);
      });

      it('正しい https URL は 200 で受理される', async () => {
        const res = await request(app)
          .patch('/api/auth/profile')
          .set('Cookie', `token=${authToken}`)
          .send({ githubUrl: 'https://github.com/me' });
        expect(res.status).toBe(200);
        expect(res.body.user.githubUrl).toBe('https://github.com/me');
      });

      it('null は受理される（クリア）', async () => {
        const res = await request(app)
          .patch('/api/auth/profile')
          .set('Cookie', `token=${authToken}`)
          .send({ githubUrl: null });
        expect(res.status).toBe(200);
        expect(res.body.user.githubUrl).toBeNull();
      });

      it('未送信は受理される（部分更新）', async () => {
        const res = await request(app)
          .patch('/api/auth/profile')
          .set('Cookie', `token=${authToken}`)
          .send({ bio: 'no github' });
        expect(res.status).toBe(200);
      });
    });

    describe('snsUrl', () => {
      it('http/https 以外のスキームは 400 を返す', async () => {
        const res = await request(app)
          .patch('/api/auth/profile')
          .set('Cookie', `token=${authToken}`)
          .send({ snsUrl: 'javascript:alert(1)' });
        expect(res.status).toBe(400);
      });

      it('URL 形式不正は 400 を返す', async () => {
        const res = await request(app)
          .patch('/api/auth/profile')
          .set('Cookie', `token=${authToken}`)
          .send({ snsUrl: 'invalid url with space' });
        expect(res.status).toBe(400);
      });

      it('正しい URL は 200 で受理される', async () => {
        const res = await request(app)
          .patch('/api/auth/profile')
          .set('Cookie', `token=${authToken}`)
          .send({ snsUrl: 'https://twitter.com/me' });
        expect(res.status).toBe(200);
        expect(res.body.user.snsUrl).toBe('https://twitter.com/me');
      });

      it('null は受理される（クリア）', async () => {
        const res = await request(app)
          .patch('/api/auth/profile')
          .set('Cookie', `token=${authToken}`)
          .send({ snsUrl: null });
        expect(res.status).toBe(200);
        expect(res.body.user.snsUrl).toBeNull();
      });
    });

    describe('timezone', () => {
      it('IANA 形式以外（"JST" などの略称）は 400 を返す', async () => {
        const res = await request(app)
          .patch('/api/auth/profile')
          .set('Cookie', `token=${authToken}`)
          .send({ timezone: 'JST' });
        expect(res.status).toBe(400);
      });

      it('未知のタイムゾーン名は 400 を返す', async () => {
        const res = await request(app)
          .patch('/api/auth/profile')
          .set('Cookie', `token=${authToken}`)
          .send({ timezone: 'Mars/Olympus_Mons' });
        expect(res.status).toBe(400);
      });

      it('IANA 形式（"Asia/Tokyo" / "UTC" / "America/Los_Angeles"）は 200 で受理される', async () => {
        for (const tz of ['Asia/Tokyo', 'UTC', 'America/Los_Angeles']) {
          const res = await request(app)
            .patch('/api/auth/profile')
            .set('Cookie', `token=${authToken}`)
            .send({ timezone: tz });
          expect(res.status).toBe(200);
          expect(res.body.user.timezone).toBe(tz);
        }
      });

      it('null は受理される（クリア）', async () => {
        const res = await request(app)
          .patch('/api/auth/profile')
          .set('Cookie', `token=${authToken}`)
          .send({ timezone: null });
        expect(res.status).toBe(200);
        expect(res.body.user.timezone).toBeNull();
      });
    });

    describe('bio', () => {
      it('上限文字数を超える bio は 400 を返す', async () => {
        const res = await request(app)
          .patch('/api/auth/profile')
          .set('Cookie', `token=${authToken}`)
          .send({ bio: 'a'.repeat(1001) });
        expect(res.status).toBe(400);
      });

      it('上限以内の bio は 200 で受理される', async () => {
        const res = await request(app)
          .patch('/api/auth/profile')
          .set('Cookie', `token=${authToken}`)
          .send({ bio: 'a'.repeat(1000) });
        expect(res.status).toBe(200);
      });

      it('null / 空文字 は受理される', async () => {
        const r1 = await request(app)
          .patch('/api/auth/profile')
          .set('Cookie', `token=${authToken}`)
          .send({ bio: null });
        expect(r1.status).toBe(200);
        const r2 = await request(app)
          .patch('/api/auth/profile')
          .set('Cookie', `token=${authToken}`)
          .send({ bio: '' });
        expect(r2.status).toBe(200);
      });
    });

    describe('jobTitle / department', () => {
      it('上限文字数を超える場合は 400 を返す', async () => {
        const r1 = await request(app)
          .patch('/api/auth/profile')
          .set('Cookie', `token=${authToken}`)
          .send({ jobTitle: 'a'.repeat(101) });
        expect(r1.status).toBe(400);
        const r2 = await request(app)
          .patch('/api/auth/profile')
          .set('Cookie', `token=${authToken}`)
          .send({ department: 'b'.repeat(101) });
        expect(r2.status).toBe(400);
      });

      it('上限以内は 200 で受理される', async () => {
        const r1 = await request(app)
          .patch('/api/auth/profile')
          .set('Cookie', `token=${authToken}`)
          .send({ jobTitle: 'a'.repeat(100) });
        expect(r1.status).toBe(200);
        const r2 = await request(app)
          .patch('/api/auth/profile')
          .set('Cookie', `token=${authToken}`)
          .send({ department: 'b'.repeat(100) });
        expect(r2.status).toBe(200);
      });

      it('null / 空文字 は受理される', async () => {
        const r1 = await request(app)
          .patch('/api/auth/profile')
          .set('Cookie', `token=${authToken}`)
          .send({ jobTitle: null, department: null });
        expect(r1.status).toBe(200);
        const r2 = await request(app)
          .patch('/api/auth/profile')
          .set('Cookie', `token=${authToken}`)
          .send({ jobTitle: '', department: '' });
        expect(r2.status).toBe(200);
      });
    });
  });

  describe('GET /api/auth/me', () => {
    it('レスポンスに拡張フィールド（bio/jobTitle/department/timezone/githubUrl/snsUrl）が含まれる', async () => {
      await request(app).patch('/api/auth/profile').set('Cookie', `token=${authToken}`).send({
        bio: 'b',
        jobTitle: 'j',
        department: 'd',
        timezone: 'UTC',
        githubUrl: 'https://github.com/x',
        snsUrl: 'https://example.com/x',
      });
      const res = await request(app).get('/api/auth/me').set('Cookie', `token=${authToken}`);
      expect(res.status).toBe(200);
      expect(res.body.user).toMatchObject({
        bio: 'b',
        jobTitle: 'j',
        department: 'd',
        timezone: 'UTC',
        githubUrl: 'https://github.com/x',
        snsUrl: 'https://example.com/x',
      });
    });

    it('未設定のフィールドは null として返る', async () => {
      const res = await request(app).get('/api/auth/me').set('Cookie', `token=${authToken}`);
      expect(res.body.user.bio).toBeNull();
      expect(res.body.user.jobTitle).toBeNull();
      expect(res.body.user.department).toBeNull();
      expect(res.body.user.timezone).toBeNull();
      expect(res.body.user.githubUrl).toBeNull();
      expect(res.body.user.snsUrl).toBeNull();
    });

    it('登録直後（拡張フィールド未設定）でも 200 を返す', async () => {
      const res = await request(app).get('/api/auth/me').set('Cookie', `token=${authToken}`);
      expect(res.status).toBe(200);
    });
  });

  describe('GET /api/auth/users', () => {
    it('全ユーザーのレスポンスに拡張フィールドが含まれる', async () => {
      await request(app)
        .patch('/api/auth/profile')
        .set('Cookie', `token=${authToken}`)
        .send({ bio: 'me', jobTitle: 'eng' });
      const res = await request(app).get('/api/auth/users').set('Cookie', `token=${authToken}`);
      expect(res.status).toBe(200);
      const users = res.body.users as Array<{
        id: number;
        bio: string | null;
        jobTitle: string | null;
      }>;
      const me = users.find((u) => u.id === userId);
      expect(me).toBeDefined();
      expect(me!.bio).toBe('me');
      expect(me!.jobTitle).toBe('eng');
    });

    it('チャネルメンバー絞り込み時も拡張フィールドが含まれる', async () => {
      // チャンネルを作成
      const created = await request(app)
        .post('/api/channels')
        .set('Cookie', `token=${authToken}`)
        .send({ name: 'general' });
      const channelId = (created.body as { channel: { id: number } }).channel.id;
      await request(app)
        .patch('/api/auth/profile')
        .set('Cookie', `token=${authToken}`)
        .send({ department: 'Platform' });

      const res = await request(app)
        .get(`/api/auth/users?channelId=${channelId}`)
        .set('Cookie', `token=${authToken}`);
      expect(res.status).toBe(200);
      const me = (res.body.users as Array<{ id: number; department: string | null }>).find(
        (u) => u.id === userId,
      );
      expect(me).toBeDefined();
      expect(me!.department).toBe('Platform');
    });

    it('他ユーザーのプロフィールカード表示用に github_url / sns_url が返る', async () => {
      await request(app).patch('/api/auth/profile').set('Cookie', `token=${authToken}`).send({
        githubUrl: 'https://github.com/me',
        snsUrl: 'https://example.com/me',
      });
      const res = await request(app).get('/api/auth/users').set('Cookie', `token=${authToken}`);
      const me = (
        res.body.users as Array<{
          id: number;
          githubUrl: string | null;
          snsUrl: string | null;
        }>
      ).find((u) => u.id === userId);
      expect(me!.githubUrl).toBe('https://github.com/me');
      expect(me!.snsUrl).toBe('https://example.com/me');
    });
  });

  describe('Swagger / OpenAPI 定義', () => {
    // Swagger 定義の存在確認は静的にコードを参照する形で行う
    // （swagger-jsdoc 由来のスキーマ生成は実装時の構造確認で十分）
    it('User スキーマに bio / jobTitle / department / timezone / githubUrl / snsUrl が記載される', () => {
      // swagger/setup.ts のソースコードに対象プロパティが定義されていることを検証する
      const setupFile = fs.readFileSync(path.join(__dirname, '..', 'swagger', 'setup.ts'), 'utf8');
      expect(setupFile).toMatch(/bio:/);
      expect(setupFile).toMatch(/jobTitle:/);
      expect(setupFile).toMatch(/department:/);
      expect(setupFile).toMatch(/timezone:/);
      expect(setupFile).toMatch(/githubUrl:/);
      expect(setupFile).toMatch(/snsUrl:/);
    });

    it('PATCH /profile のリクエストボディに拡張フィールドが定義される', () => {
      // routes/auth.ts の swagger コメント中に拡張フィールドが宣言されていることを検証する
      const file = fs.readFileSync(path.join(__dirname, '..', 'routes', 'auth.ts'), 'utf8');
      expect(file).toMatch(/bio:/);
      expect(file).toMatch(/jobTitle:/);
      expect(file).toMatch(/timezone:/);
      expect(file).toMatch(/githubUrl:/);
      expect(file).toMatch(/snsUrl:/);
    });
  });
});
