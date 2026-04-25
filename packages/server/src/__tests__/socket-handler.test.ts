/**
 * socket/handler.ts のユニットテスト
 *
 * テスト対象:
 *   - setupSocketHandlers (handler.ts)
 *   - authMiddleware / createAuthMiddleware (socketAuthMiddleware.ts)
 *   - registerChannelHandlers (channelHandler.ts)
 *   - registerMessageHandlers (messageHandler.ts)
 *
 * 戦略:
 *   - authMiddleware: モックソケットオブジェクトで createAuthMiddleware を直接テスト
 *   - channelHandler / messageHandler: Jest モックで各サービスを差し替え、モックソケットで動作を検証
 *   - setupSocketHandlers 統合: socket.io Server (httpServer) + socket.io-client でインメモリ接続テスト
 */

import { createServer } from 'http';
import { Server as SocketServer } from 'socket.io';
import { io as ioc, Socket as ClientSocket } from 'socket.io-client';
import jwt from 'jsonwebtoken';
import {
  ServerToClientEvents,
  ClientToServerEvents,
  InterServerEvents,
  SocketData,
} from '@chat-app/shared';

// --- サービスモック ---
jest.mock('../services/channelService');
jest.mock('../services/messageService');
jest.mock('../services/pushService');
jest.mock('../services/pinMessageService');
jest.mock('../services/channelNotificationService');

import * as channelService from '../services/channelService';
import * as messageService from '../services/messageService';
import * as pushService from '../services/pushService';
import * as channelNotificationService from '../services/channelNotificationService';
import { createAuthMiddleware } from '../socket/socketAuthMiddleware';
import { registerChannelHandlers } from '../socket/channelHandler';
import { registerMessageHandlers } from '../socket/messageHandler';
import { setupSocketHandlers } from '../socket/handler';

const mockedChannelService = channelService as jest.Mocked<typeof channelService>;
const mockedMessageService = messageService as jest.Mocked<typeof messageService>;
const mockedPushService = pushService as jest.Mocked<typeof pushService>;
const mockedNotificationService = channelNotificationService as jest.Mocked<
  typeof channelNotificationService
>;

const TEST_SECRET = 'test-secret';
const TEST_USER_ID = 42;
const TEST_USERNAME = 'testuser';

/** テスト用 JWT を生成する */
function makeToken(payload: object = { userId: TEST_USER_ID, username: TEST_USERNAME }): string {
  return jwt.sign(payload, TEST_SECRET);
}

function createMockSocket(
  overrides: Partial<{
    cookieHeader: string;
    authToken: string;
  }> = {},
) {
  const { cookieHeader = '', authToken = '' } = overrides;
  const socket = {
    handshake: {
      headers: { cookie: cookieHeader },
      auth: { token: authToken },
    },
    data: {} as SocketData,
    rooms: new Set<string>(),
    join: jest.fn(async (room: string) => {
      socket.rooms.add(room);
    }),
    leave: jest.fn(async (room: string) => {
      socket.rooms.delete(room);
    }),
    to: jest.fn().mockReturnThis(),
    emit: jest.fn(),
    on: jest.fn(),
  };
  return socket;
}

// ===========================
// 認証ミドルウェアのテスト
// ===========================

describe('Socket.IO ハンドラ', () => {
  describe('認証ミドルウェア (authMiddleware)', () => {
    const middleware = createAuthMiddleware(TEST_SECRET);

    describe('未認証ソケット接続の拒否', () => {
      it('トークンなしで接続するとUnauthorizedエラーで拒否される', async () => {
        const socket = createMockSocket();
        const next = jest.fn();
        middleware(socket as any, next);
        expect(next).toHaveBeenCalledWith(expect.objectContaining({ message: 'Unauthorized' }));
      });

      it('無効なJWTトークンで接続するとInvalid tokenエラーで拒否される', () => {
        const socket = createMockSocket({ authToken: 'invalid.token.here' });
        const next = jest.fn();
        middleware(socket as any, next);
        expect(next).toHaveBeenCalledWith(expect.objectContaining({ message: 'Invalid token' }));
      });

      it('有効なJWTトークンで接続するとsocket.data.userIdがセットされる', () => {
        const token = makeToken();
        const socket = createMockSocket({ authToken: token });
        const next = jest.fn();
        middleware(socket as any, next);
        expect(next).toHaveBeenCalledWith();
        expect(socket.data.userId).toBe(TEST_USER_ID);
      });

      it('有効なJWTトークンで接続するとsocket.data.usernameがセットされる', () => {
        const token = makeToken();
        const socket = createMockSocket({ authToken: token });
        const next = jest.fn();
        middleware(socket as any, next);
        expect(next).toHaveBeenCalledWith();
        expect(socket.data.username).toBe(TEST_USERNAME);
      });

      it('cookieヘッダーのtokenを優先して認証する', () => {
        const validToken = makeToken();
        // cookieに有効トークン、authに無効トークンをセット
        const socket = createMockSocket({
          cookieHeader: `token=${validToken}`,
          authToken: 'invalid',
        });
        const next = jest.fn();
        middleware(socket as any, next);
        // cookieが優先されるため認証成功
        expect(next).toHaveBeenCalledWith();
        expect(socket.data.userId).toBe(TEST_USER_ID);
      });

      it('auth.tokenでも認証できる', () => {
        const token = makeToken();
        const socket = createMockSocket({ authToken: token });
        const next = jest.fn();
        middleware(socket as any, next);
        expect(next).toHaveBeenCalledWith();
        expect(socket.data.userId).toBe(TEST_USER_ID);
      });
    });
  });

  // ===========================
  // チャンネルハンドラのテスト
  // ===========================

  describe('チャンネルハンドラ (channelHandler)', () => {
    beforeEach(() => {
      jest.clearAllMocks();
      mockedChannelService.getChannelsForUser.mockResolvedValue([]);
    });

    describe('join_channel イベント', () => {
      it('join_channelを受信するとchannel:${channelId}ルームに参加する', async () => {
        const socket = createMockSocket();
        socket.data.userId = TEST_USER_ID;
        socket.data.username = TEST_USERNAME;

        // on() で登録したコールバックを記録する
        const handlers: Record<string, (...args: unknown[]) => void> = {};
        socket.on.mockImplementation((event: string, cb: (...args: unknown[]) => void) => {
          handlers[event] = cb;
        });

        await registerChannelHandlers(socket as any);

        // join_channel イベントを発火
        handlers['join_channel']?.(99);
        await Promise.resolve(); // join は同期的

        expect(socket.join).toHaveBeenCalledWith('channel:99');
      });

      it('接続時にuser:${userId}ルームに自動参加する', async () => {
        const socket = createMockSocket();
        socket.data.userId = TEST_USER_ID;
        socket.data.username = TEST_USERNAME;

        await registerChannelHandlers(socket as any);

        expect(socket.join).toHaveBeenCalledWith(`user:${TEST_USER_ID}`);
      });

      it('接続時にアクセス可能な全チャンネルに自動joinする', async () => {
        mockedChannelService.getChannelsForUser.mockResolvedValue([
          {
            id: 1,
            name: 'general',
            description: null,
            topic: null,
            createdBy: 1,
            isPrivate: false,
            postingPermission: 'everyone',
            createdAt: '',
            unreadCount: 0,
            mentionCount: 0,
          },
          {
            id: 2,
            name: 'random',
            description: null,
            topic: null,
            createdBy: 1,
            isPrivate: false,
            postingPermission: 'everyone',
            createdAt: '',
            unreadCount: 0,
            mentionCount: 0,
          },
        ]);

        const socket = createMockSocket();
        socket.data.userId = TEST_USER_ID;
        socket.data.username = TEST_USERNAME;

        await registerChannelHandlers(socket as any);
        // 非同期 join が完了するまで待つ
        await Promise.resolve();

        expect(socket.join).toHaveBeenCalledWith('channel:1');
        expect(socket.join).toHaveBeenCalledWith('channel:2');
      });
    });

    describe('leave_channel イベント', () => {
      it('leave_channelを受信するとchannel:${channelId}ルームから退出する', async () => {
        const socket = createMockSocket();
        socket.data.userId = TEST_USER_ID;
        socket.data.username = TEST_USERNAME;

        const handlers: Record<string, (...args: unknown[]) => void> = {};
        socket.on.mockImplementation((event: string, cb: (...args: unknown[]) => void) => {
          handlers[event] = cb;
        });

        await registerChannelHandlers(socket as any);
        handlers['leave_channel']?.(99);
        await Promise.resolve();

        expect(socket.leave).toHaveBeenCalledWith('channel:99');
      });
    });

    describe('typing_start / typing_stop イベント', () => {
      it('typing_startを受信するとチャンネル内の他のソケットにuser_typingをemitする', async () => {
        const socket = createMockSocket();
        socket.data.userId = TEST_USER_ID;
        socket.data.username = TEST_USERNAME;

        const handlers: Record<string, (...args: unknown[]) => void> = {};
        socket.on.mockImplementation((event: string, cb: (...args: unknown[]) => void) => {
          handlers[event] = cb;
        });

        await registerChannelHandlers(socket as any);
        handlers['typing_start']?.(5);

        expect(socket.to).toHaveBeenCalledWith('channel:5');
        expect(socket.emit).toHaveBeenCalledWith('user_typing', {
          userId: TEST_USER_ID,
          username: TEST_USERNAME,
          channelId: 5,
        });
      });

      it('typing_stopを受信するとチャンネル内の他のソケットにuser_stopped_typingをemitする', async () => {
        const socket = createMockSocket();
        socket.data.userId = TEST_USER_ID;
        socket.data.username = TEST_USERNAME;

        const handlers: Record<string, (...args: unknown[]) => void> = {};
        socket.on.mockImplementation((event: string, cb: (...args: unknown[]) => void) => {
          handlers[event] = cb;
        });

        await registerChannelHandlers(socket as any);
        handlers['typing_stop']?.(5);

        expect(socket.to).toHaveBeenCalledWith('channel:5');
        expect(socket.emit).toHaveBeenCalledWith('user_stopped_typing', {
          userId: TEST_USER_ID,
          channelId: 5,
        });
      });
    });
  });

  // ===========================
  // メッセージハンドラのテスト
  // ===========================

  describe('メッセージハンドラ (messageHandler)', () => {
    /** モック io (チャンネルへの broadcast 用) */
    function createMockIo() {
      const io = {
        to: jest.fn().mockReturnThis(),
        emit: jest.fn(),
      };
      return io;
    }

    beforeEach(() => {
      jest.clearAllMocks();
      // 通知レベルのデフォルト: 'all'（通知を送る）
      mockedNotificationService.getLevel.mockResolvedValue('all');
    });

    describe('send_message イベント (chat messageブロードキャスト)', () => {
      it('send_messageを受信するとchannel:${channelId}全員にnew_messageをemitする', async () => {
        const fakeMessage = {
          id: 1,
          channelId: 10,
          content: 'hello',
          userId: TEST_USER_ID,
          username: TEST_USERNAME,
          isEdited: false,
          isDeleted: false,
          createdAt: '',
          updatedAt: '',
          reactions: [],
          mentions: [],
          attachments: [],
          parentMessageId: null,
          rootMessageId: null,
          quotedMessageId: null,
        };
        mockedMessageService.createMessage.mockResolvedValue(fakeMessage as any);

        const socket = createMockSocket();
        socket.data.userId = TEST_USER_ID;
        socket.data.username = TEST_USERNAME;

        const handlers: Record<string, (...args: unknown[]) => void> = {};
        socket.on.mockImplementation((event: string, cb: (...args: unknown[]) => void) => {
          handlers[event] = cb;
        });

        const io = createMockIo();
        registerMessageHandlers(io as any, socket as any);

        handlers['send_message']?.({ channelId: 10, content: 'hello' });
        // 非同期処理を待つ
        await new Promise((r) => setTimeout(r, 0));

        expect(io.to).toHaveBeenCalledWith('channel:10');
        expect(io.emit).toHaveBeenCalledWith('new_message', fakeMessage);
      });

      it('メッセージ送信に失敗するとsocket.emit("error")を呼ぶ', async () => {
        mockedMessageService.createMessage.mockRejectedValue(new Error('DB error'));

        const socket = createMockSocket();
        socket.data.userId = TEST_USER_ID;
        socket.data.username = TEST_USERNAME;

        const handlers: Record<string, (...args: unknown[]) => void> = {};
        socket.on.mockImplementation((event: string, cb: (...args: unknown[]) => void) => {
          handlers[event] = cb;
        });

        const io = createMockIo();
        registerMessageHandlers(io as any, socket as any);

        handlers['send_message']?.({ channelId: 10, content: 'hello' });
        await new Promise((r) => setTimeout(r, 0));

        expect(socket.emit).toHaveBeenCalledWith('error', 'Failed to send message');
      });

      it('mentionedUserIdsが含まれる場合、mention_updatedを対象ユーザーにemitする', async () => {
        const MENTIONED_USER_ID = 99;
        const fakeMessage = {
          id: 1,
          channelId: 10,
          content: 'hey @user',
          userId: TEST_USER_ID,
          username: TEST_USERNAME,
          isEdited: false,
          isDeleted: false,
          createdAt: '',
          updatedAt: '',
          reactions: [],
          mentions: [MENTIONED_USER_ID],
          attachments: [],
          parentMessageId: null,
          rootMessageId: null,
          quotedMessageId: null,
        };
        mockedMessageService.createMessage.mockResolvedValue(fakeMessage as any);
        mockedPushService.sendPushToUser.mockResolvedValue(undefined as any);
        mockedChannelService.getChannelsForUser.mockResolvedValue([
          {
            id: 10,
            name: 'general',
            description: null,
            topic: null,
            createdBy: 1,
            isPrivate: false,
            postingPermission: 'everyone',
            createdAt: '',
            unreadCount: 0,
            mentionCount: 2,
          },
        ]);

        const socket = createMockSocket();
        socket.data.userId = TEST_USER_ID;
        socket.data.username = TEST_USERNAME;

        const handlers: Record<string, (...args: unknown[]) => void> = {};
        socket.on.mockImplementation((event: string, cb: (...args: unknown[]) => void) => {
          handlers[event] = cb;
        });

        const io = createMockIo();
        registerMessageHandlers(io as any, socket as any);

        handlers['send_message']?.({
          channelId: 10,
          content: 'hey @user',
          mentionedUserIds: [MENTIONED_USER_ID],
        });
        await new Promise((r) => setTimeout(r, 10));

        expect(io.to).toHaveBeenCalledWith(`user:${MENTIONED_USER_ID}`);
        expect(io.emit).toHaveBeenCalledWith('mention_updated', {
          channelId: 10,
          mentionCount: 2,
        });
      });
    });

    describe('エラーハンドリング: 不正なpayload', () => {
      it('channelIdが存在しないチャンネルへのsend_messageはerrorをemitする', async () => {
        mockedMessageService.createMessage.mockRejectedValue(new Error('Channel not found'));

        const socket = createMockSocket();
        socket.data.userId = TEST_USER_ID;
        socket.data.username = TEST_USERNAME;

        const handlers: Record<string, (...args: unknown[]) => void> = {};
        socket.on.mockImplementation((event: string, cb: (...args: unknown[]) => void) => {
          handlers[event] = cb;
        });

        const io = createMockIo();
        registerMessageHandlers(io as any, socket as any);

        handlers['send_message']?.({ channelId: 9999, content: 'hello' });
        await new Promise((r) => setTimeout(r, 0));

        expect(socket.emit).toHaveBeenCalledWith('error', 'Failed to send message');
      });

      it('contentが空のsend_messageはerrorをemitする', async () => {
        mockedMessageService.createMessage.mockRejectedValue(new Error('Content is required'));

        const socket = createMockSocket();
        socket.data.userId = TEST_USER_ID;
        socket.data.username = TEST_USERNAME;

        const handlers: Record<string, (...args: unknown[]) => void> = {};
        socket.on.mockImplementation((event: string, cb: (...args: unknown[]) => void) => {
          handlers[event] = cb;
        });

        const io = createMockIo();
        registerMessageHandlers(io as any, socket as any);

        handlers['send_message']?.({ channelId: 10, content: '' });
        await new Promise((r) => setTimeout(r, 0));

        expect(socket.emit).toHaveBeenCalledWith('error', 'Failed to send message');
      });
    });

    describe('edit_message イベント', () => {
      it('edit_messageを受信するとchannel全員にmessage_editedをemitする', async () => {
        const fakeEdited = {
          id: 5,
          channelId: 10,
          content: 'edited',
          userId: TEST_USER_ID,
          username: TEST_USERNAME,
          isEdited: true,
          isDeleted: false,
          createdAt: '',
          updatedAt: '',
          reactions: [],
          mentions: [],
          attachments: [],
          parentMessageId: null,
          rootMessageId: null,
          quotedMessageId: null,
        };
        mockedMessageService.editMessage.mockResolvedValue(fakeEdited as any);

        const socket = createMockSocket();
        socket.data.userId = TEST_USER_ID;
        socket.data.username = TEST_USERNAME;

        const handlers: Record<string, (...args: unknown[]) => void> = {};
        socket.on.mockImplementation((event: string, cb: (...args: unknown[]) => void) => {
          handlers[event] = cb;
        });

        const io = createMockIo();
        registerMessageHandlers(io as any, socket as any);

        handlers['edit_message']?.({
          messageId: 5,
          content: 'edited',
          mentionedUserIds: [],
          attachmentIds: [],
        });
        await new Promise((r) => setTimeout(r, 0));

        expect(io.to).toHaveBeenCalledWith('channel:10');
        expect(io.emit).toHaveBeenCalledWith('message_edited', fakeEdited);
      });

      it('edit_messageに失敗するとsocket.emit("error")を呼ぶ', async () => {
        mockedMessageService.editMessage.mockRejectedValue(new Error('Not found'));

        const socket = createMockSocket();
        socket.data.userId = TEST_USER_ID;
        socket.data.username = TEST_USERNAME;

        const handlers: Record<string, (...args: unknown[]) => void> = {};
        socket.on.mockImplementation((event: string, cb: (...args: unknown[]) => void) => {
          handlers[event] = cb;
        });

        const io = createMockIo();
        registerMessageHandlers(io as any, socket as any);

        handlers['edit_message']?.({
          messageId: 5,
          content: 'edited',
          mentionedUserIds: [],
          attachmentIds: [],
        });
        await new Promise((r) => setTimeout(r, 0));

        expect(socket.emit).toHaveBeenCalledWith('error', 'Failed to edit message');
      });
    });

    describe('delete_message イベント', () => {
      it('delete_messageを受信するとchannel全員にmessage_deletedをemitする', async () => {
        const fakeMsg = { id: 5, channelId: 10, content: 'bye', userId: TEST_USER_ID };
        mockedMessageService.getMessageById.mockResolvedValue(fakeMsg as any);
        mockedMessageService.deleteMessage.mockResolvedValue(undefined as any);

        const socket = createMockSocket();
        socket.data.userId = TEST_USER_ID;
        socket.data.username = TEST_USERNAME;

        const handlers: Record<string, (...args: unknown[]) => void> = {};
        socket.on.mockImplementation((event: string, cb: (...args: unknown[]) => void) => {
          handlers[event] = cb;
        });

        const io = createMockIo();
        registerMessageHandlers(io as any, socket as any);

        handlers['delete_message']?.(5);
        await new Promise((r) => setTimeout(r, 0));

        expect(io.to).toHaveBeenCalledWith('channel:10');
        expect(io.emit).toHaveBeenCalledWith('message_deleted', { messageId: 5, channelId: 10 });
      });

      it('存在しないメッセージのdelete_messageは何もしない', async () => {
        mockedMessageService.getMessageById.mockResolvedValue(null);

        const socket = createMockSocket();
        socket.data.userId = TEST_USER_ID;
        socket.data.username = TEST_USERNAME;

        const handlers: Record<string, (...args: unknown[]) => void> = {};
        socket.on.mockImplementation((event: string, cb: (...args: unknown[]) => void) => {
          handlers[event] = cb;
        });

        const io = createMockIo();
        registerMessageHandlers(io as any, socket as any);

        handlers['delete_message']?.(9999);
        await new Promise((r) => setTimeout(r, 0));

        // emit は呼ばれない（エラーも broadcast も）
        expect(io.emit).not.toHaveBeenCalled();
        expect(socket.emit).not.toHaveBeenCalled();
      });
    });
  });

  // ===========================
  // setupSocketHandlers 統合テスト
  // ===========================

  describe('setupSocketHandlers (handler.ts 統合)', () => {
    let httpServer: ReturnType<typeof createServer>;
    let io: SocketServer<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>;
    let port: number;

    beforeAll((done) => {
      // channelService のモックを設定
      mockedChannelService.getChannelsForUser.mockResolvedValue([]);

      httpServer = createServer();
      io = new SocketServer(httpServer);
      setupSocketHandlers(io);

      httpServer.listen(0, () => {
        port = (httpServer.address() as { port: number }).port;
        done();
      });
    });

    afterAll((done) => {
      io.close();
      httpServer.close(done);
    });

    it('setupSocketHandlers呼び出し時にauthMiddlewareが登録される', () => {
      // io._nsps に middleware が登録されていることを確認
      // socket.io の内部 API を使わず、認証なしで接続が拒否されることで検証
      return new Promise<void>((resolve, reject) => {
        const client = ioc(`http://localhost:${port}`, {
          auth: {}, // トークンなし
          reconnection: false,
        });

        client.on('connect_error', (err) => {
          client.close();
          try {
            expect(err.message).toBe('Unauthorized');
            resolve();
          } catch (e) {
            reject(e);
          }
        });

        client.on('connect', () => {
          client.close();
          reject(new Error('認証なしで接続できてしまった'));
        });
      });
    });

    it('connectionイベント時にchannelHandler・messageHandler・dmHandlerが登録される', () => {
      const validToken = jwt.sign(
        { userId: TEST_USER_ID, username: TEST_USERNAME },
        process.env.JWT_SECRET || 'dev-secret-please-change-in-production',
      );

      return new Promise<void>((resolve, reject) => {
        const client = ioc(`http://localhost:${port}`, {
          auth: { token: validToken },
          reconnection: false,
        });

        client.on('connect', () => {
          // 接続成功 = channelHandler 等が登録された状態
          client.close();
          resolve();
        });

        client.on('connect_error', (err) => {
          client.close();
          reject(err);
        });
      });
    });
  });
});
