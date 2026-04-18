/**
 * テスト対象: ChannelList 内の DmNavigationItems コンポーネント（分割予定）
 * 責務: DM・ブックマーク・管理画面へのナビゲーション項目の表示と未読バッジ管理
 */

import { describe, it } from 'vitest';

describe('DmNavigationItems', () => {
  describe('ナビゲーション表示', () => {
    it('「ダイレクトメッセージ」リンクが表示される', () => {
      // TODO: implement
    });

    it('「ブックマーク」リンクが表示される', () => {
      // TODO: implement
    });

    it('role=admin のユーザーには「管理画面」リンクが表示される', () => {
      // TODO: implement
    });

    it('role=user のユーザーには「管理画面」リンクが表示されない', () => {
      // TODO: implement
    });
  });

  describe('DM未読バッジ', () => {
    it('dmUnreadCount > 0 のときDMアイコンに未読数バッジが表示される', () => {
      // TODO: implement
    });

    it('dmUnreadCount === 0 のときDMアイコンにバッジは表示されない', () => {
      // TODO: implement
    });

    it('「ダイレクトメッセージ」をクリックすると /dm へ遷移する', () => {
      // TODO: implement
    });

    it('「ダイレクトメッセージ」をクリックすると dmUnreadCount が 0 にリセットされる', () => {
      // TODO: implement
    });
  });

  describe('Socket.IO dm_notification 受信', () => {
    it('/dm ページ以外にいるときに dm_notification を受信すると dmUnreadCount がインクリメントされる', () => {
      // TODO: implement
    });

    it('/dm ページにいるときに dm_notification を受信しても dmUnreadCount は変化しない', () => {
      // TODO: implement
    });
  });

  describe('ナビゲーション', () => {
    it('「ブックマーク」をクリックすると /bookmarks へ遷移する', () => {
      // TODO: implement
    });

    it('「管理画面」をクリックすると /admin へ遷移する', () => {
      // TODO: implement
    });
  });
});
