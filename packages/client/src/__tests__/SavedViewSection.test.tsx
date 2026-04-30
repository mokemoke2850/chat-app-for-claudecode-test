/**
 * テスト対象: SavedViewSection コンポーネント（新規）
 *   + SavedViewEditDialog（保存ビューの編集・並べ替えダイアログ）
 *
 * 戦略:
 *   - api.savedViews.* を vi.mock('../api/client') で差し替えてネットワーク通信を排除
 *   - ユーザー操作（クリック・入力）は userEvent でシミュレートする
 *   - 並べ替えは「上ボタン / 下ボタン」の操作に対して API 呼び出しが正しく行われるかを検証
 *   - 「画面を見ればわかる」UI 状態は省略し、ロジック・コールバックを中心にテストする
 *   - React 19: use() + Suspense を使うため render は await act(async () => render(...)) でラップ
 */

import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Suspense } from 'react';

vi.mock('../api/client', () => ({
  api: {
    savedViews: {
      list: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      reorder: vi.fn(),
    },
  },
}));

// --- フィクスチャ ---
const SAVED_VIEW_FIXTURES = [
  { id: 1, name: '今週のバグ', query: { dateFrom: '2024-01-01', tagIds: [10] }, position: 0 },
  { id: 2, name: '未読メンション', query: { userId: 5 }, position: 1 },
  { id: 3, name: '添付あり', query: { hasAttachment: true }, position: 2 },
];

describe('SavedViewSection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('保存ビュー一覧表示', () => {
    it('保存ビューの名前が一覧に表示される', () => {
      // TODO
    });

    it('保存ビューが 0 件のときセクションは空（またはプレースホルダーを表示）', () => {
      // TODO
    });
  });

  describe('保存ビュークリック', () => {
    it('保存ビューをクリックすると onSelectView コールバックが query を引数として呼ばれる', () => {
      // TODO
    });
  });

  describe('編集ダイアログ', () => {
    it('編集ボタンをクリックすると編集ダイアログが開く', () => {
      // TODO
    });

    it('ダイアログで名前を変更して保存すると api.savedViews.update が呼ばれる', () => {
      // TODO
    });

    it('ダイアログをキャンセルすると api.savedViews.update が呼ばれない', () => {
      // TODO
    });
  });

  describe('削除', () => {
    it('削除ボタンをクリックすると api.savedViews.delete が呼ばれる', () => {
      // TODO
    });

    it('削除後に保存ビューが一覧から消える', () => {
      // TODO
    });
  });

  describe('並べ替え（上下ボタン）', () => {
    it('「上に移動」ボタンをクリックすると api.savedViews.reorder が新順序で呼ばれる', () => {
      // TODO
    });

    it('「下に移動」ボタンをクリックすると api.savedViews.reorder が新順序で呼ばれる', () => {
      // TODO
    });

    it('先頭の保存ビューの「上に移動」ボタンは無効（disabled）になっている', () => {
      // TODO
    });

    it('末尾の保存ビューの「下に移動」ボタンは無効（disabled）になっている', () => {
      // TODO
    });

    it('並べ替え後に一覧の表示順が更新される', () => {
      // TODO
    });
  });
});
