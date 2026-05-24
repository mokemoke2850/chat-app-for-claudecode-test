/**
 * テスト対象: hooks/useNotificationPermission.ts
 * 戦略:
 *   - グローバル Notification を差し替え、permission の初期値・requestPermission 結果を制御する
 *   - navigator.permissions.query をモックし、PermissionStatus の change イベント発火で UI 更新を検証する
 *   - 非対応環境では 'unsupported' を返すフォールバックを検証する
 */

import { renderHook, act, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { useNotificationPermission } from '../useNotificationPermission';

type ChangeHandler = (this: PermissionStatus, ev: Event) => unknown;

interface FakePermissionStatus {
  state: PermissionState;
  addEventListener: ReturnType<typeof vi.fn>;
  removeEventListener: ReturnType<typeof vi.fn>;
  triggerChange: (newState: PermissionState) => void;
}

function setNotification(
  perm: NotificationPermission | undefined,
  requestPermission?: ReturnType<typeof vi.fn>,
) {
  const g = globalThis as unknown as { Notification?: unknown };
  if (perm === undefined) {
    delete g.Notification;
    return;
  }
  g.Notification = {
    permission: perm,
    requestPermission: requestPermission ?? vi.fn().mockResolvedValue(perm),
  };
}

function setPermissionsQuery(initialState: PermissionState | null): FakePermissionStatus | null {
  if (initialState === null) {
    Object.defineProperty(navigator, 'permissions', {
      configurable: true,
      value: undefined,
    });
    return null;
  }
  const handlers: ChangeHandler[] = [];
  const status: FakePermissionStatus = {
    state: initialState,
    addEventListener: vi.fn((event: string, handler: ChangeHandler) => {
      if (event === 'change') handlers.push(handler);
    }),
    removeEventListener: vi.fn((event: string, handler: ChangeHandler) => {
      if (event === 'change') {
        const idx = handlers.indexOf(handler);
        if (idx >= 0) handlers.splice(idx, 1);
      }
    }),
    triggerChange(newState: PermissionState) {
      this.state = newState;
      for (const h of handlers) h.call(this as unknown as PermissionStatus, new Event('change'));
    },
  };
  Object.defineProperty(navigator, 'permissions', {
    configurable: true,
    value: {
      query: vi.fn().mockResolvedValue(status),
    },
  });
  return status;
}

afterEach(() => {
  setNotification(undefined);
  Object.defineProperty(navigator, 'permissions', {
    configurable: true,
    value: undefined,
  });
});

describe('useNotificationPermission', () => {
  describe('初期値', () => {
    it('Notification.permission が "default" のとき "default" を返す', () => {
      setNotification('default');
      setPermissionsQuery(null);
      const { result } = renderHook(() => useNotificationPermission());
      expect(result.current.permission).toBe('default');
    });

    it('Notification.permission が "granted" のとき "granted" を返す', () => {
      setNotification('granted');
      setPermissionsQuery(null);
      const { result } = renderHook(() => useNotificationPermission());
      expect(result.current.permission).toBe('granted');
    });

    it('Notification.permission が "denied" のとき "denied" を返す', () => {
      setNotification('denied');
      setPermissionsQuery(null);
      const { result } = renderHook(() => useNotificationPermission());
      expect(result.current.permission).toBe('denied');
    });

    it('Notification API が存在しない環境では "unsupported" を返す', () => {
      setNotification(undefined);
      setPermissionsQuery(null);
      const { result } = renderHook(() => useNotificationPermission());
      expect(result.current.permission).toBe('unsupported');
    });
  });

  describe('変更の追従', () => {
    it('navigator.permissions.query で取得した PermissionStatus の change イベントで state が更新される', async () => {
      setNotification('default');
      const status = setPermissionsQuery('prompt');
      const { result } = renderHook(() => useNotificationPermission());
      await waitFor(() => {
        expect(status!.addEventListener).toHaveBeenCalledWith('change', expect.any(Function));
      });
      act(() => {
        // ブラウザで granted に変更されたケースをエミュレート
        status!.triggerChange('granted');
      });
      await waitFor(() => expect(result.current.permission).toBe('granted'));
    });

    it('Permissions API 非対応環境では change 購読を行わず初期値のみ返す', () => {
      setNotification('default');
      setPermissionsQuery(null);
      const { result } = renderHook(() => useNotificationPermission());
      expect(result.current.permission).toBe('default');
      // navigator.permissions が undefined のため、query が呼ばれないこと自体は型上保証
      expect((navigator as unknown as { permissions?: unknown }).permissions).toBeUndefined();
    });
  });

  describe('requestPermission', () => {
    it('ユーザーが許可した場合、state が "granted" に更新される', async () => {
      const reqFn = vi.fn().mockResolvedValue('granted');
      setNotification('default', reqFn);
      setPermissionsQuery(null);
      const { result } = renderHook(() => useNotificationPermission());
      await act(async () => {
        await result.current.requestPermission();
      });
      expect(reqFn).toHaveBeenCalled();
      expect(result.current.permission).toBe('granted');
    });

    it('ユーザーが拒否した場合、state が "denied" に更新される', async () => {
      const reqFn = vi.fn().mockResolvedValue('denied');
      setNotification('default', reqFn);
      setPermissionsQuery(null);
      const { result } = renderHook(() => useNotificationPermission());
      await act(async () => {
        await result.current.requestPermission();
      });
      expect(result.current.permission).toBe('denied');
    });

    it('Notification API 未対応環境では何もせず "unsupported" を返す', async () => {
      setNotification(undefined);
      setPermissionsQuery(null);
      const { result } = renderHook(() => useNotificationPermission());
      let returned: string | undefined;
      await act(async () => {
        returned = await result.current.requestPermission();
      });
      expect(returned).toBe('unsupported');
      expect(result.current.permission).toBe('unsupported');
    });
  });
});
