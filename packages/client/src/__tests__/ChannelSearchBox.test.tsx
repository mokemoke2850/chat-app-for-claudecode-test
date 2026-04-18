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
      // SearchIcon は SVG として描画される（data-testid は存在しないので aria-hidden属性で確認）
      const container = screen.getByPlaceholderText('Search channels').closest('div');
      expect(container?.querySelector('svg')).toBeInTheDocument();
    });
  });

  describe('入力', () => {
    it('テキストを入力すると onChange が呼ばれる', async () => {
      const onChange = vi.fn();
      render(<ChannelSearchBox value="" onChange={onChange} />);
      await userEvent.type(screen.getByPlaceholderText('Search channels'), 'gen');
      expect(onChange).toHaveBeenCalled();
      expect(onChange).toHaveBeenLastCalledWith('gen');
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
