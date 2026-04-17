/**
 * SearchFilterPanel コンポーネントのユニットテスト
 *
 * テスト対象: 検索フィルタパネル（日付範囲・ユーザー絞り込み・添付ファイルフィルタ）
 * 戦略:
 *   - フィルタ値の変更時に onFilterChange コールバックが正しい値で呼ばれることを検証する
 *   - APIモックは vi.mock('../api/client') で差し替える
 *   - 「画面を見ればわかる」UI状態の確認は省略し、ロジック・コールバックを中心にテストする
 */

import { describe, it } from 'vitest';

describe('SearchFilterPanel', () => {
  describe('日付範囲入力', () => {
    it('開始日を入力すると onFilterChange に dateFrom が渡される', () => {
      // TODO
    });

    it('終了日を入力すると onFilterChange に dateTo が渡される', () => {
      // TODO
    });

    it('開始日 > 終了日のときバリデーションエラーメッセージが表示される', () => {
      // TODO
    });

    it('日付をクリアすると onFilterChange の dateFrom/dateTo が undefined になる', () => {
      // TODO
    });
  });

  describe('ユーザー絞り込み', () => {
    it('ユーザーを選択すると onFilterChange に userId が渡される', () => {
      // TODO
    });

    it('選択をクリアすると onFilterChange の userId が undefined になる', () => {
      // TODO
    });
  });

  describe('添付ファイルフィルタ', () => {
    it('「添付ファイルあり」を選択すると onFilterChange に hasAttachment=true が渡される', () => {
      // TODO
    });

    it('「添付ファイルなし」を選択すると onFilterChange に hasAttachment=false が渡される', () => {
      // TODO
    });

    it('「すべて」を選択すると onFilterChange の hasAttachment が undefined になる', () => {
      // TODO
    });
  });

  describe('フィルタリセット', () => {
    it('リセットボタンを押すとすべてのフィルタ値がクリアされ onFilterChange が空オブジェクトで呼ばれる', () => {
      // TODO
    });
  });
});
