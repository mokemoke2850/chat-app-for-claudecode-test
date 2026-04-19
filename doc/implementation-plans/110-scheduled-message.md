# #110 予約送信 — 実行計画

- Issue: [#110](https://github.com/mokemoke2850/chat-app-for-claudecode-test/issues/110)
- 難易度: 中
- ブランチ: `feature/scheduled-message/#110`

## 1. ゴール（受入条件）

- メッセージ入力欄から **送信日時（未来）** を指定して予約できる
- 予約済みメッセージ一覧を確認・編集・キャンセルできる
- 指定時刻になると自動でチャンネルへ投稿され、通常の `message:new` として全員に配信される
- 添付ファイル付きメッセージも予約可能（`message_attachments.message_id` を後付けで紐付け）
- 失敗時はユーザーに通知（エラー理由を `scheduled_messages.error` に保存）

## 2. 依存・前提

- 既存機能: `messageService.sendMessage`, `RichEditor`, `message_attachments`
- 他 Issue との衝突: `messageService` は #113 / #117 と同時変更しやすい。**#113 / #117 を先にマージ** してから着手するとコンフリクト回避

## 3. スキーマ変更（`db/schema.hcl`）

```hcl
table "scheduled_messages" {
  schema  = schema.public
  comment = "予約送信メッセージ"
  column "id"             { null = false, type = serial }
  column "user_id"        { null = false, type = integer }
  column "channel_id"     { null = false, type = integer }
  column "content"        { null = false, type = text }
  column "scheduled_at"   { null = false, type = timestamptz }
  column "status"         { null = false, type = text, default = "pending" }  # pending / sent / failed / canceled
  column "error"          { null = true,  type = text }
  column "sent_message_id"{ null = true,  type = integer }
  column "created_at"     { null = false, type = timestamptz, default = sql("NOW()") }
  column "updated_at"     { null = false, type = timestamptz, default = sql("NOW()") }
  primary_key { columns = [column.id] }
  foreign_key "fk_sched_user"    { columns = [column.user_id], ref_columns = [table.users.column.id], on_delete = CASCADE, on_update = NO_ACTION }
  foreign_key "fk_sched_channel" { columns = [column.channel_id], ref_columns = [table.channels.column.id], on_delete = CASCADE, on_update = NO_ACTION }
  foreign_key "fk_sched_sent"    { columns = [column.sent_message_id], ref_columns = [table.messages.column.id], on_delete = SET_NULL, on_update = NO_ACTION }
  index "idx_sched_pending"      { columns = [column.status, column.scheduled_at] }
}
```

添付ファイルは `message_attachments.scheduled_message_id` を追加してもよい。

```hcl
# message_attachments テーブルに追加
column "scheduled_message_id" {
  null    = true
  type    = integer
  comment = "予約送信メッセージID（NULL = 通常添付）"
}
foreign_key "fk_attachments_scheduled" {
  columns = [column.scheduled_message_id], ref_columns = [table.scheduled_messages.column.id],
  on_delete = CASCADE, on_update = NO_ACTION
}
```

## 4. shared types

```ts
// packages/shared/src/types/scheduledMessage.ts 新規
export type ScheduledMessageStatus = 'pending' | 'sent' | 'failed' | 'canceled';
export interface ScheduledMessage {
  id: number;
  userId: number;
  channelId: number;
  content: string;
  scheduledAt: string;
  status: ScheduledMessageStatus;
  error: string | null;
  sentMessageId: number | null;
  attachments: Attachment[];
  createdAt: string;
  updatedAt: string;
}
export interface CreateScheduledMessageInput {
  channelId: number;
  content: string;
  scheduledAt: string;
  attachmentIds?: number[];
}
```

## 5. サーバー変更

### 新規ファイル

- `packages/server/src/services/scheduledMessageService.ts`
  - `list(userId)` / `create(userId, input)` / `update(userId, id, input)` / `cancel(userId, id)` / `pickDue(limit)` / `markSent(id, messageId)` / `markFailed(id, error)`
- `packages/server/src/routes/scheduledMessages.ts`
  - `GET /api/scheduled-messages` / `POST /api/scheduled-messages` / `PATCH /api/scheduled-messages/:id` / `DELETE /api/scheduled-messages/:id`
- `packages/server/src/jobs/scheduledMessageWorker.ts`
  - `setInterval` で 30 秒ごとに `scheduled_at <= NOW() AND status = 'pending'` をピック → `messageService.sendMessage` を呼ぶ → Socket で `message:new` を emit
  - トランザクションで `pending → sent` をアトミックに UPDATE（先にステータスを `sending` に変えて二重送信防止）

### 変更ファイル
- `packages/server/src/index.ts` — アプリ起動時に worker を起動（`if (process.env.NODE_ENV !== 'test')` でテスト時のみ抑止）
- `packages/server/src/services/messageService.ts` — 予約経由の呼び出し用に `sendMessageFromScheduled(scheduledId)` を追加（または既存 `sendMessage` を再利用）

### 監査ログ
- 予約送信は通常のメッセージ送信として監査ログ（既存分）に記録されるため追加は不要。ただし「予約失敗」は `message.schedule.failed` として記録してもよい

## 6. クライアント変更

### 新規ファイル
- `packages/client/src/components/Chat/ScheduleSendButton.tsx` — 送信ボタン横のアイコン。クリックで日時ピッカーを開く
- `packages/client/src/components/Chat/ScheduledMessagesDialog.tsx` — 予約一覧（編集・キャンセル可能）
- `packages/client/src/hooks/useScheduledMessages.ts`

### 変更ファイル
- `packages/client/src/components/Chat/RichEditor.tsx`
  - `ScheduleSendButton` を組み込み、予約時は `onSend` の代わりに `onSchedule(datetime)` を呼ぶ
- `packages/client/src/pages/ChatPage.tsx`
  - サイドバー or ヘッダーから `ScheduledMessagesDialog` を開く
- `packages/client/src/api/client.ts`
  - `scheduledMessages.list()` / `create(input)` / `update(id, input)` / `cancel(id)`

## 7. 実装手順

1. ブランチ作成
2. スキーマ変更 → atlas apply
3. shared types 追加
4. **テスト項目列挙**
   - server: `__tests__/scheduledMessage.test.ts`（CRUD + worker ピック + 送信）
   - client: `ScheduleSendButton.test.tsx` / `ScheduledMessagesDialog.test.tsx`
5. **ユーザー確認**
6. テスト実装 → 実装 → build + test
7. PR 作成

## 8. テスト方針

### サーバー
- 過去日時の予約は 400
- 予約済みメッセージのキャンセル後は `status = canceled` になり、worker がピックしない
- worker が `scheduled_at <= NOW()` のレコードだけを対象にする
- 送信成功時に `status = sent` / `sent_message_id` が埋まる
- 送信失敗（例: チャンネル削除済み）で `status = failed` / `error` が埋まる
- 他人の予約を編集・削除できない

### クライアント
- 日時ピッカーで未来時刻を選ぶと `api.scheduledMessages.create` が呼ばれる
- 予約一覧で編集・キャンセルが反映される
- 予約時にスナックバー「〜に予約しました」が出る（`doc/snackbar-spec.md` 準拠）

## 9. 注意点

- **二重送信防止**: worker はマルチプロセス想定を今はしないが、`UPDATE ... WHERE status='pending'` のアトミック性で保護
- **タイムゾーン**: 入力値は UTC へ変換して保存。UI は端末ローカル TZ で表示
- **冪等性**: 送信失敗時のリトライはしない（手動で再度予約し直す方針）。将来リトライを追加するなら `retry_count` カラムを検討
- **worker 停止時の未送信**: 起動時に `pending AND scheduled_at <= NOW()` を即時処理する
- 添付ファイルの扱いが複雑なので、**初版は添付なしで実装** → 次 PR で添付対応、とステップを分けるのも有効（PR 規模を小さくできる）

## 10. 見積もり / リスク

- 規模: 中〜大（worker + CRUD + UI）
- リスク: worker の起動／テスト分離。テストでは worker を起動せず、`pickDue` → `messageService.sendMessage` の単体テストで担保する
