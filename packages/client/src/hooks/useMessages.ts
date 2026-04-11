import { useState, useEffect, useCallback } from 'react';
import type { Message } from '@chat-app/shared';
import { api } from '../api/client';
import { useSocket } from '../contexts/SocketContext';

export function useMessages(channelId: number | null) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const socket = useSocket();

  const fetchMessages = useCallback(
    async (before?: number) => {
      if (!channelId) return;
      setLoading(true);
      try {
        const { messages: fetched } = await api.messages.list(channelId, { limit: 50, before });
        setMessages((prev) => (before ? [...fetched, ...prev] : fetched));
      } finally {
        setLoading(false);
      }
    },
    [channelId],
  );

  // Reload when channel changes
  useEffect(() => {
    setMessages([]);
    if (!channelId) return;

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

    socket.on('new_message', onNew);
    socket.on('message_edited', onEdited);
    socket.on('message_deleted', onDeleted);
    socket.on('message_restored', onRestored);

    return () => {
      socket.off('new_message', onNew);
      socket.off('message_edited', onEdited);
      socket.off('message_deleted', onDeleted);
      socket.off('message_restored', onRestored);
    };
  }, [socket, channelId]);

  return { messages, loading, loadMore: () => void fetchMessages(messages[0]?.id) };
}
