/**
 * サーバー側インテグレーションテスト共通ヘルパー
 *
 * jest.mock は各テストファイルで宣言する必要があるため共通化できないが、
 * HTTP ヘルパー関数群はここに集約してボイラープレートを削減する。
 */

import request from 'supertest';
import type { Express } from 'express';
import { generateToken } from '../../middleware/auth';
import { execute } from '../../db/database';

/**
 * ユーザーを登録し、generateToken で生成したトークン文字列を返す
 * Cookie に `token=XXX` 形式でセットして使う
 */
export async function registerUser(
  app: Express,
  username: string,
  email: string,
  password = 'password123',
): Promise<{ token: string; userId: number }> {
  const res = await request(app).post('/api/auth/register').send({ username, email, password });
  // セットアップ失敗時に undefined が伝播して原因不明の 404 等になるのを防ぐため、明示的に失敗させる
  const user = (res.body as { user?: { id: number } }).user;
  if (!user) {
    throw new Error(`registerUser failed: status=${res.status} body=${JSON.stringify(res.body)}`);
  }
  const userId = user.id;
  return { token: generateToken(userId, username), userId };
}

/**
 * ユーザーを登録し、レスポンスの Set-Cookie をそのまま返す
 * 実際のログインフローを経由したい場合に使う
 */
export async function registerAndGetCookie(
  app: Express,
  username: string,
  email: string,
  password = 'password123',
): Promise<{ cookie: string; userId: number }> {
  const res = await request(app).post('/api/auth/register').send({ username, email, password });
  const setCookie = res.headers['set-cookie'] as string[] | string;
  const cookie = Array.isArray(setCookie) ? setCookie[0] : setCookie;
  const userId = (res.body as { user: { id: number } }).user.id;
  return { cookie, userId };
}

/**
 * チャンネルを作成してチャンネル ID を返す
 */
export async function createChannelReq(app: Express, token: string, name: string): Promise<number> {
  const res = await request(app)
    .post('/api/channels')
    .set('Cookie', `token=${token}`)
    .send({ name });
  const channel = (res.body as { channel?: { id: number } }).channel;
  if (!channel) {
    throw new Error(
      `createChannelReq failed: status=${res.status} body=${JSON.stringify(res.body)}`,
    );
  }
  return channel.id;
}

/**
 * DB にメッセージを直接 INSERT してメッセージ ID を返す
 * ソケット経由の作成をバイパスして HTTP テスト用データを準備する
 */
export async function insertMessage(
  channelId: number,
  userId: number,
  content: string,
): Promise<number> {
  const result = await execute(
    'INSERT INTO messages (channel_id, user_id, content) VALUES ($1, $2, $3) RETURNING id',
    [channelId, userId, content],
  );
  return result.rows[0].id as number;
}
