/**
 * 監査ログの型定義
 */

export type AuditActionType =
  | 'auth.login'
  | 'auth.logout'
  | 'channel.create'
  | 'channel.delete'
  | 'channel.archive'
  | 'channel.unarchive'
  | 'message.delete'
  | 'user.role_change'
  | 'user.status_change'
  | 'user.delete';

export type AuditTargetType = 'channel' | 'message' | 'user';

/** フロント/バック共通のレスポンス形状 */
export interface AuditLog {
  id: number;
  actorUserId: number | null;
  actorUsername: string | null;
  actionType: AuditActionType;
  targetType: AuditTargetType | null;
  targetId: number | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
}

export interface AuditLogListResponse {
  logs: AuditLog[];
  total: number;
}
