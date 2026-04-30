# Issue #150 — feat: 保存ビュー

> Phase 2 / 並列OK / 難易度: 中

## 概要

検索条件（キーワード・期間・ユーザー・チャンネル等）に名前を付けて保存し、ワンクリックで再表示できる機能。サイドバーやメニューから呼び出し可能。編集・並べ替え・削除も可能。

## 仕様確認事項

- **対象とする検索条件**: 既存の `SearchFilterPanel.tsx` で扱える条件すべてが対象でよいか（キーワード / 期間 / 投稿者 / チャンネル絞り込み / タグ等）。
- **保存ビューの表示位置**: サイドバー（`ChannelList`）に専用セクションを追加する想定でよいか。「お気に入り」「カテゴリ」と並べる位置関係を確認。
- **共有/個人**: 個人専用（user_id 単位で隔離）でよいか。MVP は個人専用で十分と想定。
- **件数上限**: 1 ユーザーあたり何件まで許容するか。MVP は無制限でよい（過剰になったら後付けで制限）。

## 仕様確定（2026-04-30 ユーザー承認済み）

すべて上記「仕様確認事項」の想定通りで確定。

- 対象検索条件は `SearchFilterPanel.tsx` で扱える全条件（キーワード / 期間 / 投稿者 / チャンネル / タグ）
- 表示位置は `ChannelList` 配下に「お気に入り」「カテゴリ」と並ぶ専用セクションを追加
- スコープは個人専用（`user_id` で隔離）
- 件数上限なし（MVP）
- 並べ替え UI は **上下ボタンのみ**（DnD は実装しない）

## 影響範囲

### DB

- `db/schema.hcl` に新規テーブル `saved_views` 追加
  - `id serial pk`
  - `user_id integer not null fk users`
  - `name text not null`
  - `query jsonb not null` — 検索条件をシリアライズ
  - `position integer default 0`
  - `created_at` / `updated_at`
  - 一意制約: `(user_id, name)`

### Server

- `packages/server/src/services/savedViewService.ts`（**新規**）
- `packages/server/src/routes/savedViews.ts`（**新規**）
  - `GET /saved-views`
  - `POST /saved-views`
  - `PUT /saved-views/:id`
  - `DELETE /saved-views/:id`
  - `PUT /saved-views/order` — 並べ替え

### Client

- `packages/client/src/components/Chat/SearchFilterPanel.tsx` — 「現在の条件を保存」ボタン追加
- `packages/client/src/components/Channel/SavedViewSection.tsx`（**新規**） — サイドバーセクション
- `packages/client/src/components/Channel/ChannelList.tsx` — 保存ビューセクションを差し込む（追記のみ）
- 編集/並べ替えダイアログ（既存の `ChannelCategoryDialog` を参考に）

## 並列実行時の競合警戒

- **`ChannelList.tsx` への追記**: Phase 2 の #151 もサイドバーリンクを足す可能性があるため、両者ともファイル末尾近くに追記する形で衝突を最小化する。順序は merge で吸収可能。
- 検索条件の JSON 構造は `SearchFilterPanel` の state と一致させる必要がある。`SearchFilterPanel` の API を変える Issue が将来出る場合は、保存済みクエリのマイグレーションを考慮。

## 実装ポイント / 落とし穴

- **クエリ JSON のスキーマバリデーション**: サーバ側で受け取る `query` 列の中身を緩く扱う場合、不正値で検索が壊れる恐れ。最低限の zod / valibot 検証を入れる。
- **クエリ復元時の互換性**: 将来検索条件が増えたとき、保存済み JSON に新フィールドがなくても動作するよう既定値を定める。
- **並べ替え**: ドラッグ&ドロップを実装するか、上下ボタンで十分か確認。MVP は上下ボタンで十分。

## テスト観点

- ユニット
  - 作成・更新・削除・並べ替え
  - 同名保存ビューを 2 件作るとエラー
- 統合
  - 保存ビューを呼び出すと当該条件の検索結果が返る
- フロントエンド
  - サイドバーの保存ビュー項目クリックで検索結果が表示される
  - 編集ダイアログから名称変更できる

## ステータス（経過記録）

- 計画作成日: 2026-04-27
- ブランチ: -
- PR: -
- マージ: -
- 備考: -
