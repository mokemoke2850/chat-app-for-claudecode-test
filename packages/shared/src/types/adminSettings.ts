export type MaintenanceRestriction = 'posting' | 'upload' | 'login';

export interface MaintenanceModeSettings {
  enabled: boolean;
  message: string;
  restrictedOperations: MaintenanceRestriction[];
  updatedAt: string | null;
}

export interface SettingsExportChannel {
  name: string;
  description: string | null;
  isPrivate: boolean;
  isArchived: boolean;
  isRecommended: boolean;
  postingPermission: string;
}

export interface SettingsExportNotification {
  username: string;
  channelName: string;
  level: string;
}

export interface SettingsExportNgWord {
  pattern: string;
  isRegex: boolean;
  action: string;
  isActive: boolean;
}

export interface SettingsExportPermission {
  username: string;
  role: 'user' | 'admin';
}

export interface SettingsExportData {
  schemaVersion: 1;
  exportedAt: string;
  channels: SettingsExportChannel[];
  notifications: SettingsExportNotification[];
  ngWords: SettingsExportNgWord[];
  permissions: SettingsExportPermission[];
}

export interface SettingsImportDiff {
  channels: { added: number; updated: number; removed: number };
  notifications: { added: number; updated: number; removed: number };
  ngWords: { added: number; updated: number; removed: number };
  permissions: { updated: number };
}

export interface SettingsImportPreview {
  valid: true;
  diff: SettingsImportDiff;
}
