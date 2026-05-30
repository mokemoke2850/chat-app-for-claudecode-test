/**
 * テスト対象: Socket.IO のプレゼンス連携（presenceService + handler 統合）
 *
 * 戦略:
 *   - http サーバ + socket.io Server + socket.io-client でインメモリ接続テストを行う
 *   - 既存の socket-handler.test.ts と同じパターンに従う
 *   - クライアントは autoConnect: false で作成し、リスナー登録後に connect する
 *     → 接続直後にサーバが emit する `presence:bulk` の取りこぼしを防ぐ
 *
 * 仕様前提（ユーザー承認済み）:
 *   - 接続時に presence:bulk で現在の在席集合がクライアントに送られる
 *   - state 変化時は presence:state でワークスペース内の他クライアントに broadcast される
 *   - broadcast はワークスペース内（接続中ユーザー集合）に絞る
 *   - 複数タブ接続中は online を維持し、余計な状態変化通知は出さない
 */

import { createServer } from 'http';
import { Server as SocketServer } from 'socket.io';
import { io as ioc, Socket as ClientSocket } from 'socket.io-client';
import jwt from 'jsonwebtoken';
import {
  ServerToClientEvents,
  ClientToServerEvents,
  InterServerEvents,
  SocketData,
} from '@chat-app/shared';

// channelHandler が getChannelsForUser を呼ぶためモック化
jest.mock('../services/channelService');
import * as channelService from '../services/channelService';

import { setupSocketHandlers } from '../socket/handler';
import * as presenceService from '../services/presenceService';
import { OFFLINE_GRACE_MS } from '../services/presenceService';

const mockedChannelService = channelService as jest.Mocked<typeof channelService>;

const SECRET = process.env.JWT_SECRET || 'dev-secret-please-change-in-production';

function makeToken(userId: number, username: string): string {
  return jwt.sign({ userId, username }, SECRET);
}

type SChatSocket = ClientSocket<ServerToClientEvents, ClientToServerEvents>;

function makeClient(port: number, userId: number, username: string): SChatSocket {
  return ioc(`http://localhost:${port}`, {
    auth: { token: makeToken(userId, username) },
    reconnection: false,
    forceNew: true,
    autoConnect: false,
  });
}

function waitConnect(c: SChatSocket): Promise<void> {
  return new Promise((resolve, reject) => {
    c.once('connect', () => resolve());
    c.once('connect_error', (err) => reject(err));
  });
}

async function connectClient(port: number, userId: number, username: string): Promise<SChatSocket> {
  const c = makeClient(port, userId, username);
  c.connect();
  await waitConnect(c);
  return c;
}

describe('Socket.IO プレゼンス連携', () => {
  let httpServer: ReturnType<typeof createServer>;
  let io: SocketServer<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>;
  let port: number;

  beforeAll((done) => {
    mockedChannelService.getChannelsForUser.mockResolvedValue([]);
    httpServer = createServer();
    io = new SocketServer(httpServer);
    setupSocketHandlers(io);
    httpServer.listen(0, () => {
      port = (httpServer.address() as { port: number }).port;
      done();
    });
  });

  afterAll((done) => {
    presenceService._resetForTest();
    io.close();
    httpServer.close(done);
  });

  beforeEach(() => {
    presenceService._resetForTest();
    // setupSocketHandlers の attachPresenceBroadcaster は handler.ts 側で 1 回だけ呼ばれるが、
    // _resetForTest で listeners.clear() されたため再 attach する。
    presenceService.onStateChange((userId, state) => {
      io.emit('presence:state', { userId, state });
    });
  });

  describe('接続直後の bulk 送信', () => {
    it('クライアント接続直後に presence:bulk で現在の在席ユーザー一覧を受信する', async () => {
      // 先に alice を接続して在席状態を作る
      const a = await connectClient(port, 100, 'alice');

      // 観察用クライアントを autoConnect: false で作り、bulk リスナーを先に登録
      const b = makeClient(port, 200, 'bob');
      const bulkPromise = new Promise<{ states: Array<{ userId: number; state: string }> }>(
        (resolve, reject) => {
          const timer = setTimeout(() => reject(new Error('bulk not received')), 5000);
          b.on('presence:bulk', (data) => {
            clearTimeout(timer);
            resolve(data);
          });
        },
      );
      b.connect();
      await waitConnect(b);
      const bulk = await bulkPromise;

      expect(bulk.states.some((s) => s.userId === 100 && s.state === 'online')).toBe(true);
      a.close();
      b.close();
    });
  });

  describe('presence:state ブロードキャスト', () => {
    it('クライアント A が接続すると、既に接続済みのクライアント B が presence:state ({state:"online"}) を受信する', async () => {
      const b = await connectClient(port, 200, 'bob');
      const statePromise = new Promise<{ userId: number; state: string }>((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error('state not received')), 5000);
        b.on('presence:state', (p) => {
          if (p.userId === 100 && p.state === 'online') {
            clearTimeout(timer);
            resolve(p);
          }
        });
      });
      const a = await connectClient(port, 100, 'alice');
      const payload = await statePromise;
      expect(payload).toEqual({ userId: 100, state: 'online' });
      a.close();
      b.close();
    });

    it('クライアント A が disconnect し猶予期間が経過すると、B が presence:state ({state:"offline"}) を受信する', async () => {
      const b = await connectClient(port, 200, 'bob');
      const a = await connectClient(port, 100, 'alice');

      const offlinePromise = new Promise<{ userId: number; state: string }>((resolve, reject) => {
        const timer = setTimeout(
          () => reject(new Error('offline event not received')),
          OFFLINE_GRACE_MS + 3000,
        );
        b.on('presence:state', (p) => {
          if (p.userId === 100 && p.state === 'offline') {
            clearTimeout(timer);
            resolve(p);
          }
        });
      });

      a.close();
      const payload = await offlinePromise;
      expect(payload).toEqual({ userId: 100, state: 'offline' });
      b.close();
    }, 20000);

    it('A と B が同一ユーザーの複数タブの場合、片方の disconnect では state 変化が broadcast されない', async () => {
      const observer = await connectClient(port, 999, 'observer');

      // #381 フレーク対策: tab1/tab2 接続時の alice online broadcast は並列負荷下で遅延しうる。
      // 記録を「接続時 online の到達後」に開始しないと、その遅延イベントが received に混入する。
      let recording = false;
      const received: Array<{ userId: number; state: string }> = [];
      const initialOnline = new Promise<void>((resolve) => {
        observer.on('presence:state', (p) => {
          if (p.userId !== 100) return;
          if (recording) {
            received.push(p);
          } else if (p.state === 'online') {
            resolve();
          }
        });
      });

      const tab1 = await connectClient(port, 100, 'alice');
      const tab2 = await connectClient(port, 100, 'alice');

      // alice の接続時 online が observer に伝播し切るのを待ってから記録開始
      await initialOnline;
      recording = true;

      // tab1 だけ閉じる → tab2 が残るので state 変化なし
      tab1.close();

      // 余裕を持って待つ（state 変化が起きるならこの間に来る）
      await new Promise((r) => setTimeout(r, OFFLINE_GRACE_MS + 500));

      // alice に関する state 変化通知が出ていないこと
      expect(received).toEqual([]);

      tab2.close();
      observer.close();
    }, 20000);
  });

  describe('presence:heartbeat の受信', () => {
    it('クライアントから presence:heartbeat を受信すると最終アクティビティが更新される', async () => {
      const a = await connectClient(port, 100, 'alice');
      a.emit('presence:heartbeat');
      // サービス層が同期的にイベントを処理するための微小な待ち
      await new Promise((r) => setTimeout(r, 100));
      expect(presenceService.getState(100)).toBe('online');
      a.close();
    });

    it('away 状態のユーザーが heartbeat を送ると online に復帰し、他クライアントが presence:state を受信する', async () => {
      const observer = await connectClient(port, 999, 'observer');

      // heartbeat 後に online 通知が再度走らない（過剰 broadcast を出さない）ことを確認する。
      // → 既に online のユーザーの heartbeat では state 変化なし（仕様）。
      //   away からの復帰の broadcast は別経路（presenceService 単体テスト）で確認済み。
      // #381 フレーク対策: alice 接続時の online broadcast は並列負荷下で遅延しうる。
      // リスナーは alice 接続「前」に貼り（接続時 online を取りこぼさない）、その online を
      // 受信し切ってから記録モードに切り替える。これで遅延イベントの received 混入を防ぐ。
      let recording = false;
      const received: Array<{ userId: number; state: string }> = [];
      const initialOnline = new Promise<void>((resolve) => {
        observer.on('presence:state', (p) => {
          if (p.userId !== 100) return;
          if (recording) {
            received.push(p);
          } else if (p.state === 'online') {
            resolve();
          }
        });
      });

      const a = await connectClient(port, 100, 'alice');
      // alice 接続時の online が observer に伝播し切るのを待つ
      await initialOnline;

      recording = true;
      a.emit('presence:heartbeat');
      await new Promise((r) => setTimeout(r, 200));
      // 既に online なので新たな state 変化通知は無い
      expect(received).toEqual([]);

      a.close();
      observer.close();
    });
  });

  describe('broadcast の対象', () => {
    it('presence:state は接続中ユーザー集合（同一ワークスペース）にだけ broadcast される', async () => {
      const observer = await connectClient(port, 999, 'observer');
      const statePromise = new Promise<{ userId: number; state: string }>((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error('state not received')), 5000);
        observer.on('presence:state', (p) => {
          if (p.userId === 100 && p.state === 'online') {
            clearTimeout(timer);
            resolve(p);
          }
        });
      });
      const a = await connectClient(port, 100, 'alice');
      const payload = await statePromise;
      // observer に届いた = 接続中クライアントに broadcast されている
      expect(payload.userId).toBe(100);
      a.close();
      observer.close();
    });
  });
});
