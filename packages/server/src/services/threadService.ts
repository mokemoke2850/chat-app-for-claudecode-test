import { query } from '../db/database';
import type { ThreadSummary } from '@chat-app/shared';
import * as messageService from './messageService';

interface ThreadAggRow {
  root_message_id: number;
  channel_name: string;
  reply_count: string;
  last_reply_at: string;
}

/**
 * Step 6c: 自分が返信投稿したスレッドの一覧を返す。
 *
 * 「購読中スレッド」の定義:
 *   - parent_message_id IS NOT NULL かつ user_id = userId のメッセージ（= 自分の返信）
 *   - そのルートメッセージ（root_message_id が指すメッセージ）を集約して返す
 *   - ルートメッセージが論理削除済みの場合は除外する
 *
 * unreadCount は thread_reads テーブルが未設計のため Step 6c では 0 固定。
 * Step 6d 以降で本実装予定。
 *
 * ソート: lastReplyAt 降順（自分の最後の返信時刻ではなくスレッド全体の最終返信時刻）
 */
export async function listSubscribedThreads(userId: number): Promise<ThreadSummary[]> {
  const rows = await query<ThreadAggRow>(
    `
    SELECT
      r.id AS root_message_id,
      c.name AS channel_name,
      COUNT(all_replies.id)::text AS reply_count,
      MAX(all_replies.created_at) AS last_reply_at
    FROM messages r
    JOIN channels c ON c.id = r.channel_id
    LEFT JOIN messages all_replies
      ON all_replies.root_message_id = r.id AND all_replies.is_deleted = false
    WHERE r.is_deleted = false
      AND r.id IN (
        SELECT my_reply.root_message_id
        FROM messages my_reply
        WHERE my_reply.parent_message_id IS NOT NULL
          AND my_reply.user_id = $1
          AND my_reply.is_deleted = false
      )
    GROUP BY r.id, c.name
    ORDER BY MAX(all_replies.created_at) DESC
    `,
    [userId],
  );

  const summaries: ThreadSummary[] = [];
  for (const row of rows) {
    const rootMessage = await messageService.getMessageById(row.root_message_id);
    if (!rootMessage) continue;
    summaries.push({
      rootMessage,
      channelName: row.channel_name,
      replyCount: Number(row.reply_count),
      lastReplyAt: row.last_reply_at,
      unreadCount: 0, // Step 6c では 0 固定
    });
  }
  return summaries;
}
