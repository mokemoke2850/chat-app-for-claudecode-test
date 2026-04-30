/**
 * テスト対象: pages/GuestChannelPage.tsx — /g/:token ルートで表示する読み取り専用ゲストビュー（#149）
 * 戦略:
 *   - api.guestLinks の各メソッドを vi.mock で差し替え、トークン情報取得 / パスワード検証 / メッセージ取得の各フェーズの UI を検証する
 *   - 既存ユーザーが /g/:token を踏んでも常にゲストフロー固定であることを検証する
 *   - 投稿 UI（送信欄・編集・削除・リアクション追加・添付追加）が表示されないことを検証する
 *   - React 19 の use() + Suspense パターンで実装される前提（CLAUDE.md フロントエンド開発ルール）
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

vi.mock('../api/client', () => ({
  api: {
    guestLinks: {
      lookup: vi.fn(),
      verify: vi.fn(),
      messages: vi.fn(),
    },
  },
}));

const mockUseAuth = vi.fn();
vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => mockUseAuth(),
}));

import { api } from '../api/client';
import GuestChannelPage from '../pages/GuestChannelPage';

const mockApi = api.guestLinks as unknown as {
  lookup: ReturnType<typeof vi.fn>;
  verify: ReturnType<typeof vi.fn>;
  messages: ReturnType<typeof vi.fn>;
};

/** use() + Suspense をフラッシュするため await act(async) で render を包む */
const renderAt = async (token: string) => {
  let result: ReturnType<typeof render> | undefined;
  await act(async () => {
    result = render(
      <MemoryRouter initialEntries={[`/g/${token}`]}>
        <Routes>
          <Route path="/g/:token" element={<GuestChannelPage />} />
        </Routes>
      </MemoryRouter>,
    );
  });
  return result!;
};

/** Suspense fallback テスト用に同期 render を提供する（pending な promise でロード状態を確認） */
const renderAtSync = (token: string) =>
  render(
    <MemoryRouter initialEntries={[`/g/${token}`]}>
      <Routes>
        <Route path="/g/:token" element={<GuestChannelPage />} />
      </Routes>
    </MemoryRouter>,
  );

const baseLookup = {
  token: 'tok-abc',
  channelId: 10,
  channelName: 'general',
  hasPassword: false,
  expiresAt: null,
  isExpired: false,
  isRevoked: false,
};

beforeEach(() => {
  vi.resetAllMocks();
  mockUseAuth.mockReturnValue({ user: null });
});

describe('GuestChannelPage', () => {
  describe('トークン情報取得フェーズ', () => {
    it('有効なトークンにアクセスするとチャンネル名が表示される', async () => {
      mockApi.lookup.mockResolvedValue({ guestLink: baseLookup });
      mockApi.verify.mockResolvedValue({
        guestToken: 'gt-1',
        channelId: 10,
        channelName: 'general',
      });
      mockApi.messages.mockResolvedValue({ messages: [] });
      await renderAt('tok-abc');
      await waitFor(() => expect(screen.getByText(/general/)).toBeInTheDocument());
    });

    it('存在しないトークン（404）にアクセスするとエラーメッセージが表示される', async () => {
      mockApi.lookup.mockRejectedValue(new Error('not found'));
      await renderAt('bad-token');
      await waitFor(() =>
        expect(screen.getByText('ゲストリンクが見つかりません')).toBeInTheDocument(),
      );
    });

    it('期限切れトークンには「有効期限が切れています」と表示される', async () => {
      mockApi.lookup.mockResolvedValue({
        guestLink: { ...baseLookup, isExpired: true },
      });
      await renderAt('tok-abc');
      await waitFor(() =>
        expect(screen.getByText('このリンクは有効期限が切れています')).toBeInTheDocument(),
      );
    });

    it('失効済みトークンには「このリンクは無効化されています」と表示される', async () => {
      mockApi.lookup.mockResolvedValue({
        guestLink: { ...baseLookup, isRevoked: true },
      });
      await renderAt('tok-abc');
      await waitFor(() =>
        expect(screen.getByText('このリンクは無効化されています')).toBeInTheDocument(),
      );
    });

    it('Suspense フォールバック（ローディング表示）が初期表示される', () => {
      // 解決しない Promise を返してローディング状態を維持
      mockApi.lookup.mockReturnValue(new Promise(() => {}));
      renderAtSync('tok-abc');
      expect(screen.getByRole('progressbar')).toBeInTheDocument();
    });
  });

  describe('パスワード入力フェーズ', () => {
    it('パスワード設定済みトークンにはパスワード入力フォームが表示される', async () => {
      mockApi.lookup.mockResolvedValue({
        guestLink: { ...baseLookup, hasPassword: true },
      });
      await renderAt('tok-abc');
      await waitFor(() => expect(screen.getByLabelText('パスワード')).toBeInTheDocument());
      expect(screen.getByRole('button', { name: '閲覧する' })).toBeInTheDocument();
    });

    it('パスワード未設定トークンではパスワード入力フォームを表示せず即メッセージを取得する', async () => {
      mockApi.lookup.mockResolvedValue({ guestLink: baseLookup });
      mockApi.verify.mockResolvedValue({
        guestToken: 'gt-1',
        channelId: 10,
        channelName: 'general',
      });
      mockApi.messages.mockResolvedValue({ messages: [] });
      await renderAt('tok-abc');
      await waitFor(() => expect(mockApi.verify).toHaveBeenCalledWith('tok-abc', ''));
    });

    it('正しいパスワードを入力して送信するとメッセージ一覧が表示される', async () => {
      mockApi.lookup.mockResolvedValue({
        guestLink: { ...baseLookup, hasPassword: true },
      });
      mockApi.verify.mockResolvedValue({
        guestToken: 'gt-1',
        channelId: 10,
        channelName: 'general',
      });
      mockApi.messages.mockResolvedValue({
        messages: [
          {
            id: 1,
            channelId: 10,
            userId: 1,
            username: 'alice',
            content: 'hello',
            createdAt: '2026-01-01T00:00:00Z',
            updatedAt: '2026-01-01T00:00:00Z',
            isEdited: false,
            attachments: [],
          },
        ],
      });
      await renderAt('tok-abc');
      await waitFor(() => expect(screen.getByLabelText('パスワード')).toBeInTheDocument());
      const user = userEvent.setup();
      await user.type(screen.getByLabelText('パスワード'), 'secret');
      await user.click(screen.getByRole('button', { name: '閲覧する' }));
      await waitFor(() => expect(screen.getByText('hello')).toBeInTheDocument());
    });

    it('誤ったパスワードを送信するとエラーメッセージが表示される', async () => {
      mockApi.lookup.mockResolvedValue({
        guestLink: { ...baseLookup, hasPassword: true },
      });
      mockApi.verify.mockRejectedValue(new Error('パスワードが違います'));
      await renderAt('tok-abc');
      await waitFor(() => expect(screen.getByLabelText('パスワード')).toBeInTheDocument());
      const user = userEvent.setup();
      await user.type(screen.getByLabelText('パスワード'), 'wrong');
      await user.click(screen.getByRole('button', { name: '閲覧する' }));
      await waitFor(() => expect(screen.getByText('パスワードが違います')).toBeInTheDocument());
    });

    it('連続失敗で 429 を受け取ると「しばらく時間をおいてください」と表示される', async () => {
      mockApi.lookup.mockResolvedValue({
        guestLink: { ...baseLookup, hasPassword: true },
      });
      mockApi.verify.mockRejectedValue(new Error('一時的にブロックされています'));
      await renderAt('tok-abc');
      await waitFor(() => expect(screen.getByLabelText('パスワード')).toBeInTheDocument());
      const user = userEvent.setup();
      await user.type(screen.getByLabelText('パスワード'), 'wrong');
      await user.click(screen.getByRole('button', { name: '閲覧する' }));
      await waitFor(() =>
        expect(screen.getByText('しばらく時間をおいてください')).toBeInTheDocument(),
      );
    });
  });

  describe('メッセージ表示フェーズ（読み取り専用）', () => {
    const setupWithMessages = (extra = {}) => {
      mockApi.lookup.mockResolvedValue({ guestLink: baseLookup });
      mockApi.verify.mockResolvedValue({
        guestToken: 'gt-1',
        channelId: 10,
        channelName: 'general',
      });
      mockApi.messages.mockResolvedValue({
        messages: [
          {
            id: 1,
            channelId: 10,
            userId: 1,
            username: 'alice',
            content: 'hello',
            createdAt: '2026-01-01T00:00:00Z',
            updatedAt: '2026-01-01T00:00:00Z',
            isEdited: false,
            attachments: [],
            ...extra,
          },
        ],
      });
    };

    it('チャンネルのメッセージ一覧が表示される', async () => {
      setupWithMessages();
      await renderAt('tok-abc');
      await waitFor(() => expect(screen.getByText('hello')).toBeInTheDocument());
    });

    it('送信欄（MessageInput）は表示されない', async () => {
      setupWithMessages();
      await renderAt('tok-abc');
      await waitFor(() => expect(screen.getByText('hello')).toBeInTheDocument());
      expect(screen.queryByPlaceholderText(/メッセージを送信/)).not.toBeInTheDocument();
    });

    it('リアクション追加ボタンは表示されない', async () => {
      setupWithMessages();
      await renderAt('tok-abc');
      await waitFor(() => expect(screen.getByText('hello')).toBeInTheDocument());
      expect(screen.queryByRole('button', { name: /リアクション/ })).not.toBeInTheDocument();
    });

    it('メッセージの編集／削除メニュー（MessageActions）は表示されない', async () => {
      setupWithMessages();
      await renderAt('tok-abc');
      await waitFor(() => expect(screen.getByText('hello')).toBeInTheDocument());
      expect(screen.queryByRole('button', { name: /編集/ })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /削除/ })).not.toBeInTheDocument();
    });

    it('添付ファイルアップロード UI は表示されない', async () => {
      setupWithMessages();
      await renderAt('tok-abc');
      await waitFor(() => expect(screen.getByText('hello')).toBeInTheDocument());
      expect(screen.queryByLabelText(/ファイルを添付/)).not.toBeInTheDocument();
    });

    it('スレッド返信ボタンは表示されない', async () => {
      setupWithMessages();
      await renderAt('tok-abc');
      await waitFor(() => expect(screen.getByText('hello')).toBeInTheDocument());
      expect(screen.queryByRole('button', { name: /スレッド/ })).not.toBeInTheDocument();
    });

    it('添付ファイルのプレビューは表示される（画像・PDF など読み取り）', async () => {
      setupWithMessages({
        attachments: [
          {
            id: 5,
            url: '/uploads/foo.png',
            originalName: 'foo.png',
            size: 100,
            mimeType: 'image/png',
          },
        ],
      });
      await renderAt('tok-abc');
      await waitFor(() => expect(screen.getByText('foo.png')).toBeInTheDocument());
    });
  });

  describe('既存ユーザーのアクセス（ログイン無視）', () => {
    it('useAuth.user がログイン済みでも /g/:token はゲストフローで描画される', async () => {
      mockUseAuth.mockReturnValue({ user: { id: 1, username: 'me', role: 'user' } });
      mockApi.lookup.mockResolvedValue({ guestLink: baseLookup });
      mockApi.verify.mockResolvedValue({
        guestToken: 'gt-1',
        channelId: 10,
        channelName: 'general',
      });
      mockApi.messages.mockResolvedValue({ messages: [] });
      await renderAt('tok-abc');
      // ログイン済みでも guestLinks API が呼ばれる（通常チャットページに遷移しない）
      await waitFor(() => expect(mockApi.lookup).toHaveBeenCalled());
      await waitFor(() => expect(mockApi.verify).toHaveBeenCalled());
    });

    it('ログイン済みユーザーがアクセスしてもメンバー権限の編集 UI は出ない', async () => {
      mockUseAuth.mockReturnValue({ user: { id: 1, username: 'me', role: 'admin' } });
      mockApi.lookup.mockResolvedValue({ guestLink: baseLookup });
      mockApi.verify.mockResolvedValue({
        guestToken: 'gt-1',
        channelId: 10,
        channelName: 'general',
      });
      mockApi.messages.mockResolvedValue({
        messages: [
          {
            id: 1,
            channelId: 10,
            userId: 99,
            username: 'alice',
            content: 'hello',
            createdAt: '2026-01-01T00:00:00Z',
            updatedAt: '2026-01-01T00:00:00Z',
            isEdited: false,
            attachments: [],
          },
        ],
      });
      await renderAt('tok-abc');
      await waitFor(() => expect(screen.getByText('hello')).toBeInTheDocument());
      expect(screen.queryByRole('button', { name: /編集/ })).not.toBeInTheDocument();
      expect(screen.queryByPlaceholderText(/メッセージを送信/)).not.toBeInTheDocument();
    });

    it('ログイン済みユーザーが /g/:token から通常チャットへリダイレクトされない', async () => {
      mockUseAuth.mockReturnValue({ user: { id: 1, username: 'me', role: 'user' } });
      mockApi.lookup.mockResolvedValue({ guestLink: baseLookup });
      mockApi.verify.mockResolvedValue({
        guestToken: 'gt-1',
        channelId: 10,
        channelName: 'general',
      });
      mockApi.messages.mockResolvedValue({ messages: [] });
      await renderAt('tok-abc');
      await waitFor(() => expect(screen.getByText(/general（ゲスト閲覧）/)).toBeInTheDocument());
    });
  });

  describe('ゲストセッション管理', () => {
    it('verify 成功時に発行された guestToken を messages 取得時に渡す', async () => {
      mockApi.lookup.mockResolvedValue({ guestLink: baseLookup });
      mockApi.verify.mockResolvedValue({
        guestToken: 'gt-issued',
        channelId: 10,
        channelName: 'general',
      });
      mockApi.messages.mockResolvedValue({ messages: [] });
      await renderAt('tok-abc');
      await waitFor(() => expect(mockApi.messages).toHaveBeenCalledWith('tok-abc', 'gt-issued'));
    });

    it('messages 取得が失敗するとエラー表示される', async () => {
      mockApi.lookup.mockResolvedValue({ guestLink: baseLookup });
      mockApi.verify.mockResolvedValue({
        guestToken: 'gt-1',
        channelId: 10,
        channelName: 'general',
      });
      mockApi.messages.mockRejectedValue(new Error('リンクは無効です'));
      await renderAt('tok-abc');
      await waitFor(() => expect(screen.getByText('リンクは無効です')).toBeInTheDocument());
    });

    it('use() に渡す Promise は useMemo で安定化されている（再レンダリングで再生成しない）', async () => {
      // GuestChannelPage 内部で useMemo を使うため、同じ token への再レンダリングで lookup が 1 回のみ
      mockApi.lookup.mockResolvedValue({ guestLink: baseLookup });
      mockApi.verify.mockResolvedValue({
        guestToken: 'gt-1',
        channelId: 10,
        channelName: 'general',
      });
      mockApi.messages.mockResolvedValue({ messages: [] });
      const { rerender } = await renderAt('tok-abc');
      await waitFor(() => expect(mockApi.lookup).toHaveBeenCalledTimes(1));
      rerender(
        <MemoryRouter initialEntries={[`/g/tok-abc`]}>
          <Routes>
            <Route path="/g/:token" element={<GuestChannelPage />} />
          </Routes>
        </MemoryRouter>,
      );
      // 再レンダリング後も lookup が再呼び出しされない
      expect(mockApi.lookup).toHaveBeenCalledTimes(1);
    });
  });
});
