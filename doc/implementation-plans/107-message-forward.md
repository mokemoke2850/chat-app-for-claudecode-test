# #107 メッセージ転送 — 実行計画

- Issue: [#107](https://github.com/mokemoke2850/chat-app-for-claudecode-test/issues/107)
- 難易度: 中
- ブランチ: `feature/message-forward/#107`

## 1. ゴール（受入条件）

- メッセージのコンテキストメニュー（`MessageActions`）に「転送」を追加
- 転送ダイアログでチャンネル or DM を選択できる
- 元メッセージが引用として付与される（既存 `quoted_message_id` と同じ表示）
- 任意のコメントを添えて転送できる
- 元メッセージが削除されても転送後のメッセージは残る（スナップショット保持）
- 添付は **転送しない**（リンクではなくチャンネル内のコピーを前提にすると権限問題が発生するため）※ Issue で要確認

## 2. 依存・前提

- 既存機能: `quoted_message_id`（引用返信 #57）、`MessageActions.tsx`、`DM` 機能（#43）
- 他 Issue との衝突: `MessageActions.tsx` で **#116（通報）と競合**、`messageService` 送信経路で **#113 / #117** と競合

## 3. スキーマ変更（`db/schema.hcl`）

```hcl
# messages テーブルに追加
column "forwarded_from_message_id" {
  null    = true
  type    = integer
  comment = "転送元メッセージID（NULL = 転送でない）"
}
foreign_key "fk_messages_forwarded" {
  columns     = [column.forwarded_from_message_id]
  ref_columns = [table.messages.column.id]
  on_update   = NO_ACTION
  on_delete   = SET_NULL
}
```

> DM 側も転送先として扱うなら `dm_messages` にも同様のカラムを追加するか、統一のためチャンネルに自動作成される「DM 代替チャンネル」を使う。**MVP はチャンネル間転送に限定**しても Issue の受入は満たせる。

## 4. shared types

```ts
// Message に追加
forwardedFromMessageId?: number | null;
forwardedFromMessage?: QuotedMessage | null;  // 既存 QuotedMessage を流用
// ForwardMessageInput 新規
export interface ForwardMessageInput {
  targetChannelId?: number;
  targetDmConversationId?: number;
  comment?: string;
}
```

## 5. サーバー変更

### 変更ファイル

- `packages/server/src/services/messageService.ts`
  - `forwardMessage(userId, sourceMessageId, input)` を追加
    - 権限チェック: 元メッセージのチャンネルのメンバーであること、転送先のチャンネルのメンバーかつ `posting_permission`（#113 実装後）を満たすこと
    - 既存 `sendMessage` を呼び、`forwarded_from_message_id = sourceMessageId`、`content = comment ?? ''` で insert
    - `quoted_message_id` に元メッセージ ID を入れるか、独立カラムで扱うかは設計判断（**両方を埋める** と UI 側で既存の引用表示が流用できる）
  - `list*` 系の `MESSAGE_SELECT` に `forwarded_from_message_id` + JOIN を追加（既存の `quoted_message_id` と同パターン）

- `packages/server/src/routes/messages.ts`
  - `POST /api/messages/:id/forward` `{ targetChannelId?, targetDmConversationId?, comment? }` → 転送後の `Message` を返す

- Socket: `message:new` を転送先チャンネルへ emit（既存の sendMessage 経路を通すので追加実装不要）

### 監査ログ
- 特に追加しなくてよい（通常の投稿として記録される）。必要なら `message.forward` を追加

## 6. クライアント変更

### 新規ファイル
- `packages/client/src/components/Chat/ForwardMessageDialog.tsx`
  - チャンネル一覧 + DM 会話一覧を検索可能なリスト
  - コメント入力欄
  - 送信ボタン

### 変更ファイル
- `packages/client/src/components/Chat/MessageActions.tsx`
  - 「転送」メニューを追加（#116 の「通報」と共存できるように順序決定）
- `packages/client/src/components/Chat/MessageItem.tsx`
  - `forwardedFromMessage` を使って「○○さんが転送」ヘッダーを表示
  - 本体は既存 `QuotedMessageBanner` を流用
- `packages/client/src/api/client.ts`
  - `messages.forward(messageId, input)`

## 7. 実装手順

1. ブランチ作成
2. スキーマ変更 → atlas apply
3. shared types 追加
4. **テスト項目列挙**
   - server: `__tests__/messageForward.test.ts`（正常系 / 転送先未加入 / 元メッセージ削除後の表示）
   - client: `ForwardMessageDialog.test.tsx`、`MessageItem.test.tsx` 追記、`MessageActions.test.tsx` 追記
5. **ユーザー確認**
6. テスト実装 → 実装 → build + test
7. PR 作成

## 8. テスト方針

### サーバー
- メンバーでないチャンネルへの転送は 403
- 転送先に元メッセージの添付は **コピーされない**（MVP）
- 元メッセージ削除後も `forwardedFromMessage.content` が保存スナップショットで表示できる（※ スナップショット保持を採用する場合は専用テーブルか `content_snapshot` カラムが必要。採用しないなら JOIN 結果が null で「削除された投稿」と表示）
- DM 転送も同様に動く

### クライアント
- ダイアログのチャンネル/DM 切替
- 選択後にコメント入力 → 送信で API 呼び出し
- 転送メッセージに「○○ が転送」ヘッダーが表示される

## 9. 注意点

- **スナップショット保持の方針**: 元メッセージが後から削除・編集されたとき、転送先にどう反映するかを決める
  - **方針 A**: 転送先は常に元メッセージを JOIN で参照（削除されたら空になる）
  - **方針 B**: `content_snapshot_*` カラムを追加して転送時点のスナップショットを保持
  - **推奨**: 方針 A（シンプル、編集が反映される）
- `quoted_message_id` と `forwarded_from_message_id` を両方埋めると UI が混乱する可能性がある。**どちらか片方のみ使う** か、UI で明確に区別
- DM への転送は初版スコープ外でもよい。段階実装を推奨

## 10. 見積もり / リスク

- 規模: 中
- リスク: `MessageActions` の並び・デザインが #116 と干渉。**先にマージされた方** の UI に合わせて後発は微調整
