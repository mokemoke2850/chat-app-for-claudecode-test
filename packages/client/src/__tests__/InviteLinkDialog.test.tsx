/**
 * テスト対象: components/Channel/InviteLinkDialog.tsx
 * 戦略: api.invites の各メソッドを vi.mock で差し替え、
 *       招待リンクの生成・一覧表示・コピー・無効化 UI を検証する。
 *       管理者／作成者のみ「無効化」ボタンが表示されることを確認する。
 */

import { describe, it, vi, beforeEach } from 'vitest';

vi.mock('../api/client', () => ({
  api: {
    invites: {
      create: vi.fn(),
      list: vi.fn(),
      revoke: vi.fn(),
    },
  },
}));

describe('InviteLinkDialog', () => {
  describe('リンク生成', () => {
    it('「リンクを生成」ボタンをクリックすると api.invites.create が呼ばれる', async () => {
      // TODO
    });

    it('生成されたリンクが URL 形式でダイアログ内に表示される', async () => {
      // TODO
    });

    it('有効期限（expiresInHours）を選択して生成できる', async () => {
      // TODO
    });

    it('最大使用回数（maxUses）を入力して生成できる', async () => {
      // TODO
    });
  });

  describe('クリップボードコピー', () => {
    it('「コピー」ボタンをクリックするとリンクがクリップボードに書き込まれる', async () => {
      // TODO
    });
  });

  describe('一覧表示', () => {
    it('既存の招待リンク一覧が表示される', async () => {
      // TODO
    });

    it('有効期限付きリンクに期限が表示される', async () => {
      // TODO
    });

    it('期限切れリンクに「期限切れ」が表示される', async () => {
      // TODO
    });

    it('revoke 済みリンクに「無効」が表示される', async () => {
      // TODO
    });
  });

  describe('無効化ボタンの表示制御', () => {
    it('作成者には「無効化」ボタンが表示される', async () => {
      // TODO
    });

    it('admin ロールのユーザーには他ユーザーのリンクにも「無効化」ボタンが表示される', async () => {
      // TODO
    });

    it('作成者でも admin でもないユーザーには「無効化」ボタンが表示されない', async () => {
      // TODO
    });
  });

  describe('無効化操作', () => {
    it('「無効化」ボタンをクリックすると api.invites.revoke が呼ばれる', async () => {
      // TODO
    });

    it('revoke 後にリンクの状態が「無効」に更新される', async () => {
      // TODO
    });
  });
});
