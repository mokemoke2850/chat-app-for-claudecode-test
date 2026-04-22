// テスト対象: jobs/scheduledMessageWorker.ts の 1 tick フロー (#110)
// 戦略:
//   - setInterval による実運用ループは起動せず、runOnce() のような
//     単一 tick 相当の関数を直接呼び出してフローを検証する
//   - messageService.sendMessage を spy / mock で差し替え、
//     入力 (pickDue の結果) と出力 (markSent / markFailed 呼び出し) を確認する
//   - Socket.IO はモックで emit の引数を検証する

describe('scheduledMessageWorker', () => {
  describe('runOnce (1 tick 相当)', () => {
    it('pickDue で得た各予約について messageService.sendMessage が channelId, userId, content 付きで呼ばれる', () => {
      // TODO
    });

    it('sendMessage 成功後に markSent(id, messageId) が呼ばれる', () => {
      // TODO
    });

    it('sendMessage が throw した場合に markFailed(id, errorMessage) が呼ばれる', () => {
      // TODO
    });

    it('1件が失敗しても他の予約の処理は続行される（ループ内で try/catch）', () => {
      // TODO
    });

    it('送信成功した予約はチャンネル購読者へ message:new が emit される', () => {
      // TODO
    });

    it('送信失敗した予約は予約者に failure 通知が飛ぶ', () => {
      // TODO
    });

    it('pickDue が空配列を返した場合は sendMessage を呼ばない', () => {
      // TODO
    });
  });
});
