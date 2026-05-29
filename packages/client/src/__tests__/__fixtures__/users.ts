import type { User } from '@chat-app/shared';

/**
 * テスト共通フィクスチャ: User ファクトリ
 * 各テストで必要なフィールドだけ overrides で上書きして使う。
 */
export function makeUser(overrides: Partial<User> = {}): User {
  return {
    id: 1,
    username: 'alice',
    email: 'alice@example.com',
    avatarUrl: null,
    displayName: null,
    location: null,
    createdAt: '2024-01-01T00:00:00Z',
    role: 'user',
    isActive: true,
    onboardingCompletedAt: null,
    ...overrides,
  };
}

/**
 * テスト共通フィクスチャ: ダミーユーザー一覧
 * MessageItem / MessageItemReaction などで共用する
 */
export const dummyUsers: User[] = [
  {
    id: 1,
    username: 'alice',
    email: 'alice@example.com',
    avatarUrl: null,
    displayName: null,
    location: null,
    createdAt: '2024-01-01T00:00:00Z',
    role: 'user',
    isActive: true,
    onboardingCompletedAt: null,
  },
  {
    id: 2,
    username: 'bob',
    email: 'bob@example.com',
    avatarUrl: null,
    displayName: null,
    location: null,
    createdAt: '2024-01-01T00:00:00Z',
    role: 'user',
    isActive: true,
    onboardingCompletedAt: null,
  },
];
