/**
 * テスト対象: components/Channel/NotificationLevelMenu
 * 責務: 通知レベル（all / mentions / muted）を選択するポップオーバーメニューの表示・操作
 * 戦略:
 *   - api モジュールを vi.mock で差し替えてネットワーク通信を排除
 *   - userEvent でメニュー操作をシミュレートし、API 呼び出しと選択状態を検証する
 */

import { describe, it } from 'vitest';

describe('NotificationLevelMenu', () => {
  describe('メニュー表示', () => {
    it('「すべての通知」「メンションのみ」「ミュート」の3つの選択肢が表示される', () => {
      // TODO
    });

    it('現在の通知レベルが選択済み状態で表示される', () => {
      // TODO
    });
  });

  describe('通知レベルの変更', () => {
    it('「すべての通知」を選択すると API が level="all" で呼ばれる', () => {
      // TODO
    });

    it('「メンションのみ」を選択すると API が level="mentions" で呼ばれる', () => {
      // TODO
    });

    it('「ミュート」を選択すると API が level="muted" で呼ばれる', () => {
      // TODO
    });

    it('選択後にメニューが閉じる', () => {
      // TODO
    });
  });

  describe('API エラー処理', () => {
    it('API が失敗した場合にエラーが握りつぶされず上位に伝わる（またはスナックバーで表示される）', () => {
      // TODO
    });
  });
});
