/**
 * components/Chat/UserProfilePopover.tsx のユニットテスト
 *
 * テスト対象: アバターホバー時に表示されるプロフィールポップアップ
 *   - 表示名・ID・メールアドレス・勤務地の描画
 *   - avatarUrl がある場合の画像表示
 *   - ホバー離脱時のポップアップ非表示
 */

import { describe, it } from 'vitest';

describe('UserProfilePopover', () => {
  describe('プロフィール情報の表示', () => {
    it('displayName を表示する', () => {
      // TODO: implement
    });

    it('ユーザー ID を "ID: {id}" 形式で表示する', () => {
      // TODO: implement
    });

    it('email を表示する', () => {
      // TODO: implement
    });

    it('location が設定されているとき LocationOnIcon とともに表示する', () => {
      // TODO: implement
    });

    it('location が null のとき勤務地エリアを表示しない', () => {
      // TODO: implement
    });
  });

  describe('アバター画像', () => {
    it('avatarUrl が設定されているとき img タグで表示する', () => {
      // TODO: implement
    });

    it('avatarUrl が null のとき頭文字 Avatar を表示する', () => {
      // TODO: implement
    });
  });

  describe('ポップアップの開閉', () => {
    it('open=true のときポップアップが表示される', () => {
      // TODO: implement
    });

    it('open=false のときポップアップが表示されない', () => {
      // TODO: implement
    });

    it('ポップアップ外にマウスが移動すると onClose が呼ばれる', () => {
      // TODO: implement
    });
  });
});
