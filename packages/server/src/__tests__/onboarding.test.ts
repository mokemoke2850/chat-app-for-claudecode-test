/**
 * テスト対象: ワークスペース初回オンボーディング機能（Issue #114）
 * 戦略:
 *   - サービス層レベルで onboarding_completed_at の更新と
 *     is_recommended フラグの ON/OFF を検証する。
 *   - pg-mem のインメモリ PostgreSQL 互換 DB を使用する。
 *   - HTTP レイヤーの詳細は integration/authController.test.ts と
 *     integration/adminController.test.ts で追加する。
 */

describe('オンボーディング機能', () => {
  describe('users.onboarding_completed_at カラム', () => {
    it('新規登録したユーザーは onboarding_completed_at が NULL である', () => {
      // TODO
    });

    it('POST /api/auth/onboarding/complete を呼ぶと onboarding_completed_at が NOW() で埋まる', () => {
      // TODO
    });

    it('2 回呼び出しても冪等に更新される（エラーにならない）', () => {
      // TODO
    });
  });

  describe('me レスポンスに onboardingCompletedAt を含む', () => {
    it('未完了ユーザーの me は onboardingCompletedAt === null を返す', () => {
      // TODO
    });

    it('完了済ユーザーの me は onboardingCompletedAt が ISO 文字列で返る', () => {
      // TODO
    });
  });

  describe('channels.is_recommended カラム', () => {
    it('新規作成したチャンネルの is_recommended は false である', () => {
      // TODO
    });

    it('チャンネル一覧 API のレスポンスに isRecommended が含まれる', () => {
      // TODO
    });

    it('管理者が is_recommended を true に更新できる', () => {
      // TODO
    });

    it('is_recommended フラグはチャンネル削除に連動して消える', () => {
      // TODO
    });
  });

  describe('監査ログ', () => {
    it('オンボーディング完了時に auth.onboarding.complete が記録される', () => {
      // TODO
    });

    it('推奨設定 ON 時に admin.channel.recommend が記録される', () => {
      // TODO
    });

    it('推奨設定 OFF 時に admin.channel.unrecommend が記録される', () => {
      // TODO
    });
  });
});
