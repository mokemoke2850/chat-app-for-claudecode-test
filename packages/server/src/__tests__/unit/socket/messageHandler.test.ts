import { registerMessageHandlers } from '../../../socket/messageHandler';

// サービスのモック
jest.mock('../../../services/messageService');
jest.mock('../../../services/pinMessageService');
jest.mock('../../../services/pushService');
jest.mock('../../../services/channelService');

import * as messageService from '../../../services/messageService';
import * as pinMessageService from '../../../services/pinMessageService';
import * as pushService from '../../../services/pushService';
import * as channelService from '../../../services/channelService';

const mockedMessageService = messageService as jest.Mocked<typeof messageService>;
const mockedPinMessageService = pinMessageService as jest.Mocked<typeof pinMessageService>;
const mockedPushService = pushService as jest.Mocked<typeof pushService>;
const mockedChannelService = channelService as jest.Mocked<typeof channelService>;

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

function getHandler(socket: ReturnType<typeof makeSocket>, event: string) {
  return (...args: unknown[]) => {
    const h = socket._handlers[event];
    if (!h) throw new Error(`Handler for ${event} not registered`);
    return h(...args);
  };
}

async function triggerHandler(socket: ReturnType<typeof makeSocket>, event: string, ...args: unknown[]) {
  const trigger = getHandler(socket, event);
  trigger(...args);
  // async handlerの完了を待つ
  await new Promise(resolve => setImmediate(resolve));
}

describe('messageHandler', () => {
  let io: ReturnType<typeof makeIo>;
  let socket: ReturnType<typeof makeSocket>;

  beforeEach(() => {
    jest.clearAllMocks();
    io = makeIo();
    socket = makeSocket();
    registerMessageHandlers(io as never, socket as never);
  });

  describe('send_message', () => {
    it('正常なデータを受け取ったとき、メッセージが作成されbroadcastされること', async () => {
      const message = { id: 1, channelId: 10, content: 'hello', userId: 1 };
      mockedMessageService.createMessage.mockResolvedValue(message as never);

      await triggerHandler(socket, 'send_message', { channelId: 10, content: 'hello' });

      expect(mockedMessageService.createMessage).toHaveBeenCalledWith(10, 1, 'hello', undefined, undefined, undefined);
      expect(io.to).toHaveBeenCalledWith('channel:10');
      expect(io.emit).toHaveBeenCalledWith('new_message', message);
    });

    it('メンション対象ユーザーが含まれるとき、プッシュ通知が送信されること', async () => {
      const message = { id: 1, channelId: 10, content: 'hi @bob', userId: 1 };
      mockedMessageService.createMessage.mockResolvedValue(message as never);
      mockedChannelService.getChannelsForUser.mockResolvedValue([
        { id: 10, mentionCount: 2 } as never,
      ]);
      mockedPushService.sendPushToUser.mockResolvedValue(undefined as never);

      await triggerHandler(socket, 'send_message', {
        channelId: 10,
        content: 'hi @bob',
        mentionedUserIds: [2],
      });

      expect(mockedPushService.sendPushToUser).toHaveBeenCalledWith(
        2,
        expect.objectContaining({ title: 'alice mentioned you' }),
      );
    });

    it('メンション対象ユーザーが含まれるとき、mention_updatedイベントがemitされること', async () => {
      const message = { id: 1, channelId: 10, content: 'hi @bob', userId: 1 };
      mockedMessageService.createMessage.mockResolvedValue(message as never);
      mockedChannelService.getChannelsForUser.mockResolvedValue([
        { id: 10, mentionCount: 3 } as never,
      ]);
      mockedPushService.sendPushToUser.mockResolvedValue(undefined as never);

      await triggerHandler(socket, 'send_message', {
        channelId: 10,
        content: 'hi @bob',
        mentionedUserIds: [2],
      });

      expect(io.to).toHaveBeenCalledWith('user:2');
      expect(io.emit).toHaveBeenCalledWith('mention_updated', { channelId: 10, mentionCount: 3 });
    });

    it('送信者自身へのメンションは通知しないこと', async () => {
      const message = { id: 1, channelId: 10, content: 'hi myself', userId: 1 };
      mockedMessageService.createMessage.mockResolvedValue(message as never);

      await triggerHandler(socket, 'send_message', {
        channelId: 10,
        content: 'hi myself',
        mentionedUserIds: [1], // 送信者自身 (userId=1)
      });

      expect(mockedPushService.sendPushToUser).not.toHaveBeenCalled();
    });

    it('添付ファイルIDやquotedMessageIdが指定されたとき、messageService.createMessageに渡されること', async () => {
      const message = { id: 1, channelId: 10, content: 'with attach', userId: 1 };
      mockedMessageService.createMessage.mockResolvedValue(message as never);

      await triggerHandler(socket, 'send_message', {
        channelId: 10,
        content: 'with attach',
        attachmentIds: [5, 6],
        quotedMessageId: 99,
      });

      expect(mockedMessageService.createMessage).toHaveBeenCalledWith(
        10, 1, 'with attach', undefined, [5, 6], 99,
      );
    });

    it('messageService.createMessageが失敗したとき、socket.emit("error", ...)が呼ばれること', async () => {
      mockedMessageService.createMessage.mockRejectedValue(new Error('DB error'));

      await triggerHandler(socket, 'send_message', { channelId: 10, content: 'hello' });

      expect(socket._emit).toHaveBeenCalledWith('error', 'Failed to send message');
    });
  });

  describe('edit_message', () => {
    it('正常なデータを受け取ったとき、メッセージが更新されchannel全体にbroadcastされること', async () => {
      const message = { id: 1, channelId: 10, content: 'edited', userId: 1 };
      mockedMessageService.editMessage.mockResolvedValue(message as never);

      await triggerHandler(socket, 'edit_message', {
        messageId: 1,
        content: 'edited',
        mentionedUserIds: [],
        attachmentIds: [],
      });

      expect(mockedMessageService.editMessage).toHaveBeenCalledWith(1, 1, 'edited', [], []);
      expect(io.to).toHaveBeenCalledWith('channel:10');
      expect(io.emit).toHaveBeenCalledWith('message_edited', message);
    });

    it('messageService.editMessageが失敗したとき、socket.emit("error", ...)が呼ばれること', async () => {
      mockedMessageService.editMessage.mockRejectedValue(new Error('DB error'));

      await triggerHandler(socket, 'edit_message', {
        messageId: 1,
        content: 'edited',
        mentionedUserIds: [],
        attachmentIds: [],
      });

      expect(socket._emit).toHaveBeenCalledWith('error', 'Failed to edit message');
    });
  });

  describe('delete_message', () => {
    it('存在するメッセージIDを受け取ったとき、削除されchannel全体にbroadcastされること', async () => {
      const message = { id: 5, channelId: 10, userId: 1 };
      mockedMessageService.getMessageById.mockResolvedValue(message as never);
      mockedMessageService.deleteMessage.mockResolvedValue(undefined as never);

      await triggerHandler(socket, 'delete_message', 5);

      expect(mockedMessageService.deleteMessage).toHaveBeenCalledWith(5, 1);
      expect(io.to).toHaveBeenCalledWith('channel:10');
      expect(io.emit).toHaveBeenCalledWith('message_deleted', { messageId: 5, channelId: 10 });
    });

    it('存在しないメッセージIDを受け取ったとき、何もしないこと', async () => {
      mockedMessageService.getMessageById.mockResolvedValue(null as never);

      await triggerHandler(socket, 'delete_message', 999);

      expect(mockedMessageService.deleteMessage).not.toHaveBeenCalled();
      expect(io.emit).not.toHaveBeenCalled();
    });

    it('messageService.deleteMessageが失敗したとき、socket.emit("error", ...)が呼ばれること', async () => {
      const message = { id: 5, channelId: 10, userId: 1 };
      mockedMessageService.getMessageById.mockResolvedValue(message as never);
      mockedMessageService.deleteMessage.mockRejectedValue(new Error('DB error'));

      await triggerHandler(socket, 'delete_message', 5);

      expect(socket._emit).toHaveBeenCalledWith('error', 'Failed to delete message');
    });
  });

  describe('restore_message', () => {
    it('正常なデータを受け取ったとき、メッセージが復元されchannel全体にbroadcastされること', async () => {
      const message = { id: 5, channelId: 10, userId: 1 };
      mockedMessageService.restoreMessage.mockResolvedValue(message as never);

      await triggerHandler(socket, 'restore_message', 5);

      expect(mockedMessageService.restoreMessage).toHaveBeenCalledWith(5, 1);
      expect(io.to).toHaveBeenCalledWith('channel:10');
      expect(io.emit).toHaveBeenCalledWith('message_restored', message);
    });

    it('messageService.restoreMessageが失敗したとき、socket.emit("error", ...)が呼ばれること', async () => {
      mockedMessageService.restoreMessage.mockRejectedValue(new Error('DB error'));

      await triggerHandler(socket, 'restore_message', 5);

      expect(socket._emit).toHaveBeenCalledWith('error', 'Failed to restore message');
    });
  });

  describe('add_reaction', () => {
    it('正常なデータを受け取ったとき、リアクションが追加されreaction_updatedがbroadcastされること', async () => {
      const message = { id: 1, channelId: 10 };
      const reactions = [{ emoji: '👍', count: 1 }];
      mockedMessageService.getMessageById.mockResolvedValue(message as never);
      mockedMessageService.addReaction.mockResolvedValue(reactions as never);

      await triggerHandler(socket, 'add_reaction', { messageId: 1, emoji: '👍' });

      expect(mockedMessageService.addReaction).toHaveBeenCalledWith(1, 1, '👍');
      expect(io.to).toHaveBeenCalledWith('channel:10');
      expect(io.emit).toHaveBeenCalledWith('reaction_updated', {
        messageId: 1,
        channelId: 10,
        reactions,
      });
    });

    it('存在しないメッセージIDを受け取ったとき、何もしないこと', async () => {
      mockedMessageService.getMessageById.mockResolvedValue(null as never);

      await triggerHandler(socket, 'add_reaction', { messageId: 999, emoji: '👍' });

      expect(mockedMessageService.addReaction).not.toHaveBeenCalled();
    });

    it('messageService.addReactionが失敗したとき、socket.emit("error", ...)が呼ばれること', async () => {
      const message = { id: 1, channelId: 10 };
      mockedMessageService.getMessageById.mockResolvedValue(message as never);
      mockedMessageService.addReaction.mockRejectedValue(new Error('DB error'));

      await triggerHandler(socket, 'add_reaction', { messageId: 1, emoji: '👍' });

      expect(socket._emit).toHaveBeenCalledWith('error', 'Failed to add reaction');
    });
  });

  describe('remove_reaction', () => {
    it('正常なデータを受け取ったとき、リアクションが削除されreaction_updatedがbroadcastされること', async () => {
      const message = { id: 1, channelId: 10 };
      const reactions: never[] = [];
      mockedMessageService.getMessageById.mockResolvedValue(message as never);
      mockedMessageService.removeReaction.mockResolvedValue(reactions as never);

      await triggerHandler(socket, 'remove_reaction', { messageId: 1, emoji: '👍' });

      expect(mockedMessageService.removeReaction).toHaveBeenCalledWith(1, 1, '👍');
      expect(io.to).toHaveBeenCalledWith('channel:10');
      expect(io.emit).toHaveBeenCalledWith('reaction_updated', {
        messageId: 1,
        channelId: 10,
        reactions,
      });
    });

    it('存在しないメッセージIDを受け取ったとき、何もしないこと', async () => {
      mockedMessageService.getMessageById.mockResolvedValue(null as never);

      await triggerHandler(socket, 'remove_reaction', { messageId: 999, emoji: '👍' });

      expect(mockedMessageService.removeReaction).not.toHaveBeenCalled();
    });

    it('messageService.removeReactionが失敗したとき、socket.emit("error", ...)が呼ばれること', async () => {
      const message = { id: 1, channelId: 10 };
      mockedMessageService.getMessageById.mockResolvedValue(message as never);
      mockedMessageService.removeReaction.mockRejectedValue(new Error('DB error'));

      await triggerHandler(socket, 'remove_reaction', { messageId: 1, emoji: '👍' });

      expect(socket._emit).toHaveBeenCalledWith('error', 'Failed to remove reaction');
    });
  });

  describe('send_thread_reply', () => {
    it('正常なデータを受け取ったとき、スレッド返信が作成されnew_thread_replyがbroadcastされること', async () => {
      const reply = { id: 2, channelId: 10, content: 'reply' };
      const replies = [{ id: 2 }, { id: 3 }];
      mockedMessageService.createThreadReply.mockResolvedValue(reply as never);
      mockedMessageService.getThreadReplies.mockResolvedValue(replies as never);

      await triggerHandler(socket, 'send_thread_reply', {
        parentMessageId: 1,
        rootMessageId: 1,
        content: 'reply',
        mentionedUserIds: [],
        attachmentIds: [],
      });

      expect(mockedMessageService.createThreadReply).toHaveBeenCalledWith(1, 1, 1, 'reply', [], []);
      expect(io.to).toHaveBeenCalledWith('channel:10');
      expect(io.emit).toHaveBeenCalledWith('new_thread_reply', expect.objectContaining({
        reply,
        rootMessageId: 1,
        channelId: 10,
      }));
    });

    it('replyCountが正しく計算されnew_thread_replyに含まれること', async () => {
      const reply = { id: 2, channelId: 10, content: 'reply' };
      const replies = [{ id: 2 }, { id: 3 }, { id: 4 }]; // 3件
      mockedMessageService.createThreadReply.mockResolvedValue(reply as never);
      mockedMessageService.getThreadReplies.mockResolvedValue(replies as never);

      await triggerHandler(socket, 'send_thread_reply', {
        parentMessageId: 1,
        rootMessageId: 1,
        content: 'reply',
        mentionedUserIds: [],
        attachmentIds: [],
      });

      expect(io.emit).toHaveBeenCalledWith('new_thread_reply', expect.objectContaining({
        replyCount: 3,
      }));
    });

    it('messageService.createThreadReplyが失敗したとき、socket.emit("error", ...)が呼ばれること', async () => {
      mockedMessageService.createThreadReply.mockRejectedValue(new Error('DB error'));

      await triggerHandler(socket, 'send_thread_reply', {
        parentMessageId: 1,
        rootMessageId: 1,
        content: 'reply',
        mentionedUserIds: [],
        attachmentIds: [],
      });

      expect(socket._emit).toHaveBeenCalledWith('error', 'Failed to send thread reply');
    });
  });

  describe('pin_message', () => {
    it('正常なデータを受け取ったとき、メッセージがピン留めされmessage_pinnedがbroadcastされること', async () => {
      const pinned = { messageId: 1, channelId: 10, pinnedAt: '2024-01-01T00:00:00Z' };
      mockedPinMessageService.pinMessage.mockResolvedValue(pinned as never);

      await triggerHandler(socket, 'pin_message', { messageId: 1, channelId: 10 });

      expect(mockedPinMessageService.pinMessage).toHaveBeenCalledWith(1, 10, 1);
      expect(io.to).toHaveBeenCalledWith('channel:10');
      expect(io.emit).toHaveBeenCalledWith('message_pinned', {
        messageId: 1,
        channelId: 10,
        pinnedBy: 1,
        pinnedAt: pinned.pinnedAt,
      });
    });

    it('pinMessageService.pinMessageが失敗したとき、socket.emit("error", ...)が呼ばれること', async () => {
      mockedPinMessageService.pinMessage.mockRejectedValue(new Error('DB error'));

      await triggerHandler(socket, 'pin_message', { messageId: 1, channelId: 10 });

      expect(socket._emit).toHaveBeenCalledWith('error', 'Failed to pin message');
    });
  });

  describe('unpin_message', () => {
    it('正常なデータを受け取ったとき、ピン留めが解除されmessage_unpinnedがbroadcastされること', async () => {
      mockedPinMessageService.unpinMessage.mockResolvedValue(undefined as never);

      await triggerHandler(socket, 'unpin_message', { messageId: 1, channelId: 10 });

      expect(mockedPinMessageService.unpinMessage).toHaveBeenCalledWith(1, 10);
      expect(io.to).toHaveBeenCalledWith('channel:10');
      expect(io.emit).toHaveBeenCalledWith('message_unpinned', { messageId: 1, channelId: 10 });
    });

    it('pinMessageService.unpinMessageが失敗したとき、socket.emit("error", ...)が呼ばれること', async () => {
      mockedPinMessageService.unpinMessage.mockRejectedValue(new Error('DB error'));

      await triggerHandler(socket, 'unpin_message', { messageId: 1, channelId: 10 });

      expect(socket._emit).toHaveBeenCalledWith('error', 'Failed to unpin message');
    });
  });
});
