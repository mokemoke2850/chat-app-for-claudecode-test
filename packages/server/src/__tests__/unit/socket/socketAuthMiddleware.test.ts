import jwt from 'jsonwebtoken';

// socketAuthMiddlewareをモジュールとして直接テスト可能にするため
// テスト対象の関数をインポートする
import { createAuthMiddleware } from '../../../socket/socketAuthMiddleware';

const JWT_SECRET = 'test-secret';

function makeSocket(overrides: {
  cookie?: string;
  authToken?: string;
}): { handshake: { headers: { cookie: string }; auth: { token?: string } }; data: { userId?: number; username?: string } } {
  return {
    handshake: {
      headers: { cookie: overrides.cookie ?? '' },
      auth: { token: overrides.authToken },
    },
    data: {},
  };
}

describe('socketAuthMiddleware', () => {
  const middleware = createAuthMiddleware(JWT_SECRET);

  describe('cookieヘッダーからトークンを取得する場合', () => {
    it('有効なJWTトークンがcookieに含まれるとき、socket.dataにuserId/usernameが設定されnext()が呼ばれること', () => {
      const token = jwt.sign({ userId: 1, username: 'alice' }, JWT_SECRET);
      const socket = makeSocket({ cookie: `token=${token}` });
      const next = jest.fn();

      middleware(socket as never, next);

      expect(next).toHaveBeenCalledWith();
      expect(socket.data.userId).toBe(1);
      expect(socket.data.username).toBe('alice');
    });

    it('cookieに複数のエントリがある場合でも、tokenを正しく抽出できること', () => {
      const token = jwt.sign({ userId: 2, username: 'bob' }, JWT_SECRET);
      const socket = makeSocket({ cookie: `session=xyz; token=${token}; other=abc` });
      const next = jest.fn();

      middleware(socket as never, next);

      expect(next).toHaveBeenCalledWith();
      expect(socket.data.userId).toBe(2);
      expect(socket.data.username).toBe('bob');
    });
  });

  describe('auth.tokenからトークンを取得する場合', () => {
    it('cookieが空でauth.tokenに有効なJWTがあるとき、認証が成功しnext()が呼ばれること', () => {
      const token = jwt.sign({ userId: 3, username: 'charlie' }, JWT_SECRET);
      const socket = makeSocket({ cookie: '', authToken: token });
      const next = jest.fn();

      middleware(socket as never, next);

      expect(next).toHaveBeenCalledWith();
      expect(socket.data.userId).toBe(3);
      expect(socket.data.username).toBe('charlie');
    });
  });

  describe('トークンが存在しない場合', () => {
    it('cookieもauth.tokenも存在しないとき、next(new Error("Unauthorized"))が呼ばれること', () => {
      const socket = makeSocket({ cookie: '', authToken: undefined });
      const next = jest.fn();

      middleware(socket as never, next);

      expect(next).toHaveBeenCalledWith(expect.objectContaining({ message: 'Unauthorized' }));
      expect(socket.data.userId).toBeUndefined();
    });
  });

  describe('トークンが無効な場合', () => {
    it('JWTの検証に失敗したとき、next(new Error("Invalid token"))が呼ばれること', () => {
      const socket = makeSocket({ cookie: 'token=not-a-jwt' });
      const next = jest.fn();

      middleware(socket as never, next);

      expect(next).toHaveBeenCalledWith(expect.objectContaining({ message: 'Invalid token' }));
    });

    it('JWTの署名が不正なとき、next(new Error("Invalid token"))が呼ばれること', () => {
      const token = jwt.sign({ userId: 1, username: 'alice' }, 'wrong-secret');
      const socket = makeSocket({ cookie: `token=${token}` });
      const next = jest.fn();

      middleware(socket as never, next);

      expect(next).toHaveBeenCalledWith(expect.objectContaining({ message: 'Invalid token' }));
    });

    it('JWTが期限切れのとき、next(new Error("Invalid token"))が呼ばれること', () => {
      const token = jwt.sign({ userId: 1, username: 'alice' }, JWT_SECRET, { expiresIn: -1 });
      const socket = makeSocket({ cookie: `token=${token}` });
      const next = jest.fn();

      middleware(socket as never, next);

      expect(next).toHaveBeenCalledWith(expect.objectContaining({ message: 'Invalid token' }));
    });
  });
});
