/**
 * メンション機能の表示・ラウンドトリップに関するユニットテスト（#250）
 *
 * テスト対象:
 *   - components/Chat/MentionBlot.ts          — Quill embed の生成
 *   - components/Chat/RichEditor.tsx          — メンション挿入時の delta 構築
 *   - utils/renderMessageContent.tsx          — 保存された delta から DOM への描画
 *
 * 戦略:
 *   - メンション挿入から送信までのラウンドトリップ（エディタで挿入→保存→表示）で
 *     チップ直後に余分な「@」が出ないことを保証する
 *   - 画面表示の余分な「@」除去ロジックの単体検証は renderMessageContent.test.tsx 側で網羅する
 *   - ここでは「複数ファイルにまたがる結合動作」のみを扱う
 *
 * 関連 Issue: #250 メンションチップ後に余分な「@」文字が残る
 */

import { describe } from 'vitest';

describe('メンション機能のラウンドトリップ（#250）', () => {
  describe('エディタでメンションを挿入してから送信した場合', () => {
    // RichEditor.insertMention 経由で得られる delta の構造を検証する
    // （quill モックを利用して onSend に渡される content 文字列を組み立てる）
    it.todo(
      'onSend に渡される delta は mention embed の直後に半角スペース 1 文字のみ含む（@ は含まない）',
    );
    it.todo('onSend に渡される delta を表示しても「@username」チップ直後に余分な「@」が出ない');
  });

  describe('連続でメンションを挿入した場合', () => {
    it.todo('@user1 と @user2 を続けて挿入したとき、各チップ直後に余分な「@」が出ない');
  });

  describe('レガシーデータ（既存 DB に保存済みの delta）の表示', () => {
    it.todo(
      'mention embed の直後に「 @ 」テキストが含まれている既存 delta を表示しても余分な @ が出ない',
    );
    it.todo(
      'mention embed の直後に「@」のみが含まれている既存 delta を表示しても余分な @ が出ない',
    );
  });
});
