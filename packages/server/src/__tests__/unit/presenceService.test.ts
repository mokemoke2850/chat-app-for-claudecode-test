/**
 * テスト対象: presenceService（新規）
 *
 * 戦略:
 *   - メモリ内に在席集合とアクティビティ時刻を保持するサービスを直接呼び出して検証する
 *   - 時間経過が絡む判定は jest.useFakeTimers() でタイマーを進めて検証する
 *   - DB アクセスはなく、純粋な単体テストとして扱う
 *
 * 仕様前提（ユーザー承認済み）:
 *   - 状態は 'online' | 'away' | 'offline' の 3 値
 *   - 離席判定は 5 分（固定）
 *   - 同一ユーザーが複数 Socket 接続中は online を維持
 *   - 全 disconnect 後 5〜10 秒の猶予を経て offline 判定
 */

import * as presence from '../../services/presenceService';
import { AWAY_TIMEOUT_MS, OFFLINE_GRACE_MS } from '../../services/presenceService';

beforeEach(() => {
  jest.useFakeTimers();
  presence._resetForTest();
});

afterEach(() => {
  presence._resetForTest();
  jest.useRealTimers();
});

describe('presenceService', () => {
  describe('connect / 単一接続', () => {
    it('1 件接続すると当該ユーザーは online になる', () => {
      presence.handleConnect(1, 'sock-a');
      expect(presence.getState(1)).toBe('online');
    });

    it('online のユーザーを取得すると state="online" が返る', () => {
      presence.handleConnect(2, 'sock-a');
      expect(presence.getState(2)).toBe('online');
    });
  });

  describe('複数タブ（複数 Socket）', () => {
    it('同一ユーザーが 2 つの Socket で接続中は online を維持する', () => {
      presence.handleConnect(1, 'sock-a');
      presence.handleConnect(1, 'sock-b');
      expect(presence.getState(1)).toBe('online');
    });

    it('1 本目の Socket が disconnect しても他の Socket が残っていれば online を維持する', () => {
      presence.handleConnect(1, 'sock-a');
      presence.handleConnect(1, 'sock-b');
      presence.handleDisconnect(1, 'sock-a');
      // 猶予期間相当を進めても残接続があるため online のまま
      jest.advanceTimersByTime(OFFLINE_GRACE_MS + 1000);
      expect(presence.getState(1)).toBe('online');
    });
  });

  describe('disconnect 猶予期間', () => {
    it('全 Socket が disconnect した直後は猶予期間中のため online を維持する', () => {
      presence.handleConnect(1, 'sock-a');
      presence.handleDisconnect(1, 'sock-a');
      // まだ猶予期間内
      jest.advanceTimersByTime(OFFLINE_GRACE_MS - 1000);
      expect(presence.getState(1)).toBe('online');
    });

    it('全 disconnect 後、猶予期間が経過すると offline に遷移する', () => {
      presence.handleConnect(1, 'sock-a');
      presence.handleDisconnect(1, 'sock-a');
      jest.advanceTimersByTime(OFFLINE_GRACE_MS + 100);
      expect(presence.getState(1)).toBe('offline');
    });

    it('猶予期間中に再接続すると online に復帰し offline タイマーがキャンセルされる', () => {
      presence.handleConnect(1, 'sock-a');
      presence.handleDisconnect(1, 'sock-a');
      // 猶予期間内に新しい Socket で再接続
      jest.advanceTimersByTime(OFFLINE_GRACE_MS / 2);
      presence.handleConnect(1, 'sock-b');
      // さらに猶予期間相当進めても online のまま
      jest.advanceTimersByTime(OFFLINE_GRACE_MS + 1000);
      expect(presence.getState(1)).toBe('online');
    });
  });

  describe('離席（away）判定', () => {
    it('最終アクティビティから 5 分経過で away に遷移する', () => {
      presence.handleConnect(1, 'sock-a');
      jest.advanceTimersByTime(AWAY_TIMEOUT_MS + 100);
      expect(presence.getState(1)).toBe('away');
    });

    it('away 中に heartbeat を受けると online に復帰する', () => {
      presence.handleConnect(1, 'sock-a');
      jest.advanceTimersByTime(AWAY_TIMEOUT_MS + 100);
      expect(presence.getState(1)).toBe('away');
      presence.handleHeartbeat(1);
      expect(presence.getState(1)).toBe('online');
    });

    it('5 分未満の経過では online のままで away にならない', () => {
      presence.handleConnect(1, 'sock-a');
      jest.advanceTimersByTime(AWAY_TIMEOUT_MS - 1000);
      expect(presence.getState(1)).toBe('online');
    });
  });

  describe('オフライン判定', () => {
    it('一度も接続されていないユーザーは offline を返す', () => {
      expect(presence.getState(99)).toBe('offline');
    });

    it('全 Socket disconnect + 猶予期間経過後は offline を返す', () => {
      presence.handleConnect(7, 'sock-a');
      presence.handleDisconnect(7, 'sock-a');
      jest.advanceTimersByTime(OFFLINE_GRACE_MS + 100);
      expect(presence.getState(7)).toBe('offline');
    });
  });

  describe('状態変化の通知', () => {
    it('状態が変化したときだけリスナー（broadcast コールバック）に通知する', () => {
      const listener = jest.fn();
      presence.onStateChange(listener);
      presence.handleConnect(1, 'sock-a');
      // online 通知 1 回
      expect(listener).toHaveBeenCalledTimes(1);
      expect(listener).toHaveBeenCalledWith(1, 'online');

      jest.advanceTimersByTime(AWAY_TIMEOUT_MS + 100);
      // away 通知が追加で発生
      expect(listener).toHaveBeenCalledWith(1, 'away');

      presence.handleDisconnect(1, 'sock-a');
      jest.advanceTimersByTime(OFFLINE_GRACE_MS + 100);
      expect(listener).toHaveBeenCalledWith(1, 'offline');
    });

    it('online → online のように変化がない場合はリスナーに通知しない', () => {
      presence.handleConnect(1, 'sock-a');
      const listener = jest.fn();
      presence.onStateChange(listener);
      // 既に online のユーザーの追加 Socket では通知が走らない
      presence.handleConnect(1, 'sock-b');
      expect(listener).not.toHaveBeenCalled();
      // heartbeat も online のままなら通知なし
      presence.handleHeartbeat(1);
      expect(listener).not.toHaveBeenCalled();
    });
  });

  describe('一覧取得 / bulk', () => {
    it('現在 online / away のユーザー一覧を取得できる', () => {
      presence.handleConnect(1, 'sock-a');
      presence.handleConnect(2, 'sock-b');
      jest.advanceTimersByTime(AWAY_TIMEOUT_MS + 100);
      // この時点で 1, 2 とも away
      const bulk = presence.getBulk();
      const ids = bulk.map((b) => b.userId).sort();
      expect(ids).toEqual([1, 2]);
      expect(bulk.every((b) => b.state === 'away' || b.state === 'online')).toBe(true);
    });

    it('offline のユーザーは bulk 一覧に含まれない', () => {
      presence.handleConnect(1, 'sock-a');
      presence.handleConnect(2, 'sock-b');
      presence.handleDisconnect(1, 'sock-a');
      jest.advanceTimersByTime(OFFLINE_GRACE_MS + 100);
      // 1 は offline、2 はまだ online
      const ids = presence.getBulk().map((b) => b.userId);
      expect(ids).toContain(2);
      expect(ids).not.toContain(1);
    });
  });
});
