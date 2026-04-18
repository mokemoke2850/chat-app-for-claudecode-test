import { describe, it } from 'vitest';

describe('dmHandler', () => {
  describe('send_dm', () => {
    it('正常なデータを受け取ったとき、DMが送信され送信者にnew_dm_messageがemitされること', () => {
      // TODO: implement
    });

    it('受信者（相手ユーザー）にもnew_dm_messageがemitされること', () => {
      // TODO: implement
    });

    it('受信者に未読件数を含むdm_notificationがemitされること', () => {
      // TODO: implement
    });

    it('getOtherUserIdがnullを返した場合、受信者へのemitは行われないこと', () => {
      // TODO: implement
    });

    it('dmService.sendMessageが失敗したとき、socket.emit("error", ...)が呼ばれること', () => {
      // TODO: implement
    });
  });

  describe('dm_typing_start', () => {
    it('conversationIdを受け取ったとき、相手ユーザーにdm_user_typingイベントがemitされること', () => {
      // TODO: implement
    });

    it('dm_user_typingイベントにconversationId, userId, usernameが含まれること', () => {
      // TODO: implement
    });

    it('getOtherUserIdがnullを返した場合、emitが行われないこと', () => {
      // TODO: implement
    });
  });

  describe('dm_typing_stop', () => {
    it('conversationIdを受け取ったとき、相手ユーザーにdm_user_stopped_typingイベントがemitされること', () => {
      // TODO: implement
    });

    it('dm_user_stopped_typingイベントにconversationId, userIdが含まれること', () => {
      // TODO: implement
    });

    it('getOtherUserIdがnullを返した場合、emitが行われないこと', () => {
      // TODO: implement
    });
  });
});
