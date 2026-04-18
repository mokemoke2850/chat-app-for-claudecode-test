import { registerChannelHandlers } from '../../../socket/channelHandler';

jest.mock('../../../services/channelService');

import * as channelService from '../../../services/channelService';

const mockedChannelService = channelService as jest.Mocked<typeof channelService>;

function makeSocket(userId = 1, username = 'alice') {
  const joinFn = jest.fn().mockResolvedValue(undefined);
  const leaveFn = jest.fn().mockResolvedValue(undefined);
  const toFn = jest.fn().mockReturnThis();
  const emitFn = jest.fn();
  const handlers: Record<string, (...args: unknown[]) => void> = {};
  return {
    data: { userId, username },
    join: joinFn,
    leave: leaveFn,
    to: toFn,
    emit: emitFn,
    on: jest.fn((event: string, handler: (...args: unknown[]) => void) => {
      handlers[event] = handler;
    }),
    _handlers: handlers,
    _join: joinFn,
    _leave: leaveFn,
    _to: toFn,
    _emit: emitFn,
  };
}

async function triggerHandler(socket: ReturnType<typeof makeSocket>, event: string, ...args: unknown[]) {
  const handler = socket._handlers[event];
  if (!handler) throw new Error(`Handler for ${event} not registered`);
  handler(...args);
  await new Promise(resolve => setImmediate(resolve));
}

describe('channelHandler', () => {
  let socket: ReturnType<typeof makeSocket>;

  beforeEach(() => {
    jest.clearAllMocks();
    socket = makeSocket();
  });

  describe('接続時の自動join', () => {
    it('接続時にユーザーがアクセス可能な全チャンネルへ自動joinすること', async () => {
      mockedChannelService.getChannelsForUser.mockResolvedValue([
        { id: 1 } as never,
        { id: 2 } as never,
        { id: 3 } as never,
      ]);

      await registerChannelHandlers(socket as never);
      await new Promise(resolve => setImmediate(resolve));

      expect(socket._join).toHaveBeenCalledWith('channel:1');
      expect(socket._join).toHaveBeenCalledWith('channel:2');
      expect(socket._join).toHaveBeenCalledWith('channel:3');
    });

    it('channelService.getChannelsForUserが失敗してもエラーを無視して接続が継続すること', async () => {
      mockedChannelService.getChannelsForUser.mockRejectedValue(new Error('DB error'));

      // エラーがスローされないことを確認
      await expect(registerChannelHandlers(socket as never)).resolves.not.toThrow();
    });

    it('接続時にuser:${userId}ルームへjoinすること', async () => {
      mockedChannelService.getChannelsForUser.mockResolvedValue([]);

      await registerChannelHandlers(socket as never);

      expect(socket._join).toHaveBeenCalledWith('user:1');
    });
  });

  describe('join_channel', () => {
    it('channelIdを受け取ったとき、channel:${channelId}ルームにjoinすること', async () => {
      mockedChannelService.getChannelsForUser.mockResolvedValue([]);
      await registerChannelHandlers(socket as never);

      await triggerHandler(socket, 'join_channel', 42);

      expect(socket._join).toHaveBeenCalledWith('channel:42');
    });
  });

  describe('leave_channel', () => {
    it('channelIdを受け取ったとき、channel:${channelId}ルームからleaveすること', async () => {
      mockedChannelService.getChannelsForUser.mockResolvedValue([]);
      await registerChannelHandlers(socket as never);

      await triggerHandler(socket, 'leave_channel', 42);

      expect(socket._leave).toHaveBeenCalledWith('channel:42');
    });
  });

  describe('typing_start', () => {
    it('channelIdを受け取ったとき、そのチャンネルの他のユーザーにuser_typingイベントがemitされること', async () => {
      mockedChannelService.getChannelsForUser.mockResolvedValue([]);
      await registerChannelHandlers(socket as never);

      await triggerHandler(socket, 'typing_start', 10);

      expect(socket._to).toHaveBeenCalledWith('channel:10');
      expect(socket._emit).toHaveBeenCalledWith('user_typing', expect.objectContaining({ channelId: 10 }));
    });

    it('user_typingイベントにuserId, username, channelIdが含まれること', async () => {
      mockedChannelService.getChannelsForUser.mockResolvedValue([]);
      await registerChannelHandlers(socket as never);

      await triggerHandler(socket, 'typing_start', 10);

      expect(socket._emit).toHaveBeenCalledWith('user_typing', {
        userId: 1,
        username: 'alice',
        channelId: 10,
      });
    });
  });

  describe('typing_stop', () => {
    it('channelIdを受け取ったとき、そのチャンネルの他のユーザーにuser_stopped_typingイベントがemitされること', async () => {
      mockedChannelService.getChannelsForUser.mockResolvedValue([]);
      await registerChannelHandlers(socket as never);

      await triggerHandler(socket, 'typing_stop', 10);

      expect(socket._to).toHaveBeenCalledWith('channel:10');
      expect(socket._emit).toHaveBeenCalledWith('user_stopped_typing', expect.objectContaining({ channelId: 10 }));
    });

    it('user_stopped_typingイベントにuserId, channelIdが含まれること', async () => {
      mockedChannelService.getChannelsForUser.mockResolvedValue([]);
      await registerChannelHandlers(socket as never);

      await triggerHandler(socket, 'typing_stop', 10);

      expect(socket._emit).toHaveBeenCalledWith('user_stopped_typing', {
        userId: 1,
        channelId: 10,
      });
    });
  });
});
