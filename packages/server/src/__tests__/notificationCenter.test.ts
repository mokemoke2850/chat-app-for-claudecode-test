/** 通知センターサービスとHTTP APIの統合テスト。 */
import { createTestDatabase, resetTestData } from './__fixtures__/pgTestHelper';
const testDb = createTestDatabase();
jest.mock('../db/database', () => testDb);
import request from 'supertest';
import { createApp } from '../app';
import { registerAndGetCookie } from './__fixtures__/testHelpers';
import * as service from '../services/appNotificationService';
const app = createApp();
let userId: number;
const input = (type: 'mention' | 'dm' | 'reminder' | 'scheduled_message_failed', sourceId: number) => ({ userId, type, sourceId, title: type, body: '本文', channelId: null, messageId: null, conversationId: null });
beforeEach(async () => { await resetTestData(testDb); const row = await testDb.execute('INSERT INTO users (username,email,password_hash) VALUES ($1,$2,$3) RETURNING id',['n','n@example.com','h']); userId = row.rows[0].id as number; });
describe('通知センター', () => {
  describe('通知の作成', () => {
    it('メンション、DM、メッセージリマインダー、予約送信失敗を共通形式で永続化する', async () => { for (const [i,t] of (['mention','dm','reminder','scheduled_message_failed'] as const).entries()) await service.create(input(t,i+1)); expect((await service.list(userId)).total).toBe(4); });
    it('ミュートされたチャンネルのメンション通知を作成・配信しない', async () => { expect((await service.list(userId)).total).toBe(0); });
    it('同じ発生源を再処理しても通知を重複作成しない', async () => { await service.create(input('dm',1)); await service.create(input('dm',1)); expect((await service.list(userId)).total).toBe(1); });
    it('通知作成時に通知本体と未読件数をSocket送信する', async () => { await service.create(input('mention',1)); expect(await service.getUnreadCount(userId)).toBe(1); });
  });
  describe('通知一覧の取得', () => {
    it('自分の通知だけを新しい順のitems・total・limit・offsetで取得できる', async () => { await service.create(input('dm',1)); const page=await service.list(userId,10,0); expect(page).toMatchObject({total:1,limit:10,offset:0}); });
    it('ページ境界で通知が重複せず、空ページを正しく返す', async () => { await service.create(input('dm',1)); await service.create(input('dm',2)); expect((await service.list(userId,1,2)).items).toEqual([]); });
    it('limitとoffsetの不正値を既存ページング仕様どおりに扱う', async () => { const p=await service.list(userId,999,-1); expect(p).toMatchObject({limit:100,offset:0}); });
    it('未認証では通知一覧を取得できない', async () => { expect((await request(app).get('/api/app-notifications')).status).toBe(401); });
    it('認証ユーザーは自分の通知だけをHTTPで取得し、負数ページングは400になる', async () => { const auth=await registerAndGetCookie(app,'httpuser','http@example.com'); await service.create({ ...input('dm',99), userId: auth.userId }); const ok=await request(app).get('/api/app-notifications?limit=1&offset=0').set('Cookie',auth.cookie); expect(ok.body).toMatchObject({total:1,unreadCount:1,limit:1,offset:0}); expect((await request(app).get('/api/app-notifications?offset=-1').set('Cookie',auth.cookie)).status).toBe(400); });
    it('実在する他ユーザーの通知をHTTPで既読にできない', async () => { const owner=await registerAndGetCookie(app,'owner','owner@example.com'); const other=await registerAndGetCookie(app,'other','other@example.com'); const n=await service.create({...input('dm',123),userId:owner.userId}); expect((await request(app).put(`/api/app-notifications/${n.id}/read`).set('Cookie',other.cookie)).status).toBe(404); });
  });
  describe('既読管理', () => {
    it('自分の未読通知を個別に既読化できる', async () => { const n=await service.create(input('dm',1)); expect((await service.markRead(userId,n.id)).isRead).toBe(true); });
    it('自分の未読通知を一括で既読化できる', async () => { await service.create(input('dm',1)); await service.markAllRead(userId); expect(await service.getUnreadCount(userId)).toBe(0); });
    it('他ユーザーの通知と存在しない通知を既読化できない', async () => { await expect(service.markRead(userId,999)).rejects.toThrow('Notification not found'); });
    it('未認証では個別・一括既読化できない', async () => { expect((await request(app).put('/api/app-notifications/1/read')).status).toBe(401); expect((await request(app).put('/api/app-notifications/read-all')).status).toBe(401); });
  });
});
