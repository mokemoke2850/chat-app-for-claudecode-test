// Issue #152 — カレンダーリマインダーワーカー
// scheduledMessageWorker と同じパターン: 30 秒ごとに対象を抽出 → メッセージ投稿 → sent_at 更新で冪等

import { execute, query } from '../db/database';
import { createMessage } from '../services/messageService';

export const INTERVAL_MS = 30_000;
const PICK_LIMIT = 100;

interface DueReminderRow {
  reminder_id: number;
  event_id: number;
  remind_offset_minutes: number;
  channel_id: number | null;
  title: string;
  starts_at: string | Date;
  organizer_id: number;
}

let intervalHandle: ReturnType<typeof setInterval> | null = null;

/**
 * 「未送信 (sent_at IS NULL) かつ channel_id IS NOT NULL かつ
 *  starts_at - remind_offset_minutes 分 ≤ now」のリマインダーを抽出する。
 *
 * pg-mem の INTERVAL 演算互換性に依存しないよう、SQL 側では sent_at と channel_id の
 * フィルタのみ行い、開始時刻判定は JS 側で実施する。
 */
export async function pickDueReminders(now: Date = new Date()): Promise<DueReminderRow[]> {
  const rows = await query<DueReminderRow>(
    `SELECT r.id AS reminder_id,
            r.event_id,
            r.remind_offset_minutes,
            e.channel_id,
            e.title,
            e.starts_at,
            e.organizer_id
       FROM calendar_event_reminders r
       JOIN calendar_events e ON e.id = r.event_id
      WHERE r.sent_at IS NULL
        AND e.channel_id IS NOT NULL
      ORDER BY e.starts_at ASC
      LIMIT $1`,
    [PICK_LIMIT],
  );
  const nowMs = now.getTime();
  return rows.filter((r) => {
    const startsAtMs = new Date(r.starts_at).getTime();
    const dueAtMs = startsAtMs - r.remind_offset_minutes * 60_000;
    return dueAtMs <= nowMs;
  });
}

export async function markSent(reminderId: number, sentAt: Date = new Date()): Promise<void> {
  await execute('UPDATE calendar_event_reminders SET sent_at = $1 WHERE id = $2', [
    sentAt.toISOString(),
    reminderId,
  ]);
}

/**
 * 1 tick 分の処理。テストでは setInterval を起動せずこの関数を直接呼び出す。
 */
export async function runOnce(now: Date = new Date()): Promise<void> {
  const due = await pickDueReminders(now);
  for (const r of due) {
    if (r.channel_id === null) continue; // SQL 側で除外済みだが二重ガード
    try {
      const startsAtMs = new Date(r.starts_at).getTime();
      const remainingMin = Math.max(0, Math.round((startsAtMs - now.getTime()) / 60_000));
      const content = `⏰ 「${r.title}」が ${remainingMin} 分後に開始します`;
      await createMessage(r.channel_id, r.organizer_id, content);
      await markSent(r.reminder_id, now);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error('[calendarReminderWorker] failed:', msg);
      // markSent は呼ばない → 次回再試行（冪等性は保つ）
    }
  }
}

/**
 * 30 秒ごとに runOnce を実行するスケジューラを起動する。
 * 起動直後に一度実行して、サーバー停止中に積まれたリマインダーを即時処理する。
 */
export function startCalendarReminderWorker(): ReturnType<typeof setInterval> {
  if (intervalHandle) return intervalHandle;
  void runOnce();
  intervalHandle = setInterval(() => {
    void runOnce();
  }, INTERVAL_MS);
  return intervalHandle;
}

export function stopCalendarReminderWorker(): void {
  if (intervalHandle) {
    clearInterval(intervalHandle);
    intervalHandle = null;
  }
}

export function getCalendarReminderWorkerStatus(): {
  running: boolean;
  intervalMs: number;
} {
  return {
    running: intervalHandle !== null,
    intervalMs: INTERVAL_MS,
  };
}
