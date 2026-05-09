/**
 * テスト対象: AdminPage の期間フィルタ UI（Issue #272）
 * 戦略: vi.mock('../api/client') でAPIをモック化し、
 *   - 期間トグル（24h / 7d / 30d / カスタム）の切替動作
 *   - URL パラメータ（?period=7d / ?from=...&to=...）との同期
 *   - カスタム期間の日付入力 UI
 *   - 期間変更時に集計 API が from/to パラメータ付きで再呼び出しされること
 * を検証する。
 */

import { describe, it } from 'vitest';

describe('AdminPage: 期間フィルタ UI', () => {
  describe('トグルの表示', () => {
    it.todo('統計タブに「24h / 7d / 30d / カスタム」の期間切替トグルが表示される');
    it.todo('初期表示では「7d」がデフォルト選択状態になっている');
  });

  describe('期間切替動作', () => {
    it.todo('「24h」を選択すると period=24h で statsPromise が再生成される');
    it.todo('「7d」を選択すると period=7d で statsPromise が再生成される');
    it.todo('「30d」を選択すると period=30d で statsPromise が再生成される');
    it.todo('「カスタム」を選択するとカスタム日付入力フォームが表示される');
  });

  describe('カスタム日付入力', () => {
    it.todo('「カスタム」選択時に date-from と date-to の入力欄が表示される');
    it.todo(
      'date-from / date-to を入力して確定すると from/to パラメータ付きで getStats が呼ばれる',
    );
    it.todo('date-from が date-to より後の日付の場合はバリデーションエラーが表示される');
    it.todo('date-from のみ入力した状態では確定ボタンが無効になる');
  });

  describe('URL パラメータとの同期', () => {
    it.todo('?period=7d で初期表示すると「7d」が選択済み状態になる');
    it.todo('?period=30d で初期表示すると「30d」が選択済み状態になる');
    it.todo('?period=24h で初期表示すると「24h」が選択済み状態になる');
    it.todo(
      '?from=2024-01-01&to=2024-01-31 で初期表示するとカスタムが選択済み・日付入力に値が反映される',
    );
    it.todo('期間トグルを切り替えると URL クエリパラメータが更新される');
    it.todo('カスタム日付を確定すると URL が ?from=...&to=... に更新される');
  });

  describe('API 呼び出し', () => {
    it.todo('期間を切り替えると getStats が新しい期間で再度呼ばれる');
    it.todo('24h 選択時は getStats に from=<24時間前> / to=<現在> が渡される');
    it.todo('カスタム期間確定時は getStats に入力した from / to が渡される');
    it.todo('期間切替後に統計カードの数値が更新される（再フェッチ結果が反映される）');
  });
});
