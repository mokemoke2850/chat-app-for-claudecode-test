/**
 * テスト対象: components/Chat/TagChip.tsx
 * 戦略:
 *   - タグの表示と「クリックで検索フィルタにセット」「× で削除」のコールバック挙動を検証する。
 *   - スタイリングや細かい aria 属性は対象外（画面で確認可能な範囲）。
 */

describe('TagChip', () => {
  describe('表示', () => {
    it('渡された tag.name が "#" プレフィックス付きで表示される', () => {
      // TODO
    });

    it('readOnly=true のとき削除ボタン (×) が表示されない', () => {
      // TODO
    });

    it('readOnly=false のとき削除ボタン (×) が表示される', () => {
      // TODO
    });
  });

  describe('クリック動作', () => {
    it('チップ本体をクリックすると onClick が tag.name を引数に呼ばれる', () => {
      // TODO
    });

    it('削除ボタンをクリックすると onDelete が tag.id を引数に呼ばれ、onClick は呼ばれない (stopPropagation)', () => {
      // TODO
    });
  });
});
