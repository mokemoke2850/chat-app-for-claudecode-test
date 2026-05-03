import type { Message } from './message';

/**
 * 購読中スレッドのサマリー (Inbox の「スレッド」タブで使用)。
 *
 * 「購読中スレッド」= 自分が返信投稿 (parent_message_id IS NOT NULL かつ user_id = me) した
 * スレッドのルートメッセージ。
 * unreadCount は thread_reads テーブル未設計のため現状 0 固定 (将来本実装予定)。
 */
export interface ThreadSummary {
  rootMessage: Message;
  channelName: string;
  replyCount: number;
  lastReplyAt: string;
  unreadCount: number;
}
