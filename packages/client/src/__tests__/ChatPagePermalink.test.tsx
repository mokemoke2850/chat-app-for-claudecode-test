/**
 * テスト対象: ChatPage の ?message= パラメータによるメッセージジャンプ処理
 * 戦略:
 *   - URL に ?channel=X&message=Y が含まれるとき、対象メッセージへのスクロールが発火することを検証する
 *   - ハイライト状態（focusedMessageId 等）が正しく設定されることを検証する
 *   - ジャンプ後に ?message= パラメータが URL から除去されることを検証する
 *   - メッセージが存在しない場合の挙動を検証する
 */

import { describe, it } from 'vitest';

describe('ChatPage パーマリンクジャンプ', () => {
  describe('?message= パラメータの読み取り', () => {
    it('マウント時に ?message=Y があるとき、該当メッセージへのスクロール処理が行われる', () => {
      // TODO
    });

    it('?message= がないときスクロール処理は行われない', () => {
      // TODO
    });

    it('?message=Y で指定されたメッセージが存在しない場合、スクロールは発火しない', () => {
      // TODO
    });
  });

  describe('ハイライト状態', () => {
    it('?message=Y があるとき、MessageList に highlightMessageId=Y が渡される', () => {
      // TODO
    });

    it('一定時間後（またはユーザー操作後）にハイライトが解除される', () => {
      // TODO
    });
  });

  describe('URL クリーンアップ', () => {
    it('ジャンプ後に URL から &message=Y パラメータが除去される', () => {
      // TODO
    });

    it('?channel=X は除去されず残る', () => {
      // TODO
    });
  });
});
