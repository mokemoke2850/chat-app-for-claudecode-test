/**
 * api/client の共通モック定義
 *
 * 使い方:
 *   import { createApiMock } from './__mocks__/apiClient';
 *
 *   vi.mock('../api/client', () => ({
 *     api: createApiMock(),
 *   }));
 *
 *   import { api } from '../api/client';
 *   const mockApi = api as unknown as ReturnType<typeof createApiMock>;
 *
 * 注意: vi.mock() のファクトリは各テストファイルで個別に定義する必要があるが、
 *       createApiMock() を使うことでモック形状を統一できる。
 */

import { vi } from 'vitest';

/** api オブジェクトの全関数をvi.fn()に差し替えたモックを返す */
export function createApiMock() {
  return {
    auth: {
      register: vi.fn(),
      login: vi.fn(),
      logout: vi.fn(),
      me: vi.fn(),
      users: vi.fn(),
      updateProfile: vi.fn(),
    },
    channels: {
      list: vi.fn(),
      create: vi.fn(),
      delete: vi.fn(),
      join: vi.fn(),
      read: vi.fn(),
      getMembers: vi.fn(),
      addMember: vi.fn(),
      removeMember: vi.fn(),
      pin: vi.fn(),
      unpin: vi.fn(),
      getPinned: vi.fn(),
      updateTopic: vi.fn(),
      getAttachments: vi.fn(),
    },
    messages: {
      list: vi.fn(),
      send: vi.fn(),
      edit: vi.fn(),
      delete: vi.fn(),
      react: vi.fn(),
      unreact: vi.fn(),
      pin: vi.fn(),
      unpin: vi.fn(),
      getPinned: vi.fn(),
    },
    bookmarks: {
      list: vi.fn(),
      add: vi.fn(),
      remove: vi.fn(),
    },
    dm: {
      getConversations: vi.fn(),
      getOrCreateConversation: vi.fn(),
      getMessages: vi.fn(),
      sendMessage: vi.fn(),
    },
    files: {
      upload: vi.fn(),
    },
    search: {
      messages: vi.fn(),
    },
    reminders: {
      list: vi.fn(),
      create: vi.fn(),
      delete: vi.fn(),
    },
    admin: {
      getStats: vi.fn(),
      getUsers: vi.fn(),
      updateUser: vi.fn(),
      deleteUser: vi.fn(),
      getChannels: vi.fn(),
      deleteChannel: vi.fn(),
    },
  };
}

export type ApiMock = ReturnType<typeof createApiMock>;
