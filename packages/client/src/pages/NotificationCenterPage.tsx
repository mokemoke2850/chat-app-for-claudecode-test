import { useEffect, useState } from 'react';
import { Alert, Box, Button, List, ListItemButton, ListItemText, Pagination, Typography } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import type { AppNotification, AppNotificationPage } from '@chat-app/shared';
import AppLayout from '../components/Layout/AppLayout';
import ChannelList from '../components/Channel/ChannelList';
import { api } from '../api/client';

const LIMIT = 20;
export default function NotificationCenterPage() {
  const [page, setPage] = useState<AppNotificationPage | null>(null);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();
  const load = (offset = 0) => void api.appNotifications.list(LIMIT, offset).then(setPage).catch(() => setError('通知を取得できませんでした'));
  useEffect(() => { load(); }, []);
  const open = async (n: AppNotification) => { if (!n.isRead) { const {unreadCount}=await api.appNotifications.markRead(n.id); window.dispatchEvent(new CustomEvent('app-notification-unread',{detail:unreadCount})); setPage((current) => current ? {...current,unreadCount,items:current.items.map((item)=>item.id===n.id?{...item,isRead:true}:item)} : current); } if (n.conversationId) navigate(`/dm?conv=${n.conversationId}`); else if (n.messageId) navigate(`/chat?channel=${n.channelId}&message=${n.messageId}`); else if (n.type === 'scheduled_message_failed') navigate('/'); };
  return <AppLayout sidebar={<ChannelList activeChannelId={null} onSelect={() => {}} />}><Box sx={{ p: 3, maxWidth: 760 }}><Typography variant="h5">通知</Typography>{error && <Alert severity="error">{error}</Alert>}<Button onClick={() => void api.appNotifications.markAllRead().then(({unreadCount}) => { window.dispatchEvent(new CustomEvent('app-notification-unread',{detail:unreadCount})); load(page?.offset ?? 0); })}>すべて既読にする</Button><List>{page?.items.map((n) => <ListItemButton key={n.id} onClick={() => void open(n)}><ListItemText primary={n.title} secondary={n.body} /></ListItemButton>)}</List>{page?.total === 0 && <Typography>通知はありません</Typography>}<Pagination count={Math.ceil((page?.total ?? 0) / LIMIT)} page={Math.floor((page?.offset ?? 0) / LIMIT) + 1} onChange={(_, p) => load((p - 1) * LIMIT)} /></Box></AppLayout>;
}
