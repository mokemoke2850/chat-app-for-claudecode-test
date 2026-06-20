export interface AdminUser {
  id: number;
  username: string;
  email: string;
  role: 'user' | 'admin';
  isActive: boolean;
  lastLoginAt: string | null;
  createdAt: string;
}

export interface AdminChannel {
  id: number;
  name: string;
  description: string | null;
  isPrivate: boolean;
  memberCount: number;
  isArchived: boolean;
  isRecommended: boolean;
  createdAt: string;
}

export interface AdminStats {
  totalUsers: number;
  totalChannels: number;
  totalMessages: number;
  activeUsersLast24h: number;
  activeUsersLast7d: number;
}

export interface TimeseriesPoint {
  timestamp: string;
  count: number;
}

export interface ChannelTimeseries {
  channelId: number;
  channelName: string;
  points: TimeseriesPoint[];
}

export interface TopChannelByMessageCount {
  channelId: number;
  channelName: string;
  count: number;
}

export interface AdminTimeseriesResponse {
  messages: TimeseriesPoint[];
  activeUsers: TimeseriesPoint[];
  messagesByChannel?: ChannelTimeseries[];
}

export type HealthStatus = 'normal' | 'warning' | 'error';

export interface AdminHealthDetails {
  checkedAt: string;
  overallStatus: HealthStatus;
  components: {
    database: {
      status: HealthStatus;
      reachable: boolean;
      latencyMs: number | null;
      message: string;
    };
    socket: {
      status: HealthStatus;
      running: boolean;
      connectionCount: number;
      message: string;
    };
    jobs: {
      status: HealthStatus;
      workers: Array<{
        key: 'scheduledMessages' | 'messageReminders' | 'calendarReminders';
        label: string;
        status: HealthStatus;
        running: boolean;
        intervalMs: number;
      }>;
      message: string;
    };
    storage: {
      status: HealthStatus;
      writable: boolean;
      totalBytes: number;
      fileCount: number;
      path: string;
      message: string;
    };
  };
}

export type {
  MaintenanceModeSettings,
  MaintenanceRestriction,
  SettingsExportData,
  SettingsImportPreview,
} from '@chat-app/shared';

export type {
  AuditLog,
  AuditActionType,
  AuditTargetType,
  AuditLogListResponse,
} from '@chat-app/shared';
