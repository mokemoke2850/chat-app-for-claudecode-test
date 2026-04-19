# #109 通知設定のカスタマイズ — 実行計画

- Issue: [#109](https://github.com/mokemoke2850/chat-app-for-claudecode-test/issues/109)
- 難易度: 中
- ブランチ: `feature/channel-notification-settings/#109`

## 1. ゴール（受入条件）

- チャンネル単位で通知レベルを選択できる: `all`（全件）/ `mentions`（メンションのみ）/ `muted`（ミュート）
- デフォルトは `all`
- ユーザーごとに独立（チャンネルごとに他ユーザーの設定に影響しない）
- サイドバー（`ChannelItem`）から 1 クリックで変更可能（3 択のポップオーバー）
- ミュート中のチャンネルはサイドバーで **未読バッジを薄く/非表示** にする（視認性の調整）
- プッシュ通知・メンションバッジの発火が設定に従う

## 2. 依存・前提

- 既存機能: `pushService`, `mentionsテーブル`, `channel_read_status`
- 他 Issue との衝突: なし（`channel_members` とは別テーブルなので独立）

## 3. スキーマ変更（`db/schema.hcl`）

```hcl
table "channel_notification_settings" {
  schema  = schema.public
  comment = "チャンネル通知設定（ユーザー × チャンネル）"
  column "user_id"    { null = false, type = integer }
  column "channel_id" { null = false, type = integer }
  column "level"      { null = false, type = text, default = "all" }  # all / mentions / muted
  column "updated_at" { null = false, type = timestamptz, default = sql("NOW()") }
  primary_key { columns = [column.user_id, column.channel_id] }
  foreign_key "fk_cns_user" {
    columns = [column.user_id], ref_columns = [table.users.column.id],
    on_delete = CASCADE, on_update = NO_ACTION
  }
  foreign_key "fk_cns_channel" {
    columns = [column.channel_id], ref_columns = [table.channels.column.id],
    on_delete = CASCADE, on_update = NO_ACTION
  }
}
```

## 4. shared types

```ts
// packages/shared/src/types/channel.ts に追記
export type ChannelNotificationLevel = 'all' | 'mentions' | 'muted';
export interface ChannelNotificationSetting {
  channelId: number;
  level: ChannelNotificationLevel;
  updatedAt: string;
}
```

## 5. サーバー変更

### 新規ファイル
- `packages/server/src/services/channelNotificationService.ts`
  - `getForUser(userId)` — ユーザーの全設定 Map を返す
  - `set(userId, channelId, level)` — UPSERT
  - `getLevel(userId, channelId)` — 存在しなければ `'all'` を返す（内部 helper）

### 変更ファイル
- `packages/server/src/routes/channels.ts`
  - `GET /api/channels/notifications` — 自分の全設定取得
  - `PUT /api/channels/:id/notifications` — レベル更新（body: `{ level }`）
- `packages/server/src/services/pushService.ts`
  - 通知送信前に `getLevel(userId, channelId)` を呼ぶ
  - `'muted'` なら送信しない
  - `'mentions'` ならメンション対象者のみ送信
- `packages/server/src/socket/messageHandler.ts`
  - 通知・バッジ更新イベント発火前に同様のチェック

### 監査ログ

通知設定はユーザーの個人設定なので監査対象外。

## 6. クライアント変更

### 新規ファイル
- `packages/client/src/components/Channel/NotificationLevelMenu.tsx` — 3 択ラジオのポップオーバー
- `packages/client/src/hooks/useChannelNotifications.ts` — Map でキャッシュ、`use()` で初回解決

### 変更ファイル
- `packages/client/src/api/client.ts`
  - `channels.getNotifications()` / `channels.setNotificationLevel(channelId, level)`
- `packages/client/src/components/Channel/ChannelItem.tsx`
  - 右クリック or `⋮` アイコンでメニュー表示
  - ミュート時は名前をグレーで表示
- `packages/client/src/hooks/useMessages.ts` / `useMentions.ts`（存在すれば）
  - ミュート判定で未読バッジを非表示にする

## 7. 実装手順

1. ブランチ作成
2. `db/schema.hcl` 編集 → atlas apply
3. shared types 追加
4. **テスト項目列挙**
   - server: `__tests__/channelNotification.test.ts`、`pushService` 既存テストに「ミュート時は送信されない」を追記
   - client: `__tests__/NotificationLevelMenu.test.tsx`、`ChannelItem.test.tsx` 追記、`useChannelNotifications.test.ts`
5. **ユーザー確認**
6. テスト実装 → 実装 → build + test
7. PR 作成

## 8. テスト方針

### サーバー
- `level` バリデーション（`all` / `mentions` / `muted` 以外は 400）
- レコード未作成ユーザーの `getLevel` が `'all'` を返す
- UPSERT が冪等
- `pushService.sendToUser` がレベルに従って発火する/しない
- メンション通知がレベル `'mentions'` で送られ、`'muted'` で送られない

### クライアント
- メニュー操作で API が呼ばれる
- 反映後に `ChannelItem` のスタイルが変わる
- ミュート中はメンションバッジも非表示

## 9. 注意点

- **既存ユーザーのデフォルト**: テーブルにレコードがないユーザーは `'all'` と解釈する（row が無い＝未設定）。全ユーザー × 全チャンネル分のレコードを前もって生成しない（維持コスト増）
- プッシュ通知は非同期なので、設定変更の「即時反映」は多少遅れる可能性あり。ユーザー体験上問題ないレベル
- Socket 経由の `message:new` イベントは全員に流すが、**クライアント側でもミュート中は通知・バッジ増分をスキップ** する二重防御にすると安全

## 10. 見積もり / リスク

- 規模: 中（サーバー 1 service + 2 route、クライアント 2 コンポーネント + 1 hook + pushService の条件分岐）
- リスク: プッシュ通知の既存テストを壊す可能性 → `getLevel` の default-all 挙動を確実に担保する
