import { useEffect } from 'react';
import { useSocket } from '../contexts/SocketContext';
import type { DmConversationWithDetails, DmMessage } from '@chat-app/shared';

interface Options {
  /**
   * 現在表示中の会話 ID。一致する会話への新着メッセージは未読数をインクリメントしない。
   * Sidebar 用 (アクティブ会話の概念なし) のときは undefined / null を渡す。
   */
  activeConvId?: number | null;
  currentUserId: number;
  setConversations: (
    updater: (prev: DmConversationWithDetails[]) => DmConversationWithDetails[],
  ) => void;
}

/**
 * DM 会話一覧 (DmConversationList / SidebarDmList) で共通の `new_dm_message` socket 購読フック。
 * 受信メッセージに対して該当会話の lastMessage / updatedAt を更新し、
 * アクティブでない & 自分以外からのメッセージなら unreadCount をインクリメントする。
 */
export function useDmConversationsSocket({
  activeConvId,
  currentUserId,
  setConversations,
}: Options): void {
  const socket = useSocket();

  useEffect(() => {
    if (!socket) return;

    const handler = (msg: DmMessage) => {
      setConversations((prev) =>
        prev.map((c) => {
          if (c.id !== msg.conversationId) return c;
          const isActive = activeConvId != null && activeConvId === msg.conversationId;
          const isOwnMessage = msg.senderId === currentUserId;
          const shouldIncrementUnread = !isActive && !isOwnMessage;
          return {
            ...c,
            lastMessage: {
              content: msg.content,
              createdAt: msg.createdAt,
              senderId: msg.senderId,
            },
            updatedAt: msg.createdAt,
            unreadCount: shouldIncrementUnread ? c.unreadCount + 1 : c.unreadCount,
          };
        }),
      );
    };

    socket.on('new_dm_message', handler);
    return () => {
      socket.off('new_dm_message', handler);
    };
  }, [socket, activeConvId, currentUserId, setConversations]);
}
