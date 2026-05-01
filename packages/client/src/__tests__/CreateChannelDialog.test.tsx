/**
 * components/Channel/CreateChannelDialog.tsx のユニットテスト
 *
 * テスト対象: ダイアログの表示制御、フォームバリデーション、送信フロー
 * 戦略:
 *   - api.channels.create を vi.mock で差し替える
 *   - userEvent でフォーム入力・送信をシミュレートする
 *   - MUI の Dialog は open prop で描画制御される
 *
 * React 19 移行後の変更点:
 *   - isPrivate=true 時に UsersList が use() + Suspense を使うため、
 *     private トグルをオンにした後に await act(async () => {}) で
 *     Suspense をフラッシュする
 */

import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import type { Channel } from '@chat-app/shared';
import CreateChannelDialog from '../components/Channel/CreateChannelDialog';

vi.mock('../api/client', () => ({
  api: {
    channels: {
      create: vi.fn(),
    },
    auth: {
      users: vi.fn(),
    },
    tags: {
      suggestions: vi.fn().mockResolvedValue({ suggestions: [] }),
    },
  },
}));

import { api } from '../api/client';
import { _resetSuggestionsCacheForTest } from '../hooks/useTagSuggestions';
const mockCreate = api.channels.create as ReturnType<typeof vi.fn>;
const mockUsers = api.auth.users as ReturnType<typeof vi.fn>;

let user: ReturnType<typeof userEvent.setup>;

function makeChannel(id: number, name: string, isPrivate = false): Channel {
  return {
    id,
    name,
    description: null,
    topic: null,
    createdBy: 1,
    createdAt: '2024-01-01T00:00:00Z',
    isPrivate,
    postingPermission: 'everyone',
    unreadCount: 0,
  };
}

const defaultProps = {
  open: true,
  onClose: vi.fn(),
  onCreate: vi.fn(),
};

beforeEach(() => {
  vi.resetAllMocks();
  _resetSuggestionsCacheForTest();
  // TagInput 内部の useTagSuggestions が api.tags.suggestions を呼ぶため、
  // resetAllMocks 後に毎回デフォルト値を設定する
  (api.tags.suggestions as ReturnType<typeof vi.fn>).mockResolvedValue({ suggestions: [] });
  user = userEvent.setup({ delay: null, pointerEventsCheck: 0 });
});

describe('CreateChannelDialog', () => {
  describe('表示制御', () => {
    it('open=false のとき Dialog が非表示である', () => {
      render(<CreateChannelDialog open={false} onClose={vi.fn()} onCreate={vi.fn()} />);

      expect(screen.queryByText('Create Channel')).not.toBeInTheDocument();
    });

    it('open=true のとき Dialog が表示される', () => {
      render(<CreateChannelDialog {...defaultProps} />);

      expect(screen.getByText('Create Channel')).toBeInTheDocument();
    });
  });

  describe('フォームバリデーション', () => {
    it('チャンネル名が空のとき Create ボタンが disabled になる', () => {
      render(<CreateChannelDialog {...defaultProps} />);

      expect(screen.getByRole('button', { name: /^create$/i })).toBeDisabled();
    });

    it('チャンネル名を入力すると Create ボタンが有効になる', async () => {
      render(<CreateChannelDialog {...defaultProps} />);

      await user.type(screen.getByLabelText(/channel name/i), 'general');

      expect(screen.getByRole('button', { name: /^create$/i })).toBeEnabled();
    });
  });

  describe('プライベートチャンネル', () => {
    it('プライベートチャンネルのトグルスイッチが表示される', () => {
      render(<CreateChannelDialog {...defaultProps} />);

      expect(screen.getByLabelText(/private/i)).toBeInTheDocument();
    });

    it('トグルをオンにすると isPrivate=true で API が呼ばれる', async () => {
      mockUsers.mockResolvedValue({ users: [] });
      mockCreate.mockResolvedValue({ channel: { ...makeChannel(1, 'secret'), isPrivate: true } });

      render(<CreateChannelDialog {...defaultProps} />);
      await user.type(screen.getByLabelText(/channel name/i), 'secret');
      await user.click(screen.getByLabelText(/private/i));
      // use() の Suspense が解決するまで待つ
      await screen.findByRole('list', { name: /members/i });
      await user.click(screen.getByRole('button', { name: /^create$/i }));

      await waitFor(() =>
        expect(mockCreate).toHaveBeenCalledWith(
          expect.objectContaining({ name: 'secret', isPrivate: true }),
        ),
      );
    });

    it('トグルがオフのとき isPrivate=false で API が呼ばれる', async () => {
      mockCreate.mockResolvedValue({ channel: makeChannel(1, 'public') });

      render(<CreateChannelDialog {...defaultProps} />);
      await user.type(screen.getByLabelText(/channel name/i), 'public');
      await user.click(screen.getByRole('button', { name: /^create$/i }));

      await waitFor(() =>
        expect(mockCreate).toHaveBeenCalledWith(
          expect.objectContaining({ name: 'public', isPrivate: false }),
        ),
      );
    });
  });

  describe('送信フロー', () => {
    it('フォームを送信すると api.channels.create が呼ばれる', async () => {
      mockCreate.mockResolvedValue({ channel: makeChannel(1, 'general') });

      render(<CreateChannelDialog {...defaultProps} />);
      await user.type(screen.getByLabelText(/channel name/i), 'general');
      await user.click(screen.getByRole('button', { name: /^create$/i }));

      await waitFor(() =>
        expect(mockCreate).toHaveBeenCalledWith(expect.objectContaining({ name: 'general' })),
      );
    });

    it('送信中は Create ボタンが disabled になる', async () => {
      mockCreate.mockReturnValue(new Promise(() => {}));

      render(<CreateChannelDialog {...defaultProps} />);
      await user.type(screen.getByLabelText(/channel name/i), 'general');
      await user.click(screen.getByRole('button', { name: /^create$/i }));

      expect(screen.getByRole('button', { name: /^create$/i })).toBeDisabled();
    });

    it('作成成功後に onCreate が作成されたチャンネルを引数に呼ばれる', async () => {
      const created = makeChannel(1, 'general');
      mockCreate.mockResolvedValue({ channel: created });
      const onCreate = vi.fn();

      render(<CreateChannelDialog open={true} onClose={vi.fn()} onCreate={onCreate} />);
      await user.type(screen.getByLabelText(/channel name/i), 'general');
      await user.click(screen.getByRole('button', { name: /^create$/i }));

      await waitFor(() => expect(onCreate).toHaveBeenCalledWith(created));
    });

    it('作成成功後にフォームがリセットされ onClose が呼ばれる', async () => {
      mockCreate.mockResolvedValue({ channel: makeChannel(1, 'general') });
      const onClose = vi.fn();

      render(<CreateChannelDialog open={true} onClose={onClose} onCreate={vi.fn()} />);
      await user.type(screen.getByLabelText(/channel name/i), 'general');
      await user.click(screen.getByRole('button', { name: /^create$/i }));

      await waitFor(() => expect(onClose).toHaveBeenCalled());
    });

    it('API エラー時にエラーメッセージが表示される', async () => {
      mockCreate.mockRejectedValue(new Error('Channel name already taken'));

      render(<CreateChannelDialog {...defaultProps} />);
      await user.type(screen.getByLabelText(/channel name/i), 'duplicate');
      await user.click(screen.getByRole('button', { name: /^create$/i }));

      await waitFor(() =>
        expect(screen.getByText('Channel name already taken')).toBeInTheDocument(),
      );
    });
  });

  describe('プライベートチャンネル作成時のメンバー選択', () => {
    it('Privateトグルがオフのときメンバー選択フィールドは表示されない', async () => {
      render(<CreateChannelDialog {...defaultProps} />);

      expect(screen.queryByLabelText(/members/i)).not.toBeInTheDocument();
    });

    it('Privateトグルをオンにするとメンバー選択フィールドが表示される', async () => {
      mockUsers.mockResolvedValue({ users: [] });

      render(<CreateChannelDialog {...defaultProps} />);
      await user.click(screen.getByLabelText(/private/i));
      // use() の Suspense が解決するまで待つ
      await screen.findByRole('list', { name: /members/i });

      expect(screen.getByRole('list', { name: /members/i })).toBeInTheDocument();
    });

    it('メンバー選択フィールド表示時に api.auth.users からユーザー一覧を取得して選択肢に表示する', async () => {
      mockUsers.mockResolvedValue({
        users: [
          { id: 2, username: 'alice' },
          { id: 3, username: 'bob' },
        ],
      });

      render(<CreateChannelDialog {...defaultProps} />);
      await user.click(screen.getByLabelText(/private/i));
      // use() の Suspense が解決するまで待つ
      await screen.findByText('alice');

      expect(mockUsers).toHaveBeenCalled();
      expect(screen.getByText('alice')).toBeInTheDocument();
      expect(screen.getByText('bob')).toBeInTheDocument();
    });

    it('メンバーを選択した状態でCreateすると memberIds を含めて API が呼ばれる', async () => {
      mockUsers.mockResolvedValue({
        users: [{ id: 2, username: 'alice' }],
      });
      mockCreate.mockResolvedValue({ channel: makeChannel(1, 'secret', true) });

      render(<CreateChannelDialog {...defaultProps} />);
      await user.type(screen.getByLabelText(/channel name/i), 'secret');
      await user.click(screen.getByLabelText(/private/i));
      // use() の Suspense が解決するまで待つ
      await screen.findByText('alice');

      // alice を選択
      await user.click(screen.getByText('alice'));
      await user.click(screen.getByRole('button', { name: /^create$/i }));

      await waitFor(() =>
        expect(mockCreate).toHaveBeenCalledWith(
          expect.objectContaining({ isPrivate: true, memberIds: [2] }),
        ),
      );
    });

    it('メンバーを選択せずにCreateすると memberIds は空配列で API が呼ばれる', async () => {
      mockUsers.mockResolvedValue({ users: [] });
      mockCreate.mockResolvedValue({ channel: makeChannel(1, 'secret', true) });

      render(<CreateChannelDialog {...defaultProps} />);
      await user.type(screen.getByLabelText(/channel name/i), 'secret');
      await user.click(screen.getByLabelText(/private/i));
      // use() の Suspense が解決するまで待つ
      await screen.findByRole('list', { name: /members/i });
      await user.click(screen.getByRole('button', { name: /^create$/i }));

      await waitFor(() =>
        expect(mockCreate).toHaveBeenCalledWith(
          expect.objectContaining({ isPrivate: true, memberIds: [] }),
        ),
      );
    });
  });

  // #115 タグ機能 — チャンネル作成時のタグ付与
  describe('タグ付与 (#115)', () => {
    it('TagInput に入力したタグ名が submit 時に create API の tagNames に渡される', async () => {
      mockCreate.mockResolvedValue({ channel: makeChannel(1, 'tagged') });

      render(<CreateChannelDialog {...defaultProps} />);
      await user.type(screen.getByLabelText(/channel name/i), 'tagged');
      // TagInput の入力欄にタグ名を入力して Enter で確定
      await user.type(screen.getByLabelText(/タグ入力/i), 'frontend{Enter}');
      await user.click(screen.getByRole('button', { name: /^create$/i }));

      await waitFor(() =>
        expect(mockCreate).toHaveBeenCalledWith(
          expect.objectContaining({ tagNames: ['frontend'] }),
        ),
      );
    });

    it('タグを指定しない場合は tagNames が空配列または未指定で API が呼ばれる', async () => {
      mockCreate.mockResolvedValue({ channel: makeChannel(1, 'no-tags') });

      render(<CreateChannelDialog {...defaultProps} />);
      await user.type(screen.getByLabelText(/channel name/i), 'no-tags');
      await user.click(screen.getByRole('button', { name: /^create$/i }));

      await waitFor(() => {
        const call = mockCreate.mock.calls[0][0] as Record<string, unknown>;
        const tagNames = call.tagNames;
        expect(!tagNames || (Array.isArray(tagNames) && tagNames.length === 0)).toBe(true);
      });
    });
  });

  // #113 投稿権限制御チャンネル — 作成時の権限選択
  describe('投稿権限選択 (#113)', () => {
    it('投稿権限選択UI（everyone / admins / readonly のラジオ）が表示される', () => {
      render(<CreateChannelDialog {...defaultProps} />);

      expect(screen.getByRole('radio', { name: /全員/ })).toBeInTheDocument();
      expect(screen.getByRole('radio', { name: /管理者のみ/ })).toBeInTheDocument();
      expect(screen.getByRole('radio', { name: /閲覧専用/ })).toBeInTheDocument();
    });

    it('既定で "everyone" が選択されている', () => {
      render(<CreateChannelDialog {...defaultProps} />);

      expect(screen.getByRole('radio', { name: /全員/ })).toBeChecked();
      expect(screen.getByRole('radio', { name: /管理者のみ/ })).not.toBeChecked();
      expect(screen.getByRole('radio', { name: /閲覧専用/ })).not.toBeChecked();
    });

    it('"admins" を選択して Create すると postingPermission: "admins" で API が呼ばれる', async () => {
      mockCreate.mockResolvedValue({
        channel: { ...makeChannel(1, 'admins-only'), postingPermission: 'admins' },
      });
      render(<CreateChannelDialog {...defaultProps} />);

      await user.type(screen.getByLabelText(/channel name/i), 'admins-only');
      await user.click(screen.getByRole('radio', { name: /管理者のみ/ }));
      await user.click(screen.getByRole('button', { name: /^create$/i }));

      await waitFor(() =>
        expect(mockCreate).toHaveBeenCalledWith(
          expect.objectContaining({ postingPermission: 'admins' }),
        ),
      );
    });

    it('"readonly" を選択して Create すると postingPermission: "readonly" で API が呼ばれる', async () => {
      mockCreate.mockResolvedValue({
        channel: { ...makeChannel(1, 'readonly'), postingPermission: 'readonly' },
      });
      render(<CreateChannelDialog {...defaultProps} />);

      await user.type(screen.getByLabelText(/channel name/i), 'readonly');
      await user.click(screen.getByRole('radio', { name: /閲覧専用/ }));
      await user.click(screen.getByRole('button', { name: /^create$/i }));

      await waitFor(() =>
        expect(mockCreate).toHaveBeenCalledWith(
          expect.objectContaining({ postingPermission: 'readonly' }),
        ),
      );
    });

    it('権限を変更せずに Create すると postingPermission は "everyone" で API が呼ばれる', async () => {
      mockCreate.mockResolvedValue({ channel: makeChannel(1, 'public') });
      render(<CreateChannelDialog {...defaultProps} />);

      await user.type(screen.getByLabelText(/channel name/i), 'public');
      await user.click(screen.getByRole('button', { name: /^create$/i }));

      await waitFor(() =>
        expect(mockCreate).toHaveBeenCalledWith(
          expect.objectContaining({ postingPermission: 'everyone' }),
        ),
      );
    });
  });
});
