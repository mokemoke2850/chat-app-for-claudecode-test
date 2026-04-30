import type { PresenceState } from './presence';

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
}
