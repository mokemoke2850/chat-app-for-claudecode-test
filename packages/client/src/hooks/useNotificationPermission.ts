import { useEffect, useState } from 'react';

export type NotificationPermissionState = NotificationPermission | 'unsupported';

export interface UseNotificationPermissionResult {
  permission: NotificationPermissionState;
  requestPermission: () => Promise<NotificationPermissionState>;
}

function readInitialPermission(): NotificationPermissionState {
  if (typeof Notification === 'undefined') return 'unsupported';
  return Notification.permission;
}

function permissionStateToNotificationPermission(state: PermissionState): NotificationPermission {
  return state === 'prompt' ? 'default' : state;
}

/**
 * ブラウザ通知許可状態を購読するフック。
 *
 * - 初期値は `Notification.permission`（未対応環境では 'unsupported'）
 * - Permissions API (`navigator.permissions.query({ name: 'notifications' })`) を
 *   購読し、ユーザーがブラウザ設定で許可状態を変更した際に再描画する
 * - `requestPermission()` で許可リクエストを発火し、結果に応じて state を更新する
 */
export function useNotificationPermission(): UseNotificationPermissionResult {
  const [permission, setPermission] = useState<NotificationPermissionState>(readInitialPermission);

  useEffect(() => {
    if (typeof Notification === 'undefined') return;
    if (typeof navigator === 'undefined' || !navigator.permissions?.query) return;

    let cancelled = false;
    let status: PermissionStatus | null = null;
    const handleChange = () => {
      if (cancelled || !status) return;
      setPermission(permissionStateToNotificationPermission(status.state));
    };

    navigator.permissions
      .query({ name: 'notifications' as PermissionName })
      .then((s) => {
        if (cancelled) return;
        status = s;
        setPermission(permissionStateToNotificationPermission(s.state));
        s.addEventListener('change', handleChange);
      })
      .catch(() => {
        // Permissions API が 'notifications' を未サポートな環境ではフォールバック
        // （Notification.permission の初期値のみ使う）
      });

    return () => {
      cancelled = true;
      if (status) status.removeEventListener('change', handleChange);
    };
  }, []);

  const requestPermission = async (): Promise<NotificationPermissionState> => {
    if (typeof Notification === 'undefined') return 'unsupported';
    const result = await Notification.requestPermission();
    setPermission(result);
    return result;
  };

  return { permission, requestPermission };
}
