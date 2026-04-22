import { pickDue, markSent, markFailed } from '../services/scheduledMessageService';
import { createMessage } from '../services/messageService';
import { getSocketServer } from '../socket';

const PICK_LIMIT = 50;
const INTERVAL_MS = 30_000;

/**
 * 1 tick 分の処理：期限切れ予約をピックして送信する。
 * テストでは setInterval を起動せずこの関数を直接呼び出す。
 */
export async function runOnce(): Promise<void> {
  const due = await pickDue(PICK_LIMIT);
  if (due.length === 0) return;

  const io = getSocketServer();

  for (const sm of due) {
    try {
      const message = await createMessage(sm.channelId, sm.userId, sm.content, [], []);
      await markSent(sm.id, message.id);

      // チャンネル購読者へ通常メッセージとして配信
      io?.to(`channel:${sm.channelId}`).emit('message:new', message);
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      await markFailed(sm.id, errorMessage).catch(() => {
        // markFailed 自体が失敗しても他の予約処理を止めない
      });

      // 予約者へ失敗通知
      io?.to(`user:${sm.userId}`).emit('scheduled_message:failed', {
        scheduledMessageId: sm.id,
        error: errorMessage,
      });
    }
  }
}

/**
 * 30 秒ごとに runOnce を実行するスケジューラを起動する。
 * 起動直後に once 実行して、サーバー停止中に積まれた予約を即時処理する。
 */
export function startScheduledMessageWorker(): void {
  void runOnce();
  setInterval(() => {
    void runOnce();
  }, INTERVAL_MS);
}
