/**
 * components/Layout/SidebarFooter.tsx のユニットテスト
 *
 * テスト対象: Sidebar 列フッター（ステータス + 表示名 / テーマ切替 / 通知 / プロフィール / ログアウト）
 * 戦略:
 *   - AuthContext / ThemeContext / usePushNotifications / useNotificationPermission /
 *     useChannelNotifications をモックする
 *   - useNavigate を vi.fn() で差し替え、プロフィール遷移を検証する
 *   - StatusEditDialog は jsdom で開閉確認可能なため、ダイアログタイトル等で検証
 *   - #321 通知許可状態に応じた CTA 出し分けは mockPermission を差し替えて検証
 */

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { ChannelNotificationSetting } from '@chat-app/shared';
import SidebarFooter from '../components/Layout/SidebarFooter';

const mockToggleTheme = vi.fn();
const mockLogout = vi.fn();
const mockSubscribe = vi.fn();
const mockUnsubscribe = vi.fn();
const mockNavigate = vi.fn();
const mockRequestPermission = vi.fn();
const mockFetchSettings = vi.fn().mockResolvedValue(undefined);
const mockMe = vi.fn().mockResolvedValue({
  user: { id: 1, username: 'alice', email: 'a@test.com', displayName: null, role: 'user' },
});

vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => ({ user: mockUser, logout: mockLogout, updateUser: vi.fn() }),
}));

vi.mock('../contexts/ThemeContext', () => ({
  useTheme: () => ({ mode: mockMode, toggleTheme: mockToggleTheme }),
}));

vi.mock('../hooks/usePushNotifications', () => ({
  usePushNotifications: () => ({
    supported: mockPushSupported,
    subscribed: mockSubscribed,
    loading: false,
    error: null,
    subscribe: mockSubscribe,
    unsubscribe: mockUnsubscribe,
  }),
}));

vi.mock('../hooks/useNotificationPermission', () => ({
  useNotificationPermission: () => ({
    permission: mockPermission,
    requestPermission: mockRequestPermission,
  }),
}));

vi.mock('../hooks/useChannelNotifications', () => ({
  useChannelNotifications: () => ({
    settings: mockChannelSettings,
    getLevel: () => 'all',
    setLevel: vi.fn(),
    fetchSettings: mockFetchSettings,
  }),
}));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

vi.mock('../api/client', () => ({
  api: {
    auth: {
      me: () => mockMe(),
    },
  },
}));

const mockUser: {
  id: number;
  username: string;
  email: string;
  displayName: string | null;
  role: 'user' | 'admin';
  status?: { emoji?: string; text?: string } | null;
} = {
  id: 1,
  username: 'alice',
  email: 'a@test.com',
  displayName: null,
  role: 'user',
  status: null,
};

let mockMode: 'light' | 'dark' = 'light';
let mockPushSupported = false;
let mockSubscribed = false;
let mockPermission: 'default' | 'granted' | 'denied' | 'unsupported' = 'granted';
let mockChannelSettings = new Map<number, ChannelNotificationSetting>();

beforeEach(() => {
  mockUser.displayName = null;
  mockUser.status = null;
  mockMode = 'light';
  mockPushSupported = false;
  mockSubscribed = false;
  mockPermission = 'granted';
  mockChannelSettings = new Map();
  mockToggleTheme.mockClear();
  mockLogout.mockClear();
  mockSubscribe.mockClear();
  mockUnsubscribe.mockClear();
  mockNavigate.mockClear();
  mockRequestPermission.mockClear();
  mockFetchSettings.mockClear();
});

function renderFooter() {
  return render(
    <MemoryRouter>
      <SidebarFooter />
    </MemoryRouter>,
  );
}

describe('SidebarFooter', () => {
  describe('表示', () => {
    it('ステータス絵文字が表示される（status.emoji がある場合）', () => {
      mockUser.status = { emoji: '🔵', text: 'available' };
      renderFooter();
      expect(screen.getByText('🔵')).toBeInTheDocument();
    });

    // Step 8e-3: Rail に統合され 64px 幅になったため、displayName/username は
    // SidebarFooter 内に直接テキスト表示されず Tooltip 経由でのみ表示される。
    it('表示名は SidebarFooter 内に直接表示されない (Step 8e-3: Tooltip 化)', () => {
      mockUser.displayName = '田中花子';
      renderFooter();
      expect(screen.queryByText('田中花子')).not.toBeInTheDocument();
    });

    it('displayName が null のとき username も SidebarFooter 内に直接表示されない (Step 8e-3)', () => {
      renderFooter();
      expect(screen.queryByText('alice')).not.toBeInTheDocument();
    });

    it('テーマ切替ボタン（ダーク/ライト）が表示される', () => {
      renderFooter();
      expect(screen.getByRole('button', { name: 'ダークモードに切り替える' })).toBeInTheDocument();
    });

    it('プロフィール設定ボタンが表示される', () => {
      renderFooter();
      expect(screen.getByRole('button', { name: 'プロフィール設定' })).toBeInTheDocument();
    });

    it('ログアウトボタンが表示される', () => {
      renderFooter();
      expect(screen.getByRole('button', { name: 'ログアウト' })).toBeInTheDocument();
    });

    it('Push 通知サポート時 (permission=granted)、通知設定ボタンが表示される', () => {
      mockPushSupported = true;
      mockPermission = 'granted';
      renderFooter();
      expect(screen.getByRole('button', { name: '通知設定' })).toBeInTheDocument();
    });

    it('Push 通知未対応時、通知ボタンが表示されない', () => {
      mockPushSupported = false;
      renderFooter();
      expect(screen.queryByRole('button', { name: '通知設定' })).not.toBeInTheDocument();
      expect(
        screen.queryByRole('button', { name: 'ブラウザ通知を有効化' }),
      ).not.toBeInTheDocument();
      expect(
        screen.queryByRole('button', { name: '通知がブロックされています' }),
      ).not.toBeInTheDocument();
    });
  });

  describe('動作', () => {
    it('ステータスボタンをクリックするとステータス編集ダイアログが開く', async () => {
      renderFooter();
      const statusButton = screen.getByRole('button', { name: 'ステータスを設定' });
      await userEvent.click(statusButton);
      // StatusEditDialog 内のタイトル文字列で開いたことを確認
      expect(await screen.findByRole('dialog')).toBeInTheDocument();
    });

    it('テーマ切替ボタンをクリックすると toggleTheme が呼ばれる', async () => {
      renderFooter();
      const button = screen.getByRole('button', { name: 'ダークモードに切り替える' });
      await userEvent.click(button);
      expect(mockToggleTheme).toHaveBeenCalledTimes(1);
    });

    it('プロフィール設定ボタンをクリックすると /profile に遷移する', async () => {
      renderFooter();
      const button = screen.getByRole('button', { name: 'プロフィール設定' });
      await userEvent.click(button);
      expect(mockNavigate).toHaveBeenCalledWith('/profile');
    });

    it('ログアウトボタンをクリックすると logout が呼ばれる', async () => {
      renderFooter();
      const button = screen.getByRole('button', { name: 'ログアウト' });
      await userEvent.click(button);
      expect(mockLogout).toHaveBeenCalledTimes(1);
    });
  });

  // #321 通知許可 CTA の状態別ガイダンス
  describe('#321 通知許可状態に応じた CTA の出し分け', () => {
    describe('default (未設定)', () => {
      it('「ブラウザ通知を有効化」CTA ラベルのボタンが表示される', () => {
        mockPushSupported = true;
        mockPermission = 'default';
        renderFooter();
        expect(screen.getByRole('button', { name: 'ブラウザ通知を有効化' })).toBeInTheDocument();
      });

      it('クリックすると Notification.requestPermission が呼ばれる', async () => {
        mockPushSupported = true;
        mockPermission = 'default';
        mockRequestPermission.mockResolvedValue('granted');
        renderFooter();
        const button = screen.getByRole('button', { name: 'ブラウザ通知を有効化' });
        await userEvent.click(button);
        expect(mockRequestPermission).toHaveBeenCalledTimes(1);
      });
    });

    describe('denied (拒否済み)', () => {
      it('「通知がブロックされています」状態のボタンが表示される', () => {
        mockPushSupported = true;
        mockPermission = 'denied';
        renderFooter();
        expect(
          screen.getByRole('button', { name: '通知がブロックされています' }),
        ).toBeInTheDocument();
      });

      it('クリックするとブラウザ設定変更の手順案内 Popover が開く', async () => {
        mockPushSupported = true;
        mockPermission = 'denied';
        renderFooter();
        const button = screen.getByRole('button', { name: '通知がブロックされています' });
        await userEvent.click(button);
        // Popover 内に「ブラウザ設定」「通知を許可」など手順案内のキーワードが含まれる
        expect(await screen.findByText(/ブラウザの設定/)).toBeInTheDocument();
      });
    });

    describe('granted (有効)', () => {
      it('Push 購読/未購読のサマリーをポップオーバーで表示する', async () => {
        mockPushSupported = true;
        mockPermission = 'granted';
        mockSubscribed = false;
        renderFooter();
        const button = screen.getByRole('button', { name: '通知設定' });
        await userEvent.click(button);
        expect(await screen.findByText(/Push 通知: 未購読/)).toBeInTheDocument();
      });

      it('通知レベル別チャンネル件数（メンションのみ N 件 / ミュート M 件）をポップオーバーで表示する', async () => {
        mockPushSupported = true;
        mockPermission = 'granted';
        mockSubscribed = true;
        mockChannelSettings = new Map([
          [1, { channelId: 1, level: 'mentions', updatedAt: '2026-01-01T00:00:00.000Z' }],
          [2, { channelId: 2, level: 'mentions', updatedAt: '2026-01-01T00:00:00.000Z' }],
          [3, { channelId: 3, level: 'muted', updatedAt: '2026-01-01T00:00:00.000Z' }],
        ]);
        renderFooter();
        const button = screen.getByRole('button', { name: '通知設定' });
        await userEvent.click(button);
        // 取得トリガが Popover を開いたタイミングなので、表示は非同期
        expect(await screen.findByText(/メンションのみ: 2 件/)).toBeInTheDocument();
        expect(screen.getByText(/ミュート中: 1 件/)).toBeInTheDocument();
      });
    });

    describe('permission 変化への追従', () => {
      it('permission が default → granted に変化すると CTA から購読サマリー表示に切り替わる', () => {
        mockPushSupported = true;
        mockPermission = 'default';
        const { rerender } = render(
          <MemoryRouter>
            <SidebarFooter />
          </MemoryRouter>,
        );
        expect(screen.getByRole('button', { name: 'ブラウザ通知を有効化' })).toBeInTheDocument();

        mockPermission = 'granted';
        rerender(
          <MemoryRouter>
            <SidebarFooter />
          </MemoryRouter>,
        );
        expect(screen.getByRole('button', { name: '通知設定' })).toBeInTheDocument();
        expect(
          screen.queryByRole('button', { name: 'ブラウザ通知を有効化' }),
        ).not.toBeInTheDocument();
      });
    });
  });

  // Step 9c: variant prop でドロワー底部用の ListItem 形式表示に切替
  describe('Step 9c: variant="drawer" 表示', () => {
    function renderDrawerFooter() {
      return render(
        <MemoryRouter>
          <SidebarFooter variant="drawer" />
        </MemoryRouter>,
      );
    }

    it('variant="drawer" のとき各機能 (テーマ / プロフィール / ログアウト) のラベル文字列が表示される', () => {
      mockPushSupported = true;
      mockPermission = 'granted';
      renderDrawerFooter();
      // ステータス: ユーザー名込みのラベル
      expect(screen.getByText('alice のステータスを設定')).toBeInTheDocument();
      // テーマ
      expect(screen.getByText('ダークモードに切り替える')).toBeInTheDocument();
      // 通知 (granted 時のラベル)
      expect(screen.getByText('通知設定')).toBeInTheDocument();
      // プロフィール
      expect(screen.getByText('プロフィール設定')).toBeInTheDocument();
      // ログアウト
      expect(screen.getByText('ログアウト')).toBeInTheDocument();
    });

    it('variant="rail" (default) のときは従来の縦並びアイコン表示でラベルは表示されない', () => {
      renderFooter();
      // Tooltip ラベルとして aria-label には存在するが、可視テキストとしては存在しない
      expect(screen.queryByText('ダークモードに切り替える')).not.toBeInTheDocument();
      expect(screen.queryByText('プロフィール設定')).not.toBeInTheDocument();
      // ログアウトのテキスト表示は無い (aria-label のみ)
      const logoutLabels = screen.queryAllByText('ログアウト');
      expect(logoutLabels).toHaveLength(0);
    });

    it('variant="drawer" でログアウトクリックで logout が呼ばれる', async () => {
      renderDrawerFooter();
      const button = screen.getByRole('button', { name: 'ログアウト' });
      await userEvent.click(button);
      expect(mockLogout).toHaveBeenCalledTimes(1);
    });
  });
});
