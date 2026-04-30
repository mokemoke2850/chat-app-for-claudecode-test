/**
 * #146 オンライン/オフラインステータス
 *
 * メモリ上でユーザーの在席状況を管理するサービス。
 *
 * 仕様:
 *   - state は 'online' | 'away' | 'offline' の 3 値
 *   - 同一ユーザーが複数 Socket で接続中は online を維持する
 *   - 離席判定: 最終アクティビティから AWAY_TIMEOUT_MS 経過で away
 *   - オフライン判定: 全 Socket disconnect から OFFLINE_GRACE_MS 経過で offline
 *
 * このモジュールは Express / Socket 層から独立しており、純粋なメモリ管理と
 * リスナー通知のみを担う。タイマーは setTimeout / clearTimeout を使用する。
 */

import type { PresenceState } from '@chat-app/shared';

/** 離席判定閾値: 最終アクティビティから 5 分（300_000ms） */
export const AWAY_TIMEOUT_MS = 5 * 60 * 1000;

/** オフライン判定の disconnect 猶予期間: 8 秒（テスト環境では OFFLINE_GRACE_MS=500 などに短縮可） */
export const OFFLINE_GRACE_MS = process.env.OFFLINE_GRACE_MS
  ? parseInt(process.env.OFFLINE_GRACE_MS, 10)
  : 8 * 1000;

/** 単一ユーザーの内部状態 */
interface UserPresence {
  /** 現在接続中の Socket ID 集合 */
  socketIds: Set<string>;
  /** 最後に活動した時刻（ms） */
  lastActiveAt: number;
  /** 公開 state */
  state: PresenceState;
  /** away への遷移タイマー */
  awayTimer: ReturnType<typeof setTimeout> | null;
  /** offline への遷移タイマー（disconnect 猶予） */
  offlineTimer: ReturnType<typeof setTimeout> | null;
}

type Listener = (userId: number, state: PresenceState) => void;

const users = new Map<number, UserPresence>();
const listeners = new Set<Listener>();

function notify(userId: number, state: PresenceState): void {
  for (const l of listeners) {
    try {
      l(userId, state);
    } catch {
      // リスナーで例外が起きても他のリスナー通知を止めない
    }
  }
}

function clearAwayTimer(p: UserPresence): void {
  if (p.awayTimer) {
    clearTimeout(p.awayTimer);
    p.awayTimer = null;
  }
}

function clearOfflineTimer(p: UserPresence): void {
  if (p.offlineTimer) {
    clearTimeout(p.offlineTimer);
    p.offlineTimer = null;
  }
}

function scheduleAway(userId: number, p: UserPresence): void {
  clearAwayTimer(p);
  p.awayTimer = setTimeout(() => {
    const cur = users.get(userId);
    if (!cur) return;
    if (cur.socketIds.size === 0) return; // 既に offline 移行候補なので何もしない
    if (cur.state !== 'away') {
      cur.state = 'away';
      notify(userId, 'away');
    }
  }, AWAY_TIMEOUT_MS);
}

/**
 * 状態変化通知のリスナーを登録する。返り値はリスナー解除関数。
 */
export function onStateChange(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/**
 * Socket 接続を登録する。新規 online 化や猶予期間中の復帰を扱う。
 */
export function handleConnect(userId: number, socketId: string): void {
  const now = Date.now();
  let p = users.get(userId);

  if (!p) {
    p = {
      socketIds: new Set([socketId]),
      lastActiveAt: now,
      state: 'online',
      awayTimer: null,
      offlineTimer: null,
    };
    users.set(userId, p);
    scheduleAway(userId, p);
    notify(userId, 'online');
    return;
  }

  // 既存エントリに socket を追加
  p.socketIds.add(socketId);
  // disconnect 猶予中なら offline 化タイマーを取消
  clearOfflineTimer(p);

  const wasOnline = p.state === 'online';
  p.lastActiveAt = now;
  scheduleAway(userId, p);
  if (!wasOnline) {
    p.state = 'online';
    notify(userId, 'online');
  }
}

/**
 * Socket 切断を登録する。残接続があれば何もしない。
 * 全切断のときは OFFLINE_GRACE_MS の猶予後に offline 化する。
 */
export function handleDisconnect(userId: number, socketId: string): void {
  const p = users.get(userId);
  if (!p) return;
  p.socketIds.delete(socketId);
  if (p.socketIds.size > 0) return;

  // 全 Socket 切断 → 猶予を持って offline 化
  clearAwayTimer(p);
  clearOfflineTimer(p);
  p.offlineTimer = setTimeout(() => {
    const cur = users.get(userId);
    if (!cur) return;
    if (cur.socketIds.size > 0) return; // 猶予中に再接続済み
    users.delete(userId);
    notify(userId, 'offline');
  }, OFFLINE_GRACE_MS);
}

/**
 * クライアントからのハートビート（操作検知）を受け取り、
 * 最終アクティビティを更新する。away 状態なら online に復帰する。
 */
export function handleHeartbeat(userId: number): void {
  const p = users.get(userId);
  if (!p) return;
  p.lastActiveAt = Date.now();
  scheduleAway(userId, p);
  if (p.state !== 'online') {
    p.state = 'online';
    notify(userId, 'online');
  }
}

/**
 * 指定ユーザーの現在の state を返す。未登録ユーザーは 'offline'。
 */
export function getState(userId: number): PresenceState {
  const p = users.get(userId);
  return p ? p.state : 'offline';
}

/**
 * online / away のユーザー一覧を返す（offline は含めない）。
 */
export function getBulk(): Array<{ userId: number; state: PresenceState }> {
  const result: Array<{ userId: number; state: PresenceState }> = [];
  for (const [userId, p] of users) {
    if (p.state === 'online' || p.state === 'away') {
      result.push({ userId, state: p.state });
    }
  }
  return result;
}

/**
 * テスト用: 全状態とタイマーをクリアする。
 */
export function _resetForTest(): void {
  for (const p of users.values()) {
    clearAwayTimer(p);
    clearOfflineTimer(p);
  }
  users.clear();
  listeners.clear();
}
