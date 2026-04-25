// テスト対象: hooks/useScheduledMessages.ts (#110)
// 戦略:
//   - React 19 の use() + Suspense パターンでの fetch Promise 生成ロジックを検証
//   - Promise は useState/useMemo で安定化させており、再レンダーで再生成されないことを確認
//   - list / create / update / cancel のラッパ関数を経由してキャッシュが更新されることを確認

describe('useScheduledMessages', () => {
  describe('初回フェッチ', () => {
    it('マウント時に api.scheduledMessages.list が1回だけ呼ばれる', () => {
      // TODO
    });

    it('同じコンポーネントが再レンダーされても list は追加で呼ばれない（Promise が安定している）', () => {
      // TODO
    });
  });

  describe('作成', () => {
    it('create() を呼ぶと api.scheduledMessages.create が呼ばれ、キャッシュが再取得される', () => {
      // TODO
    });
  });

  describe('更新', () => {
    it('update(id, patch) を呼ぶと api.scheduledMessages.update が呼ばれ、キャッシュが更新される', () => {
      // TODO
    });
  });

  describe('キャンセル', () => {
    it('cancel(id) を呼ぶと api.scheduledMessages.cancel が呼ばれ、該当要素のステータスが canceled になる', () => {
      // TODO
    });
  });

  describe('リフレッシュ', () => {
    it('refresh() で list を再実行する（Socket で別タブから更新があったとき用）', () => {
      // TODO
    });
  });
});
