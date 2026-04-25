/**
 * テスト対象: components/Chat/TagInput.tsx (補完候補付きタグ入力)
 * 戦略:
 *   - useTagSuggestions をモックして候補配列を固定し、UI のキー操作・確定挙動を検証する。
 *   - Autocomplete の細かい visual state ではなく、「Enter で確定」「Backspace で直近削除」など
 *     キーボードからしか確認できないインタラクションをカバーする。
 */

describe('TagInput', () => {
  describe('候補表示 (Autocomplete)', () => {
    it('入力中の文字列を prefix として候補リストに表示する', () => {
      // TODO
    });

    it('useTagSuggestions が返す候補は use_count 順に並んでいる前提で、その順番のまま表示される', () => {
      // TODO
    });

    it('入力が空のときも use_count 上位の候補を表示する', () => {
      // TODO
    });
  });

  describe('タグ確定操作', () => {
    it('Enter キーで現在の入力値を新規タグとして確定し onChange に追加後の配列が渡る', () => {
      // TODO
    });

    it('候補を矢印キーで選択し Enter を押すと候補のタグ名で確定される', () => {
      // TODO
    });

    it('カンマ "," 入力でも確定される', () => {
      // TODO
    });

    it('既に追加済みのタグ名を再入力しても重複追加されない', () => {
      // TODO
    });

    it('空文字または空白のみの入力では確定されない', () => {
      // TODO
    });
  });

  describe('タグ削除操作', () => {
    it('入力欄が空の状態で Backspace を押すと最後尾のタグが削除される', () => {
      // TODO
    });

    it('入力欄に文字がある状態で Backspace を押してもタグは削除されない (通常の文字削除)', () => {
      // TODO
    });

    it('チップの × ボタン経由でも削除できる', () => {
      // TODO
    });
  });

  describe('正規化との整合', () => {
    it('"Bug" を入力して確定すると、表示上は小文字 "bug" として正規化される', () => {
      // TODO
    });

    it('前後空白付きで入力しても trim されてから追加される', () => {
      // TODO
    });
  });
});
