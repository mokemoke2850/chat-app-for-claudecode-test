/**
 * テスト対象: channelNotificationService（ユニットレベル）
 * 戦略: pushService と channelNotificationService を Jest モックで検証する。
 *       通知レベルに応じた pushService.sendPushToUser の発火/非発火を確認する。
 *       messageHandler の send_message イベントハンドラを経由して検証する。
 */

jest.mock('../../services/pushService');
jest.mock('../../services/channelNotificationService');
jest.mock('../../services/messageService');
jest.mock('../../services/channelService');
jest.mock('../../services/pinMessageService');
jest.mock('../../services/moderationService');

import * as pushService from '../../services/pushService';
import * as channelNotificationService from '../../services/channelNotificationService';
import * as messageService from '../../services/messageService';
import * as channelService from '../../services/channelService';
import * as moderationService from '../../services/moderationService';
import { registerMessageHandlers } from '../../socket/messageHandler';
import type { Message } from '@chat-app/shared';

const mockedPushService = pushService as jest.Mocked<typeof pushService>;
const mockedNotificationService = channelNotificationService as jest.Mocked<
  typeof channelNotificationService
>;
const mockedMessageService = messageService as jest.Mocked<typeof messageService>;
const mockedChannelService = channelService as jest.Mocked<typeof channelService>;
const mockedModerationService = moderationService as jest.Mocked<typeof moderationService>;

const SENDER_ID = 1;
const MENTIONED_USER_ID = 2;
const CHANNEL_ID = 10;

function makeMessage(overrides: Partial<Message> = {}): Message {
  return {
    id: 100,
    channelId: CHANNEL_ID,
    userId: SENDER_ID,
    username: 'sender',
    avatarUrl: null,
    content: 'hello',
    isEdited: false,
    isDeleted: false,
    mentions: [],
    reactions: [],
    parentMessageId: null,
    rootMessageId: null,
    replyCount: 0,
    quotedMessageId: null,
    quotedMessage: null,
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
    ...overrides,
  };
}

function createMockSocket(userId = SENDER_ID, username = 'sender') {
  const handlers: Record<string, (...args: unknown[]) => void> = {};
  const socket = {
    data: { userId, username },
    on: jest.fn((event: string, cb: (...args: unknown[]) => void) => {
      handlers[event] = cb;
    }),
    emit: jest.fn(),
    to: jest.fn().mockReturnThis(),
    _trigger: (event: string, ...args: unknown[]) => handlers[event]?.(...args),
  };
  return socket;
}

function createMockIo() {
  const io = {
    to: jest.fn().mockReturnThis(),
    emit: jest.fn(),
  };
  return io;
}

beforeEach(() => {
  jest.clearAllMocks();
  mockedMessageService.createMessage.mockResolvedValue(makeMessage());
  mockedNotificationService.getLevel.mockResolvedValue('all');
  mockedModerationService.checkContent.mockResolvedValue(null);
  mockedChannelService.getChannelsForUser.mockResolvedValue([
    {
      id: CHANNEL_ID,
      name: 'general',
      description: null,
      topic: null,
      createdBy: SENDER_ID,
      createdAt: '2024-01-01T00:00:00Z',
      isPrivate: false,
      postingPermission: 'everyone',
      unreadCount: 0,
      mentionCount: 1,
    },
  ]);
});

describe('pushService と通知レベルの連携', () => {
  describe('sendPushToUser の呼び出し制御', () => {
    it('通知レベルが "all" の場合は sendPushToUser が呼ばれる', async () => {
      mockedNotificationService.getLevel.mockResolvedValue('all');
      const io = createMockIo();
      const socket = createMockSocket();
      registerMessageHandlers(io as any, socket as any);

      socket._trigger('send_message', {
        channelId: CHANNEL_ID,
        content: 'hi',
        mentionedUserIds: [MENTIONED_USER_ID],
      });
      await new Promise((r) => setTimeout(r, 10));

      expect(mockedPushService.sendPushToUser).toHaveBeenCalledWith(
        MENTIONED_USER_ID,
        expect.objectContaining({ title: expect.any(String) }),
      );
    });

    it('通知レベルが "muted" の場合は sendPushToUser が呼ばれない', async () => {
      mockedNotificationService.getLevel.mockResolvedValue('muted');
      const io = createMockIo();
      const socket = createMockSocket();
      registerMessageHandlers(io as any, socket as any);

      socket._trigger('send_message', {
        channelId: CHANNEL_ID,
        content: 'hi',
        mentionedUserIds: [MENTIONED_USER_ID],
      });
      await new Promise((r) => setTimeout(r, 10));

      expect(mockedPushService.sendPushToUser).not.toHaveBeenCalled();
    });

    it('通知レベルが "mentions" かつメンションあり の場合は sendPushToUser が呼ばれる', async () => {
      mockedNotificationService.getLevel.mockResolvedValue('mentions');
      const io = createMockIo();
      const socket = createMockSocket();
      registerMessageHandlers(io as any, socket as any);

      socket._trigger('send_message', {
        channelId: CHANNEL_ID,
        content: 'hi @user2',
        mentionedUserIds: [MENTIONED_USER_ID],
      });
      await new Promise((r) => setTimeout(r, 10));

      expect(mockedPushService.sendPushToUser).toHaveBeenCalledWith(
        MENTIONED_USER_ID,
        expect.objectContaining({ title: expect.any(String) }),
      );
    });

    it('通知レベルが "mentions" かつメンションなし の場合は sendPushToUser が呼ばれない', async () => {
      mockedNotificationService.getLevel.mockResolvedValue('mentions');
      const io = createMockIo();
      const socket = createMockSocket();
      registerMessageHandlers(io as any, socket as any);

      socket._trigger('send_message', {
        channelId: CHANNEL_ID,
        content: 'hi',
        mentionedUserIds: [],
      });
      await new Promise((r) => setTimeout(r, 10));

      expect(mockedPushService.sendPushToUser).not.toHaveBeenCalled();
    });

    it('レコードが存在しない（未設定）ユーザーは "all" として扱われ sendPushToUser が呼ばれる', async () => {
      mockedNotificationService.getLevel.mockResolvedValue('all');
      const io = createMockIo();
      const socket = createMockSocket();
      registerMessageHandlers(io as any, socket as any);

      socket._trigger('send_message', {
        channelId: CHANNEL_ID,
        content: 'hi',
        mentionedUserIds: [MENTIONED_USER_ID],
      });
      await new Promise((r) => setTimeout(r, 10));

      expect(mockedPushService.sendPushToUser).toHaveBeenCalledWith(
        MENTIONED_USER_ID,
        expect.objectContaining({ title: expect.any(String) }),
      );
    });
  });

  describe('mention_updated イベントの発火制御', () => {
    it('通知レベルが "muted" のチャンネルでは mention_updated イベントをクライアントに送らない', async () => {
      mockedNotificationService.getLevel.mockResolvedValue('muted');
      const io = createMockIo();
      const socket = createMockSocket();
      registerMessageHandlers(io as any, socket as any);

      socket._trigger('send_message', {
        channelId: CHANNEL_ID,
        content: 'hi',
        mentionedUserIds: [MENTIONED_USER_ID],
      });
      await new Promise((r) => setTimeout(r, 10));

      expect(io.emit).not.toHaveBeenCalledWith('mention_updated', expect.anything());
    });

    it('通知レベルが "mentions" のチャンネルでは mention_updated イベントを送る', async () => {
      mockedNotificationService.getLevel.mockResolvedValue('mentions');
      const io = createMockIo();
      const socket = createMockSocket();
      registerMessageHandlers(io as any, socket as any);

      socket._trigger('send_message', {
        channelId: CHANNEL_ID,
        content: 'hi @user2',
        mentionedUserIds: [MENTIONED_USER_ID],
      });
      await new Promise((r) => setTimeout(r, 10));

      expect(io.to).toHaveBeenCalledWith(`user:${MENTIONED_USER_ID}`);
    });
  });
});
