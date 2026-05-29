/**
 * カーソルページング共通ヘルパー buildCursorPage のユニットテスト
 *
 * テスト対象: src/utils/pagination.ts
 * 戦略:
 *   - DM / ゲスト / スレッド返信 / チャンネルメッセージのカーソル封筒化（#375 / #386）で共用するヘルパー。
 *   - 時系列昇順かつ limit+1 件取得済みの配列を入力に、hasMore / nextCursor / items を導出する純粋関数を検証する。
 *   - DB 不要のためサービス・HTTP を介さず直接呼び出す。
 */

import { buildCursorPage } from '../../utils/pagination';

// id 昇順の行を作るヘルパー（時系列昇順＝oldest first を模す）
const rows = (ids: number[]) => ids.map((id) => ({ id }));

describe('buildCursorPage（#386 カーソル封筒の共通導出）', () => {
  it('limit+1 件のとき hasMore=true・余剰（最古1件）を除いた最新 limit 件を items にする', () => {
    // 昇順 [10,11,12]、limit=2 → 余剰は先頭(最古)10、items=[11,12]
    const page = buildCursorPage(rows([10, 11, 12]), 2);
    expect(page.hasMore).toBe(true);
    expect(page.items.map((r) => r.id)).toEqual([11, 12]);
  });

  it('hasMore=true のとき nextCursor は items 先頭（最古）の id 文字列になる', () => {
    const page = buildCursorPage(rows([10, 11, 12]), 2);
    expect(page.nextCursor).toBe('11');
  });

  it('limit 以下のとき hasMore=false・nextCursor=null で全件を items にする', () => {
    const page = buildCursorPage(rows([10, 11]), 2);
    expect(page.hasMore).toBe(false);
    expect(page.nextCursor).toBeNull();
    expect(page.items.map((r) => r.id)).toEqual([10, 11]);
  });

  it('空配列のとき items=[]・hasMore=false・nextCursor=null を返す', () => {
    const page = buildCursorPage(rows([]), 2);
    expect(page.items).toEqual([]);
    expect(page.hasMore).toBe(false);
    expect(page.nextCursor).toBeNull();
  });
});
