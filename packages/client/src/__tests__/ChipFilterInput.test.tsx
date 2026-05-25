/**
 * components/Search/ChipFilterInput.tsx のユニットテスト (Step 7c-1)
 *
 * テスト対象: 検索ページ上部のチップ式フィルタ入力欄。
 *   - 入力テキストを `parseSearchChips` で解析
 *   - 抽出した from:/in:/tag: を users / channels / tags の配列と照合して ID 変換
 *   - 解析結果のチップを TextField の下に表示
 *   - 親に `onResolved({ keyword, filters })` を通知
 *
 * 戦略:
 *   - 純粋コンポーネント: users / channels / tags 配列を props で直接渡す
 */

import { useState } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { User, Channel, Tag } from '@chat-app/shared';
import ChipFilterInput from '../components/Search/ChipFilterInput';

function makeUser(overrides: Partial<User> = {}): User {
  return {
    id: 1,
    username: 'alice',
    email: 'alice@example.com',
    displayName: null,
    avatarUrl: null,
    role: 'user',
    location: null,
    createdAt: '2026-05-01T00:00:00Z',
    isActive: true,
    onboardingCompletedAt: null,
    ...overrides,
  };
}

function makeChannel(overrides: Partial<Channel> = {}): Channel {
  return {
    id: 100,
    name: 'general',
    description: null,
    topic: null,
    createdBy: 1,
    createdAt: '2026-05-01T00:00:00Z',
    isPrivate: false,
    postingPermission: 'everyone',
    unreadCount: 0,
    ...overrides,
  };
}

function makeTag(overrides: Partial<Tag> = {}): Tag {
  return {
    id: 10,
    name: 'urgent',
    useCount: 1,
    createdAt: '2026-05-01T00:00:00Z',
    ...overrides,
  };
}

interface RenderOpts {
  value?: string;
  users?: User[];
  channels?: Channel[];
  tags?: Tag[];
  onTextChange?: (text: string) => void;
  onResolved?: (params: { keyword: string; filters: Record<string, unknown> }) => void;
}

function renderInput(opts: RenderOpts = {}) {
  const onTextChange = opts.onTextChange ?? vi.fn();
  const onResolved = opts.onResolved ?? vi.fn();
  const utils = render(
    <ChipFilterInput
      value={opts.value ?? ''}
      onTextChange={onTextChange}
      onResolved={onResolved}
      users={opts.users ?? []}
      channels={opts.channels ?? []}
      tags={opts.tags ?? []}
    />,
  );
  return { ...utils, onTextChange, onResolved };
}

/**
 * value を内部 state で保持して onTextChange で更新する controlled な wrapper。
 * ユーザー操作（入力 / 候補選択）の結果を実際に value へ反映できるようにする。
 */
function renderControlled(opts: RenderOpts = {}) {
  const externalOnTextChange = opts.onTextChange;
  const onResolved = opts.onResolved ?? vi.fn();
  const Wrapper = () => {
    const [v, setV] = useState(opts.value ?? '');
    return (
      <ChipFilterInput
        value={v}
        onTextChange={(text) => {
          setV(text);
          externalOnTextChange?.(text);
        }}
        onResolved={onResolved}
        users={opts.users ?? []}
        channels={opts.channels ?? []}
        tags={opts.tags ?? []}
      />
    );
  };
  return render(<Wrapper />);
}

describe('ChipFilterInput (Step 7c-1)', () => {
  describe('入力 + 通知', () => {
    it('value props の初期値が TextField に表示される', () => {
      renderInput({ value: 'hello' });
      expect(screen.getByLabelText('メッセージ検索')).toHaveValue('hello');
    });

    it('入力するたびに onTextChange が呼ばれ、parse 結果が onResolved で通知される', async () => {
      const onTextChange = vi.fn();
      renderInput({ onTextChange });
      const input = screen.getByLabelText('メッセージ検索');
      await userEvent.type(input, 'a');
      expect(onTextChange).toHaveBeenCalledWith('a');
    });

    it('プレーンテキスト入力時は keyword のみ通知される (filters は空)', () => {
      const onResolved = vi.fn();
      renderInput({ value: 'hello world', onResolved });
      // 初回マウント時にも onResolved が呼ばれる
      expect(onResolved).toHaveBeenCalled();
      const lastCall = onResolved.mock.calls[onResolved.mock.calls.length - 1][0];
      expect(lastCall.keyword).toBe('hello world');
      expect(lastCall.filters).toEqual({});
    });
  });

  describe('チップ表示', () => {
    it('from:alice 入力時、送信者 alice のチップが表示される', () => {
      renderInput({ value: 'from:alice' });
      expect(screen.getByTestId('chip-from')).toHaveTextContent('alice');
    });

    it('in:general 入力時、チャンネル general のチップが表示される', () => {
      renderInput({ value: 'in:general' });
      expect(screen.getByTestId('chip-in')).toHaveTextContent('general');
    });

    it('has:file 入力時、添付ありのチップが表示される', () => {
      renderInput({ value: 'has:file' });
      expect(screen.getByTestId('chip-has')).toHaveTextContent('添付あり');
    });

    it('tag:urgent 入力時、タグ urgent のチップが表示される', () => {
      renderInput({ value: 'tag:urgent' });
      expect(screen.getByTestId('chip-tag')).toHaveTextContent('urgent');
    });

    it('複数構文が組み合わさると複数のチップが表示される', () => {
      renderInput({ value: 'from:alice has:file tag:urgent' });
      expect(screen.getByTestId('chip-from')).toBeInTheDocument();
      expect(screen.getByTestId('chip-has')).toBeInTheDocument();
      expect(screen.getByTestId('chip-tag')).toBeInTheDocument();
    });
  });

  describe('マスタデータ照合', () => {
    it('from:alice に対応するユーザーがいれば userId が filters に反映される', () => {
      const onResolved = vi.fn();
      renderInput({
        value: 'from:alice',
        users: [makeUser({ id: 42, username: 'alice' })],
        onResolved,
      });
      const lastCall = onResolved.mock.calls[onResolved.mock.calls.length - 1][0];
      expect(lastCall.filters.userId).toBe(42);
    });

    it('from:存在しないユーザー はチップ表示するが filters の userId は undefined', () => {
      const onResolved = vi.fn();
      renderInput({
        value: 'from:bob',
        users: [makeUser({ id: 1, username: 'alice' })],
        onResolved,
      });
      const lastCall = onResolved.mock.calls[onResolved.mock.calls.length - 1][0];
      expect(lastCall.filters.userId).toBeUndefined();
      expect(screen.getByTestId('chip-from')).toBeInTheDocument(); // チップは表示
    });

    it('in:general に対応するチャンネルがいれば channelId が filters に反映される', () => {
      const onResolved = vi.fn();
      renderInput({
        value: 'in:general',
        channels: [makeChannel({ id: 99, name: 'general' })],
        onResolved,
      });
      const lastCall = onResolved.mock.calls[onResolved.mock.calls.length - 1][0];
      expect(lastCall.filters.channelId).toBe(99);
    });

    it('tag:urgent に対応するタグがいれば tagIds に反映される', () => {
      const onResolved = vi.fn();
      renderInput({
        value: 'tag:urgent',
        tags: [makeTag({ id: 7, name: 'urgent' })],
        onResolved,
      });
      const lastCall = onResolved.mock.calls[onResolved.mock.calls.length - 1][0];
      expect(lastCall.filters.tagIds).toEqual([7]);
    });
  });

  describe('検索構文オートコンプリート (Issue #326)', () => {
    beforeEach(() => {
      localStorage.clear();
    });

    describe('構文キーワード候補の表示', () => {
      it('入力欄からフォーカスが外れているときは候補リストが表示されない', async () => {
        renderInput();
        const input = screen.getByLabelText('メッセージ検索');
        // TextField が autoFocus 持ちなのでテスト側で明示的に blur する
        input.blur();
        await new Promise((r) => setTimeout(r, 0));
        expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
      });

      it('入力欄にフォーカスが当たり、トークンに `:` が含まれない場合は from:/in:/has:/tag:/before:/after: の構文候補が表示される', async () => {
        renderControlled();
        const input = screen.getByLabelText('メッセージ検索');
        await userEvent.click(input);
        expect(screen.getByRole('option', { name: 'from:' })).toBeInTheDocument();
        expect(screen.getByRole('option', { name: 'in:' })).toBeInTheDocument();
        expect(screen.getByRole('option', { name: 'has:' })).toBeInTheDocument();
        expect(screen.getByRole('option', { name: 'tag:' })).toBeInTheDocument();
        expect(screen.getByRole('option', { name: 'before:' })).toBeInTheDocument();
        expect(screen.getByRole('option', { name: 'after:' })).toBeInTheDocument();
      });

      it('"fr" のように前方一致する構文だけに候補が絞り込まれる', async () => {
        renderControlled();
        const input = screen.getByLabelText('メッセージ検索');
        await userEvent.click(input);
        await userEvent.type(input, 'fr');
        expect(screen.getByRole('option', { name: 'from:' })).toBeInTheDocument();
        expect(screen.queryByRole('option', { name: 'in:' })).not.toBeInTheDocument();
      });

      it('構文候補をクリックすると入力テキストにプレフィックス（例: "from:"）が補完される', async () => {
        const onTextChange = vi.fn();
        renderControlled({ onTextChange });
        const input = screen.getByLabelText('メッセージ検索');
        await userEvent.click(input);
        await userEvent.click(screen.getByRole('option', { name: 'from:' }));
        expect(onTextChange).toHaveBeenLastCalledWith('from:');
      });
    });

    describe('値の候補表示', () => {
      it('"from:" を入力した直後、users 配列のユーザー名候補が表示される', async () => {
        renderControlled({
          users: [makeUser({ id: 1, username: 'alice' }), makeUser({ id: 2, username: 'bob' })],
        });
        const input = screen.getByLabelText('メッセージ検索');
        await userEvent.click(input);
        await userEvent.type(input, 'from:');
        expect(screen.getByRole('option', { name: 'alice' })).toBeInTheDocument();
        expect(screen.getByRole('option', { name: 'bob' })).toBeInTheDocument();
      });

      it('"in:" を入力した直後、channels 配列のチャンネル名候補が表示される', async () => {
        renderControlled({
          channels: [
            makeChannel({ id: 1, name: 'general' }),
            makeChannel({ id: 2, name: 'random' }),
          ],
        });
        const input = screen.getByLabelText('メッセージ検索');
        await userEvent.click(input);
        await userEvent.type(input, 'in:');
        expect(screen.getByRole('option', { name: 'general' })).toBeInTheDocument();
        expect(screen.getByRole('option', { name: 'random' })).toBeInTheDocument();
      });

      it('"tag:" を入力した直後、tags 配列のタグ名候補が表示される', async () => {
        renderControlled({
          tags: [makeTag({ id: 1, name: 'urgent' }), makeTag({ id: 2, name: 'bug' })],
        });
        const input = screen.getByLabelText('メッセージ検索');
        await userEvent.click(input);
        await userEvent.type(input, 'tag:');
        expect(screen.getByRole('option', { name: 'urgent' })).toBeInTheDocument();
        expect(screen.getByRole('option', { name: 'bug' })).toBeInTheDocument();
      });

      it('"has:" を入力した直後、file と link の固定候補が表示される', async () => {
        renderControlled();
        const input = screen.getByLabelText('メッセージ検索');
        await userEvent.click(input);
        await userEvent.type(input, 'has:');
        expect(screen.getByRole('option', { name: 'file' })).toBeInTheDocument();
        expect(screen.getByRole('option', { name: 'link' })).toBeInTheDocument();
      });

      it('"from:al" のように値部分の前方一致で候補が絞り込まれる（大小文字無視）', async () => {
        renderControlled({
          users: [
            makeUser({ id: 1, username: 'alice' }),
            makeUser({ id: 2, username: 'Albert' }),
            makeUser({ id: 3, username: 'bob' }),
          ],
        });
        const input = screen.getByLabelText('メッセージ検索');
        await userEvent.click(input);
        await userEvent.type(input, 'from:al');
        expect(screen.getByRole('option', { name: 'alice' })).toBeInTheDocument();
        expect(screen.getByRole('option', { name: 'Albert' })).toBeInTheDocument();
        expect(screen.queryByRole('option', { name: 'bob' })).not.toBeInTheDocument();
      });

      it('値の候補をクリックすると、対応するトークン（例: "from:alice"）が入力される', async () => {
        const onTextChange = vi.fn();
        renderControlled({
          users: [makeUser({ id: 1, username: 'alice' })],
          onTextChange,
        });
        const input = screen.getByLabelText('メッセージ検索');
        await userEvent.click(input);
        await userEvent.type(input, 'from:');
        await userEvent.click(screen.getByRole('option', { name: 'alice' }));
        expect(onTextChange).toHaveBeenLastCalledWith('from:alice');
      });
    });

    describe('キーボード操作', () => {
      it('ArrowDown で候補のハイライトが次の項目へ移動する', async () => {
        renderControlled({
          users: [makeUser({ id: 1, username: 'alice' }), makeUser({ id: 2, username: 'bob' })],
        });
        const input = screen.getByLabelText('メッセージ検索');
        await userEvent.click(input);
        await userEvent.type(input, 'from:');
        // 初期状態では最初の項目がハイライト
        expect(screen.getByRole('option', { name: 'alice' })).toHaveAttribute(
          'aria-selected',
          'true',
        );
        await userEvent.keyboard('{ArrowDown}');
        expect(screen.getByRole('option', { name: 'bob' })).toHaveAttribute(
          'aria-selected',
          'true',
        );
      });

      it('ArrowUp で候補のハイライトが前の項目へ移動する', async () => {
        renderControlled({
          users: [makeUser({ id: 1, username: 'alice' }), makeUser({ id: 2, username: 'bob' })],
        });
        const input = screen.getByLabelText('メッセージ検索');
        await userEvent.click(input);
        await userEvent.type(input, 'from:');
        await userEvent.keyboard('{ArrowDown}');
        await userEvent.keyboard('{ArrowUp}');
        expect(screen.getByRole('option', { name: 'alice' })).toHaveAttribute(
          'aria-selected',
          'true',
        );
      });

      it('ハイライト中に Enter を押すと候補が補完される', async () => {
        const onTextChange = vi.fn();
        renderControlled({
          users: [makeUser({ id: 1, username: 'alice' })],
          onTextChange,
        });
        const input = screen.getByLabelText('メッセージ検索');
        await userEvent.click(input);
        await userEvent.type(input, 'from:');
        await userEvent.keyboard('{Enter}');
        expect(onTextChange).toHaveBeenLastCalledWith('from:alice');
      });

      it('ハイライト中に Tab を押すと候補が補完される', async () => {
        const onTextChange = vi.fn();
        renderControlled({
          users: [makeUser({ id: 1, username: 'alice' })],
          onTextChange,
        });
        const input = screen.getByLabelText('メッセージ検索');
        await userEvent.click(input);
        await userEvent.type(input, 'from:');
        await userEvent.keyboard('{Tab}');
        expect(onTextChange).toHaveBeenLastCalledWith('from:alice');
      });

      it('Escape で候補リストが閉じる', async () => {
        renderControlled();
        const input = screen.getByLabelText('メッセージ検索');
        await userEvent.click(input);
        expect(screen.getByRole('listbox')).toBeInTheDocument();
        await userEvent.keyboard('{Escape}');
        expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
      });

      it('候補リスト表示中の Enter / Tab はフォーム送信やフォーカス移動を引き起こさない', async () => {
        renderControlled({
          users: [makeUser({ id: 1, username: 'alice' })],
        });
        const input = screen.getByLabelText('メッセージ検索');
        await userEvent.click(input);
        await userEvent.type(input, 'from:');
        await userEvent.keyboard('{Enter}');
        // Enter 後もフォーカスは入力欄に留まる
        expect(document.activeElement).toBe(input);
      });
    });

    describe('使用履歴', () => {
      it('値の候補を選択すると、選択値が localStorage に保存される', async () => {
        renderControlled({
          users: [makeUser({ id: 1, username: 'alice' })],
        });
        const input = screen.getByLabelText('メッセージ検索');
        await userEvent.click(input);
        await userEvent.type(input, 'from:');
        await userEvent.click(screen.getByRole('option', { name: 'alice' }));
        const stored = localStorage.getItem('searchChipHistory.from');
        expect(stored).not.toBeNull();
        expect(JSON.parse(stored!)).toContain('alice');
      });

      it('履歴がある場合、その値が候補リストの先頭に優先表示される', async () => {
        localStorage.setItem('searchChipHistory.from', JSON.stringify(['bob']));
        renderControlled({
          users: [makeUser({ id: 1, username: 'alice' }), makeUser({ id: 2, username: 'bob' })],
        });
        const input = screen.getByLabelText('メッセージ検索');
        await userEvent.click(input);
        await userEvent.type(input, 'from:');
        const options = screen.getAllByRole('option');
        // bob が先頭に表示
        expect(options[0]).toHaveTextContent('bob');
        expect(options[1]).toHaveTextContent('alice');
      });

      it('履歴の保存件数は最大10件で、古いものから捨てられる', async () => {
        // 既に10件保存済（先頭が最新、末尾が最古）
        const existing = Array.from({ length: 10 }, (_, i) => `user${i}`);
        localStorage.setItem('searchChipHistory.from', JSON.stringify(existing));
        renderControlled({
          users: [makeUser({ id: 99, username: 'newbie' })],
        });
        const input = screen.getByLabelText('メッセージ検索');
        await userEvent.click(input);
        await userEvent.type(input, 'from:');
        await userEvent.click(screen.getByRole('option', { name: 'newbie' }));
        const stored = JSON.parse(localStorage.getItem('searchChipHistory.from')!) as string[];
        expect(stored.length).toBe(10);
        expect(stored[0]).toBe('newbie');
        // 末尾の最古 user9 が捨てられる
        expect(stored).not.toContain('user9');
      });

      it('from: / in: / tag: は別キーで履歴管理される', async () => {
        renderControlled({
          users: [makeUser({ id: 1, username: 'alice' })],
          channels: [makeChannel({ id: 10, name: 'general' })],
        });
        const input = screen.getByLabelText('メッセージ検索');
        await userEvent.click(input);
        await userEvent.type(input, 'from:');
        await userEvent.click(screen.getByRole('option', { name: 'alice' }));
        await userEvent.clear(input);
        await userEvent.click(input);
        await userEvent.type(input, 'in:');
        await userEvent.click(screen.getByRole('option', { name: 'general' }));
        expect(JSON.parse(localStorage.getItem('searchChipHistory.from')!)).toContain('alice');
        expect(JSON.parse(localStorage.getItem('searchChipHistory.in')!)).toContain('general');
      });
    });
  });
});
