import type { PresenceState } from './presence';
import type { AccentColor } from './accentColor';

/** #147 カスタムステータス情報 */
export interface UserStatus {
  /** 絵文字（未設定時は null） */
  emoji: string | null;
  /** テキスト（未設定時は null） */
  text: string | null;
  /** 有効期限 ISO 文字列（null = 無期限） */
  expiresAt: string | null;
}

export interface User {
  id: number;
  username: string;
  email: string;
  avatarUrl: string | null;
  displayName: string | null;
  location: string | null;
  createdAt: string;
  role: 'user' | 'admin';
  isActive: boolean;
  onboardingCompletedAt: string | null;
  /**
   * #146 プレゼンス（オンライン/オフラインステータス）。
   * サーバが /api/auth/users などで返却する際に付与する。
   * 永続化されたカラムではないため optional。
   */
  presenceState?: PresenceState;
  /**
   * #147 カスタムステータス。
   * 期限切れの場合はサーバ側でフィルタして null を返す。
   * 未設定またはすべてクリア済みの場合も null。
   */
  status?: UserStatus | null;
  /**
   * #274 アクセントカラー（プリセット名）。
   * null の場合はクライアント側でデフォルト値（blue）を適用する。
   */
  accentColor?: AccentColor | null;
}
