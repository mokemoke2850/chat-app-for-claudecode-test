/**
 * テスト対象: services/guestLinkService.ts — ゲスト閲覧リンク機能（#149）
 * 戦略:
 *   - pg-mem のインメモリ PostgreSQL 互換 DB を使ってサービス層を直接テストする
 *   - URL セーフトークン生成・パスワードハッシュ化・有効期限/失効/総当たり防止のビジネスロジックを検証する
 *   - ゲストセッション JWT の発行・検証フローを検証する
 *   - 公開メッセージ取得が読み取り専用（DM・スレッド・リアクションを含まない）であることを検証する
 */

import { getSharedTestDatabase, resetTestData } from '../__fixtures__/pgTestHelper';

const testDb = getSharedTestDatabase();

jest.mock('../../db/database', () => testDb);

// NOTE: guestLinkService は本 PR 後段（Step 5 以降）で実装予定。
// このテストファイルは項目骨子のみ。アサーション・import は実装フェーズで追加する。

describe('ゲスト閲覧リンクサービス', () => {
  describe('token 生成', () => {
    it('生成された token は 32 文字以上である', () => {
      // TODO
    });

    it('生成された token は URL セーフ文字（base64url）のみで構成される', () => {
      // TODO
    });

    it('複数回生成した token は重複しない', () => {
      // TODO
    });
  });

  describe('ゲストリンク作成', () => {
    it('チャンネルメンバーがパスワードなしでゲストリンクを作成できる', async () => {
      // TODO
    });

    it('パスワードを指定するとハッシュ化されて保存される（平文では保存されない）', async () => {
      // TODO
    });

    it('有効期限（expiresInHours）を指定して作成できる', async () => {
      // TODO
    });

    it('有効期限を省略すると expires_at が NULL になる（無期限）', async () => {
      // TODO
    });

    it('存在しないチャンネル ID では作成できない', async () => {
      // TODO
    });

    it('作成時に audit_logs に guest_link.create が記録される', async () => {
      // TODO
    });
  });

  describe('ゲストリンク失効（revoke）', () => {
    it('作成者が自分のリンクを失効できる', async () => {
      // TODO
    });

    it('admin は他ユーザーのリンクも失効できる', async () => {
      // TODO
    });

    it('作成者でも admin でもないユーザーは失効できない', async () => {
      // TODO
    });

    it('失効後は is_revoked = true になる', async () => {
      // TODO
    });

    it('失効時に audit_logs に guest_link.revoke が記録される', async () => {
      // TODO
    });
  });

  describe('ゲストリンク一覧取得', () => {
    it('チャンネル ID を指定するとそのチャンネルのリンク一覧を取得できる', async () => {
      // TODO
    });

    it('一覧結果の password_hash は平文で返さない（マスクまたは hasPassword フラグのみ）', async () => {
      // TODO
    });
  });

  describe('トークン情報取得（lookup）', () => {
    it('有効なトークンの情報（チャンネル名・期限・パスワード要否）を返す', async () => {
      // TODO
    });

    it('存在しないトークンは null を返す', async () => {
      // TODO
    });

    it('期限切れトークンでも情報を返すが isExpired: true になる', async () => {
      // TODO
    });

    it('失効済みトークンでも情報を返すが isRevoked: true になる', async () => {
      // TODO
    });

    it('lookup 結果には password_hash 平文を含めない', async () => {
      // TODO
    });
  });

  describe('パスワード検証 + ゲストセッション発行', () => {
    it('パスワード未設定リンクは空文字または未指定で検証成功する', async () => {
      // TODO
    });

    it('パスワード設定済みリンクで正しいパスワードを与えると検証成功し JWT が発行される', async () => {
      // TODO
    });

    it('パスワード設定済みリンクで誤ったパスワードを与えると検証失敗する', async () => {
      // TODO
    });

    it('発行されるゲスト JWT の payload に token と channelId が含まれる', async () => {
      // TODO
    });

    it('発行されるゲスト JWT は短期（数十分〜数時間）で有効期限切れになる設定である', async () => {
      // TODO
    });

    it('失効済みリンクではパスワードが正しくても検証失敗する', async () => {
      // TODO
    });

    it('期限切れリンクではパスワードが正しくても検証失敗する', async () => {
      // TODO
    });
  });

  describe('パスワード総当たり対策（短期ブロック）', () => {
    it('同一トークンに対する連続検証失敗が閾値を超えると短期間ブロックされる', async () => {
      // TODO
    });

    it('検証成功が混ざると失敗カウンタはリセットされる', async () => {
      // TODO
    });

    it('ブロック期間が過ぎると再度検証できる', async () => {
      // TODO
    });
  });

  describe('ゲスト用メッセージ取得', () => {
    it('有効なゲストトークンとチャンネル ID で公開チャンネル本体メッセージを取得できる', async () => {
      // TODO
    });

    it('返されるメッセージは is_deleted = false のものに限られる', async () => {
      // TODO
    });

    it('スレッド返信（parent_message_id != null）はトップレベル一覧に含まれない', async () => {
      // TODO
    });

    it('DM メッセージは取得対象に含まれない', async () => {
      // TODO
    });

    it('リアクション一覧は応答に含まれない（読み取りメッセージ本体と添付のみ）', async () => {
      // TODO
    });

    it('ゲストトークンのチャンネル ID と異なるチャンネル ID を指定すると取得できない', async () => {
      // TODO
    });

    it('失効済みリンクのゲストトークンでは取得できない', async () => {
      // TODO
    });

    it('期限切れリンクのゲストトークンでは取得できない', async () => {
      // TODO
    });
  });

  describe('ゲスト用添付ファイルアクセス制御', () => {
    it('対象チャンネル内のメッセージ添付はゲストトークンで取得できる', async () => {
      // TODO
    });

    it('対象チャンネル外のメッセージ添付はゲストトークンで取得できない', async () => {
      // TODO
    });
  });
});
