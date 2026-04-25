/**
 * テスト対象: components/Chat/EventCard.tsx（会話イベント投稿 #108）
 * 戦略:
 *   - api.events は vi.mock で差し替え、RSVP API 呼び出しを検証する
 *   - Socket.IO は SocketContext をモックして event:rsvp_updated を擬似発火する
 *   - 集計表示・RSVP ボタン操作・リアルタイム更新を中心に検証する
 */

import { describe, it } from 'vitest';

describe('EventCard - 会話イベント投稿 (#108)', () => {
  describe('表示', () => {
    it('イベントタイトル・開始日時・説明文が表示される', () => {
      // TODO: アサーション
    });

    it('ends_at が設定されている場合は終了日時も表示される', () => {
      // TODO: アサーション
    });

    it('ends_at が null の場合は終了日時を表示しない', () => {
      // TODO: アサーション
    });

    it('description が null の場合は説明エリアを表示しない', () => {
      // TODO: アサーション
    });

    it('rsvpCounts に基づき "参加 N 名 / 不参加 N 名 / 未定 N 名" の集計が表示される', () => {
      // TODO: アサーション
    });

    it('myRsvp が "going" のとき「参加する」ボタンが選択状態になる', () => {
      // TODO: アサーション
    });

    it('myRsvp が "not_going" のとき「不参加」ボタンが選択状態になる', () => {
      // TODO: アサーション
    });

    it('myRsvp が "maybe" のとき「未定」ボタンが選択状態になる', () => {
      // TODO: アサーション
    });

    it('myRsvp が null のときどのボタンも選択状態にならない', () => {
      // TODO: アサーション
    });
  });

  describe('RSVP 操作', () => {
    it('「参加する」ボタンをクリックすると api.events.setRsvp が status="going" で呼ばれる', () => {
      // TODO: アサーション
    });

    it('「不参加」ボタンをクリックすると api.events.setRsvp が status="not_going" で呼ばれる', () => {
      // TODO: アサーション
    });

    it('「未定」ボタンをクリックすると api.events.setRsvp が status="maybe" で呼ばれる', () => {
      // TODO: アサーション
    });

    it('RSVP 更新成功後にローカル集計とボタン選択状態が反映される', () => {
      // TODO: アサーション
    });

    it('RSVP 更新失敗時はスナックバーでエラー通知され、ボタン状態はロールバックされる', () => {
      // TODO: アサーション
    });
  });

  describe('Socket リアルタイム更新', () => {
    it('event:rsvp_updated を受信すると rsvpCounts が再描画される', () => {
      // TODO: アサーション
    });

    it('別イベントの event:rsvp_updated は無視される', () => {
      // TODO: アサーション
    });
  });

  describe('参加者一覧表示', () => {
    it('集計をクリックすると参加者一覧パネル（going/not_going/maybe）が開く', () => {
      // TODO: アサーション
    });

    it('参加者一覧には各ユーザーの表示名とアバターが並ぶ', () => {
      // TODO: アサーション
    });
  });

  describe('作成者向け操作', () => {
    it('作成者のときのみ編集・削除メニューが表示される', () => {
      // TODO: アサーション
    });

    it('作成者以外のときは編集・削除メニューが表示されない', () => {
      // TODO: アサーション
    });
  });
});
