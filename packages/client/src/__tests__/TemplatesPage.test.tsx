/**
 * テスト対象: pages/TemplatesPage.tsx
 * 戦略:
 *   - ネットワーク通信は vi.mock('../api/client') で差し替える
 *   - React 19 の use() + Suspense パターンを考慮し、非同期データ取得を検証する
 *   - テンプレートの CRUD 操作と並び替えを重点的に検証する
 */

import { describe, it, vi } from 'vitest';

vi.mock('../api/client', () => ({
  api: {
    templates: {
      list: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      remove: vi.fn(),
      reorder: vi.fn(),
    },
  },
}));

describe('TemplatesPage', () => {
  describe('テンプレート一覧', () => {
    it('テンプレート一覧がタイトル・本文とともに表示される', () => {
      // TODO
    });

    it('テンプレートが 0 件のときに「テンプレートがありません」旨が表示される', () => {
      // TODO
    });
  });

  describe('テンプレート作成', () => {
    it('タイトルと本文を入力して保存するとテンプレートが追加される', () => {
      // TODO
    });

    it('タイトルが空の状態では保存ボタンが無効化される', () => {
      // TODO
    });

    it('本文が空の状態では保存ボタンが無効化される', () => {
      // TODO
    });

    it('作成 API 呼び出し後に一覧がリフレッシュされる', () => {
      // TODO
    });
  });

  describe('テンプレート編集', () => {
    it('編集ボタンを押すとタイトル・本文の編集フォームが表示される', () => {
      // TODO
    });

    it('内容を変更して保存すると update API が呼ばれる', () => {
      // TODO
    });

    it('キャンセルすると変更が破棄される', () => {
      // TODO
    });
  });

  describe('テンプレート削除', () => {
    it('削除ボタンを押すと確認なしに即時削除 API が呼ばれる', () => {
      // TODO
    });

    it('削除後に一覧からそのテンプレートが消える', () => {
      // TODO
    });
  });

  describe('並び替え', () => {
    it('↑ボタンを押すと対象テンプレートの position が1つ前に移動し reorder API が呼ばれる', () => {
      // TODO
    });

    it('↓ボタンを押すと対象テンプレートの position が1つ後に移動し reorder API が呼ばれる', () => {
      // TODO
    });

    it('先頭テンプレートの ↑ ボタンは無効化されている', () => {
      // TODO
    });

    it('末尾テンプレートの ↓ ボタンは無効化されている', () => {
      // TODO
    });
  });
});
