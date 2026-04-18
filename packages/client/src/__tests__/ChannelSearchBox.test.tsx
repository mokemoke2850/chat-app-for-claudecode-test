/**
 * テスト対象: ChannelList 内の ChannelSearchBox コンポーネント
 * 責務: チャンネル名によるインクリメンタルサーチ入力UI
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ChannelSearchBox from '../components/Channel/ChannelSearchBox';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('ChannelSearchBox', () => {
  describe('表示', () => {
    it('検索プレースホルダーが表示される', () => {
      render(<ChannelSearchBox value="" onChange={vi.fn()} />);
      expect(screen.getByPlaceholderText('Search channels')).toBeInTheDocument();
    });

    it('検索アイコンが表示される', () => {
      render(<ChannelSearchBox value="" onChange={vi.fn()} />);
      // SearchIcon は InputBase の兄弟要素として描画される
      // 共通の親要素（Box）から SVG を検索する
      const input = screen.getByPlaceholderText('Search channels');
      const box = input.closest('div')?.parentElement;
      expect(box?.querySelector('svg')).toBeInTheDocument();
    });
  });

  describe('入力', () => {
    it('テキストを入力すると onChange が呼ばれる', async () => {
      const onChange = vi.fn();
      // 制御コンポーネントのため、fireEvent.change を使って onChange を確認する
      const { rerender } = render(<ChannelSearchBox value="" onChange={onChange} />);
      const input = screen.getByPlaceholderText('Search channels');
      // 1文字ずつタイプして onChange が都度呼ばれることを確認
      await userEvent.type(input, 'g');
      expect(onChange).toHaveBeenCalledWith('g');
      rerender(<ChannelSearchBox value="g" onChange={onChange} />);
      await userEvent.type(input, 'e');
      expect(onChange).toHaveBeenCalledWith('ge');
    });

    it('入力した値が表示される', () => {
      render(<ChannelSearchBox value="general" onChange={vi.fn()} />);
      expect(screen.getByPlaceholderText('Search channels')).toHaveValue('general');
    });
  });

  describe('クリア', () => {
    it('入力をクリアすると空文字列が onChange に渡される', async () => {
      const onChange = vi.fn();
      const { rerender } = render(<ChannelSearchBox value="gen" onChange={onChange} />);
      const input = screen.getByPlaceholderText('Search channels');
      // 入力値をクリア
      await userEvent.clear(input);
      // clear後にonChangeが空文字列で呼ばれる
      expect(onChange).toHaveBeenLastCalledWith('');
    });
  });
});
