import { useState, useEffect, useCallback, useRef } from 'react';
import type { Message } from '@chat-app/shared';
import { api } from '../api/client';
import { useSocket } from '../contexts/SocketContext';

export function useMessages(channelId: number | null) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  // #375 カーソル系ページング: サーバが返す nextCursor / hasMore を保持して loadMore に利用する
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const socket = useSocket();
  const contextMessageIdRef = useRef<number | null>(null);

  const fetchMessages = useCallback(
    async (before?: string) => {
      if (!channelId) return;
      setLoading(true);
      try {
        const {
          items,
          nextCursor: cursor,
          hasMore: more,
        } = await api.messages.list(channelId, {
          limit: 50,
          before,
        });
        if (contextMessageIdRef.current !== null && !before) return;
        setMessages((prev) => (before ? [...items, ...prev] : items));
        setNextCursor(cursor);
        setHasMore(more);
      } finally {
        setLoading(false);
      }
    },
    [channelId],
  );

  const loadContext = useCallback(async (messageId: number) => {
    contextMessageIdRef.current = messageId;
    setLoading(true);
    try {
      const { items } = await api.messages.getContext(messageId);
      setMessages(items);
      setNextCursor(null);
      setHasMore(false);
    } finally {
      setLoading(false);
    }
  }, []);

  // Reload when channel changes
  useEffect(() => {
    setMessages([]);
    setNextCursor(null);
    setHasMore(false);
    if (!channelId) return;

    contextMessageIdRef.current = null;

    void fetchMessages();

    socket?.emit('join_channel', channelId);
    return () => {
      socket?.emit('leave_channel', channelId);
    };
  }, [channelId, socket, fetchMessages]);

  // Real-time updates
  useEffect(() => {
    if (!socket || !channelId) return;

    const onNew = (msg: Message) => {
      if (msg.channelId === channelId) {
        setMessages((prev) => [...prev, msg]);
      }
    };

    const onEdited = (msg: Message) => {
      setMessages((prev) => prev.map((m) => (m.id === msg.id ? msg : m)));
    };

    const onDeleted = ({ messageId }: { messageId: number; channelId: number }) => {
      setMessages((prev) => prev.map((m) => (m.id === messageId ? { ...m, isDeleted: true } : m)));
    };

    const onRestored = (msg: Message) => {
      setMessages((prev) => prev.map((m) => (m.id === msg.id ? msg : m)));
    };

    const onThreadReply = (data: {
      reply: Message;
      rootMessageId: number;
      channelId: number;
      replyCount: number;
    }) => {
      if (data.channelId === channelId) {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === data.rootMessageId ? { ...m, replyCount: data.replyCount } : m,
          ),
        );
      }
    };

    socket.on('new_message', onNew);
    socket.on('message_edited', onEdited);
    socket.on('message_deleted', onDeleted);
    socket.on('message_restored', onRestored);
    socket.on('new_thread_reply', onThreadReply);

    return () => {
      socket.off('new_message', onNew);
      socket.off('message_edited', onEdited);
      socket.off('message_deleted', onDeleted);
      socket.off('message_restored', onRestored);
      socket.off('new_thread_reply', onThreadReply);
    };
  }, [socket, channelId]);

  return {
    messages,
    loading,
    hasMore,
    // nextCursor（= 現在表示中の最古メッセージの ID 文字列）を before に渡して続きを読み込む
    loadMore: () => {
      if (hasMore && nextCursor) void fetchMessages(nextCursor);
    },
    refetch: () => void fetchMessages(),
    loadContext,
  };
}
