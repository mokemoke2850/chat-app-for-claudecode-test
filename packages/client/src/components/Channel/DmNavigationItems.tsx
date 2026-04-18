import { useState, useEffect } from 'react';
import {
  Badge,
  Divider,
  List,
  ListItemButton,
  ListItemText,
} from '@mui/material';
import AdminPanelSettingsIcon from '@mui/icons-material/AdminPanelSettings';
import BookmarkIcon from '@mui/icons-material/Bookmark';
import ChatIcon from '@mui/icons-material/Chat';
import { useNavigate } from 'react-router-dom';
import { useSocket } from '../../contexts/SocketContext';
import { useAuth } from '../../contexts/AuthContext';

export interface DmNavigationItemsProps {
  dmUnreadCount: number;
  onDmUnreadCountChange: (count: number) => void;
}

export default function DmNavigationItems({
  dmUnreadCount,
  onDmUnreadCountChange,
}: DmNavigationItemsProps) {
  const navigate = useNavigate();
  const socket = useSocket();
  const { user } = useAuth();

  // dm_notification を受信してDM未読数を更新
  useEffect(() => {
    if (!socket) return;

    const handleDmNotification = (data: { conversationId: number; unreadCount: number }) => {
      // /dm ページを開いていない場合にバッジを表示する
      if (!window.location.pathname.startsWith('/dm')) {
        onDmUnreadCountChange(dmUnreadCount + data.unreadCount);
      }
    };

    socket.on('dm_notification', handleDmNotification);
    return () => {
      socket.off('dm_notification', handleDmNotification);
    };
  }, [socket, dmUnreadCount, onDmUnreadCountChange]);

  return (
    <>
      <Divider sx={{ mt: 1 }} />
      <List dense disablePadding>
        <ListItemButton
          onClick={() => {
            onDmUnreadCountChange(0);
            navigate('/dm');
          }}
        >
          <Badge badgeContent={dmUnreadCount > 0 ? dmUnreadCount : undefined} color="error" max={9}>
            <ChatIcon sx={{ fontSize: 16, mr: 1, color: 'text.secondary' }} />
          </Badge>
          <ListItemText primary="ダイレクトメッセージ" primaryTypographyProps={{ fontSize: 14 }} />
        </ListItemButton>
        <ListItemButton onClick={() => navigate('/bookmarks')}>
          <BookmarkIcon sx={{ fontSize: 16, mr: 1, color: 'text.secondary' }} />
          <ListItemText primary="ブックマーク" primaryTypographyProps={{ fontSize: 14 }} />
        </ListItemButton>
      </List>

      {user?.role === 'admin' && (
        <>
          <Divider />
          <List dense disablePadding>
            <ListItemButton onClick={() => navigate('/admin')}>
              <AdminPanelSettingsIcon sx={{ fontSize: 16, mr: 1, color: 'text.secondary' }} />
              <ListItemText primary="管理画面" primaryTypographyProps={{ fontSize: 14 }} />
            </ListItemButton>
          </List>
        </>
      )}
    </>
  );
}
