/**
 * 監査ログの型定義
 */

export type AuditActionType =
  | 'auth.login'
  | 'auth.logout'
  | 'auth.onboarding.complete'
  | 'channel.create'
  | 'channel.delete'
  | 'channel.archive'
  | 'channel.unarchive'
  | 'channel.permission.update'
  | 'message.delete'
  | 'user.role_change'
  | 'user.status_change'
  | 'user.delete'
  | 'admin.channel.recommend'
  | 'admin.channel.unrecommend'
  | 'audit.export'
  | 'invite.create'
  | 'invite.revoke'
  | 'invite.redeem'
  | 'moderation.ngword.create'
  | 'moderation.ngword.update'
  | 'moderation.ngword.delete'
  | 'moderation.blocklist.add'
  | 'moderation.blocklist.remove';

export interface AuditLogExportQuery {
  from?: string; // ISO8601
  to?: string; // ISO8601
  actionType?: string;
  actorUserId?: number;
}

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
