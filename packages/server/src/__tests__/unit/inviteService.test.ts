/**
 * テスト対象: inviteService（token 生成・redeem トランザクション）
 * 戦略: pg-mem のインメモリ DB でサービス層を直接テストする。
 *       token 生成アルゴリズムの品質確認と、
 *       redeem のトランザクション整合性（行ロック・条件付き UPDATE）を重点検証する。
 */

import { getSharedTestDatabase, resetTestData } from '../__fixtures__/pgTestHelper';

const testDb = getSharedTestDatabase();

jest.mock('../../db/database', () => testDb);

// サービスはモック適用後にインポートする
import * as inviteService from '../../services/inviteService';

let userId: number;
let channelId: number;

async function setupFixtures() {
  // TODO
}

beforeAll(async () => {
  await setupFixtures();
});

beforeEach(async () => {
  await resetTestData(testDb);
  await setupFixtures();
});

describe('inviteService', () => {
  describe('create — 招待リンク作成', () => {
    it('token が crypto.randomBytes(24).toString("base64url") で生成され 32 文字以上になる', async () => {
      // TODO
    });

    it('token は URL セーフ文字（A-Z a-z 0-9 - _）のみで構成される', async () => {
      // TODO
    });

    it('同一の channelId で複数作成しても token は一意になる', async () => {
      // TODO
    });

    it('expiresInHours を渡すと expires_at が現在時刻 + 指定時間後になる', async () => {
      // TODO
    });

    it('expiresInHours を省略すると expires_at が null になる', async () => {
      // TODO
    });

    it('maxUses を省略すると max_uses が null になる', async () => {
      // TODO
    });

    it('channelId を省略すると channel_id が null（ワークスペース全体招待）になる', async () => {
      // TODO
    });
  });

  describe('listByChannel — チャンネル別一覧', () => {
    it('指定チャンネルの招待リンク一覧が返る', async () => {
      // TODO
    });

    it('他チャンネルの招待リンクは含まれない', async () => {
      // TODO
    });
  });

  describe('listAll — 全件取得（管理者用）', () => {
    it('全チャンネルの招待リンクが返る', async () => {
      // TODO
    });
  });

  describe('revoke — 無効化', () => {
    it('is_revoked が true に更新される', async () => {
      // TODO
    });

    it('他ユーザーのリンクを revoke しようとすると権限エラーになる', async () => {
      // TODO
    });

    it('存在しない id を指定すると 404 エラーになる', async () => {
      // TODO
    });
  });

  describe('redeem — 使用（トランザクション）', () => {
    it('有効なトークンで redeem するとメンバー追加・used_count 増加・uses レコード挿入が一括で行われる', async () => {
      // TODO
    });

    it('max_uses 到達時に redeem するとエラーになり used_count は増加しない', async () => {
      // TODO
    });

    it('expires_at 過去のトークンで redeem するとエラーになる', async () => {
      // TODO
    });

    it('is_revoked = true のトークンで redeem するとエラーになる', async () => {
      // TODO
    });

    it('既にメンバーのユーザーが redeem しても成功し used_count は増加しない', async () => {
      // TODO
    });

    it('行ロックにより同時実行時に used_count が max_uses を超えない', async () => {
      // TODO
    });

    it('ワークスペース招待（channel_id = null）で全公開チャンネルに addMember が呼ばれる', async () => {
      // TODO
    });
  });

  describe('lookup — token 情報取得', () => {
    it('有効なトークンの情報を返す（isExpired: false, isRevoked: false, isExhausted: false）', async () => {
      // TODO
    });

    it('期限切れトークンで isExpired: true を返す', async () => {
      // TODO
    });

    it('revoke 済みトークンで isRevoked: true を返す', async () => {
      // TODO
    });

    it('maxUses 到達トークンで isExhausted: true を返す', async () => {
      // TODO
    });

    it('存在しないトークンで null を返す', async () => {
      // TODO
    });
  });
});
