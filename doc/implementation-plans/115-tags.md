# #115 タグ機能 — 実行計画

- Issue: [#115](https://github.com/mokemoke2850/chat-app-for-claudecode-test/issues/115)
- 難易度: 中
- ブランチ: `feature/tags/#115`

## 1. ゴール（受入条件）

- メッセージまたはチャンネルに自由記述のタグ（例: `#bug`, `#idea`）を付与できる
- タグでフィルタリング・検索ができる（既存 `messageSearch` と統合、または独立エンドポイント）
- ワークスペース内でよく使われるタグを候補表示する（入力中の補完）
- タグ削除時は紐付け（`message_tags` / `channel_tags`）も削除される

## 2. 依存・前提

- 既存機能: `messageService`, `searchService`（あれば）, `MessageItem.tsx`
- 他 Issue との衝突: `messages` 周辺は #107 / #110 / #113 / #117 と衝突しやすい。`messages` 本体のカラムを増やさずジョイン方式にすれば影響は最小

## 3. スキーマ変更（`db/schema.hcl`）

```hcl
table "tags" {
  schema  = schema.public
  comment = "タグ（ワークスペース共有）"
  column "id"          { null = false, type = serial }
  column "name"        { null = false, type = text }                # 大文字小文字は保存時に lowerCase
  column "created_by"  { null = true,  type = integer }
  column "use_count"   { null = false, type = integer, default = 0 }
  column "created_at"  { null = false, type = timestamptz, default = sql("NOW()") }
  primary_key { columns = [column.id] }
  foreign_key "fk_tags_user" { columns = [column.created_by], ref_columns = [table.users.column.id], on_delete = SET_NULL, on_update = NO_ACTION }
  index "idx_tags_name" { unique = true, columns = [column.name] }
  index "idx_tags_use_count" { columns = [column.use_count] }
}

table "message_tags" {
  schema  = schema.public
  comment = "メッセージとタグの紐付け"
  column "message_id" { null = false, type = integer }
  column "tag_id"     { null = false, type = integer }
  column "created_at" { null = false, type = timestamptz, default = sql("NOW()") }
  column "created_by" { null = true,  type = integer }
  primary_key { columns = [column.message_id, column.tag_id] }
  foreign_key "fk_mt_message" { columns = [column.message_id], ref_columns = [table.messages.column.id], on_delete = CASCADE, on_update = NO_ACTION }
  foreign_key "fk_mt_tag"     { columns = [column.tag_id], ref_columns = [table.tags.column.id], on_delete = CASCADE, on_update = NO_ACTION }
  foreign_key "fk_mt_user"    { columns = [column.created_by], ref_columns = [table.users.column.id], on_delete = SET_NULL, on_update = NO_ACTION }
}

table "channel_tags" {
  schema  = schema.public
  comment = "チャンネルとタグの紐付け"
  column "channel_id" { null = false, type = integer }
  column "tag_id"     { null = false, type = integer }
  column "created_at" { null = false, type = timestamptz, default = sql("NOW()") }
  primary_key { columns = [column.channel_id, column.tag_id] }
  foreign_key "fk_ct_channel" { columns = [column.channel_id], ref_columns = [table.channels.column.id], on_delete = CASCADE, on_update = NO_ACTION }
  foreign_key "fk_ct_tag"     { columns = [column.tag_id], ref_columns = [table.tags.column.id], on_delete = CASCADE, on_update = NO_ACTION }
}
```

## 4. shared types

```ts
// packages/shared/src/types/tag.ts 新規
export interface Tag {
  id: number;
  name: string;
  useCount: number;
  createdAt: string;
}
export interface TagSuggestion { name: string; useCount: number; }
```

`Message` / `Channel` 型に `tags: Tag[]` を追加する（あるいは別取得）。

## 5. サーバー変更

### 新規ファイル
- `packages/server/src/services/tagService.ts`
  - `listSuggestions(prefix, limit)` — `use_count DESC, name ASC` の上位
  - `findOrCreate(name, userId)` — 小文字正規化
  - `attachToMessage(messageId, tagIds, userId)` / `detachFromMessage(messageId, tagIds)`
  - `attachToChannel(channelId, tagIds)` / `detachFromChannel(channelId, tagIds)`
  - `getForMessages(messageIds)` — N+1 回避の bulk fetch
- `packages/server/src/routes/tags.ts`
  - `GET /api/tags/suggestions?prefix=&limit=`
  - `POST /api/messages/:id/tags` `{ names: string[] }` — findOrCreate → attach
  - `DELETE /api/messages/:id/tags/:tagId`
  - 同様にチャンネル版

### 変更ファイル
- `packages/server/src/services/messageService.ts`
  - `list*` 系のレスポンスに `tags: Tag[]` を含める（bulk fetch で n+1 回避）
- `packages/server/src/services/searchService.ts`（もしくは相当箇所）
  - `MessageSearchFilters` に `tagIds?: number[]` を追加し、WHERE 句に `EXISTS (SELECT 1 FROM message_tags mt WHERE mt.message_id = m.id AND mt.tag_id = ANY($tagIds))` を差し込む

## 6. クライアント変更

### 新規ファイル
- `packages/client/src/components/Chat/TagChip.tsx` — クリックで検索にセット
- `packages/client/src/components/Chat/TagInput.tsx` — 補完候補付きの入力（Autocomplete）
- `packages/client/src/hooks/useTagSuggestions.ts`

### 変更ファイル
- `packages/client/src/components/Chat/MessageItem.tsx` — タグの表示・編集トグル
- `packages/client/src/components/Chat/SearchFilterPanel.tsx` — タグフィルタを追加
- `packages/client/src/components/Channel/CreateChannelDialog.tsx` / `ChannelTopicBar.tsx` — チャンネルタグの追加・表示
- `packages/client/src/api/client.ts` — `tags.suggestions` / `messages.setTags` / `channels.setTags`

## 7. 実装手順

1. ブランチ作成
2. スキーマ変更 → atlas apply
3. shared types 追加
4. **テスト項目列挙**
   - server: `__tests__/tag.test.ts`、既存 `advanced-search.test.ts` に「タグフィルタ」を追記
   - client: `TagInput.test.tsx` / `MessageItem.test.tsx` 追記 / `SearchFilterPanel.test.tsx` 追記
5. **ユーザー確認**
6. テスト実装 → 実装 → build + test
7. PR 作成

## 8. テスト方針

### サーバー
- タグ名の **正規化**（前後空白除去、小文字化）
- 同名タグは重複せず `findOrCreate` が既存 ID を返す
- 付与/解除で `use_count` が増減する（またはトリガーやサービス層で更新）
- `GET /api/tags/suggestions` が use_count 降順で返る
- メッセージ検索で tagIds フィルタが効く
- 他人のメッセージに対する付与可否（**作成者のみ付与可能** とするか全員可能とするかは仕様決定）→ **チャンネルメンバーなら誰でも付与可能** を推奨

### クライアント
- Autocomplete で候補が表示される
- Enter で確定、Backspace で直近チップを削除
- メッセージ削除時にタグチップも消える（サーバー CASCADE の結果）

## 9. 注意点

- **use_count** の整合性: レースコンディションで狂う可能性。`count_tags()` のような再計算ジョブを夜間に回す or `COUNT(*)` で毎回算出（負荷次第）→ 初版は `UPDATE tags SET use_count = use_count + 1` で OK
- **タグ名の最大長**: 50 文字上限、`[^\s#]` の制約
- **検索統合**: 既存の `MessageSearchFilters` を拡張するので、`SearchFilterPanel` 全体のテストが影響する可能性あり
- Channel タグの用途が曖昧（カテゴリとの違い）なので、**実装は任意** として Issue に合わせて MVP はメッセージタグのみでも可

## 10. 見積もり / リスク

- 規模: 中〜大（3 テーブル + UI 複数箇所）
- リスク: 既存メッセージ API のレスポンス変更で型エラー波及 → `tags` を **optional** で追加するとリスク減
