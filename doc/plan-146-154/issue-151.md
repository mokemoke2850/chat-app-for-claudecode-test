# Issue #151 — feat: タスク管理ボード

> Phase 2 / 並列OK / 難易度: 中

## 概要

メッセージからタスク化し、担当者・期限・進捗を管理するカンバンボード。

- メッセージのコンテキストメニューから「タスク化」
- 担当者 / 期限 / ステータス（未着手・進行中・完了）
- カンバン形式で一覧・並べ替え

## 仕様確認事項

- **タスクのスコープ**: ワークスペース全体共有か、チャンネル単位か、個人専用か。issue 文からは「ワークスペース全体で見える共有」が読み取れる。MVP はワークスペース全体共有とし、誰でも参照・編集可。
- **担当者**: 単数 / 複数 のいずれか。MVP は単数想定。
- **メッセージとの関連**: タスクから元メッセージへ戻れる導線が必要。タスクに `source_message_id` を保持。
- **カンバンの列**: 固定 3 列（未着手 / 進行中 / 完了）か、ユーザーが列を増やせるか。MVP は固定 3 列。
- **チャンネル絞り込み表示**: 特定チャンネル発のタスクだけ抽出する UI が必要か。

## 仕様確定（2026-04-30 ユーザー承認済み）

- スコープ: **ワークスペース全体共有**（誰でも参照・編集可）
- 担当者: **単数**
- メッセージとの関連: タスクに `source_message_id` 保持。タスクから元メッセージに戻れる導線を提供
- カンバン列: **固定 3 列**（未着手 / 進行中 / 完了）。ユーザーによる列追加は不可
- 同時編集: **ポーリング or 操作後再フェッチ**で十分（MVP では Socket ブロードキャスト不要）
- **DnD ライブラリ**: `@dnd-kit/core` ^6.3.1 / `@dnd-kit/sortable` ^10.0.0 を使用（**main の `packages/client/package.json` に既に導入済み**。追加インストール不要）
- **チャンネル絞り込み UI**: **MVP に含める**（特定チャンネル発のタスクだけ抽出する UI が必要）

## 影響範囲

### DB

- `db/schema.hcl` に新規テーブル `tasks` 追加
  - `id serial pk`
  - `title text not null`
  - `description text null`
  - `status text not null default 'todo'` — todo / in_progress / done
  - `assignee_id integer null fk users`
  - `due_at timestamptz null`
  - `source_message_id integer null fk messages`
  - `created_by integer null fk users`
  - `position integer default 0` — 同一ステータス内の並び順
  - `created_at` / `updated_at`

### Server

- `packages/server/src/services/taskService.ts`（**新規**）
- `packages/server/src/routes/tasks.ts`（**新規**）
  - `GET /tasks`（フィルタ: status, assignee, channel）
  - `POST /tasks`
  - `PATCH /tasks/:id`
  - `DELETE /tasks/:id`
  - `PUT /tasks/order` — 並べ替え

### Client

- `packages/client/src/pages/TaskBoardPage.tsx`（**新規**） — カンバン UI
- `packages/client/src/components/Chat/MessageActions.tsx` — 「タスク化」メニュー追加
- `packages/client/src/components/Task/CreateTaskDialog.tsx`（**新規**）
- `packages/client/src/components/Layout/AppLayout.tsx` — 「タスクボード」ナビ追加
- ルーティング追加 `/tasks`

## 並列実行時の競合警戒

- **`MessageActions.tsx` を編集する Issue は #151 のみ**（Phase 2 内では他なし）。
- `AppLayout.tsx` のナビ追加は #150 / #152 でも追記する可能性があり、追記位置を末尾近くに揃えれば衝突最小化。
- DnD ライブラリ（react-dnd / @dnd-kit など）を新規導入する場合、`package.json` の依存追加が他 Issue と衝突する可能性あり。Phase 2 開始時に先行追加するか、HTML5 標準 DnD で割り切るか方針決定。

## 実装ポイント / 落とし穴

- **並べ替え整合性**: カンバン内のドラッグでステータスと position を同時更新。トランザクションで排他制御。
- **複数ユーザー同時編集**: Socket でブロードキャストするか、ポーリングで割り切るか。MVP はポーリング or 操作後に再フェッチで十分。
- **削除されたメッセージへのリンク**: `source_message_id` の参照先が `is_deleted` だった場合のフォールバック表示。
- **期限超過の視覚化**: 期限切れタスクを赤くハイライトするなど、共通コンポーネントで判定。

## テスト観点

- ユニット
  - タスク作成・更新・削除・並べ替え
  - メッセージから生成された場合、`source_message_id` が保持される
- 統合
  - ステータス変更で position が再計算される
- フロントエンド
  - カンバンに 3 列が表示される
  - メッセージのコンテキストメニューから作成ダイアログが開く

## ステータス（経過記録）

- 計画作成日: 2026-04-27
- ブランチ: -
- PR: -
- マージ: -
- 備考: -
