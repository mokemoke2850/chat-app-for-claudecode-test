/**
 * テスト対象: DMPage 内の NewDmDialog コンポーネント
 * 責務: 新規DM開始時のユーザー選択ダイアログ
 */

import { describe, it } from 'vitest';

describe('NewDmDialog', () => {
  describe('ダイアログ表示', () => {
    it('open=true のとき「新規ダイレクトメッセージ」ダイアログが表示される', () => {
      // TODO: implement
    });

    it('open=false のときダイアログが表示されない', () => {
      // TODO: implement
    });
  });

  describe('ユーザー一覧表示', () => {
    it('現在のユーザー以外のユーザー一覧が表示される', () => {
      // TODO: implement
    });

    it('現在のユーザー自身は一覧に表示されない', () => {
      // TODO: implement
    });

    it('ユーザーの displayName がある場合は displayName が表示される', () => {
      // TODO: implement
    });

    it('displayName がない場合は username が表示される', () => {
      // TODO: implement
    });

    it('他のユーザーが存在しない場合は「他のユーザーがいません」と表示される', () => {
      // TODO: implement
    });
  });

  describe('ユーザー選択', () => {
    it('ユーザーをクリックすると onSelect がそのユーザーIDで呼ばれる', () => {
      // TODO: implement
    });

    it('ユーザーをクリックすると onClose が呼ばれてダイアログが閉じる', () => {
      // TODO: implement
    });
  });

  describe('ダイアログクローズ', () => {
    it('ダイアログの外側をクリックすると onClose が呼ばれる', () => {
      // TODO: implement
    });
  });
});
