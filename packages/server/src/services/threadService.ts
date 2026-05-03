import { query, execute } from '../db/database';
import type { ThreadSummary } from '@chat-app/shared';
import * as messageService from './messageService';

interface ThreadAggRow {
  root_message_id: number;
  channel_name: string;
  reply_count: string;
  last_reply_at: string;
  unread_count: string;
}

/**
 * 自分が返信投稿したスレッドの一覧を返す (購読中スレッド)。
 *
 * 「購読中スレッド」の定義:
 *   - parent_message_id IS NOT NULL かつ user_id = userId のメッセージ (= 自分の返信)
 *   - そのルートメッセージ (root_message_id が指すメッセージ) を集約して返す
 *   - ルートメッセージが論理削除済みの場合は除外する
 *
 * unreadCount:
 *   - thread_reads テーブルの last_read_at より後に投稿された他者の返信数
 *   - thread_reads レコードが存在しない場合は全ての他者返信が未読
 *   - 自分自身の返信は未読にカウントしない
 *
 * ソート: lastReplyAt 降順 (スレッド全体の最終返信時刻)。
 */
export async function listSubscribedThreads(userId: number): Promise<ThreadSummary[]> {
  const rows = await query<ThreadAggRow>(
    `
    SELECT
      r.id AS root_message_id,
      c.name AS channel_name,
      COUNT(all_replies.id)::text AS reply_count,
      MAX(all_replies.created_at) AS last_reply_at,
      COUNT(
        CASE
          WHEN all_replies.user_id != $1
            AND (tr.last_read_at IS NULL OR all_replies.created_at > tr.last_read_at)
          THEN 1
        END
      )::text AS unread_count
    FROM messages r
    JOIN channels c ON c.id = r.channel_id
    LEFT JOIN messages all_replies
      ON all_replies.root_message_id = r.id AND all_replies.is_deleted = false
    LEFT JOIN thread_reads tr
      ON tr.root_message_id = r.id AND tr.user_id = $1
    WHERE r.is_deleted = false
      AND r.id IN (
        SELECT my_reply.root_message_id
        FROM messages my_reply
        WHERE my_reply.parent_message_id IS NOT NULL
          AND my_reply.user_id = $1
          AND my_reply.is_deleted = false
      )
    GROUP BY r.id, c.name, tr.last_read_at
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
      unreadCount: Number(row.unread_count),
    });
  }
  return summaries;
}

/**
 * スレッドを既読にする。
 * thread_reads テーブルに UPSERT し last_read_at を現在時刻に更新する。
 * rootMessageId が存在しない場合は何もしない（冪等に無視する）。
 */
export async function markThreadAsRead(userId: number, rootMessageId: number): Promise<void> {
  // 存在しないメッセージIDの場合は FK 違反を避けて何もしない
  await execute(
    `
    INSERT INTO thread_reads (user_id, root_message_id, last_read_at)
    SELECT $1::integer, $2::integer, NOW()
    WHERE EXISTS (SELECT 1 FROM messages WHERE id = $2::integer)
    ON CONFLICT (user_id, root_message_id)
    DO UPDATE SET last_read_at = NOW()
    `,
    [userId, rootMessageId],
  );
}
