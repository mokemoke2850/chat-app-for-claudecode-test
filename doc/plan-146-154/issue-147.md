# Issue #147 — feat: カスタムステータス

> Phase 2 / 並列OK / 難易度: 低 / **依存: #146**

## 概要

「会議中」「集中モード」など、絵文字＋テキスト＋有効期限のステータスを設定可能にする。

- 自由記述テキスト + 絵文字
- 有効期限（1時間後 / 今日中 / 明日まで / 1週間 / カスタム / 期限なし）
- 期限切れで自動クリア
- メンバー一覧 / プロフィール / メンション候補に表示

## 仕様確認事項

- **テーブル設計**: `users` 列追加で十分（`status_emoji` / `status_text` / `status_expires_at`）。履歴は不要。
- **絵文字ピッカー**: 既存 `EmojiPicker.tsx`（`packages/client/src/components/Chat/EmojiPicker.tsx`）を再利用してよいか。
- **「今日中」の解釈**: ユーザーのローカルタイムゾーンの 23:59:59 で良いか。サーバ側はユーザー時刻を持たないので、クライアントが期限を計算して送信する想定。
- **メンション通知への反映**: 集中モード中の人にメンションが飛んだ際の特殊扱いは MVP では不要、と想定。

## 影響範囲

### DB

- `db/schema.hcl` の `users` テーブルに 3 列追加
  - `status_emoji text null`
  - `status_text text null`
  - `status_expires_at timestamptz null`

### Server

- `packages/server/src/services/userService.ts` または `authService.ts` — ステータス更新メソッド追加
- `packages/server/src/routes/users.ts` — `PATCH /users/me/status` 追加
- ユーザー取得系レスポンスに `status` 情報を含める（期限切れは null として返す）
- **期限切れ自動クリア**: GET 時に `status_expires_at < now()` ならレスポンスで null を返すだけで十分（DB のクリーンアップは別ジョブで遅延処理可）

### Client

- `packages/client/src/components/User/StatusEditDialog.tsx`（**新規**） — 絵文字 + テキスト + 期限プルダウン
- `UserProfilePopover.tsx` — ステータス表示
- メンバー一覧 (`ChannelMembersDialog.tsx`)
- メンション候補 `MentionDropdown.tsx`
- ヘッダーや自分のアバター付近にステータス変更導線

## 並列実行時の競合警戒

- **#146 と同時禁止**: `UserAvatar` 表示位置（プレゼンスドットとステータス絵文字）が同居する。**#146 がマージされた後**に着手する前提でブランチを切る。
- Phase 2 内の #150 / #151 とはファイルが分離されており並列OK。

## 実装ポイント / 落とし穴

- **TZ 計算**: 「今日中」「明日まで」はクライアント側で計算して UTC で送る。サーバ側でクライアントタイムゾーンを推測しない。
- **期限切れ表示**: 取得時に `expires_at < now()` をサーバ側でフィルタすればクライアントは特別なロジック不要。
- **絵文字の文字コード**: Unicode 文字列としてそのまま保存（`text` 型）。サロゲートペア対応のため文字長バリデーションはコードポイント単位ではなくバイト数 or グラフェム単位で行う。
- **空ステータス**: 絵文字のみ / テキストのみも許容するか確認。MVP では両方任意（ただし両方空ならクリア扱い）が妥当。

## テスト観点

- ユニット
  - ステータス設定 → 取得で同じ内容が返る
  - 期限切れ後の取得でステータスが null になる
  - 期限なしのステータスは恒久的に有効
- フロントエンド
  - StatusEditDialog で絵文字選択・テキスト入力・期限選択ができる
  - 自分のアバターに設定したステータス絵文字が表示される

## ステータス（経過記録）

- 計画作成日: 2026-04-27
- ブランチ: -
- PR: -
- マージ: -
- 備考: -
