import { describe, it } from 'vitest';

describe('channelHandler', () => {
  describe('接続時の自動join', () => {
    it('接続時にユーザーがアクセス可能な全チャンネルへ自動joinすること', () => {
      // TODO: implement
    });

    it('channelService.getChannelsForUserが失敗してもエラーを無視して接続が継続すること', () => {
      // TODO: implement
    });

    it('接続時にuser:${userId}ルームへjoinすること', () => {
      // TODO: implement
    });
  });

  describe('join_channel', () => {
    it('channelIdを受け取ったとき、channel:${channelId}ルームにjoinすること', () => {
      // TODO: implement
    });
  });

  describe('leave_channel', () => {
    it('channelIdを受け取ったとき、channel:${channelId}ルームからleaveすること', () => {
      // TODO: implement
    });
  });

  describe('typing_start', () => {
    it('channelIdを受け取ったとき、そのチャンネルの他のユーザーにuser_typingイベントがemitされること', () => {
      // TODO: implement
    });

    it('user_typingイベントにuserId, username, channelIdが含まれること', () => {
      // TODO: implement
    });
  });

  describe('typing_stop', () => {
    it('channelIdを受け取ったとき、そのチャンネルの他のユーザーにuser_stopped_typingイベントがemitされること', () => {
      // TODO: implement
    });

    it('user_stopped_typingイベントにuserId, channelIdが含まれること', () => {
      // TODO: implement
    });
  });
});
