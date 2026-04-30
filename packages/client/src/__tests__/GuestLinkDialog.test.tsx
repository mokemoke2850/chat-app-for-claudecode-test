/**
 * テスト対象: components/Channel/GuestLinkDialog.tsx — 管理者向けゲストリンク発行 / 失効ダイアログ（#149）
 * 戦略:
 *   - api.guestLinks の各メソッドを vi.mock で差し替え、リンク発行・一覧表示・コピー・失効 UI を検証する
 *   - 既存 InviteLinkDialog と並列で表示されることを意図しており、見た目・操作系統は揃える
 *   - パスワード入力・有効期限選択・hasPassword 表示・失効ボタンの表示制御を中心に検証する
 */

import { describe, it, vi } from 'vitest';

vi.mock('../api/client', () => ({
  api: {
    guestLinks: {
      create: vi.fn(),
      list: vi.fn(),
      revoke: vi.fn(),
    },
  },
}));

vi.mock('../contexts/AuthContext', () => ({
  useAuth: vi.fn(),
}));

describe('GuestLinkDialog', () => {
  describe('リンク発行', () => {
    it('「ゲストリンクを発行」ボタンをクリックすると api.guestLinks.create が呼ばれる', async () => {
      // TODO
    });

    it('発行されたリンクが /g/:token 形式の URL でダイアログ内に表示される', async () => {
      // TODO
    });

    it('有効期限（無期限 / 1時間 / 24時間 / 7日 / 30日）を選択して発行できる', async () => {
      // TODO
    });

    it('パスワードを入力して発行できる', async () => {
      // TODO
    });

    it('パスワード未入力でも発行できる（任意項目）', async () => {
      // TODO
    });

    it('発行 API が password_hash 平文を返さないことを前提として UI でも表示しない', async () => {
      // TODO
    });
  });

  describe('クリップボードコピー', () => {
    it('「コピー」ボタンをクリックすると /g/:token URL がクリップボードに書き込まれる', async () => {
      // TODO
    });

    it('コピー成功時にスナックバー（または同等の通知）が表示される', async () => {
      // TODO
    });
  });

  describe('一覧表示', () => {
    it('既存のゲストリンク一覧が表示される', async () => {
      // TODO
    });

    it('有効期限付きリンクに期限が表示される', async () => {
      // TODO
    });

    it('期限切れリンクに「期限切れ」が表示される', async () => {
      // TODO
    });

    it('失効済みリンクに「無効」が表示される', async () => {
      // TODO
    });

    it('パスワード付きリンクに鍵アイコンまたは「パスワード保護中」が表示される', async () => {
      // TODO
    });
  });

  describe('失効ボタンの表示制御', () => {
    it('作成者には「失効」ボタンが表示される', async () => {
      // TODO
    });

    it('admin ロールのユーザーには他ユーザーのリンクにも「失効」ボタンが表示される', async () => {
      // TODO
    });

    it('作成者でも admin でもないユーザーには「失効」ボタンが表示されない', async () => {
      // TODO
    });
  });

  describe('失効操作', () => {
    it('「失効」ボタンをクリックすると api.guestLinks.revoke が呼ばれる', async () => {
      // TODO
    });

    it('失効後にリンクの状態が「無効」に更新される', async () => {
      // TODO
    });

    it('失効ボタンに確認ダイアログが表示される（誤操作防止）', async () => {
      // TODO
    });
  });

  describe('チャンネル管理メニューからの導線', () => {
    it('ChatPage の管理メニューに「ゲスト閲覧リンクを発行」項目が存在し、クリックでこのダイアログが開く', async () => {
      // TODO
    });

    it('既存 InviteLinkDialog の項目とは別に並んでおり混同されない', async () => {
      // TODO
    });
  });
});
