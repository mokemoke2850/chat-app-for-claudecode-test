# Issue #146 — feat: オンライン/オフラインステータス

> Phase 1 / 並列OK / 難易度: 低

## 概要

ユーザーの在席状況（オンライン / 離席中 / オフライン）をアバターのインジケータとして表示する。

- ログイン中は緑、一定時間操作なしで黄、ログアウト/タブクローズで灰
- アバターに小さなドットを重ねて表示

## 仕様確認事項

- **永続化方針**: プレゼンスはメモリ管理のみで足りるのか、`users.last_active_at` 列を追加してリロード後も最終アクセス推定を表示したいか。MVP はメモリ管理のみで十分と想定。
- **離席判定の閾値**: 5 分 / 10 分 / 設定可能 のいずれか。MVP は固定値（5 分）でよいか。
- **インジケータ表示位置**: 既存 `UserAvatar` の右下に重ねる想定で問題ないか。

## 影響範囲

### Server

- `packages/server/src/socket/index.ts` — connect / disconnect で在席集合を更新
- `packages/server/src/socket/socketAuthMiddleware.ts` — ユーザーID 取得済み前提
- `packages/server/src/services/presenceService.ts`（**新規**） — メモリ Map で在席管理 + 最終アクティビティ更新
- `packages/server/src/routes/users.ts` または既存ユーザー取得系 — `presenceState: 'online' | 'away' | 'offline'` を返す
- 既存ユーザー一覧 / メンバー一覧の API レスポンスに `presenceState` を含める

### Client

- `packages/client/src/components/`（既存の `UserAvatar` に相当する箇所） — インジケータドット追加
  - `UserProfilePopover.tsx`
  - `Channel/ChannelMembersDialog.tsx`
  - DM 一覧
  - メンション候補 `MentionDropdown.tsx`
- `packages/client/src/hooks/`（**新規** `usePresence.ts`） — Socket 経由でプレゼンス変化を購読
- 自身の操作検知（mousemove / keydown）→ Socket `presence:heartbeat` 送信 or `idle` 通知

### Socket イベント設計

- `presence:state` (server→client): `{ userId, state }`
- `presence:bulk` (server→client, 接続直後): 全オンラインユーザー一覧
- `presence:heartbeat` (client→server): アクティブ通知（任意）

### DB

- 新規テーブル不要を推奨。`users` への列追加（`last_active_at`）は将来拡張で十分。
- もし永続化する場合は `db/schema.hcl` の `users` テーブルに `last_active_at timestamptz null` を追加。

## 並列実行時の競合警戒

- **#147 と同時着手禁止**: `UserAvatar` 表示部を両方が触る。Phase 1 で #146 を確定 → Phase 2 で #147。
- Phase 1 内では #154 / #148 と触るファイルが重ならないため並列OK。

## 実装ポイント / 落とし穴

- **複数タブ問題**: 同一ユーザーが複数タブで接続する。Socket セッションが 1 つでも残っていれば online。
- **離席判定**: サーバ側でハートビートのタイムアウト管理 vs クライアント側の `idle` イベント。サーバ側にタイマーを置く方がスケール面でシンプル。
- **broadcast コスト**: 全ユーザーに変化を即時 broadcast すると重い。同一ワークスペース内（チャンネル参加メンバー集合）に絞るのが望ましい。
- **再接続タイミング**: 離脱直後の再接続でフラッシュを起こさないよう、disconnect 後 5〜10 秒猶予を持たせて offline 判定する。

## テスト観点

- ユニット（presenceService）
  - 接続 1 件で online、disconnect 後の猶予期間中は online を維持する
  - ハートビート途絶 5 分で away、再アクティブで online
  - 全 disconnect 後 N 秒で offline
- 統合（Socket）
  - クライアント A 接続 → クライアント B が `presence:state` を受信する
- フロントエンド
  - `UserAvatar` のインジケータ色が state に応じて切り替わる（最低限の表示確認）
  - 自分自身の操作で離席→アクティブに復帰する

## ステータス（経過記録）

- 計画作成日: 2026-04-27
- ブランチ: -
- PR: -
- マージ: -
- 備考: -
