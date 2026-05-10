import { useEffect, useRef } from 'react';
import { useScrollPositionMemory } from '../../hooks/useScrollPositionMemory';
import { Box, Button, CircularProgress, Typography } from '@mui/material';
import type { Message, User } from '@chat-app/shared';
import MessageItem from './MessageItem';
import { useAuth } from '../../contexts/AuthContext';
import { useDensity } from '../../contexts/DensityContext';

interface Props {
  messages: Message[];
  loading: boolean;
  onLoadMore: () => void;
  currentUserId: number | null;
  users?: User[];
  onOpenThread?: (messageId: number) => void;
  onPinMessage?: (messageId: number) => void;
  pinnedMessageIds?: Set<number>;
  bookmarkedMessageIds?: Set<number>;
  onBookmarkChange?: (messageId: number, bookmarked: boolean) => void;
  onQuoteReply?: (message: Message) => void;
  /** キーボードナビゲーションでフォーカスされているメッセージ ID */
  focusedMessageId?: number | null;
  /** パーマリンクジャンプ時にハイライトするメッセージ ID */
  highlightMessageId?: number | null;
  /** スクロール位置記憶に使うチャンネル ID（省略時はスクロール位置を記憶しない） */
  channelId?: number | null;
}

// 連投マージ境界
// cozy: 5 分未満、compact: 2 分未満で同送信者なら連続投稿として扱う
const CONTINUED_THRESHOLD_COZY_MS = 5 * 60 * 1000;
const CONTINUED_THRESHOLD_COMPACT_MS = 2 * 60 * 1000;

/**
 * 直前メッセージと比較して連投マージ対象か判定する。
 * - 配列先頭は常に false
 * - 自身が削除済み or 直前が削除済みのときチェーン切断
 * - 異なる送信者は false
 * - 同送信者でも閾値以上経過していれば false
 * @param thresholdMs density に応じた閾値（cozy: 5分 / compact: 2分）
 */
function isContinuedMessage(messages: Message[], idx: number, thresholdMs: number): boolean {
  if (idx === 0) return false;
  const current = messages[idx];
  const prev = messages[idx - 1];
  if (current.isDeleted || prev.isDeleted) return false;
  if (current.userId !== prev.userId) return false;
  const diff = Math.abs(new Date(current.createdAt).getTime() - new Date(prev.createdAt).getTime());
  return diff < thresholdMs;
}

export default function MessageList({
  messages,
  loading,
  onLoadMore,
  users = [],
  onOpenThread,
  onPinMessage,
  pinnedMessageIds = new Set(),
  bookmarkedMessageIds = new Set(),
  onBookmarkChange,
  onQuoteReply,
  focusedMessageId = null,
  highlightMessageId = null,
  channelId = null,
}: Props) {
  const { user } = useAuth();
  const { density } = useDensity();
  const continuedThresholdMs =
    density === 'compact' ? CONTINUED_THRESHOLD_COMPACT_MS : CONTINUED_THRESHOLD_COZY_MS;
  const bottomRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const hasScrolledToHash = useRef(false);
  const isInitialLoad = useRef(true);
  // 直前の channelId を記憶し、切替時に保存タイミングを検知する
  const prevChannelIdRef = useRef<number | null>(null);

  const { save, restore } = useScrollPositionMemory(containerRef);

  // channelId が変化したとき、離脱するチャンネルのスクロール位置を保存し
  // 新チャンネルのスクロール位置を復元（または初回扱いにして最下部へ）する
  useEffect(() => {
    const prevId = prevChannelIdRef.current;
    const nextId = channelId;

    // 切替前チャンネルのスクロール位置を保存
    if (prevId !== null && prevId !== nextId) {
      save(prevId);
    }

    prevChannelIdRef.current = nextId;
  }, [channelId, save]);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // メッセージが空になったらチャンネル切り替えとみなし、次のロードを初回扱いにする
    if (messages.length === 0) {
      isInitialLoad.current = true;
      return;
    }

    // 初回ロード時: 保存済みスクロール位置があれば復元、なければ最下部へ移動する
    if (isInitialLoad.current) {
      isInitialLoad.current = false;
      if (channelId !== null) {
        const restored = restore(channelId);
        if (restored) return;
      }
      bottomRef.current?.scrollIntoView({ behavior: 'instant' });
      return;
    }

    // 以降の更新（新着メッセージ）は最下部付近にいるときのみスクロールする
    const isAtBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 100;
    if (isAtBottom) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, channelId, restore]);

  // URL ハッシュ #message-{id} に対応するメッセージへスクロール（初回のみ）
  useEffect(() => {
    if (hasScrolledToHash.current) return;
    const hash = window.location.hash;
    if (!hash.startsWith('#message-')) return;
    const el = document.getElementById(hash.slice(1));
    if (!el) return;
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    hasScrolledToHash.current = true;
  }, [messages]);

  // キーボードナビゲーション: フォーカスメッセージへスクロール追従
  useEffect(() => {
    if (focusedMessageId === null) return;
    const el = document.querySelector(`[data-message-id="${focusedMessageId}"]`);
    if (!el) return;
    el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [focusedMessageId]);

  // パーマリンクジャンプ: highlightMessageId が変化したときスクロール追従
  useEffect(() => {
    if (highlightMessageId === null) return;
    const el = document.querySelector(`[data-message-id="${highlightMessageId}"]`);
    if (!el) return;
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [highlightMessageId]);

  if (!user) return null;

  return (
    <Box
      ref={containerRef}
      sx={{ flexGrow: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column' }}
    >
      {messages.length === 0 && !loading && (
        <Box sx={{ flexGrow: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Typography color="text.secondary">No messages yet. Say hello!</Typography>
        </Box>
      )}

      {messages.length > 0 && (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 1 }}>
          <Button size="small" onClick={onLoadMore} disabled={loading}>
            {loading ? <CircularProgress size={16} /> : 'Load older messages'}
          </Button>
        </Box>
      )}

      <Box sx={{ flexGrow: 1 }} />

      {messages.map((msg, idx) => (
        <MessageItem
          key={msg.id}
          message={msg}
          currentUserId={user.id}
          users={users}
          onOpenThread={onOpenThread}
          onPinMessage={onPinMessage}
          isPinned={pinnedMessageIds.has(msg.id)}
          isBookmarked={bookmarkedMessageIds.has(msg.id)}
          onBookmarkChange={onBookmarkChange}
          onQuoteReply={onQuoteReply}
          isContinued={isContinuedMessage(messages, idx, continuedThresholdMs)}
          focused={focusedMessageId === msg.id || highlightMessageId === msg.id}
        />
      ))}

      <div ref={bottomRef} />
    </Box>
  );
}
