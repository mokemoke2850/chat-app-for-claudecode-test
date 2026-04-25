/**
 * テスト対象: メッセージ転送機能 (messageService.forwardMessage)
 * 戦略: pg-mem のインメモリ PostgreSQL 互換 DB を使いサービス層を直接テストする。
 * 設計: 方針 A（元メッセージを JOIN で参照、スナップショットなし）を採用。
 *       元メッセージ削除後は forwardedFromMessage が null になることを検証する。
 */

import { getSharedTestDatabase, resetTestData } from './__fixtures__/pgTestHelper';

const testDb = getSharedTestDatabase();

jest.mock('../db/database', () => testDb);

describe('メッセージ転送機能', () => {
  let userId1: number;
  let userId2: number;
  let channelId: number;
  let targetChannelId: number;
  let sourceMessageId: number;

  beforeEach(async () => {
    await resetTestData(testDb);
    // TODO: アサーション
  });

  describe('正常系: チャンネル間転送', () => {
    it('元メッセージを別チャンネルへ転送できる', async () => {
      // TODO: アサーション
    });

    it('転送されたメッセージに forwarded_from_message_id が設定される', async () => {
      // TODO: アサーション
    });

    it('コメントなしで転送するとき content は空文字になる', async () => {
      // TODO: アサーション
    });

    it('コメントを添えて転送するとき content にコメントが設定される', async () => {
      // TODO: アサーション
    });

    it('転送後のメッセージに転送元メッセージ情報（forwardedFromMessage）がネストして返される', async () => {
      // TODO: アサーション
    });

    it('転送後のメッセージを一覧取得したとき forwardedFromMessage が含まれる', async () => {
      // TODO: アサーション
    });
  });

  describe('権限チェック: 転送先チャンネル未加入', () => {
    it('転送先チャンネルのメンバーでないユーザーが転送しようとすると 403 エラーになる', async () => {
      // TODO: アサーション
    });

    it('転送先チャンネルの posting_permission が admins_only のとき一般ユーザーは 403 エラーになる', async () => {
      // TODO: アサーション
    });
  });

  describe('権限チェック: 転送元チャンネル未加入', () => {
    it('転送元メッセージのチャンネルのメンバーでないユーザーが転送しようとすると 403 エラーになる', async () => {
      // TODO: アサーション
    });
  });

  describe('存在しない・無効なリソース', () => {
    it('存在しない元メッセージ ID を指定すると 404 エラーになる', async () => {
      // TODO: アサーション
    });

    it('存在しない転送先チャンネル ID を指定すると 404 エラーになる', async () => {
      // TODO: アサーション
    });
  });

  describe('元メッセージ削除後の表示（方針 A: JOIN 参照）', () => {
    it('転送後に元メッセージが削除されると forwardedFromMessage は null になる', async () => {
      // TODO: アサーション
    });

    it('元メッセージが削除されても転送先のメッセージ自体は残る', async () => {
      // TODO: アサーション
    });
  });

  describe('添付ファイルの扱い', () => {
    it('元メッセージに添付があっても転送先には添付がコピーされない（MVP）', async () => {
      // TODO: アサーション
    });
  });
});
