# #116 通報 / モデレーションキュー — 実行計画

- Issue: [#116](https://github.com/mokemoke2850/chat-app-for-claudecode-test/issues/116)
- 難易度: 中
- ブランチ: `feature/moderation-queue/#116`

## 1. ゴール（受入条件）

- メッセージのコンテキストメニュー（`MessageActions`）から通報できる
- 通報時に理由を選択（`spam` / `harassment` / `other` + 任意コメント）
- 管理者画面（`AdminPage`）に **モデレーションキュー** タブを追加
- キューで各通報を確認し、以下の対応を取れる
  - `dismiss` — 却下（そのまま残す）
  - `delete_message` — 該当メッセージを削除
  - `warn_user` — ユーザーに警告（MVP は削除のみでもよい）
- 1 メッセージに複数通報が付く場合はキュー上でグループ化表示（任意）

## 2. 依存・前提

- 既存機能: `messageService`, `MessageActions.tsx`, Admin 周辺
- 他 Issue との衝突: `MessageActions.tsx` で **#107（転送）と競合**、`AdminPage.tsx` で **#117 / #118 と競合**

## 3. スキーマ変更（`db/schema.hcl`）

```hcl
table "message_reports" {
  schema  = schema.public
  comment = "メッセージ通報"
  column "id"            { null = false, type = serial }
  column "message_id"    { null = false, type = integer }
  column "reporter_id"   { null = true,  type = integer }
  column "reason"        { null = false, type = text }    # spam / harassment / other
  column "comment"       { null = true,  type = text }
  column "status"        { null = false, type = text, default = "pending" }  # pending / dismissed / actioned
  column "action_taken"  { null = true,  type = text }    # delete_message / warn_user / ...
  column "handled_by"    { null = true,  type = integer }
  column "handled_at"    { null = true,  type = timestamptz }
  column "created_at"    { null = false, type = timestamptz, default = sql("NOW()") }
  primary_key { columns = [column.id] }
  foreign_key "fk_rep_message"  { columns = [column.message_id], ref_columns = [table.messages.column.id], on_delete = CASCADE, on_update = NO_ACTION }
  foreign_key "fk_rep_reporter" { columns = [column.reporter_id], ref_columns = [table.users.column.id], on_delete = SET_NULL, on_update = NO_ACTION }
  foreign_key "fk_rep_handler"  { columns = [column.handled_by], ref_columns = [table.users.column.id], on_delete = SET_NULL, on_update = NO_ACTION }
  index "idx_reports_status" { columns = [column.status, column.created_at] }
  index "idx_reports_message_reporter" { unique = true, columns = [column.message_id, column.reporter_id] }  # 同一ユーザーの重複通報防止
}
```

## 4. shared types

```ts
// packages/shared/src/types/moderation.ts に追記（または新規）
export type ReportReason = 'spam' | 'harassment' | 'other';
export type ReportStatus = 'pending' | 'dismissed' | 'actioned';
export interface MessageReport {
  id: number; messageId: number; reporterId: number | null; reporterUsername: string | null;
  reason: ReportReason; comment: string | null;
  status: ReportStatus; actionTaken: string | null;
  handledBy: number | null; handledAt: string | null;
  createdAt: string;
}
export interface ReportMessageInput { reason: ReportReason; comment?: string; }
```

## 5. サーバー変更

### 新規ファイル
- `packages/server/src/services/moderationReportService.ts`
  - `report(userId, messageId, input)` — 同一 (messageId, reporterId) が既にあれば 409 Conflict or 冪等扱い
  - `listQueue(filter)` — 管理者用
  - `dismiss(id, userId)` / `actionDelete(id, userId)` — トランザクションで message を `is_deleted = true` にしつつレポートも `actioned` に
- `packages/server/src/routes/messages.ts`
  - `POST /api/messages/:id/report` — 認証ユーザー（自分のメッセージには通報不可）
- `packages/server/src/routes/admin.ts`
  - `GET /api/admin/reports` / `POST /api/admin/reports/:id/dismiss` / `POST /api/admin/reports/:id/action`

### 監査ログ
- `report.create` / `report.dismiss` / `report.action.delete_message` を `AuditActionType` に追加

## 6. クライアント変更

### 新規ファイル
- `packages/client/src/components/Chat/ReportMessageDialog.tsx`
- `packages/client/src/components/Admin/ModerationQueue.tsx`

### 変更ファイル
- `packages/client/src/components/Chat/MessageActions.tsx`
  - 「通報」メニュー追加（自分のメッセージは非表示）
- `packages/client/src/pages/AdminPage.tsx`
  - タブに「通報キュー」を追加
- `packages/client/src/api/client.ts`
  - `messages.report(id, input)` / `admin.reports.list` / `admin.reports.dismiss` / `admin.reports.action`

## 7. 実装手順

1. ブランチ作成
2. スキーマ変更 → atlas apply
3. shared types 追加
4. **テスト項目列挙**
   - server: `__tests__/moderationReport.test.ts`（通報・却下・アクション削除）
   - client: `ReportMessageDialog.test.tsx` / `ModerationQueue.test.tsx` / `AdminPage.test.tsx` 追記
5. **ユーザー確認**
6. テスト実装 → 実装 → build + test
7. PR 作成

## 8. テスト方針

### サーバー
- 自分のメッセージを通報すると 400
- 同一メッセージへの二重通報は 409（または既存レコード返却で冪等）
- 管理者以外は `/api/admin/reports` に 403
- `action.delete_message` 後に該当メッセージが `is_deleted = true`
- 通報が監査ログに記録される

### クライアント
- 通報ダイアログの理由選択 + コメント + 送信
- モデレーションキューの一覧・対応操作
- 対応済みは `status = actioned/dismissed` として表示切替

## 9. 注意点

- **プライバシー**: 通報者の ID は管理者にのみ見えるようにする（他ユーザーから不可視）
- **グループ化表示**: 同一メッセージへの複数通報は 1 行にまとめて人数表示すると UX 向上（初版は個別行でも可）
- **通報者への結果通知**: スコープ外でよい

## 10. 見積もり / リスク

- 規模: 中
- リスク: `MessageActions.tsx` / `AdminPage.tsx` で #107 / #117 / #118 との同時変更。**後発 PR がリベースで調整** する運用で対応
