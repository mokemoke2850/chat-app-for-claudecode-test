/**
 * テスト対象: MentionDropdown コンポーネント (@here / @channel 固定エントリ機能)
 * 戦略: @here / @channel がサジェスト候補に固定エントリとして表示されること、
 *       クエリに応じたフィルタリング、選択時の動作を検証する。
 *       メッセージ送信コンポーネントから mentionedUserIds に特殊値が渡されるルートも確認する。
 */

import { describe, it } from 'vitest';

describe('@here / @channel 固定エントリ（MentionDropdown）', () => {
  describe('@here サジェスト表示', () => {
    it.todo('@h と入力したとき候補リストのトップに @here が表示される');
    it.todo('@he と入力したとき候補リストのトップに @here が表示される');
    it.todo('@here と完全入力したとき候補リストに @here が表示される');
    it.todo('@c と入力したとき @here は表示されず @channel のみが候補に現れる');
  });

  describe('@channel サジェスト表示', () => {
    it.todo('@c と入力したとき候補リストのトップに @channel が表示される');
    it.todo('@ch と入力したとき候補リストのトップに @channel が表示される');
    it.todo('@channel と完全入力したとき候補リストに @channel が表示される');
    it.todo('@h と入力したとき @channel は表示されず @here のみが候補に現れる');
  });

  describe('固定エントリとユーザー候補の混在', () => {
    it.todo('@h と入力したとき @here 固定エントリが通常ユーザー候補より前に表示される');
    it.todo('@a のように固定エントリに一致しないクエリでは @here / @channel は表示されない');
    it.todo('@ のみ入力（空クエリ）のとき @here と @channel が候補リストの先頭に表示される');
  });

  describe('固定エントリの選択', () => {
    it.todo('@here を選択すると onSelectSpecial が "here" を引数に呼ばれる');
    it.todo('@channel を選択すると onSelectSpecial が "channel" を引数に呼ばれる');
    it.todo('@here を選択してもエディタのフォーカスは維持される（e.preventDefault）');
  });
});
