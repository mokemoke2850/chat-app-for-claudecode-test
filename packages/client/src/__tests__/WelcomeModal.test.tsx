/**
 * テスト対象: packages/client/src/components/Onboarding/WelcomeModal.tsx
 * 戦略:
 *   - vi.mock で api/client を差し替え、初回ログインモーダルの
 *     ステップ遷移・おすすめチャンネル参加・完了/スキップ時の API 呼び出しを検証する。
 *   - Issue #114 のオンボーディング UI。
 */

describe('WelcomeModal', () => {
  describe('表示制御', () => {
    it('user.onboardingCompletedAt === null のとき自動的に開く', () => {
      // TODO
    });

    it('user.onboardingCompletedAt が埋まっているとき開かない', () => {
      // TODO
    });

    it('未ログイン（user === null）のときは開かない', () => {
      // TODO
    });
  });

  describe('ステップ遷移', () => {
    it('初期表示時はステップ 1（ようこそ）が表示される', () => {
      // TODO
    });

    it('「次へ」ボタンでステップ 2（おすすめチャンネル）に進む', () => {
      // TODO
    });

    it('「戻る」ボタンで前のステップに戻る', () => {
      // TODO
    });

    it('最終ステップでは「次へ」ではなく「完了」ボタンが表示される', () => {
      // TODO
    });

    it('再レンダリングされても activeStep がリセットされない（useMemo で Promise を安定化）', () => {
      // TODO
    });
  });

  describe('おすすめチャンネル参加', () => {
    it('isRecommended === true のチャンネルが一覧表示される', () => {
      // TODO
    });

    it('「このチャンネルに参加」ボタンで channels.join API が呼ばれる', () => {
      // TODO
    });

    it('参加済みチャンネルは「参加済み」表示になる', () => {
      // TODO
    });

    it('複数チャンネルを続けて参加できる', () => {
      // TODO
    });
  });

  describe('完了・スキップ', () => {
    it('「完了」ボタンで auth.completeOnboarding API が呼ばれてモーダルが閉じる', () => {
      // TODO
    });

    it('「スキップ」ボタンでも auth.completeOnboarding API が呼ばれてモーダルが閉じる', () => {
      // TODO
    });

    it('completeOnboarding 成功後に AuthContext の user.onboardingCompletedAt が更新される', () => {
      // TODO
    });

    it('completeOnboarding が失敗してもモーダルは閉じる（UX 優先）', () => {
      // TODO
    });
  });
});
