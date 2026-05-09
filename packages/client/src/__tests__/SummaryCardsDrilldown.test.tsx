/**
 * テスト対象: components/Inbox/SummaryCards.tsx のドリルダウン機能
 * 戦略: 各サマリーカードがクリック可能で、対応するURLへ遷移することを検証する。
 *       react-router-dom の useNavigate をモックして遷移先を確認する。
 */

import { describe, it } from 'vitest';

describe('SummaryCards ドリルダウン', () => {
  describe('カードのクリック可能性', () => {
    it('未読カードにカーソルを当てると pointer カーソルが表示される', () => {
      // TODO
    });

    it('今日の予定カードにカーソルを当てると pointer カーソルが表示される', () => {
      // TODO
    });

    it('未完タスクカードにカーソルを当てると pointer カーソルが表示される', () => {
      // TODO
    });
  });

  describe('クリック時のナビゲーション', () => {
    it('未読カードをクリックすると /?tab=mentions に遷移する', () => {
      // TODO
    });

    it('今日の予定カードをクリックすると /calendar?date=today に遷移する', () => {
      // TODO
    });

    it('未完タスクカードをクリックすると /tasks?status=open に遷移する', () => {
      // TODO
    });
  });

  describe('アクセシビリティ', () => {
    it('各カードが button ロールまたは role="button" を持つ', () => {
      // TODO
    });

    it('各カードに適切な aria-label が付与されている', () => {
      // TODO
    });
  });
});
