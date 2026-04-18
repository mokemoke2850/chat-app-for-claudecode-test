/**
 * テスト対象: DMPage 内の DmConversationList コンポーネント（DMPageContent から分割予定）
 * 責務: DM会話一覧のサイドバー表示・会話選択・新規DM起動ボタン
 */

import { describe, it } from 'vitest';

describe('DmConversationList', () => {
  describe('会話一覧表示', () => {
    it('会話一覧が正しく表示される', () => {
      // TODO: implement
    });

    it('会話が存在しない場合は「DM会話がありません」と表示される', () => {
      // TODO: implement
    });

    it('会話相手の displayName がある場合は displayName が表示される', () => {
      // TODO: implement
    });

    it('lastMessage がある場合はメッセージプレビューが表示される', () => {
      // TODO: implement
    });

    it('lastMessage がある場合は日時が表示される', () => {
      // TODO: implement
    });

    it('lastMessage がない場合は日時プレビューが表示されない', () => {
      // TODO: implement
    });
  });

  describe('未読バッジ', () => {
    it('unreadCount > 0 の会話に未読数バッジが表示される', () => {
      // TODO: implement
    });

    it('unreadCount === 0 の会話にバッジは表示されない', () => {
      // TODO: implement
    });

    it('unreadCount > 0 の会話では相手名が太字で表示される', () => {
      // TODO: implement
    });
  });

  describe('会話選択', () => {
    it('会話をクリックすると onSelectConversation がその会話IDで呼ばれる', () => {
      // TODO: implement
    });

    it('選択中の会話が selected 状態になる', () => {
      // TODO: implement
    });
  });

  describe('新規DM起動', () => {
    it('「新規DM」ボタンが表示される', () => {
      // TODO: implement
    });

    it('「新規DM」ボタンをクリックすると onNewDm が呼ばれる', () => {
      // TODO: implement
    });
  });

  describe('Socket.IO リアルタイム更新', () => {
    it('new_dm_message イベント受信時に非アクティブ会話の unreadCount がインクリメントされる', () => {
      // TODO: implement
    });

    it('new_dm_message イベント受信時に会話一覧の lastMessage が更新される', () => {
      // TODO: implement
    });

    it('アクティブ会話への new_dm_message では unreadCount がインクリメントされない', () => {
      // TODO: implement
    });
  });
});
