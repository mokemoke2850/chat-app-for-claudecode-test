/**
 * テスト対象: pages/GuestChannelPage.tsx — /g/:token ルートで表示する読み取り専用ゲストビュー（#149）
 * 戦略:
 *   - api.guestLinks の各メソッドを vi.mock で差し替え、トークン情報取得 / パスワード検証 / メッセージ取得の各フェーズの UI を検証する
 *   - 既存ユーザーが /g/:token を踏んでも常にゲストフロー固定であることを検証する
 *   - 投稿 UI（送信欄・編集・削除・リアクション・添付追加）が表示されないことを検証する
 *   - React 19 の use() + Suspense パターンで実装される前提（CLAUDE.md フロントエンド開発ルール）
 */

import { describe, it, vi } from 'vitest';

vi.mock('../api/client', () => ({
  api: {
    guestLinks: {
      lookup: vi.fn(),
      verify: vi.fn(),
      messages: vi.fn(),
    },
  },
}));

vi.mock('../contexts/AuthContext', () => ({
  useAuth: vi.fn(),
}));

describe('GuestChannelPage', () => {
  describe('トークン情報取得フェーズ', () => {
    it('有効なトークンにアクセスするとチャンネル名が表示される', async () => {
      // TODO
    });

    it('存在しないトークン（404）にアクセスするとエラーメッセージが表示される', async () => {
      // TODO
    });

    it('期限切れトークンには「有効期限が切れています」と表示される', async () => {
      // TODO
    });

    it('失効済みトークンには「このリンクは無効化されています」と表示される', async () => {
      // TODO
    });

    it('Suspense フォールバック（ローディング表示）が初期表示される', async () => {
      // TODO
    });
  });

  describe('パスワード入力フェーズ', () => {
    it('パスワード設定済みトークンにはパスワード入力フォームが表示される', async () => {
      // TODO
    });

    it('パスワード未設定トークンではパスワード入力フォームを表示せず即メッセージを取得する', async () => {
      // TODO
    });

    it('正しいパスワードを入力して送信するとメッセージ一覧が表示される', async () => {
      // TODO
    });

    it('誤ったパスワードを送信するとエラーメッセージが表示される', async () => {
      // TODO
    });

    it('連続失敗で 429 を受け取ると「しばらく時間をおいてください」と表示される', async () => {
      // TODO
    });
  });

  describe('メッセージ表示フェーズ（読み取り専用）', () => {
    it('チャンネルのメッセージ一覧が表示される', async () => {
      // TODO
    });

    it('送信欄（MessageInput）は表示されない', async () => {
      // TODO
    });

    it('リアクション追加ボタンは表示されない', async () => {
      // TODO
    });

    it('メッセージの編集／削除メニュー（MessageActions）は表示されない', async () => {
      // TODO
    });

    it('添付ファイルアップロード UI は表示されない', async () => {
      // TODO
    });

    it('スレッド返信ボタンは表示されない', async () => {
      // TODO
    });

    it('添付ファイルのプレビューは表示される（画像・PDF など読み取り）', async () => {
      // TODO
    });
  });

  describe('既存ユーザーのアクセス（ログイン無視）', () => {
    it('useAuth.user がログイン済みでも /g/:token はゲストフローで描画される', async () => {
      // TODO
    });

    it('ログイン済みユーザーがアクセスしてもメンバー権限の編集 UI は出ない', async () => {
      // TODO
    });

    it('ログイン済みユーザーが /g/:token から通常チャットへリダイレクトされない', async () => {
      // TODO
    });
  });

  describe('ゲストセッション管理', () => {
    it('verify 成功時に発行された guestToken を Authorization ヘッダで messages 取得時に送る', async () => {
      // TODO
    });

    it('messages 取得が 410 を返すと「リンクは無効です」と表示する', async () => {
      // TODO
    });

    it('use() に渡す Promise は useState または useMemo で安定化されている（再レンダリングで再生成しない）', async () => {
      // TODO
    });
  });
});
