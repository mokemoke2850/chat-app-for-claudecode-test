/** dmHandler から通知センターへ接続されることを検証する。 */
const handlers = new Map<string, (data: any) => void>();
const mockSendMessage = jest.fn(); const mockOther = jest.fn(); const mockConversations = jest.fn();
jest.mock('../../services/dmService', () => ({ sendMessage: (...a: unknown[]) => mockSendMessage(...a), getOtherUserId: (...a: unknown[]) => mockOther(...a), getConversations: (...a: unknown[]) => mockConversations(...a) }));
jest.mock('../../services/rateLimitService', () => ({ rateLimitService: { check: () => ({ allowed: true }) }, getRateLimitConfig: () => ({ windowSec: 1, limit: 1 }) }));
const createNotification = jest.fn().mockResolvedValue({id:1}); const unread = jest.fn().mockResolvedValue(1);
jest.mock('../../services/appNotificationService', () => ({ create: (...a: unknown[]) => createNotification(...a), getUnreadCount: (...a: unknown[]) => unread(...a) }));
import { registerDmHandlers } from '../../socket/dmHandler';
describe('dmHandler 通知発生源', () => {
 it('DM送信時に受信者向け通知を永続化する', async () => { const io:any={to:jest.fn(()=>({emit:jest.fn()}))}; const socket:any={data:{userId:1,username:'alice'},on:jest.fn((event,handler)=>handlers.set(event,handler)),emit:jest.fn()}; mockSendMessage.mockResolvedValue({id:77,content:'hello'}); mockOther.mockResolvedValue(2); mockConversations.mockResolvedValue([{id:5,unreadCount:1}]); registerDmHandlers(io,socket); handlers.get('send_dm')!({conversationId:5,content:'hello'}); await new Promise((r)=>setTimeout(r,0)); expect(createNotification).toHaveBeenCalledWith(expect.objectContaining({type:'dm',sourceId:77,userId:2,conversationId:5})); });
});
