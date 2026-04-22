// テスト対象: services/scheduledMessageService.ts の CRUD ロジック単体 (#110)
// 戦略:
//   - pg-mem 上でサービス関数を直接呼び出し、DB 状態を検証する
//   - Express や Socket.IO を介さず、純粋な業務ロジックだけを対象にする
//   - HTTP レベルのバリデーションはルート側のテストに委ねる

describe('scheduledMessageService', () => {
  describe('create', () => {
    it('pending 状態で INSERT され、scheduled_at は UTC で保存される', () => {
      // TODO
    });

    it('過去日時を渡すとエラーが投げられる', () => {
      // TODO
    });

    it('attachmentIds を渡すと message_attachments.scheduled_message_id が更新される', () => {
      // TODO
    });
  });

  describe('list', () => {
    it('指定ユーザーの予約のみ返す', () => {
      // TODO
    });

    it('scheduled_at の昇順で返される', () => {
      // TODO
    });
  });

  describe('update', () => {
    it('pending 状態の予約の content / scheduledAt を更新できる', () => {
      // TODO
    });

    it('所有者以外のユーザーIDで呼ぶと例外になる', () => {
      // TODO
    });

    it('pending 以外のステータスでは更新できない', () => {
      // TODO
    });
  });

  describe('cancel', () => {
    it('status=canceled に更新される', () => {
      // TODO
    });

    it('既に sent のものはキャンセルできない', () => {
      // TODO
    });
  });

  describe('pickDue', () => {
    it('scheduled_at <= NOW() かつ status=pending のみ返す', () => {
      // TODO
    });

    it('アトミックに status=sending に更新してから返す（同時呼び出しで重複しない）', () => {
      // TODO
    });
  });

  describe('markSent', () => {
    it('status=sent と sent_message_id が同時に更新される', () => {
      // TODO
    });
  });

  describe('markFailed', () => {
    it('status=failed と error 文字列が保存される', () => {
      // TODO
    });
  });
});
