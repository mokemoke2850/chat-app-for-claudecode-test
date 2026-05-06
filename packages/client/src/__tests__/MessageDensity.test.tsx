// テスト対象: DensityContext / MessageItem / MessageList / ProfilePage（表示密度セクション）
// 戦略: 密度モード（cozy/compact）の切替・永続化・CSS変数適用・UI を複数コンポーネントにまたがって検証する
// 対象ソースファイルが DensityContext・MessageItem・MessageList・ProfilePage と複数にまたがるため独立ファイルとして作成

import { act, render, screen, fireEvent } from '@testing-library/react';
import { renderHook } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { DensityProvider, useDensity } from '../contexts/DensityContext';
import MessageItem from '../components/Chat/MessageItem';
import type { Message, User } from '@chat-app/shared';

// ProfilePage は内部で useAuth / useSnackbar / api を使うため mock が必要
vi.mock('../contexts/AuthContext', () => ({
  useAuth: vi.fn(() => ({
    user: {
      id: 1,
      username: 'alice',
      email: 'alice@example.com',
      displayName: 'Alice',
      avatarUrl: null,
      location: null,
      createdAt: '2024-01-01T00:00:00Z',
      role: 'user',
      isActive: true,
      onboardingCompletedAt: null,
    },
    updateUser: vi.fn(),
  })),
}));

vi.mock('../contexts/SnackbarContext', () => ({
  useSnackbar: vi.fn(() => ({
    showSuccess: vi.fn(),
    showError: vi.fn(),
  })),
}));

vi.mock('../api/client', () => ({
  api: {
    auth: {
      updateProfile: vi.fn(),
      changePassword: vi.fn(),
    },
    tags: {
      setMessageTags: vi.fn(),
    },
  },
}));

vi.mock('../contexts/SocketContext', () => ({
  useSocket: vi.fn(() => null),
}));

vi.mock('../hooks/usePresence', () => ({
  usePresence: vi.fn(() => new Map()),
}));

vi.mock('../components/Layout/AppLayout', () => ({
  default: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

// テスト用のメッセージ・ユーザーフィクスチャ
const testUser: User = {
  id: 1,
  username: 'alice',
  email: 'alice@example.com',
  displayName: 'Alice',
  avatarUrl: null,
  location: null,
  createdAt: '2024-01-01T00:00:00Z',
  role: 'user',
  isActive: true,
  onboardingCompletedAt: null,
  presenceState: undefined,
};

const testMessage: Message = {
  id: 1,
  channelId: 1,
  userId: 1,
  username: 'alice',
  avatarUrl: null,
  content: 'Hello world',
  createdAt: '2024-01-01T12:00:00Z',
  updatedAt: '2024-01-01T12:00:00Z',
  isEdited: false,
  isDeleted: false,
  reactions: [],
  tags: [],
  attachments: [],
  forwardedFromMessage: null,
  event: null,
  mentions: [],
  parentMessageId: null,
  rootMessageId: null,
  replyCount: 0,
  quotedMessageId: null,
  quotedMessage: null,
};

describe('メッセージ密度切替機能', () => {
  beforeEach(() => {
    localStorage.clear();
    // document.documentElement の data-density 属性をリセット
    document.documentElement.removeAttribute('data-density');
  });

  describe('DensityContext', () => {
    it('初期値は cozy になる', () => {
      const { result } = renderHook(() => useDensity(), {
        wrapper: ({ children }) => <DensityProvider>{children}</DensityProvider>,
      });
      expect(result.current.density).toBe('cozy');
    });

    it('setDensity("compact") を呼ぶと density が compact に変わる', () => {
      const { result } = renderHook(() => useDensity(), {
        wrapper: ({ children }) => <DensityProvider>{children}</DensityProvider>,
      });

      act(() => {
        result.current.setDensity('compact');
      });

      expect(result.current.density).toBe('compact');
    });

    it('setDensity("cozy") を呼ぶと density が cozy に戻る', () => {
      const { result } = renderHook(() => useDensity(), {
        wrapper: ({ children }) => <DensityProvider>{children}</DensityProvider>,
      });

      act(() => {
        result.current.setDensity('compact');
      });
      act(() => {
        result.current.setDensity('cozy');
      });

      expect(result.current.density).toBe('cozy');
    });

    it('Provider 外で useDensity を呼ぶとエラーをスローする', () => {
      expect(() => renderHook(() => useDensity())).toThrow(
        'useDensity must be used inside DensityProvider',
      );
    });
  });

  describe('localStorage 永続化', () => {
    it('compact に切り替えると localStorage に "compact" が保存される', () => {
      const { result } = renderHook(() => useDensity(), {
        wrapper: ({ children }) => <DensityProvider>{children}</DensityProvider>,
      });

      act(() => {
        result.current.setDensity('compact');
      });

      expect(localStorage.getItem('message-density')).toBe('compact');
    });

    it('cozy に切り替えると localStorage に "cozy" が保存される', () => {
      const { result } = renderHook(() => useDensity(), {
        wrapper: ({ children }) => <DensityProvider>{children}</DensityProvider>,
      });

      act(() => {
        result.current.setDensity('compact');
      });
      act(() => {
        result.current.setDensity('cozy');
      });

      expect(localStorage.getItem('message-density')).toBe('cozy');
    });

    it('localStorage に不正な値がある場合はデフォルトの cozy になる', () => {
      localStorage.setItem('message-density', 'invalid-value');

      const { result } = renderHook(() => useDensity(), {
        wrapper: ({ children }) => <DensityProvider>{children}</DensityProvider>,
      });

      expect(result.current.density).toBe('cozy');
    });
  });

  describe('初期表示時の復元', () => {
    it('localStorage に "compact" が保存されていれば初期値が compact になる', () => {
      localStorage.setItem('message-density', 'compact');

      const { result } = renderHook(() => useDensity(), {
        wrapper: ({ children }) => <DensityProvider>{children}</DensityProvider>,
      });

      expect(result.current.density).toBe('compact');
    });

    it('localStorage に "cozy" が保存されていれば初期値が cozy になる', () => {
      localStorage.setItem('message-density', 'cozy');

      const { result } = renderHook(() => useDensity(), {
        wrapper: ({ children }) => <DensityProvider>{children}</DensityProvider>,
      });

      expect(result.current.density).toBe('cozy');
    });

    it('localStorage が空の場合は cozy がデフォルトになる', () => {
      const { result } = renderHook(() => useDensity(), {
        wrapper: ({ children }) => <DensityProvider>{children}</DensityProvider>,
      });

      expect(result.current.density).toBe('cozy');
    });
  });

  describe('compact モード時の CSS 変数適用', () => {
    it('compact モードのとき document.documentElement に data-density="compact" が付与される', () => {
      const { result } = renderHook(() => useDensity(), {
        wrapper: ({ children }) => <DensityProvider>{children}</DensityProvider>,
      });

      act(() => {
        result.current.setDensity('compact');
      });

      expect(document.documentElement.getAttribute('data-density')).toBe('compact');
    });

    it('cozy モードのとき document.documentElement に data-density="cozy" が付与される', () => {
      // compact にしてから cozy に戻す
      const { result } = renderHook(() => useDensity(), {
        wrapper: ({ children }) => <DensityProvider>{children}</DensityProvider>,
      });

      act(() => {
        result.current.setDensity('compact');
      });
      act(() => {
        result.current.setDensity('cozy');
      });

      expect(document.documentElement.getAttribute('data-density')).toBe('cozy');
    });
  });

  describe('連投時の名前省略強化', () => {
    it('compact モードかつ isContinued=true のとき送信者名が表示されない', () => {
      localStorage.setItem('message-density', 'compact');

      render(
        <DensityProvider>
          <MessageItem
            message={testMessage}
            currentUserId={1}
            users={[testUser]}
            isContinued={true}
          />
        </DensityProvider>,
      );

      // isContinued=true のとき送信者名（Typography subtitle2）は描画しない
      expect(screen.queryByText('Alice')).toBeNull();
    });

    it('compact モードかつ isContinued=true のときアバターが表示されない（スペーサーのみ）', () => {
      localStorage.setItem('message-density', 'compact');

      render(
        <DensityProvider>
          <MessageItem
            message={testMessage}
            currentUserId={1}
            users={[testUser]}
            isContinued={true}
          />
        </DensityProvider>,
      );

      // compact + isContinued=true はアバターを描画しない
      expect(screen.queryByTestId('user-avatar')).toBeNull();
    });

    it('cozy モードかつ isContinued=true のとき送信者名が表示されない', () => {
      render(
        <DensityProvider>
          <MessageItem
            message={testMessage}
            currentUserId={1}
            users={[testUser]}
            isContinued={true}
          />
        </DensityProvider>,
      );

      expect(screen.queryByText('Alice')).toBeNull();
    });

    it('cozy モードかつ isContinued=true のときアバターは表示される', () => {
      render(
        <DensityProvider>
          <MessageItem
            message={testMessage}
            currentUserId={1}
            users={[testUser]}
            isContinued={true}
          />
        </DensityProvider>,
      );

      // cozy + isContinued=true はアバターを表示したまま名前のみ省略
      expect(screen.getByTestId('user-avatar')).toBeInTheDocument();
    });

    it('compact モードかつ isContinued=false のとき送信者名が表示される', () => {
      localStorage.setItem('message-density', 'compact');

      render(
        <DensityProvider>
          <MessageItem
            message={testMessage}
            currentUserId={1}
            users={[testUser]}
            isContinued={false}
          />
        </DensityProvider>,
      );

      expect(screen.getByText('Alice')).toBeInTheDocument();
    });
  });

  describe('設定 UI（ProfilePage 表示密度セクション）', () => {
    async function renderProfilePage() {
      // ProfilePage を動的 import することで ThemeContext 等への依存を避ける
      const { default: ProfilePage } = await import('../pages/ProfilePage');
      await act(async () => {
        render(
          <DensityProvider>
            <ProfilePage />
          </DensityProvider>,
        );
      });
    }

    it('ProfilePage に「表示密度」セクションが表示される', async () => {
      await renderProfilePage();
      expect(screen.getByText('表示密度')).toBeInTheDocument();
    });

    it('"快適" ラジオボタンを選択すると density が cozy になる', async () => {
      localStorage.setItem('message-density', 'compact');
      await renderProfilePage();

      const cozyRadio = screen.getByRole('radio', { name: /快適/i });
      await act(async () => {
        fireEvent.click(cozyRadio);
      });

      expect(localStorage.getItem('message-density')).toBe('cozy');
    });

    it('"コンパクト" ラジオボタンを選択すると density が compact になる', async () => {
      await renderProfilePage();

      const compactRadio = screen.getByRole('radio', { name: /コンパクト/i });
      await act(async () => {
        fireEvent.click(compactRadio);
      });

      expect(localStorage.getItem('message-density')).toBe('compact');
    });

    it('現在の density に応じたラジオボタンが選択済み状態になる', async () => {
      localStorage.setItem('message-density', 'compact');
      await renderProfilePage();

      const compactRadio = screen.getByRole('radio', { name: /コンパクト/i });
      expect(compactRadio).toBeChecked();

      const cozyRadio = screen.getByRole('radio', { name: /快適/i });
      expect(cozyRadio).not.toBeChecked();
    });
  });
});
