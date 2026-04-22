/**
 * テスト対象: channelNotificationService（ユニットレベル）
 * 戦略: pushService との連携ロジックを Jest モックで検証する。
 *       通知レベルに応じた pushService.sendPushToUser の発火/非発火を確認する。
 */

describe('pushService と通知レベルの連携', () => {
  describe('sendPushToUser の呼び出し制御', () => {
    it('通知レベルが "all" の場合は sendPushToUser が呼ばれる', () => {
      // TODO
    });

    it('通知レベルが "muted" の場合は sendPushToUser が呼ばれない', () => {
      // TODO
    });

    it('通知レベルが "mentions" かつメンションあり の場合は sendPushToUser が呼ばれる', () => {
      // TODO
    });

    it('通知レベルが "mentions" かつメンションなし の場合は sendPushToUser が呼ばれない', () => {
      // TODO
    });

    it('レコードが存在しない（未設定）ユーザーは "all" として扱われ sendPushToUser が呼ばれる', () => {
      // TODO
    });
  });

  describe('mention_updated イベントの発火制御', () => {
    it('通知レベルが "muted" のチャンネルでは mention_updated イベントをクライアントに送らない', () => {
      // TODO
    });

    it('通知レベルが "mentions" のチャンネルでは mention_updated イベントを送る', () => {
      // TODO
    });
  });
});
