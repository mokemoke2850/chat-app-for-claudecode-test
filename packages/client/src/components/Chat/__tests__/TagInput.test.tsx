/**
 * テスト対象: components/Chat/TagInput.tsx (補完候補付きタグ入力)
 * 戦略:
 *   - useTagSuggestions をモックして候補配列を固定し、UI のキー操作・確定挙動を検証する。
 *   - Autocomplete の細かい visual state ではなく、「Enter で確定」「Backspace で直近削除」など
 *     キーボードからしか確認できないインタラクションをカバーする。
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import type { TagSuggestion } from '@chat-app/shared';
import TagInput from '../TagInput';

let mockSuggestions: TagSuggestion[] = [];
vi.mock('../../../hooks/useTagSuggestions', () => ({
  useTagSuggestions: () => mockSuggestions,
}));

beforeEach(() => {
  mockSuggestions = [];
});

describe('TagInput', () => {
  describe('候補表示', () => {
    it('入力中の文字列を prefix として候補リストに表示する', () => {
      mockSuggestions = [
        { id: 1, name: 'apple', useCount: 5 },
        { id: 2, name: 'apricot', useCount: 3 },
      ];
      render(<TagInput value={[]} onChange={vi.fn()} />);
      const input = screen.getByTestId('tag-input');
      fireEvent.change(input, { target: { value: 'ap' } });
      expect(screen.getByText('#apple')).toBeInTheDocument();
      expect(screen.getByText('#apricot')).toBeInTheDocument();
    });

    it('useTagSuggestions が返す候補は use_count 順に並んでいる前提で、その順番のまま表示される', () => {
      mockSuggestions = [
        { id: 1, name: 'high', useCount: 10 },
        { id: 2, name: 'mid', useCount: 5 },
        { id: 3, name: 'low', useCount: 1 },
      ];
      render(<TagInput value={[]} onChange={vi.fn()} />);
      const input = screen.getByTestId('tag-input');
      fireEvent.change(input, { target: { value: 'x' } });
      const items = screen.getAllByRole('button').map((el) => el.textContent ?? '');
      // ListItemButton は role=button。先頭は #high, 次が #mid, 最後が #low
      const labels = items.filter((t) => t.startsWith('#'));
      expect(labels.findIndex((l) => l.includes('high'))).toBeLessThan(
        labels.findIndex((l) => l.includes('mid')),
      );
      expect(labels.findIndex((l) => l.includes('mid'))).toBeLessThan(
        labels.findIndex((l) => l.includes('low')),
      );
    });

    // 仕様の精緻化（#177）：
    // 旧テスト名「入力が空のときも use_count 上位の候補を表示する」は実装と乖離しており、
    // TagInput は入力文字数 > 0 のときのみ候補リストを開く実装になっているため、
    // 「入力が空のときは候補リストが表示されない」に更新する。
    it('入力が空のときは候補リストが表示されない', () => {
      mockSuggestions = [{ id: 1, name: 'apple', useCount: 5 }];
      render(<TagInput value={[]} onChange={vi.fn()} />);
      // 何も入力していない状態では候補は描画されない
      expect(screen.queryByText('#apple')).toBeNull();
    });
  });

  describe('タグ確定操作', () => {
    it('Enter キーで現在の入力値を新規タグとして確定し onChange に追加後の配列が渡る', () => {
      const onChange = vi.fn();
      render(<TagInput value={[]} onChange={onChange} />);
      const input = screen.getByTestId('tag-input');
      fireEvent.change(input, { target: { value: 'newtag' } });
      fireEvent.keyDown(input, { key: 'Enter' });
      expect(onChange).toHaveBeenCalledWith(['newtag']);
    });

    // 仕様の精緻化（#177）：
    // 旧テスト名「候補を矢印キーで選択し Enter を押すと候補のタグ名で確定される」は
    // 実装に矢印キー選択が無いため、現実装のマウス操作に合わせて
    // 「候補をクリックすると候補のタグ名で確定される」に更新する。
    it('候補をクリックすると候補のタグ名で確定される', () => {
      const onChange = vi.fn();
      mockSuggestions = [{ id: 1, name: 'apple', useCount: 5 }];
      render(<TagInput value={[]} onChange={onChange} />);
      const input = screen.getByTestId('tag-input');
      fireEvent.change(input, { target: { value: 'ap' } });
      // 候補は onMouseDown で確定する実装
      fireEvent.mouseDown(screen.getByText('#apple'));
      expect(onChange).toHaveBeenCalledWith(['apple']);
    });

    it('カンマ "," 入力でも確定される', () => {
      const onChange = vi.fn();
      render(<TagInput value={[]} onChange={onChange} />);
      const input = screen.getByTestId('tag-input');
      // 末尾にカンマを含む入力で即確定
      fireEvent.change(input, { target: { value: 'newtag,' } });
      expect(onChange).toHaveBeenCalledWith(['newtag']);
    });

    it('既に追加済みのタグ名を再入力しても重複追加されない', () => {
      const onChange = vi.fn();
      render(<TagInput value={['apple']} onChange={onChange} />);
      const input = screen.getByTestId('tag-input');
      fireEvent.change(input, { target: { value: 'apple' } });
      fireEvent.keyDown(input, { key: 'Enter' });
      expect(onChange).not.toHaveBeenCalled();
    });

    it('空文字または空白のみの入力では確定されない', () => {
      const onChange = vi.fn();
      render(<TagInput value={[]} onChange={onChange} />);
      const input = screen.getByTestId('tag-input');
      // 空文字
      fireEvent.keyDown(input, { key: 'Enter' });
      expect(onChange).not.toHaveBeenCalled();
      // 空白のみ
      fireEvent.change(input, { target: { value: '   ' } });
      fireEvent.keyDown(input, { key: 'Enter' });
      expect(onChange).not.toHaveBeenCalled();
    });
  });

  describe('タグ削除操作', () => {
    it('入力欄が空の状態で Backspace を押すと最後尾のタグが削除される', () => {
      const onChange = vi.fn();
      render(<TagInput value={['a', 'b', 'c']} onChange={onChange} />);
      const input = screen.getByTestId('tag-input');
      fireEvent.keyDown(input, { key: 'Backspace' });
      expect(onChange).toHaveBeenCalledWith(['a', 'b']);
    });

    it('入力欄に文字がある状態で Backspace を押してもタグは削除されない (通常の文字削除)', () => {
      const onChange = vi.fn();
      render(<TagInput value={['a', 'b']} onChange={onChange} />);
      const input = screen.getByTestId('tag-input');
      fireEvent.change(input, { target: { value: 'x' } });
      onChange.mockClear();
      fireEvent.keyDown(input, { key: 'Backspace' });
      expect(onChange).not.toHaveBeenCalled();
    });

    it('チップの × ボタン経由でも削除できる', () => {
      const onChange = vi.fn();
      render(<TagInput value={['apple', 'banana']} onChange={onChange} />);
      // 'apple' チップの削除アイコンをクリック
      const cancelIcons = screen.getAllByTestId('CancelIcon');
      fireEvent.click(cancelIcons[0]);
      expect(onChange).toHaveBeenCalledWith(['banana']);
    });
  });

  describe('正規化との整合', () => {
    it('"Bug" を入力して確定すると、表示上は小文字 "bug" として正規化される', () => {
      const onChange = vi.fn();
      render(<TagInput value={[]} onChange={onChange} />);
      const input = screen.getByTestId('tag-input');
      fireEvent.change(input, { target: { value: 'Bug' } });
      fireEvent.keyDown(input, { key: 'Enter' });
      expect(onChange).toHaveBeenCalledWith(['bug']);
    });

    it('前後空白付きで入力しても trim されてから追加される', () => {
      const onChange = vi.fn();
      render(<TagInput value={[]} onChange={onChange} />);
      const input = screen.getByTestId('tag-input');
      fireEvent.change(input, { target: { value: '  bug  ' } });
      fireEvent.keyDown(input, { key: 'Enter' });
      expect(onChange).toHaveBeenCalledWith(['bug']);
    });
  });
});
