import type { Message } from './message';

/**
 * 購読中スレッドのサマリー (Inbox の「スレッド」タブで使用)。
 *
 * 「購読中スレッド」= 自分が返信投稿 (parent_message_id IS NOT NULL かつ user_id = me) した
 * スレッドのルートメッセージ。
 * unreadCount は thread_reads テーブルの last_read_at より後に投稿された他者の返信数。
 * 自分自身の返信は未読にカウントしない。
 */
export interface ThreadSummary {
  rootMessage: Message;
  channelName: string;
  replyCount: number;
  lastReplyAt: string;
  unreadCount: number;
}
