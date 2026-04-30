/**
 * #146 オンライン/オフラインステータス
 *
 * ユーザーの在席状況を表す 3 値の状態。
 * - online: アクティブ（接続中かつ最終アクティビティから 5 分未満）
 * - away: 接続中だが最終アクティビティから 5 分以上経過
 * - offline: 接続が無く、disconnect 猶予期間も経過
 */
export type PresenceState = 'online' | 'away' | 'offline';

/**
 * 単一ユーザーの状態通知ペイロード（presence:state）。
 */
export interface PresenceUpdate {
  userId: number;
  state: PresenceState;
}

/**
 * 接続直後に受信する一括スナップショット（presence:bulk）。
 * offline は含めず、online / away のみを含める。
 */
export interface PresenceBulk {
  states: PresenceUpdate[];
}
