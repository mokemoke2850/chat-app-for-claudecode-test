/**
 * 管理画面の月次レポート CSV エクスポート UI テスト（Issue #273）
 *
 * テスト対象:
 *   - packages/client/src/pages/AdminPage.tsx に追加する
 *     「月次レポートをダウンロード」ボタンと月選択プルダウン
 *   - packages/client/src/api/client.ts の admin.exportMonthlyReportUrl（仮）
 * 戦略:
 *   - vi.mock('../api/client') で API をモック化
 *   - 月選択プルダウンの選択肢生成（過去12ヶ月）と onChange 動作を検証
 *   - ダウンロードボタンのクリックでブラウザのダウンロードが起動されることを検証
 *     （window.location.href への代入 or <a download> クリック を検出する方式）
 *   - jsdom 環境では実ファイル保存は走らないため、API URL ビルダー呼び出しと
 *     リンク要素のクリック呼び出しがあれば成功とみなす
 */

describe('管理画面の月次レポート CSV エクスポート', () => {
  describe('月選択プルダウン', () => {
    it.todo('管理画面に「月次レポートをダウンロード」セクションが表示される');
    it.todo('月選択プルダウンが表示される');
    it.todo('プルダウンの選択肢として過去12ヶ月が YYYY-MM 形式で並ぶ');
    it.todo('プルダウンの初期値は前月（現在月の1つ前）になっている');
    it.todo('プルダウンを変更すると選択中の月の表示が切り替わる');
  });

  describe('ダウンロードボタン', () => {
    it.todo('「ダウンロード」ボタンが表示される');
    it.todo('ボタンをクリックすると admin.exportMonthlyReportUrl({ month }) が呼び出される');
    it.todo('生成された URL が /api/admin/reports/monthly?month=YYYY-MM 形式である');
    it.todo('ボタンをクリックするとブラウザのファイルダウンロードがトリガーされる');
    it.todo('未選択（プルダウン未選択）状態ではボタンが非活性になる');
  });

  describe('権限制御', () => {
    it.todo(
      '一般ユーザーで管理画面にアクセスした場合、ボタンは表示されない（または管理画面自体が非表示）',
    );
  });

  describe('API クライアント (api.admin.exportMonthlyReportUrl)', () => {
    it.todo('month を渡すと /api/admin/reports/monthly?month=YYYY-MM の URL を返す');
    it.todo(
      'month に不正な値を渡しても例外を投げず URL を返す（バリデーションはサーバー側で行う）',
    );
  });
});
