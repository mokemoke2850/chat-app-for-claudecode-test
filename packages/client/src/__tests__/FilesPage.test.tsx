/**
 * テスト対象: ファイル一覧ページ（FilesPage / FileList）
 * 戦略:
 *   - ネットワーク通信は vi.mock('../api/client') で差し替える
 *   - React 19 の use() + Suspense パターンを考慮し、非同期データ取得を検証する
 *   - ファイルタイプフィルタリング操作をAPIモックを通じて検証する
 */

import { describe, it, vi } from 'vitest';

vi.mock('../api/client', () => ({
  api: {
    channels: {
      getAttachments: vi.fn(),
    },
  },
}));

vi.mock('../contexts/SocketContext', () => ({
  useSocket: () => ({ emit: vi.fn(), on: vi.fn(), off: vi.fn() }),
}));

describe('FilesPage', () => {
  describe('ファイル一覧の表示', () => {
    it('チャンネルの添付ファイル一覧が取得できたとき、ファイル一覧が表示される', async () => {
      // TODO: implement
    });

    it('各ファイル項目にファイル名が表示される', async () => {
      // TODO: implement
    });

    it('各ファイル項目にアップロード者名が表示される', async () => {
      // TODO: implement
    });

    it('各ファイル項目にアップロード日時が表示される', async () => {
      // TODO: implement
    });

    it('各ファイル項目にファイルサイズが表示される', async () => {
      // TODO: implement
    });

    it('ファイルが0件の場合、空状態のメッセージを表示する', async () => {
      // TODO: implement
    });

    it('データ取得中は Suspense のフォールバック（ローディング表示）を表示する', async () => {
      // TODO: implement
    });
  });

  describe('ファイルタイプフィルタリング', () => {
    it('「画像」フィルターを選択すると画像ファイルのみ表示される', async () => {
      // TODO: implement
    });

    it('「PDF」フィルターを選択するとPDFファイルのみ表示される', async () => {
      // TODO: implement
    });

    it('「その他」フィルターを選択すると画像・PDF以外のファイルのみ表示される', async () => {
      // TODO: implement
    });

    it('「すべて」フィルターを選択するとすべてのファイルが表示される', async () => {
      // TODO: implement
    });
  });

  describe('ファイル操作', () => {
    it('ダウンロードボタンをクリックするとファイルのダウンロードが開始される', async () => {
      // TODO: implement
    });

    it('画像ファイルのプレビューボタンをクリックするとプレビューが表示される', async () => {
      // TODO: implement
    });

    it('PDFファイルのプレビューボタンをクリックするとプレビューが表示される', async () => {
      // TODO: implement
    });
  });
});
