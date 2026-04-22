/**
 * AuthContext (useAuth) の共通モック定義
 *
 * 使い方:
 *   import { createAuthMock } from './__mocks__/authContext';
 *
 *   vi.mock('../contexts/AuthContext', () => ({
 *     useAuth: () => createAuthMock(),
 *   }));
 */

import { vi } from 'vitest';
import type { User } from '@chat-app/shared';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyFn = (...args: any[]) => any;

export interface AuthMock {
  user: User | null;
  logout: ReturnType<typeof vi.fn<AnyFn>>;
  updateUser: ReturnType<typeof vi.fn<AnyFn>>;
  login: ReturnType<typeof vi.fn<AnyFn>>;
  register: ReturnType<typeof vi.fn<AnyFn>>;
}

/** デフォルトのテストユーザー (role: 'user') */
export const defaultTestUser: User = {
  id: 1,
  username: 'testuser',
  email: 'test@example.com',
  role: 'user',
  isActive: true,
  createdAt: '2024-01-01T00:00:00Z',
  displayName: null,
  location: null,
  avatarUrl: null,
  onboardingCompletedAt: null,
};

/** デフォルト (role: 'user') の useAuth モックを作成する */
export function createAuthMock(overrides: Partial<User> = {}): AuthMock {
  return {
    user: { ...defaultTestUser, ...overrides },
    logout: vi.fn<AnyFn>().mockResolvedValue(undefined),
    updateUser: vi.fn<AnyFn>(),
    login: vi.fn<AnyFn>().mockResolvedValue(undefined),
    register: vi.fn<AnyFn>().mockResolvedValue(undefined),
  };
}

/** role: 'admin' の useAuth モックを作成する */
export function createAdminAuthMock(): AuthMock {
  return createAuthMock({ role: 'admin', id: 99, username: 'admin', email: 'admin@example.com' });
}
