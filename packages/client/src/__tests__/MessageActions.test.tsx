/**
 * components/Chat/MessageActions.tsx のユニットテスト
 *
 * テスト対象: メッセージに対するアクションボタン群
 *   - 引用返信・返信・リアクション・ピン留め・ブックマーク・リマインダー・リンクコピー
 *   - 自分のメッセージのみ表示する編集・削除ボタン
 */

import { describe, it } from 'vitest';

describe('MessageActions', () => {
  describe('共通アクションボタンの表示', () => {
    it('引用返信ボタンが表示される', () => {
      // TODO: implement
    });

    it('返信（スレッド）ボタンが表示される', () => {
      // TODO: implement
    });

    it('リアクション追加ボタンが表示される', () => {
      // TODO: implement
    });

    it('ピン留めボタンが表示される', () => {
      // TODO: implement
    });

    it('ブックマークボタンが表示される', () => {
      // TODO: implement
    });

    it('リマインダー設定ボタンが表示される', () => {
      // TODO: implement
    });

    it('リンクをコピーボタンが表示される', () => {
      // TODO: implement
    });
  });

  describe('自分のメッセージのアクション', () => {
    it('isOwn=true のとき Edit ボタンが表示される', () => {
      // TODO: implement
    });

    it('isOwn=true のとき Delete ボタンが表示される', () => {
      // TODO: implement
    });

    it('isOwn=false のとき Edit ボタンが表示されない', () => {
      // TODO: implement
    });

    it('isOwn=false のとき Delete ボタンが表示されない', () => {
      // TODO: implement
    });
  });

  describe('引用返信', () => {
    it('引用返信ボタンをクリックすると onQuoteReply が message を引数に呼ばれる', () => {
      // TODO: implement
    });
  });

  describe('スレッド返信', () => {
    it('返信ボタンをクリックすると onOpenThread が message.id を引数に呼ばれる', () => {
      // TODO: implement
    });
  });

  describe('ピン留め', () => {
    it('isPinned=false のとき「ピン留め」ラベルのボタンを表示する', () => {
      // TODO: implement
    });

    it('isPinned=true のとき「ピン留めを解除」ラベルのボタンを表示し primary カラーで強調する', () => {
      // TODO: implement
    });

    it('ピン留めボタンをクリックすると onPinMessage が message.id を引数に呼ばれる', () => {
      // TODO: implement
    });
  });

  describe('ブックマーク', () => {
    it('isBookmarked=false のとき BookmarkBorderIcon を表示する', () => {
      // TODO: implement
    });

    it('isBookmarked=true のとき BookmarkIcon を表示し primary カラーで強調する', () => {
      // TODO: implement
    });

    it('ブックマークボタンをクリックすると api.bookmarks.add が呼ばれ状態が更新される', () => {
      // TODO: implement
    });

    it('ブックマーク解除ボタンをクリックすると api.bookmarks.remove が呼ばれ状態が更新される', () => {
      // TODO: implement
    });

    it('ブックマーク API が失敗したとき状態を変更しない', () => {
      // TODO: implement
    });

    it('ブックマーク変更後に onBookmarkChange コールバックが呼ばれる', () => {
      // TODO: implement
    });
  });

  describe('リマインダー', () => {
    it('リマインダー設定ボタンをクリックすると ReminderDialog が開く', () => {
      // TODO: implement
    });
  });

  describe('リンクコピー', () => {
    it('リンクコピーボタンをクリックすると navigator.clipboard.writeText が #message-{id} と ?channel={channelId} を含む URL で呼ばれる', () => {
      // TODO: implement
    });
  });

  describe('編集', () => {
    it('Edit ボタンをクリックすると onEdit コールバックが呼ばれる', () => {
      // TODO: implement
    });
  });

  describe('削除', () => {
    it('Delete ボタンをクリックすると socket.emit("delete_message") が呼ばれる', () => {
      // TODO: implement
    });
  });

  describe('リアクション', () => {
    it('リアクション追加ボタンをクリックすると EmojiPicker が表示される', () => {
      // TODO: implement
    });
  });
});
