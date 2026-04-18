import jwt from 'jsonwebtoken';
import { Server as SocketServer } from 'socket.io';
import {
  ServerToClientEvents,
  ClientToServerEvents,
  InterServerEvents,
  SocketData,
} from '@chat-app/shared';

type ChatServer = SocketServer<
  ClientToServerEvents,
  ServerToClientEvents,
  InterServerEvents,
  SocketData
>;

type SocketMiddleware = Parameters<ChatServer['use']>[0];

const DEFAULT_JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-please-change-in-production';

/**
 * JWT認証ミドルウェアを生成する。
 * cookieヘッダーまたはauth.tokenからJWTを取得し、検証する。
 * @param secret JWTシークレット（省略時は環境変数から取得）
 */
export function createAuthMiddleware(secret: string = DEFAULT_JWT_SECRET): SocketMiddleware {
  return (socket, next) => {
    const cookieHeader = socket.handshake.headers.cookie ?? '';
    const tokenMatch = cookieHeader.match(/(?:^|;\s*)token=([^;]+)/);
    const token = tokenMatch?.[1] ?? (socket.handshake.auth as { token?: string }).token;

    if (!token) {
      next(new Error('Unauthorized'));
      return;
    }

    try {
      const payload = jwt.verify(token, secret) as { userId: number; username: string };
      socket.data.userId = payload.userId;
      socket.data.username = payload.username;
      next();
    } catch {
      next(new Error('Invalid token'));
    }
  };
}

/**
 * デフォルトのJWT認証ミドルウェア（環境変数のJWT_SECRETを使用）
 */
export const authMiddleware = createAuthMiddleware();
