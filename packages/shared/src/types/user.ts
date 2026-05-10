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
  /**
   * #305 拡張プロフィール項目。
   * いずれも任意項目。サーバ側で永続化されている場合のみ値を持つ。
   */
  /** 自己紹介（複数行可、上限 1000 文字） */
  bio?: string | null;
  /** 役職（上限 100 文字） */
  jobTitle?: string | null;
  /** 部署（上限 100 文字） */
  department?: string | null;
  /** IANA 形式タイムゾーン（例: "Asia/Tokyo"） */
  timezone?: string | null;
  /** GitHub URL（http/https のみ） */
  githubUrl?: string | null;
  /** SNS URL（http/https のみ） */
  snsUrl?: string | null;
}

/** #305 拡張プロフィール各項目の文字数上限 */
export const EXTENDED_PROFILE_LIMITS = {
  bio: 1000,
  jobTitle: 100,
  department: 100,
} as const;
