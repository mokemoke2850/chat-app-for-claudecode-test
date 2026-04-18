import { useState, useEffect } from 'react';
import {
  Avatar,
  Badge,
  Box,
  IconButton,
  List,
  ListItem,
  ListItemButton,
  ListItemAvatar,
  ListItemText,
  Tooltip,
  Typography,
} from '@mui/material';
import AddCommentIcon from '@mui/icons-material/AddComment';
import { useSocket } from '../../contexts/SocketContext';
import type { DmConversationWithDetails, DmMessage } from '@chat-app/shared';

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleString('ja-JP', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export interface DmConversationListProps {
  conversations: DmConversationWithDetails[];
  activeConvId: number | null;
  currentUserId: number;
  onSelectConversation: (convId: number) => void;
  onNewDm: () => void;
  onConversationsChange: (updater: (prev: DmConversationWithDetails[]) => DmConversationWithDetails[]) => void;
}

export default function DmConversationList({
  conversations,
  activeConvId,
  currentUserId,
  onSelectConversation,
  onNewDm,
  onConversationsChange,
}: DmConversationListProps) {
  const socket = useSocket();

  // Socket.IO: new_dm_message イベントで会話一覧を更新
  useEffect(() => {
    if (!socket) return;

    const handleNewDmMessage = (msg: DmMessage) => {
      if (msg.conversationId !== activeConvId && msg.senderId !== currentUserId) {
        // 非アクティブ会話の未読数更新
        onConversationsChange((prev) =>
          prev.map((c) =>
            c.id === msg.conversationId ? { ...c, unreadCount: c.unreadCount + 1 } : c,
          ),
        );
      }
      // 会話一覧の最新メッセージを更新
      onConversationsChange((prev) =>
        prev.map((c) =>
          c.id === msg.conversationId
            ? {
                ...c,
                lastMessage: {
                  content: msg.content,
                  createdAt: msg.createdAt,
                  senderId: msg.senderId,
                },
                updatedAt: msg.createdAt,
              }
            : c,
        ),
      );
    };

    socket.on('new_dm_message', handleNewDmMessage);
    return () => {
      socket.off('new_dm_message', handleNewDmMessage);
    };
  }, [socket, activeConvId, currentUserId, onConversationsChange]);

  return (
    <Box
      sx={{
        width: 280,
        flexShrink: 0,
        borderRight: 1,
        borderColor: 'divider',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      <Box
        sx={{
          px: 2,
          py: 1.5,
          display: 'flex',
          alignItems: 'center',
          borderBottom: 1,
          borderColor: 'divider',
        }}
      >
        <Typography variant="subtitle1" fontWeight="bold" sx={{ flexGrow: 1 }}>
          ダイレクトメッセージ
        </Typography>
        <Tooltip title="新規DM">
          <IconButton size="small" onClick={onNewDm} aria-label="新規DM">
            <AddCommentIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      </Box>

      <Box sx={{ flexGrow: 1, overflowY: 'auto' }}>
        {conversations.length === 0 ? (
          <Box sx={{ p: 2, textAlign: 'center', color: 'text.secondary' }}>
            <Typography variant="body2">DM会話がありません</Typography>
            <Typography variant="caption">上のボタンから開始しましょう</Typography>
          </Box>
        ) : (
          <List disablePadding>
            {conversations.map((conv) => (
              <ListItem key={conv.id} disablePadding>
                <ListItemButton
                  selected={conv.id === activeConvId}
                  onClick={() => onSelectConversation(conv.id)}
                >
                  <ListItemAvatar sx={{ minWidth: 40 }}>
                    <Badge
                      badgeContent={conv.unreadCount > 0 ? conv.unreadCount : undefined}
                      color="error"
                      max={9}
                    >
                      <Avatar
                        src={conv.otherUser.avatarUrl ?? undefined}
                        sx={{ width: 32, height: 32 }}
                      >
                        {conv.otherUser.username[0].toUpperCase()}
                      </Avatar>
                    </Badge>
                  </ListItemAvatar>
                  <ListItemText
                    primary={
                      <Typography
                        variant="body2"
                        fontWeight={conv.unreadCount > 0 ? 'bold' : 'normal'}
                        noWrap
                      >
                        {conv.otherUser.displayName ?? conv.otherUser.username}
                      </Typography>
                    }
                    secondary={
                      conv.lastMessage ? (
                        <Typography variant="caption" noWrap color="text.secondary">
                          {conv.lastMessage.content}
                        </Typography>
                      ) : undefined
                    }
                  />
                  {conv.lastMessage && (
                    <Typography
                      variant="caption"
                      color="text.secondary"
                      sx={{ ml: 0.5, flexShrink: 0 }}
                    >
                      {formatDate(conv.lastMessage.createdAt)}
                    </Typography>
                  )}
                </ListItemButton>
              </ListItem>
            ))}
          </List>
        )}
      </Box>
    </Box>
  );
}
