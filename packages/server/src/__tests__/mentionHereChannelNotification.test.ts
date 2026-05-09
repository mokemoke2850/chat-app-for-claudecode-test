/**
 * テスト対象: @here / @channel メンション展開ロジック（サーバ通知）
 * 戦略: messageHandler の send_message ハンドラで @here / @channel が渡された場合に
 *       展開ロジックがオンラインユーザー / チャンネルメンバー全員に通知を送ることを検証する。
 *       channelNotificationService の muted 設定を持つユーザーは通知が届かないことも確認する。
 */

import { describe, it } from '@jest/globals';

describe('@here / @channel 通知展開ロジック', () => {
  describe('@here 展開（オンラインユーザーへの通知）', () => {
    it.todo(
      'send_message で mentionType: "here" を受け取るとオンライン中のチャンネルメンバー全員に mention_updated を emit する',
    );
    it.todo('送信者自身は @here 展開の通知対象から除外される');
    it.todo('チャンネル通知レベルが "muted" のユーザーは @here 展開の通知対象から除外される');
    it.todo('@here のとき OFFLINE ユーザーは通知対象に含まれない');
  });

  describe('@channel 展開（チャンネル全員への通知）', () => {
    it.todo(
      'send_message で mentionType: "channel" を受け取るとチャンネルメンバー全員に mention_updated を emit する',
    );
    it.todo('送信者自身は @channel 展開の通知対象から除外される');
    it.todo('チャンネル通知レベルが "muted" のユーザーは @channel 展開の通知対象から除外される');
    it.todo('@channel のとき OFFLINE ユーザーも通知対象に含まれる（@here との差異）');
  });

  describe('通知レベルによる除外ロジック', () => {
    it.todo('通知レベル "all" のユーザーは @here / @channel の両方で通知を受け取る');
    it.todo('通知レベル "mentions" のユーザーは @here / @channel の両方で通知を受け取る');
    it.todo('通知レベル "muted" のユーザーは @here / @channel いずれも通知を受け取らない');
  });

  describe('通常メンションとの共存', () => {
    it.todo('@here と個別ユーザーメンションが同時に含まれるとき両方の通知が正しく送信される');
    it.todo('@channel と個別ユーザーメンションが重複する場合でも通知は1回だけ送信される');
  });
});
