import { registerDmHandlers } from '../../../socket/dmHandler';

jest.mock('../../../services/dmService');

import * as dmService from '../../../services/dmService';

const mockedDmService = dmService as jest.Mocked<typeof dmService>;

function makeIo() {
  const toFn = jest.fn().mockReturnThis();
  const emitFn = jest.fn().mockReturnThis();
  return {
    to: toFn,
    emit: emitFn,
    _to: toFn,
    _emit: emitFn,
  };
}

function makeSocket(userId = 1, username = 'alice') {
  const emitFn = jest.fn();
  const handlers: Record<string, (...args: unknown[]) => void> = {};
  return {
    data: { userId, username },
    emit: emitFn,
    on: jest.fn((event: string, handler: (...args: unknown[]) => void) => {
      handlers[event] = handler;
    }),
    _handlers: handlers,
    _emit: emitFn,
  };
}

async function triggerHandler(socket: ReturnType<typeof makeSocket>, event: string, ...args: unknown[]) {
  const handler = socket._handlers[event];
  if (!handler) throw new Error(`Handler for ${event} not registered`);
  handler(...args);
  await new Promise(resolve => setImmediate(resolve));
}

describe('dmHandler', () => {
  let io: ReturnType<typeof makeIo>;
  let socket: ReturnType<typeof makeSocket>;

  beforeEach(() => {
    jest.clearAllMocks();
    io = makeIo();
    socket = makeSocket();
    registerDmHandlers(io as never, socket as never);
  });

  describe('send_dm', () => {
    it('正常なデータを受け取ったとき、DMが送信され送信者にnew_dm_messageがemitされること', async () => {
      const message = { id: 1, conversationId: 10, content: 'hello', senderId: 1 };
      mockedDmService.sendMessage.mockResolvedValue(message as never);
      mockedDmService.getOtherUserId.mockResolvedValue(2);
      mockedDmService.getConversations.mockResolvedValue([
        { id: 10, unreadCount: 1 } as never,
      ]);

      await triggerHandler(socket, 'send_dm', { conversationId: 10, content: 'hello' });

      expect(mockedDmService.sendMessage).toHaveBeenCalledWith(10, 1, 'hello');
      expect(io.to).toHaveBeenCalledWith('user:1');
      expect(io.emit).toHaveBeenCalledWith('new_dm_message', message);
    });

    it('受信者（相手ユーザー）にもnew_dm_messageがemitされること', async () => {
      const message = { id: 1, conversationId: 10, content: 'hello', senderId: 1 };
      mockedDmService.sendMessage.mockResolvedValue(message as never);
      mockedDmService.getOtherUserId.mockResolvedValue(2);
      mockedDmService.getConversations.mockResolvedValue([
        { id: 10, unreadCount: 1 } as never,
      ]);

      await triggerHandler(socket, 'send_dm', { conversationId: 10, content: 'hello' });

      expect(io.to).toHaveBeenCalledWith('user:2');
      expect(io.emit).toHaveBeenCalledWith('new_dm_message', message);
    });

    it('受信者に未読件数を含むdm_notificationがemitされること', async () => {
      const message = { id: 1, conversationId: 10, content: 'hello', senderId: 1 };
      mockedDmService.sendMessage.mockResolvedValue(message as never);
      mockedDmService.getOtherUserId.mockResolvedValue(2);
      mockedDmService.getConversations.mockResolvedValue([
        { id: 10, unreadCount: 5 } as never,
      ]);

      await triggerHandler(socket, 'send_dm', { conversationId: 10, content: 'hello' });

      expect(io.to).toHaveBeenCalledWith('user:2');
      expect(io.emit).toHaveBeenCalledWith('dm_notification', {
        conversationId: 10,
        unreadCount: 5,
      });
    });

    it('getOtherUserIdがnullを返した場合、受信者へのemitは行われないこと', async () => {
      const message = { id: 1, conversationId: 10, content: 'hello', senderId: 1 };
      mockedDmService.sendMessage.mockResolvedValue(message as never);
      mockedDmService.getOtherUserId.mockResolvedValue(null);

      await triggerHandler(socket, 'send_dm', { conversationId: 10, content: 'hello' });

      // 送信者にはemitされる
      expect(io.to).toHaveBeenCalledWith('user:1');
      // 受信者へのgetConversationsは呼ばれない
      expect(mockedDmService.getConversations).not.toHaveBeenCalled();
    });

    it('dmService.sendMessageが失敗したとき、socket.emit("error", ...)が呼ばれること', async () => {
      mockedDmService.sendMessage.mockRejectedValue(new Error('DB error'));

      await triggerHandler(socket, 'send_dm', { conversationId: 10, content: 'hello' });

      expect(socket._emit).toHaveBeenCalledWith('error', 'Failed to send DM');
    });
  });

  describe('dm_typing_start', () => {
    it('conversationIdを受け取ったとき、相手ユーザーにdm_user_typingイベントがemitされること', async () => {
      mockedDmService.getOtherUserId.mockResolvedValue(2);

      await triggerHandler(socket, 'dm_typing_start', 10);

      expect(io.to).toHaveBeenCalledWith('user:2');
      expect(io.emit).toHaveBeenCalledWith('dm_user_typing', expect.objectContaining({ conversationId: 10 }));
    });

    it('dm_user_typingイベントにconversationId, userId, usernameが含まれること', async () => {
      mockedDmService.getOtherUserId.mockResolvedValue(2);

      await triggerHandler(socket, 'dm_typing_start', 10);

      expect(io.emit).toHaveBeenCalledWith('dm_user_typing', {
        conversationId: 10,
        userId: 1,
        username: 'alice',
      });
    });

    it('getOtherUserIdがnullを返した場合、emitが行われないこと', async () => {
      mockedDmService.getOtherUserId.mockResolvedValue(null);

      await triggerHandler(socket, 'dm_typing_start', 10);

      expect(io.emit).not.toHaveBeenCalled();
    });
  });

  describe('dm_typing_stop', () => {
    it('conversationIdを受け取ったとき、相手ユーザーにdm_user_stopped_typingイベントがemitされること', async () => {
      mockedDmService.getOtherUserId.mockResolvedValue(2);

      await triggerHandler(socket, 'dm_typing_stop', 10);

      expect(io.to).toHaveBeenCalledWith('user:2');
      expect(io.emit).toHaveBeenCalledWith('dm_user_stopped_typing', expect.objectContaining({ conversationId: 10 }));
    });

    it('dm_user_stopped_typingイベントにconversationId, userIdが含まれること', async () => {
      mockedDmService.getOtherUserId.mockResolvedValue(2);

      await triggerHandler(socket, 'dm_typing_stop', 10);

      expect(io.emit).toHaveBeenCalledWith('dm_user_stopped_typing', {
        conversationId: 10,
        userId: 1,
      });
    });

    it('getOtherUserIdがnullを返した場合、emitが行われないこと', async () => {
      mockedDmService.getOtherUserId.mockResolvedValue(null);

      await triggerHandler(socket, 'dm_typing_stop', 10);

      expect(io.emit).not.toHaveBeenCalled();
    });
  });
});
