/**
 * テスト対象:
 *   - packages/client/src/api/client.ts（429 ハンドリング）
 *   - Socket.IO の error: rate_limit イベントリスナ（ChatPage / DMPage）
 *
 * 戦略:
 *   - fetch は vi.stubGlobal でモックしてネットワーク通信を排除
 *   - Socket.IO は手動モックオブジェクトを組み立てて注入する
 *   - スナックバー表示は SnackbarContext の showError / showWarning が呼ばれることで検証する
 */

import { describe, it } from 'vitest';

describe('api/client.ts 429 ハンドリング', () => {
  describe('request 関数', () => {
    it('サーバーが 429 を返したとき Error がスローされる', () => {
      // TODO
    });

    it('429 レスポンスの error フィールドがエラーメッセージとして設定される', () => {
      // TODO
    });

    it('429 時にスナックバーの showError が呼ばれる', () => {
      // TODO
    });

    it('retryAfterSec がレスポンスに含まれるとき、エラーメッセージに残り秒数が表示される', () => {
      // TODO
    });
  });
});

describe('Socket rate_limit エラーリスナ', () => {
  describe('チャンネルメッセージ（ChatPage）', () => {
    it('error: rate_limit イベントを受信したときスナックバー警告が表示される', () => {
      // TODO
    });

    it('警告メッセージに「時間をおいてください」相当の文言が含まれる', () => {
      // TODO
    });
  });

  describe('DM（DMPage）', () => {
    it('error: rate_limit イベントを受信したときスナックバー警告が表示される', () => {
      // TODO
    });
  });
});
