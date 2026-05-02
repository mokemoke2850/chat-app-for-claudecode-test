import type { Message } from './message';

/**
 * Step 6c: 購読中スレッドのサマリー
 *
 * Inbox 画面の「スレッド」タブで使用する集約レスポンス。
 * 「購読中スレッド」 = 自分が返信投稿（parent_message_id IS NOT NULL かつ user_id = me）した
 * スレッドのルートメッセージ。
 *
 * unreadCount は thread_reads テーブル未設計のため Step 6c では 0 固定。
 * Step 6d 以降で本実装予定。
 */
export interface ThreadSummary {
  rootMessage: Message;
  channelName: string;
  replyCount: number;
  lastReplyAt: string;
  unreadCount: number;
}
