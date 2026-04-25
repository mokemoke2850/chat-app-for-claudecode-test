/**
 * テスト対象: hooks/useTagSuggestions.ts (タグ候補取得フック)
 * 戦略:
 *   - api.tags.suggestions をモックし、prefix 変更時の再フェッチ・デバウンス・キャッシュ挙動を検証する。
 *   - React 19 の use() + Suspense 構成を想定するため、render は Suspense でラップする。
 */

describe('useTagSuggestions', () => {
  describe('初期取得', () => {
    it('マウント時に prefix なしで api.tags.suggestions が呼ばれる', () => {
      // TODO
    });

    it('取得した候補配列が data として返る', () => {
      // TODO
    });
  });

  describe('prefix の変更', () => {
    it('prefix を変更すると新しい prefix で再フェッチされる', () => {
      // TODO
    });

    it('短時間に連続で prefix が変わってもデバウンスにより最後の値だけリクエストされる', () => {
      // TODO
    });

    it('同じ prefix への再要求はキャッシュから返り API は呼ばれない', () => {
      // TODO
    });
  });

  describe('エラー処理', () => {
    it('API がエラーを投げた場合、空配列にフォールバックして UI を壊さない', () => {
      // TODO
    });
  });
});
