/**
 * テスト対象: components/CommandPalette/CommandPalette.tsx
 *
 * 戦略:
 *   - api.channels.list / api.dm.listConversations / api.auth.users をモックして API 通信を排除
 *   - React 19 use() + Suspense をフラッシュするため await act() でラップ
 *   - useNavigate を vi.fn() で差し替え、URL 遷移を検証
 *   - MemoryRouter でラップ
 *   - `open` prop と `onClose` を直接制御することでショートカットの組み立てに依存しない単体検証を行う
 *     （Cmd+K グローバルショートカットの統合は ChatPage 側のテストで担保する想定）
 */

import { act } from 'react';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Channel, User } from '@chat-app/shared';
import CommandPalette, {
  resetCommandPaletteCache,
} from '../components/CommandPalette/CommandPalette';
import { makeConversation } from './__fixtures__/dm';

const mockChannelsList = vi.fn();
const mockDmListConversations = vi.fn();
const mockAuthUsers = vi.fn();
const mockNavigate = vi.fn();

vi.mock('../api/client', () => ({
  api: {
    channels: {
      list: () => mockChannelsList(),
    },
    dm: {
      listConversations: () => mockDmListConversations(),
    },
    auth: {
      users: () => mockAuthUsers(),
    },
  },
}));

vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>();
  return { ...actual, useNavigate: () => mockNavigate };
});

vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 1, username: 'me', email: 'me@example.com', role: 'user' },
  }),
}));

function makeChannel(overrides: Partial<Channel> = {}): Channel {
  return {
    id: 1,
    name: 'general',
    description: null,
    topic: null,
    createdBy: null,
    createdAt: '2024-01-01T00:00:00Z',
    isPrivate: false,
    postingPermission: 'everyone',
    unreadCount: 0,
    ...overrides,
  };
}

function makeUser(overrides: Partial<User> = {}): User {
  return {
    id: 10,
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

beforeEach(() => {
  vi.clearAllMocks();
  resetCommandPaletteCache();
  // デフォルトでは空のレスポンスを返す（個別テストで上書き）
  mockChannelsList.mockResolvedValue({ channels: [] });
  mockDmListConversations.mockResolvedValue({ conversations: [] });
  mockAuthUsers.mockResolvedValue({ users: [] });
});

async function renderPalette(open = true, onClose: () => void = vi.fn()) {
  await act(async () => {
    render(
      <MemoryRouter>
        <CommandPalette open={open} onClose={onClose} />
      </MemoryRouter>,
    );
  });
}

describe('CommandPalette', () => {
  describe('表示', () => {
    it('open=true のときダイアログが表示される', async () => {
      await renderPalette(true);
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });

    it('open=false のときダイアログは表示されない', async () => {
      await renderPalette(false);
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    it('テキスト入力欄が表示される', async () => {
      await renderPalette(true);
      expect(screen.getByPlaceholderText(/検索|search|jump/i)).toBeInTheDocument();
    });
  });

  describe('モーダルの閉じる動作', () => {
    it('Escape キーで onClose が呼ばれる', async () => {
      const onClose = vi.fn();
      await renderPalette(true, onClose);
      await userEvent.keyboard('{Escape}');
      expect(onClose).toHaveBeenCalled();
    });
  });

  describe('入力フィルタリング', () => {
    it('初期表示でチャンネル・DM・コマンドが統合表示される', async () => {
      mockChannelsList.mockResolvedValue({
        channels: [makeChannel({ id: 1, name: 'general' })],
      });
      mockDmListConversations.mockResolvedValue({
        conversations: [
          makeConversation({
            id: 7,
            otherUser: { id: 2, username: 'bob', displayName: null, avatarUrl: null },
          }),
        ],
      });
      mockAuthUsers.mockResolvedValue({ users: [makeUser({ id: 10, username: 'alice' })] });

      await renderPalette(true);
      // チャンネル
      expect(screen.getByText(/general/)).toBeInTheDocument();
      // DM
      expect(screen.getByText(/bob/)).toBeInTheDocument();
      // ユーザー
      expect(screen.getByText(/alice/)).toBeInTheDocument();
      // コマンド（少なくとも1つは表示される）
      expect(
        screen.getAllByText(/設定|ブックマーク|カレンダー|タスク|ファイル|インボックス/).length,
      ).toBeGreaterThan(0);
    });

    it('テキスト入力に応じてチャンネル名がフィルタされる', async () => {
      mockChannelsList.mockResolvedValue({
        channels: [makeChannel({ id: 1, name: 'general' }), makeChannel({ id: 2, name: 'random' })],
      });
      await renderPalette(true);

      const input = screen.getByPlaceholderText(/検索|search|jump/i);
      await userEvent.type(input, 'gen');

      expect(screen.getByText(/general/)).toBeInTheDocument();
      expect(screen.queryByText(/random/)).not.toBeInTheDocument();
    });

    it('テキスト入力に応じて DM 相手のユーザー名がフィルタされる', async () => {
      mockDmListConversations.mockResolvedValue({
        conversations: [
          makeConversation({
            id: 1,
            otherUser: { id: 2, username: 'bob', displayName: null, avatarUrl: null },
          }),
          makeConversation({
            id: 2,
            otherUser: { id: 3, username: 'carol', displayName: null, avatarUrl: null },
          }),
        ],
      });
      await renderPalette(true);

      const input = screen.getByPlaceholderText(/検索|search|jump/i);
      await userEvent.type(input, 'bob');

      expect(screen.getByText(/bob/)).toBeInTheDocument();
      expect(screen.queryByText(/carol/)).not.toBeInTheDocument();
    });

    it('検索結果がゼロ件のとき空状態メッセージが表示される', async () => {
      mockChannelsList.mockResolvedValue({
        channels: [makeChannel({ id: 1, name: 'general' })],
      });
      await renderPalette(true);

      const input = screen.getByPlaceholderText(/検索|search|jump/i);
      await userEvent.type(input, 'zzzzzz_no_match');

      expect(screen.getByText(/見つかりません|該当なし|no results/i)).toBeInTheDocument();
    });
  });

  describe('キーボードナビゲーション', () => {
    it('↓ キーで次の候補が選択される（aria-selected が移動する）', async () => {
      mockChannelsList.mockResolvedValue({
        channels: [makeChannel({ id: 1, name: 'general' }), makeChannel({ id: 2, name: 'random' })],
      });
      await renderPalette(true);

      // 初期は最初の項目が選択されている
      const items = screen.getAllByRole('option');
      expect(items[0]).toHaveAttribute('aria-selected', 'true');

      await userEvent.keyboard('{ArrowDown}');
      const itemsAfter = screen.getAllByRole('option');
      expect(itemsAfter[0]).toHaveAttribute('aria-selected', 'false');
      expect(itemsAfter[1]).toHaveAttribute('aria-selected', 'true');
    });

    it('リスト末尾で ↓ キーを押すと先頭に循環する', async () => {
      mockChannelsList.mockResolvedValue({
        channels: [makeChannel({ id: 1, name: 'general' })],
      });
      mockDmListConversations.mockResolvedValue({ conversations: [] });
      mockAuthUsers.mockResolvedValue({ users: [] });
      await renderPalette(true);

      // 全項目（チャンネル1 + コマンド数個）の数を取得
      const items = screen.getAllByRole('option');
      // 末尾まで移動
      for (let i = 0; i < items.length - 1; i++) {
        await userEvent.keyboard('{ArrowDown}');
      }
      const itemsBeforeWrap = screen.getAllByRole('option');
      expect(itemsBeforeWrap[itemsBeforeWrap.length - 1]).toHaveAttribute('aria-selected', 'true');

      // 末尾でさらに ↓ を押すと先頭に戻る
      await userEvent.keyboard('{ArrowDown}');
      const itemsAfterWrap = screen.getAllByRole('option');
      expect(itemsAfterWrap[0]).toHaveAttribute('aria-selected', 'true');
    });

    it('リスト先頭で ↑ キーを押すと末尾に循環する', async () => {
      mockChannelsList.mockResolvedValue({
        channels: [makeChannel({ id: 1, name: 'general' })],
      });
      mockDmListConversations.mockResolvedValue({ conversations: [] });
      mockAuthUsers.mockResolvedValue({ users: [] });
      await renderPalette(true);

      // 先頭で ↑ を押す
      await userEvent.keyboard('{ArrowUp}');
      const items = screen.getAllByRole('option');
      expect(items[items.length - 1]).toHaveAttribute('aria-selected', 'true');
    });
  });

  describe('項目の選択・ジャンプ', () => {
    it('チャンネルを Enter で選択すると /chat?channel=:id に遷移して onClose が呼ばれる', async () => {
      const onClose = vi.fn();
      mockChannelsList.mockResolvedValue({
        channels: [makeChannel({ id: 42, name: 'general' })],
      });
      // DM/users/コマンドより先にチャンネルを選ばせるため、空にしておく
      mockDmListConversations.mockResolvedValue({ conversations: [] });
      mockAuthUsers.mockResolvedValue({ users: [] });
      await renderPalette(true, onClose);

      await userEvent.keyboard('{Enter}');

      expect(mockNavigate).toHaveBeenCalledWith('/chat?channel=42');
      expect(onClose).toHaveBeenCalled();
    });

    it('DM 会話を選択すると /dm?conv=:id に遷移する', async () => {
      const onClose = vi.fn();
      mockChannelsList.mockResolvedValue({ channels: [] });
      mockDmListConversations.mockResolvedValue({
        conversations: [
          makeConversation({
            id: 7,
            otherUser: { id: 2, username: 'bob', displayName: null, avatarUrl: null },
          }),
        ],
      });
      mockAuthUsers.mockResolvedValue({ users: [] });
      await renderPalette(true, onClose);

      await userEvent.keyboard('{Enter}');

      expect(mockNavigate).toHaveBeenCalledWith('/dm?conv=7');
      expect(onClose).toHaveBeenCalled();
    });

    it('クリックでも項目を選択できる', async () => {
      const onClose = vi.fn();
      mockChannelsList.mockResolvedValue({
        channels: [makeChannel({ id: 99, name: 'general' })],
      });
      mockDmListConversations.mockResolvedValue({ conversations: [] });
      mockAuthUsers.mockResolvedValue({ users: [] });
      await renderPalette(true, onClose);

      const dialog = screen.getByRole('dialog');
      const channelItem = within(dialog).getByText(/general/);
      await userEvent.click(channelItem);

      expect(mockNavigate).toHaveBeenCalledWith('/chat?channel=99');
      expect(onClose).toHaveBeenCalled();
    });
  });

  describe('データ取得とキャッシュ', () => {
    it('初回 open で API が呼ばれる', async () => {
      await renderPalette(true);
      expect(mockChannelsList).toHaveBeenCalledTimes(1);
      expect(mockDmListConversations).toHaveBeenCalledTimes(1);
      expect(mockAuthUsers).toHaveBeenCalledTimes(1);
    });

    it('キャッシュをリセットしない限り 2 回目以降のレンダリングで API は再呼び出しされない', async () => {
      // 1 回目
      const onClose1 = vi.fn();
      const { unmount } = render(
        <MemoryRouter>
          <CommandPalette open={true} onClose={onClose1} />
        </MemoryRouter>,
      );
      await act(async () => {
        await Promise.resolve();
      });
      unmount();
      expect(mockChannelsList).toHaveBeenCalledTimes(1);

      // 2 回目（同じモジュールキャッシュを再利用）
      await act(async () => {
        render(
          <MemoryRouter>
            <CommandPalette open={true} onClose={vi.fn()} />
          </MemoryRouter>,
        );
      });

      // 再呼び出しされていない
      expect(mockChannelsList).toHaveBeenCalledTimes(1);
      expect(mockDmListConversations).toHaveBeenCalledTimes(1);
      expect(mockAuthUsers).toHaveBeenCalledTimes(1);
    });
  });
});
