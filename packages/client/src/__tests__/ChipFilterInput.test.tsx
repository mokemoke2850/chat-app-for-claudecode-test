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

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
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
});
