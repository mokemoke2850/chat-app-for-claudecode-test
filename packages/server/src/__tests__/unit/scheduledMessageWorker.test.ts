// テスト対象: jobs/scheduledMessageWorker.ts の 1 tick フロー (#110)
// 戦略:
//   - setInterval による実運用ループは起動せず、runOnce() のような
//     単一 tick 相当の関数を直接呼び出してフローを検証する
//   - scheduledMessageService と createMessage をモックで差し替え、
//     入力 (pickDue の結果) と出力 (markSent / markFailed 呼び出し) を確認する
//   - Socket.IO はモックで emit の引数を検証する

// Socket.IO モック
const mockEmit = jest.fn();
const mockSocketTo = jest.fn().mockReturnValue({ emit: mockEmit });
const mockSocketServer = { to: mockSocketTo };

jest.mock('../../socket', () => ({
  getSocketServer: jest.fn(() => mockSocketServer),
}));

// scheduledMessageService モック
const mockPickDue = jest.fn();
const mockMarkSent = jest.fn();
const mockMarkFailed = jest.fn();
jest.mock('../../services/scheduledMessageService', () => ({
  pickDue: (...args: unknown[]) => mockPickDue(...args),
  markSent: (...args: unknown[]) => mockMarkSent(...args),
  markFailed: (...args: unknown[]) => mockMarkFailed(...args),
}));

// messageService モック
const mockCreateMessage = jest.fn();
jest.mock('../../services/messageService', () => ({
  createMessage: (...args: unknown[]) => mockCreateMessage(...args),
}));

import { runOnce } from '../../jobs/scheduledMessageWorker';
import type { ScheduledMessage } from '@chat-app/shared';

const makeScheduledMsg = (overrides: Partial<ScheduledMessage> = {}): ScheduledMessage => ({
  id: 1,
  userId: 10,
  channelId: 100,
  content: 'テスト予約メッセージ',
  scheduledAt: new Date(Date.now() - 1000).toISOString(),
  status: 'sending',
  error: null,
  sentMessageId: null,
  attachments: [],
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  ...overrides,
});

beforeEach(() => {
  jest.clearAllMocks();
  mockSocketTo.mockReturnValue({ emit: mockEmit });
});

describe('scheduledMessageWorker', () => {
  describe('runOnce (1 tick 相当)', () => {
    it('pickDue で得た各予約について createMessage が channelId, userId, content 付きで呼ばれる', async () => {
      const sm = makeScheduledMsg({ id: 1, channelId: 100, userId: 10, content: 'hello' });
      mockPickDue.mockResolvedValue([sm]);
      mockCreateMessage.mockResolvedValue({ id: 999, channelId: 100, content: 'hello' });
      mockMarkSent.mockResolvedValue(undefined);

      await runOnce();

      expect(mockCreateMessage).toHaveBeenCalledWith(sm.channelId, sm.userId, sm.content, [], []);
    });

    it('sendMessage 成功後に markSent(id, messageId) が呼ばれる', async () => {
      const sm = makeScheduledMsg({ id: 42 });
      mockPickDue.mockResolvedValue([sm]);
      mockCreateMessage.mockResolvedValue({ id: 999 });
      mockMarkSent.mockResolvedValue(undefined);

      await runOnce();

      expect(mockMarkSent).toHaveBeenCalledWith(42, 999);
    });

    it('sendMessage が throw した場合に markFailed(id, errorMessage) が呼ばれる', async () => {
      const sm = makeScheduledMsg({ id: 7 });
      mockPickDue.mockResolvedValue([sm]);
      mockCreateMessage.mockRejectedValue(new Error('チャンネルが見つかりません'));
      mockMarkFailed.mockResolvedValue(undefined);

      await runOnce();

      expect(mockMarkFailed).toHaveBeenCalledWith(7, 'チャンネルが見つかりません');
      expect(mockMarkSent).not.toHaveBeenCalled();
    });

    it('1件が失敗しても他の予約の処理は続行される（ループ内で try/catch）', async () => {
      const sm1 = makeScheduledMsg({ id: 1 });
      const sm2 = makeScheduledMsg({ id: 2, userId: 20 });
      mockPickDue.mockResolvedValue([sm1, sm2]);
      mockCreateMessage.mockRejectedValueOnce(new Error('失敗')).mockResolvedValueOnce({ id: 888 });
      mockMarkFailed.mockResolvedValue(undefined);
      mockMarkSent.mockResolvedValue(undefined);

      await runOnce();

      expect(mockMarkFailed).toHaveBeenCalledWith(1, '失敗');
      expect(mockMarkSent).toHaveBeenCalledWith(2, 888);
    });

    it('送信成功した予約はチャンネル購読者へ message:new が emit される', async () => {
      const sm = makeScheduledMsg({ channelId: 55 });
      const createdMsg = { id: 777, channelId: 55, content: 'hi' };
      mockPickDue.mockResolvedValue([sm]);
      mockCreateMessage.mockResolvedValue(createdMsg);
      mockMarkSent.mockResolvedValue(undefined);

      await runOnce();

      expect(mockSocketTo).toHaveBeenCalledWith('channel:55');
      expect(mockEmit).toHaveBeenCalledWith('message:new', createdMsg);
    });

    it('送信失敗した予約は予約者に failure 通知が飛ぶ', async () => {
      const sm = makeScheduledMsg({ id: 9, userId: 99 });
      mockPickDue.mockResolvedValue([sm]);
      mockCreateMessage.mockRejectedValue(new Error('送信失敗'));
      mockMarkFailed.mockResolvedValue(undefined);

      await runOnce();

      expect(mockSocketTo).toHaveBeenCalledWith('user:99');
      expect(mockEmit).toHaveBeenCalledWith(
        'scheduled_message:failed',
        expect.objectContaining({ scheduledMessageId: 9 }),
      );
    });

    it('pickDue が空配列を返した場合は sendMessage を呼ばない', async () => {
      mockPickDue.mockResolvedValue([]);

      await runOnce();

      expect(mockCreateMessage).not.toHaveBeenCalled();
      expect(mockMarkSent).not.toHaveBeenCalled();
    });
  });
});
