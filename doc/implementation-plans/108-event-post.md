# #108 会話イベント投稿 — 実行計画

- Issue: [#108](https://github.com/mokemoke2850/chat-app-for-claudecode-test/issues/108)
- 難易度: 中
- ブランチ: `feature/event-post/#108`

## 1. ゴール（受入条件）

- チャンネル内にイベント（日時・タイトル・説明）を投稿できる（通常メッセージの特殊形として扱う）
- メンバーが「参加する / 不参加 / 未定」を選択できる（1 人 1 レコード、更新可）
- イベントメッセージ上で 3 種類の集計と参加者一覧を確認できる
- 既存のメッセージ表示と同じタイムライン上に溶け込む（添付ブロックのようなリッチコンポーネントで表示）

## 2. 依存・前提

- 既存機能: `messageService`, `MessageItem.tsx`
- 他 Issue との衝突: `MessageItem.tsx` は複数 Issue で触るので UI 部分は最後にマージするか、描画分岐を `event` に閉じる

## 3. スキーマ変更（`db/schema.hcl`）

```hcl
table "events" {
  schema  = schema.public
  comment = "会話イベント"
  column "id"          { null = false, type = serial }
  column "message_id"  { null = false, type = integer }   # 関連するイベント投稿メッセージ
  column "title"       { null = false, type = text }
  column "description" { null = true,  type = text }
  column "starts_at"   { null = false, type = timestamptz }
  column "ends_at"     { null = true,  type = timestamptz }
  column "created_by"  { null = true,  type = integer }
  column "created_at"  { null = false, type = timestamptz, default = sql("NOW()") }
  column "updated_at"  { null = false, type = timestamptz, default = sql("NOW()") }
  primary_key { columns = [column.id] }
  foreign_key "fk_events_message" { columns = [column.message_id], ref_columns = [table.messages.column.id], on_delete = CASCADE, on_update = NO_ACTION }
  foreign_key "fk_events_user"    { columns = [column.created_by], ref_columns = [table.users.column.id], on_delete = SET_NULL, on_update = NO_ACTION }
  index "idx_events_message" { unique = true, columns = [column.message_id] }
  index "idx_events_starts_at" { columns = [column.starts_at] }
}

table "event_rsvps" {
  schema  = schema.public
  comment = "イベント参加可否"
  column "event_id"   { null = false, type = integer }
  column "user_id"    { null = false, type = integer }
  column "status"     { null = false, type = text }   # going / not_going / maybe
  column "updated_at" { null = false, type = timestamptz, default = sql("NOW()") }
  primary_key { columns = [column.event_id, column.user_id] }
  foreign_key "fk_rsvp_event" { columns = [column.event_id], ref_columns = [table.events.column.id], on_delete = CASCADE, on_update = NO_ACTION }
  foreign_key "fk_rsvp_user"  { columns = [column.user_id], ref_columns = [table.users.column.id], on_delete = CASCADE, on_update = NO_ACTION }
}
```

## 4. shared types

```ts
// packages/shared/src/types/event.ts 新規
export type RsvpStatus = 'going' | 'not_going' | 'maybe';
export interface ChatEvent {
  id: number; messageId: number; title: string; description: string | null;
  startsAt: string; endsAt: string | null; createdBy: number | null;
  createdAt: string; updatedAt: string;
  rsvpCounts: { going: number; notGoing: number; maybe: number };
  myRsvp: RsvpStatus | null;
}
export interface CreateEventInput {
  channelId: number;
  title: string;
  description?: string;
  startsAt: string;
  endsAt?: string;
}
```

`Message` にも `event?: ChatEvent | null` を追加してタイムラインで同時取得できるようにする。

## 5. サーバー変更

### 新規ファイル
- `packages/server/src/services/eventService.ts`
  - `create(userId, input)` — まず `messageService.sendMessage` で type 付きメッセージを作成し、その `message_id` で `events` を insert
  - `update(userId, id, input)` / `delete(userId, id)`（作成者のみ）
  - `setRsvp(userId, eventId, status)`
  - `getByMessageId(messageId)` — メッセージ取得時のバルクロード用 `getByMessageIds`
- `packages/server/src/routes/events.ts`
  - `POST /api/events` / `PATCH /api/events/:id` / `DELETE /api/events/:id` / `POST /api/events/:id/rsvp`

### 変更ファイル
- `packages/server/src/services/messageService.ts`
  - `list*` 系で `events` を LEFT JOIN し、`event` フィールドを埋める（n+1 回避で bulk fetch）
- Socket: `event:rsvp_updated` を発火して即時集計更新

## 6. クライアント変更

### 新規ファイル
- `packages/client/src/components/Chat/EventCard.tsx` — メッセージ内に表示するイベントカード（タイトル、日時、集計、RSVP ボタン）
- `packages/client/src/components/Chat/CreateEventDialog.tsx` — 日時ピッカー + タイトル + 説明

### 変更ファイル
- `packages/client/src/components/Chat/MessageItem.tsx`
  - `message.event` が存在するとき `EventCard` を表示
- `packages/client/src/components/Chat/RichEditor.tsx`
  - スラッシュコマンド `/event` で作成ダイアログを開く
- `packages/client/src/api/client.ts`
  - `events.create` / `update` / `delete` / `setRsvp`

## 7. 実装手順

1. ブランチ作成
2. スキーマ変更 → atlas apply
3. shared types 追加
4. **テスト項目列挙**
   - server: `__tests__/event.test.ts`（作成 / RSVP / 集計）
   - client: `EventCard.test.tsx`、`CreateEventDialog.test.tsx`、`MessageItem.test.tsx` 追記
5. **ユーザー確認**
6. テスト実装 → 実装 → build + test
7. PR 作成

## 8. テスト方針

### サーバー
- `starts_at` は `ends_at` より前
- RSVP が冪等（同一ユーザーが連続で POST しても重複しない）
- 集計値が正しい（各ステータスの COUNT）
- 作成者以外は update / delete できない

### クライアント
- カード上でボタンクリックで RSVP 更新
- Socket 経由で集計がリアルタイム更新される
- `/event` コマンドでダイアログが開く

## 9. 注意点

- **イベント更新時のメッセージ本文**: メッセージ本文には「〜イベント作成」などの短いプレースホルダを入れ、ビジュアルは EventCard で描画する
- **繰り返しイベント**: スコープ外（将来拡張）
- **参加者通知**: RSVP 変更で主催者にメンション通知するのは任意機能

## 10. 見積もり / リスク

- 規模: 中〜大（新規 2 テーブル + 独自カード UI）
- リスク: メッセージ API レスポンスに `event` フィールドを追加する影響範囲。`optional` にして既存テストを壊さない
