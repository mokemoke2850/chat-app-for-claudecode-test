/**
 * テスト対象: MessageActions のパーマリンクコピー機能
 * 戦略:
 *   - 「リンクをコピー」クリック時に `/chat?channel={id}&message={mid}` 形式の URL が
 *     クリップボードに書き込まれることを検証する
 *   - コピー後に「リンクをコピーしました」スナックバーが表示されることを検証する
 *   - URL 形式の変更（ハッシュ形式 → クエリ形式）を確認する
 */

import { describe, it } from 'vitest';

describe('MessageActions パーマリンクコピー', () => {
  describe('URL 形式', () => {
    it('「リンクをコピー」クリックで ?channel={channelId}&message={messageId} 形式の URL がクリップボードに書き込まれる', () => {
      // TODO
    });

    it('URL に #message- ハッシュフラグメントは含まれない（クエリパラメータのみ）', () => {
      // TODO
    });

    it('origin（http://localhost）が URL に含まれる', () => {
      // TODO
    });

    it('/chat パスが URL に含まれる', () => {
      // TODO
    });
  });

  describe('スナックバー通知', () => {
    it('「リンクをコピー」クリック後に showSuccess が「リンクをコピーしました」で呼ばれる', () => {
      // TODO
    });

    it('クリップボード API が失敗したとき showSuccess は呼ばれない', () => {
      // TODO
    });
  });

  describe('メニューの閉じ動作', () => {
    it('「リンクをコピー」クリック後にメニューが閉じる', () => {
      // TODO
    });
  });
});
