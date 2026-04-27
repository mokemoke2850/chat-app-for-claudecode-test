# Issue #149 — feat: ゲスト閲覧リンク

> Phase 3 / 並列OK / 難易度: 中

## 概要

未登録ユーザーがアカウント登録なしで特定チャンネルを **読み取り専用** で閲覧できる公開URLを発行する。

- 管理者がチャンネル単位で発行・無効化
- 投稿不可・読み取り専用
- 有効期限・パスワード保護を設定可能

## 仕様確認事項

- **パスワード保護**: 入力 UI と検証フロー、保存形式（bcrypt ハッシュ）。MVP では**任意設定**として bcrypt ハッシュ保存を推奨。
- **公開対象範囲**: チャンネル単位のみか、DM・スレッド・添付ファイルへのアクセスもか。MVP はチャンネル本体のメッセージ + 添付 のみ閲覧可能で十分と想定。
- **既存 `invite_links` との関係**: `invite_links` は「登録 → メンバー化」のフローで、本機能（未登録のままアクセス）とは別概念。テーブルを分けるべき。
- **レート制限**: パスワード総当たり対策のため、検証 API には別途レート制限が必要（#153 が後にあるが、本機能内で簡易実装でも可）。
- **公開ページのデザイン**: ログイン中ユーザーと同じ `ChatPage` を読み取り専用フラグで描画するか、別ページコンポーネントにするか。**別ページ推奨**（#154 のヘッダー縮小やプレゼンス表示など、ログイン UI 専用要素を取り除いた軽量ビューにできる）。

## 影響範囲

### DB

- `db/schema.hcl` に新規テーブル `guest_links` 追加
  - `id serial pk`
  - `token text unique` — URL セーフ乱数 32 文字以上
  - `channel_id integer not null fk channels`
  - `created_by integer null fk users`
  - `password_hash text null` — bcrypt
  - `expires_at timestamptz null`
  - `is_revoked boolean default false`
  - `created_at timestamptz`

### Server

- `packages/server/src/services/guestLinkService.ts`（**新規**）
- `packages/server/src/routes/guestLinks.ts`（**新規**）
  - `POST /channels/:id/guest-links`（管理者）
  - `DELETE /guest-links/:id`（管理者、無効化）
  - `GET /guest-links/:token/verify`（公開、パスワード検証）
  - `GET /guest-links/:token/messages`（公開、読み取り専用）
- `packages/server/src/middleware/guestAuth.ts`（**新規**） — token + パスワードからゲストセッションを発行
- ゲストセッションの実装方針: 短期 JWT を発行してクライアントが Authorization ヘッダで送る形が最もミドルウェアと馴染む。
- 既存 `middleware/auth.ts` には**触らない**（既存ユーザー向け認可は不変）。代わりに新ミドルウェアを公開ルート専用に適用する。

### Client

- `packages/client/src/pages/GuestChannelPage.tsx`（**新規**）
- `packages/client/src/components/Channel/GuestLinkDialog.tsx`（**新規**） — 管理者向け発行 / 失効 UI
- ルーティング: `/g/:token` で `GuestChannelPage` を表示
- 公開ビューは `MessageList` を読み取り専用モードで再利用（送信欄なし、リアクション・編集・添付追加なし）

### モーダルおよびインジケータ

- ChatPage 編集権限のあるユーザー用に「ゲスト閲覧リンクを発行」メニュー追加（既存 `InviteLinkDialog` と同列の位置）

## 並列実行時の競合警戒

- **`middleware/auth.ts` を変更しない方針**で進めることが重要（#153 のレート制限ミドルウェアと衝突しない）。
- 公開チャンネルメッセージ取得 API（`GET /guest-links/:token/messages`）は既存 `messages.ts` ルートとは別ファイルに分離するため、Phase 3 内で並列実行可能。
- `MessageList` を読み取り専用モードで再利用する場合、既存の `MessageList.tsx` に props 1 つ追加するだけに留める（深い改修は他機能と衝突しやすい）。

## 実装ポイント / 落とし穴

- **トークン推測対策**: 32 byte 乱数を base64url エンコード。
- **無効化されたリンクの扱い**: `is_revoked` のチェックを毎回行う。キャッシュは持たない。
- **パスワード総当たり**: 同一トークンに対する検証失敗回数で短期ブロックを実装。
- **読み取り専用ガード**: 公開ビュー側で送信 UI を出さないだけでなく、サーバ側でも投稿系エンドポイントはゲストトークンを拒否する。
- **添付ファイルアクセス**: 添付 URL もゲストトークン経由で署名 / 認可を通す。直リンクでアクセス可能だと意味がなくなる。
- **既存ユーザーが `/g/:token` を踏んだ場合**: ゲストフローに入るのか、自動的にメンバーとして閲覧するのか、UX を確認。MVP は常にゲストフローで割り切る。
- **チャンネルがプライベートの場合**: 発行できる前提だがログ監査必須。`audit_logs` に発行ログを残す。

## テスト観点

- ユニット
  - リンク発行・失効・期限切れ判定
  - パスワード未設定・設定済みの両方の検証
- 統合
  - 公開ルートで投稿 API を叩くと 403 になる
  - 失効済みリンクで取得すると 404 になる
- フロントエンド
  - `GuestChannelPage` で送信欄が表示されない
  - パスワード入力ダイアログ後にメッセージ一覧が表示される

## ステータス（経過記録）

- 計画作成日: 2026-04-27
- ブランチ: -
- PR: -
- マージ: -
- 備考: -
