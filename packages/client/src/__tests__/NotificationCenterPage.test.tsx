/** NotificationCenterPage の既読同期と遷移を検証する。 */
import { render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom';
import NotificationCenterPage from '../pages/NotificationCenterPage';
const mocks=vi.hoisted(()=>({list:vi.fn(),markRead:vi.fn(),markAllRead:vi.fn()}));
vi.mock('../api/client',()=>({api:{appNotifications:mocks}}));
vi.mock('../components/Layout/AppLayout',()=>({default:({children}:{children:ReactNode})=><div>{children}</div>}));
vi.mock('../components/Channel/ChannelList',()=>({default:()=>null}));
function Location(){return <div data-testid="location">{useLocation().pathname+useLocation().search}</div>}
beforeEach(()=>{ mocks.list.mockResolvedValue({items:[{id:1,type:'dm',sourceId:1,title:'DM',body:'x',channelId:null,messageId:null,conversationId:9,isRead:false,createdAt:''},{id:2,type:'mention',sourceId:2,title:'M',body:'x',channelId:3,messageId:4,conversationId:null,isRead:false,createdAt:''},{id:3,type:'scheduled_message_failed',sourceId:3,title:'F',body:'x',channelId:null,messageId:null,conversationId:null,isRead:false,createdAt:''}],total:3,limit:20,offset:0,unreadCount:3}); mocks.markRead.mockResolvedValue({unreadCount:2}); mocks.markAllRead.mockResolvedValue({unreadCount:0}); });
describe('NotificationCenterPage',()=>{
 it('通知を既読化してDM・メッセージ・予約失敗の遷移先へ移動する',async()=>{const u=userEvent.setup(); const listener=vi.fn(); window.addEventListener('app-notification-unread',listener); render(<MemoryRouter><Routes><Route path="*" element={<><NotificationCenterPage/><Location/></>}/></Routes></MemoryRouter>); await screen.findByText('DM'); await u.click(screen.getByText('DM')); expect(mocks.markRead).toHaveBeenCalledWith(1); expect(listener).toHaveBeenCalledWith(expect.objectContaining({detail:2})); expect(screen.getByTestId('location')).toHaveTextContent('/dm?conv=9'); window.removeEventListener('app-notification-unread',listener); });
 it('メッセージ通知と予約失敗通知は対応する画面へ遷移する',async()=>{const u=userEvent.setup(); render(<MemoryRouter initialEntries={['/notifications']}><Routes><Route path="*" element={<><NotificationCenterPage/><Location/></>}/></Routes></MemoryRouter>); await screen.findByText('M'); await u.click(screen.getByText('M')); expect(screen.getByTestId('location')).toHaveTextContent('/chat?channel=3&message=4'); await u.click(screen.getByText('F')); expect(screen.getByTestId('location')).toHaveTextContent('/'); });
 it('全件既読APIのunreadCountをBell同期イベントへ通知する',async()=>{const u=userEvent.setup(); const listener=vi.fn(); window.addEventListener('app-notification-unread',listener); render(<MemoryRouter><NotificationCenterPage/></MemoryRouter>); await screen.findByText('DM'); await u.click(screen.getByText('すべて既読にする')); expect(mocks.markAllRead).toHaveBeenCalled(); expect(listener).toHaveBeenCalledWith(expect.objectContaining({detail:0})); window.removeEventListener('app-notification-unread',listener); });
});
