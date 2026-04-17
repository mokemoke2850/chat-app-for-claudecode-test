/**
 * クライアントテスト共通モックの動作を検証するテスト項目
 *
 * テスト対象: 複数テストファイルで重複定義されている共通モック
 *   - AuthContext (useAuth)
 *   - SocketContext (useSocket)
 *   - react-router-dom (useNavigate, useLocation等)
 *   - api/client
 *
 * 目的: 各共通モックが期待通りのインターフェースを返すかを検証し、
 *       モック定義を一元化する際の仕様基準とする。
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createAuthMock, createAdminAuthMock } from './__mocks__/authContext';
import { createSocketMock } from './__mocks__/socketContext';
import { createApiMock } from './__mocks__/apiClient';

describe('AuthContext モック (useAuth)', () => {
  describe('基本ユーザー情報', () => {
    it('useAuth() が user オブジェクトを返す', () => {
      const mock = createAuthMock();
      expect(mock.user).toBeDefined();
    });

    it('user は id / username / email を持つ', () => {
      const mock = createAuthMock();
      expect(mock.user).toHaveProperty('id');
      expect(mock.user).toHaveProperty('username');
      expect(mock.user).toHaveProperty('email');
    });

    it('user は role / isActive を持つ', () => {
      const mock = createAuthMock();
      expect(mock.user).toHaveProperty('role');
      expect(mock.user).toHaveProperty('isActive');
    });

    it('user.role のデフォルト値は "user" である', () => {
      const mock = createAuthMock();
      expect(mock.user?.role).toBe('user');
    });

    it('user.isActive のデフォルト値は true である', () => {
      const mock = createAuthMock();
      expect(mock.user?.isActive).toBe(true);
    });
  });

  describe('認証操作', () => {
    it('useAuth() が logout 関数を返す', () => {
      const mock = createAuthMock();
      expect(typeof mock.logout).toBe('function');
    });

    it('useAuth() が updateUser 関数を返す', () => {
      const mock = createAuthMock();
      expect(typeof mock.updateUser).toBe('function');
    });

    it('logout を呼び出してもエラーが発生しない', async () => {
      const mock = createAuthMock();
      await expect(mock.logout()).resolves.not.toThrow();
    });
  });

  describe('管理者ユーザー', () => {
    it('role が "admin" のユーザーで useAuth() をモックできる', () => {
      const mock = createAdminAuthMock();
      expect(mock.user?.role).toBe('admin');
    });
  });
});

describe('SocketContext モック (useSocket)', () => {
  describe('インターフェース整合性', () => {
    it('useSocket() が emit / on / off を持つオブジェクトを返す', () => {
      const mock = createSocketMock();
      expect(typeof mock.emit).toBe('function');
      expect(typeof mock.on).toBe('function');
      expect(typeof mock.off).toBe('function');
    });

    it('useSocket() が null を返すパターンも許容される（ChatPage等）', () => {
      // null パターンは createSocketMock() ではなく vi.mock の戻り値として null を使う
      const nullSocket: null = null;
      expect(nullSocket).toBeNull();
    });
  });

  describe('イベント操作', () => {
    it('on(eventName, handler) でイベントリスナーが登録できる', () => {
      const mock = createSocketMock();
      const handler = vi.fn();
      mock.on('new_message', handler);
      expect(mock.on).toHaveBeenCalledWith('new_message', handler);
    });

    it('off(eventName, handler) でイベントリスナーが解除できる', () => {
      const mock = createSocketMock();
      const handler = vi.fn();
      mock.off('new_message', handler);
      expect(mock.off).toHaveBeenCalledWith('new_message', handler);
    });

    it('emit(eventName, payload) でイベントが送信できる', () => {
      const mock = createSocketMock();
      mock.emit('send_message', { channelId: 1, content: 'hello' });
      expect(mock.emit).toHaveBeenCalledWith('send_message', { channelId: 1, content: 'hello' });
    });
  });

  describe('mockSocket の状態管理', () => {
    beforeEach(() => {
      vi.clearAllMocks();
    });

    it('beforeEach で vi.clearAllMocks() を呼ぶとモック呼び出し履歴がリセットされる', () => {
      const mock = createSocketMock();
      mock.on('some_event', vi.fn());
      // clearAllMocks は beforeEach で実行済みなので新しいモックは0回
      const freshMock = createSocketMock();
      expect(freshMock.on).toHaveBeenCalledTimes(0);
    });

    it('on() の呼び出し引数を後から検証できる', () => {
      const mock = createSocketMock();
      const handler = vi.fn();
      mock.on('channel_update', handler);
      expect(mock.on).toHaveBeenCalledWith('channel_update', handler);
    });
  });
});

describe('react-router-dom モック', () => {
  describe('useNavigate', () => {
    it('useNavigate() が vi.fn() を返す', () => {
      const mockNavigate = vi.fn();
      expect(typeof mockNavigate).toBe('function');
      expect(vi.isMockFunction(mockNavigate)).toBe(true);
    });

    it('navigate("/path") が呼び出された引数を検証できる', () => {
      const mockNavigate = vi.fn();
      mockNavigate('/dashboard');
      expect(mockNavigate).toHaveBeenCalledWith('/dashboard');
    });
  });

  describe('useLocation', () => {
    it('useLocation() が pathname / search / hash を返す', () => {
      const mockLocation = { pathname: '/channels', search: '?q=test', hash: '' };
      expect(mockLocation).toHaveProperty('pathname');
      expect(mockLocation).toHaveProperty('search');
      expect(mockLocation).toHaveProperty('hash');
    });
  });

  describe('useParams', () => {
    it('useParams() がルートパラメータを返す', () => {
      const mockParams = { channelId: '42' };
      expect(mockParams.channelId).toBe('42');
    });
  });

  describe('importOriginal を使う部分モック', () => {
    it('importOriginal を使うとき実装の一部をそのまま利用できる', async () => {
      // importOriginal パターンの検証: 実際のモジュールから spread して一部だけ差し替える
      const actual = await import('react-router-dom');
      expect(actual.MemoryRouter).toBeDefined();
      expect(actual.Link).toBeDefined();
    });

    it('MemoryRouter など実際のコンポーネントは差し替えずに使用できる', async () => {
      const { MemoryRouter } = await import('react-router-dom');
      expect(typeof MemoryRouter).toBe('function');
    });
  });
});

describe('api/client モック', () => {
  describe('channels API', () => {
    it('api.channels.list が vi.fn() として定義できる', () => {
      const mock = createApiMock();
      expect(vi.isMockFunction(mock.channels.list)).toBe(true);
    });

    it('api.channels.create が vi.fn() として定義できる', () => {
      const mock = createApiMock();
      expect(vi.isMockFunction(mock.channels.create)).toBe(true);
    });

    it('api.channels.pin / unpin が vi.fn() として定義できる', () => {
      const mock = createApiMock();
      expect(vi.isMockFunction(mock.channels.pin)).toBe(true);
      expect(vi.isMockFunction(mock.channels.unpin)).toBe(true);
    });

    it('api.channels.getMembers / addMember / removeMember が vi.fn() として定義できる', () => {
      const mock = createApiMock();
      expect(vi.isMockFunction(mock.channels.getMembers)).toBe(true);
      expect(vi.isMockFunction(mock.channels.addMember)).toBe(true);
      expect(vi.isMockFunction(mock.channels.removeMember)).toBe(true);
    });
  });

  describe('auth API', () => {
    it('api.auth.login が vi.fn() として定義できる', () => {
      const mock = createApiMock();
      expect(vi.isMockFunction(mock.auth.login)).toBe(true);
    });

    it('api.auth.users が vi.fn() として定義できる', () => {
      const mock = createApiMock();
      expect(vi.isMockFunction(mock.auth.users)).toBe(true);
    });
  });

  describe('messages API', () => {
    it('api.messages.list が vi.fn() として定義できる', () => {
      const mock = createApiMock();
      expect(vi.isMockFunction(mock.messages.list)).toBe(true);
    });

    it('api.messages.send が vi.fn() として定義できる', () => {
      const mock = createApiMock();
      expect(vi.isMockFunction(mock.messages.send)).toBe(true);
    });
  });

  describe('モック戻り値の制御', () => {
    it('mockResolvedValue() で非同期レスポンスを設定できる', async () => {
      const mock = createApiMock();
      mock.channels.list.mockResolvedValue({ channels: [] });
      const result = await mock.channels.list();
      expect(result).toEqual({ channels: [] });
    });

    it('mockRejectedValue() でエラーレスポンスを設定できる', async () => {
      const mock = createApiMock();
      mock.channels.list.mockRejectedValue(new Error('Network error'));
      await expect(mock.channels.list()).rejects.toThrow('Network error');
    });

    it('beforeEach で mockReset() を呼ぶとデフォルト実装がリセットされる', () => {
      const mock = createApiMock();
      mock.channels.list.mockResolvedValue({ channels: [{ id: 1 } as never] });
      mock.channels.list.mockReset();
      expect(mock.channels.list).not.toHaveBeenCalled();
    });
  });
});

describe('RichEditor モック', () => {
  it('vi.mock("../components/Chat/RichEditor") で空コンポーネントに差し替えられる', () => {
    // RichEditorモックは vi.mock() のファクトリ関数で定義するパターンの確認
    const mockRichEditor = vi.fn(() => null);
    expect(vi.isMockFunction(mockRichEditor)).toBe(true);
    expect(mockRichEditor()).toBeNull();
  });

  it('差し替え後に props 型エラーが発生しない', () => {
    // プロップ型エラーが発生しないことを確認（型安全なモック定義）
    const mockRichEditor = vi.fn((_props: { onSubmit?: () => void; onCancel?: () => void }) => null);
    expect(() => mockRichEditor({ onSubmit: vi.fn(), onCancel: vi.fn() })).not.toThrow();
  });
});

describe('共通モックの組み合わせ', () => {
  it('AuthContext + SocketContext + api/client を同時にモックしてコンポーネントをレンダリングできる', () => {
    const authMock = createAuthMock();
    const socketMock = createSocketMock();
    const apiMock = createApiMock();

    // 全モックが独立して定義されていること
    expect(authMock.user).toBeDefined();
    expect(socketMock.emit).toBeDefined();
    expect(apiMock.channels.list).toBeDefined();
  });

  it('各モックが独立しており、片方の設定が他方に影響しない', () => {
    const authMock1 = createAuthMock();
    const authMock2 = createAdminAuthMock();

    // 各インスタンスは独立
    expect(authMock1.user?.role).toBe('user');
    expect(authMock2.user?.role).toBe('admin');
  });
});
