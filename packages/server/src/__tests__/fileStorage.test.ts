/**
 * services/fileStorageService.ts + POST /api/files/upload のテスト
 *
 * テスト対象: ファイルアップロード保存機能 / アップロードエンドポイント
 * 戦略:
 *   - jest.mock('fs') で fs を差し替え、実際のディスク書き込みを防ぐ
 *   - supertest で POST /api/files/upload の統合テストを行う
 *   - DB は better-sqlite3 インメモリを使用する
 *   - multer によるマルチパートパースを supertest の .attach() でテストする
 */

jest.mock('../db/database', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const Db = require('better-sqlite3') as typeof import('better-sqlite3');
  const db = new Db(':memory:');
  db.pragma('foreign_keys = ON');
  const { initializeSchema: init } =
    jest.requireActual<typeof import('../db/database')>('../db/database');
  init(db);
  return { getDatabase: () => db, initializeSchema: init, closeDatabase: jest.fn() };
});

jest.mock('fs', () => {
  const actual = jest.requireActual<typeof import('fs')>('fs');
  return {
    ...actual,
    mkdirSync: jest.fn(),
    writeFileSync: jest.fn(),
    existsSync: jest.fn().mockImplementation((p: unknown) => {
      if (typeof p === 'string' && p.includes('uploads')) return false;
      return actual.existsSync(p as import('fs').PathLike);
    }),
  };
});

import * as fs from 'fs';
import path from 'path';
import request from 'supertest';
import { saveFile } from '../services/fileStorageService';
import { createApp } from '../app';
import { register } from '../services/authService';
import { generateToken } from '../middleware/auth';

describe('FileStorageService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (fs.existsSync as jest.Mock).mockImplementation((p: unknown) => {
      const actual = jest.requireActual<typeof import('fs')>('fs');
      if (typeof p === 'string' && p.includes('uploads')) return false;
      return actual.existsSync(p as import('fs').PathLike);
    });
  });

  describe('saveFile', () => {
    it('バイナリデータを uploads/ ディレクトリに保存できる', () => {
      const buffer = Buffer.from('hello world');
      saveFile(buffer, 'hello.txt', 'text/plain');

      expect(fs.writeFileSync).toHaveBeenCalledTimes(1);
      const [filePath] = (fs.writeFileSync as jest.Mock).mock.calls[0] as [string, Buffer];
      expect(filePath).toContain(path.join('uploads'));
    });

    it('保存されたファイルの公開 URL を返す', () => {
      const buffer = Buffer.from('dummy');
      const result = saveFile(buffer, 'test.pdf', 'application/pdf');

      expect(result.url).toMatch(/^\/uploads\//);
    });

    it('uploads/ ディレクトリが存在しない場合は自動作成する', () => {
      (fs.existsSync as jest.Mock).mockReturnValue(false);

      const buffer = Buffer.from('data');
      saveFile(buffer, 'file.txt', 'text/plain');

      expect(fs.mkdirSync).toHaveBeenCalledWith(expect.stringContaining('uploads'), {
        recursive: true,
      });
    });

    it('元のファイル名・拡張子を含むファイル名で保存する', () => {
      const buffer = Buffer.from('content');
      saveFile(buffer, 'document.pdf', 'application/pdf');

      const [filePath] = (fs.writeFileSync as jest.Mock).mock.calls[0] as [string, Buffer];
      expect(filePath).toMatch(/document.*\.pdf$/);
    });
  });
});

describe('POST /api/files/upload', () => {
  let app: ReturnType<typeof createApp>;
  let token: string;

  beforeEach(async () => {
    jest.clearAllMocks();
    (fs.existsSync as jest.Mock).mockImplementation((p: unknown) => {
      const actual = jest.requireActual<typeof import('fs')>('fs');
      if (typeof p === 'string' && p.includes('uploads')) return false;
      return actual.existsSync(p as import('fs').PathLike);
    });
    app = createApp();
    const user = await register(
      `fileuser_${Date.now()}`,
      `fileuser_${Date.now()}@example.com`,
      'password123',
    );
    token = generateToken(user.id, user.username);
  });

  describe('正常系', () => {
    it('認証済みユーザーがファイルをアップロードすると 200 と { url, originalName, size } を返す', async () => {
      const buffer = Buffer.from('test file content');

      const res = await request(app)
        .post('/api/files/upload')
        .set('Cookie', `token=${token}`)
        .attach('file', buffer, 'test.txt');

      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({
        url: expect.stringMatching(/^\/uploads\//),
        originalName: 'test.txt',
        size: expect.any(Number),
      });
    });

    it('画像・テキスト・PDF など複数の MIME タイプのファイルをアップロードできる', async () => {
      const cases = [
        { name: 'image.png', mime: 'image/png' },
        { name: 'doc.pdf', mime: 'application/pdf' },
        { name: 'note.txt', mime: 'text/plain' },
      ];

      for (const { name } of cases) {
        const res = await request(app)
          .post('/api/files/upload')
          .set('Cookie', `token=${token}`)
          .attach('file', Buffer.from('data'), name);

        expect(res.status).toBe(200);
        expect(res.body.originalName).toBe(name);
      }
    });
  });

  describe('異常系', () => {
    it('未認証のリクエストは 401 を返す', async () => {
      const res = await request(app)
        .post('/api/files/upload')
        .attach('file', Buffer.from('data'), 'test.txt');

      expect(res.status).toBe(401);
    });

    it('ファイルが添付されていない場合は 400 を返す', async () => {
      const res = await request(app)
        .post('/api/files/upload')
        .set('Cookie', `token=${token}`)
        .send();

      expect(res.status).toBe(400);
    });
  });
});
