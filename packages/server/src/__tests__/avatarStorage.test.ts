/**
 * services/avatarStorageService.ts のユニットテスト
 *
 * テスト対象: アバター画像のストレージ保存機能
 * 戦略:
 *   - jest.mock('fs') で fs を差し替えるが、existsSync は uploads 以外は実挙動にパススルー
 *     （bcrypt のネイティブモジュールロードが existsSync を使うため）
 *   - supertest で PUT /api/auth/profile のエンドポイント統合テストを行う
 *   - DB は better-sqlite3 インメモリを使用する
 */

import path from 'path';
import request from 'supertest';

// DB をインメモリに差し替え（jest.mock は巻き上げされるため先頭に置く）
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

// fs をモック — existsSync は bcrypt のバイナリ探索に使われるため uploads 以外はパススルー
jest.mock('fs', () => {
  const actual = jest.requireActual<typeof import('fs')>('fs');
  return {
    ...actual,
    mkdirSync: jest.fn(),
    writeFileSync: jest.fn(),
    existsSync: jest.fn().mockImplementation((p: unknown) => {
      if (typeof p === 'string' && p.includes('uploads')) return false;
      return actual.existsSync(p as fs.PathLike);
    }),
  };
});

import * as fs from 'fs';
import { saveAvatar } from '../services/avatarStorageService';
import { createApp } from '../app';
import { register } from '../services/authService';
import { generateToken } from '../middleware/auth';

describe('AvatarStorageService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (fs.existsSync as jest.Mock).mockImplementation((p: unknown) => {
      const actual = jest.requireActual<typeof import('fs')>('fs');
      if (typeof p === 'string' && p.includes('uploads')) return false;
      return actual.existsSync(p as fs.PathLike);
    });
  });

  describe('ローカルストレージへの保存', () => {
    it('base64 データ URL を受け取ってファイルを保存し、公開 URL を返す', () => {
      const base64 = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAE=';
      const result = saveAvatar(1, base64);

      expect(fs.writeFileSync).toHaveBeenCalledTimes(1);
      expect(result).toMatch(/^\/uploads\//);
    });

    it('base64 でない通常 URL はそのまま返す（再保存しない）', () => {
      const url = 'https://example.com/avatar.jpg';
      const result = saveAvatar(1, url);

      expect(fs.writeFileSync).not.toHaveBeenCalled();
      expect(result).toBe(url);
    });

    it('保存されたファイルパスが uploads ディレクトリ配下になる', () => {
      const base64 = 'data:image/jpeg;base64,/9j/4AAQ=';
      saveAvatar(2, base64);

      const [filePath] = (fs.writeFileSync as jest.Mock).mock.calls[0] as [string, Buffer];
      expect(filePath).toContain(path.join('uploads'));
    });
  });

  describe('プロフィール更新エンドポイントとの統合', () => {
    it('PUT /api/auth/profile に base64 の avatarUrl を送るとファイル保存後の URL が返る', async () => {
      const user = await register('avataruser2', 'avataruser2@example.com', 'password123');
      const token = generateToken(user.id, user.username);
      const app = createApp();
      const base64 = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAE=';

      const res = await request(app)
        .patch('/api/auth/profile')
        .set('Cookie', `token=${token}`)
        .send({ avatarUrl: base64 });

      expect(res.status).toBe(200);
      expect(res.body.user.avatarUrl).toMatch(/^\/uploads\//);
    });
  });
});
