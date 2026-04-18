import { describe, it } from 'vitest';

describe('messageHandler', () => {
  describe('send_message', () => {
    it('正常なデータを受け取ったとき、メッセージが作成されbroadcastされること', () => {
      // TODO: implement
    });

    it('メンション対象ユーザーが含まれるとき、プッシュ通知が送信されること', () => {
      // TODO: implement
    });

    it('メンション対象ユーザーが含まれるとき、mention_updatedイベントがemitされること', () => {
      // TODO: implement
    });

    it('送信者自身へのメンションは通知しないこと', () => {
      // TODO: implement
    });

    it('添付ファイルIDやquotedMessageIdが指定されたとき、messageService.createMessageに渡されること', () => {
      // TODO: implement
    });

    it('messageService.createMessageが失敗したとき、socket.emit("error", ...)が呼ばれること', () => {
      // TODO: implement
    });
  });

  describe('edit_message', () => {
    it('正常なデータを受け取ったとき、メッセージが更新されchannel全体にbroadcastされること', () => {
      // TODO: implement
    });

    it('messageService.editMessageが失敗したとき、socket.emit("error", ...)が呼ばれること', () => {
      // TODO: implement
    });
  });

  describe('delete_message', () => {
    it('存在するメッセージIDを受け取ったとき、削除されchannel全体にbroadcastされること', () => {
      // TODO: implement
    });

    it('存在しないメッセージIDを受け取ったとき、何もしないこと', () => {
      // TODO: implement
    });

    it('messageService.deleteMessageが失敗したとき、socket.emit("error", ...)が呼ばれること', () => {
      // TODO: implement
    });
  });

  describe('restore_message', () => {
    it('正常なデータを受け取ったとき、メッセージが復元されchannel全体にbroadcastされること', () => {
      // TODO: implement
    });

    it('messageService.restoreMessageが失敗したとき、socket.emit("error", ...)が呼ばれること', () => {
      // TODO: implement
    });
  });

  describe('add_reaction', () => {
    it('正常なデータを受け取ったとき、リアクションが追加されreaction_updatedがbroadcastされること', () => {
      // TODO: implement
    });

    it('存在しないメッセージIDを受け取ったとき、何もしないこと', () => {
      // TODO: implement
    });

    it('messageService.addReactionが失敗したとき、socket.emit("error", ...)が呼ばれること', () => {
      // TODO: implement
    });
  });

  describe('remove_reaction', () => {
    it('正常なデータを受け取ったとき、リアクションが削除されreaction_updatedがbroadcastされること', () => {
      // TODO: implement
    });

    it('存在しないメッセージIDを受け取ったとき、何もしないこと', () => {
      // TODO: implement
    });

    it('messageService.removeReactionが失敗したとき、socket.emit("error", ...)が呼ばれること', () => {
      // TODO: implement
    });
  });

  describe('send_thread_reply', () => {
    it('正常なデータを受け取ったとき、スレッド返信が作成されnew_thread_replyがbroadcastされること', () => {
      // TODO: implement
    });

    it('replyCountが正しく計算されnew_thread_replyに含まれること', () => {
      // TODO: implement
    });

    it('messageService.createThreadReplyが失敗したとき、socket.emit("error", ...)が呼ばれること', () => {
      // TODO: implement
    });
  });

  describe('pin_message', () => {
    it('正常なデータを受け取ったとき、メッセージがピン留めされmessage_pinnedがbroadcastされること', () => {
      // TODO: implement
    });

    it('pinMessageService.pinMessageが失敗したとき、socket.emit("error", ...)が呼ばれること', () => {
      // TODO: implement
    });
  });

  describe('unpin_message', () => {
    it('正常なデータを受け取ったとき、ピン留めが解除されmessage_unpinnedがbroadcastされること', () => {
      // TODO: implement
    });

    it('pinMessageService.unpinMessageが失敗したとき、socket.emit("error", ...)が呼ばれること', () => {
      // TODO: implement
    });
  });
});
