# #117 NG ワード / 添付制限 — 実行計画

- Issue: [#117](https://github.com/mokemoke2850/chat-app-for-claudecode-test/issues/117)
- 難易度: 中
- ブランチ: `feature/ng-words-attachment-blocklist/#117`

## 1. ゴール（受入条件）

- 管理者が **NG ワードリスト** を登録・管理できる
- 投稿時に NG ワードを検出した場合、以下のアクションから選択可能
  - **block** — 送信を拒否（既定）
  - **warn** — クライアントで警告ダイアログ表示（送信は可能）
- 添付ファイルの **拡張子ブラックリスト** を管理できる（例: `exe`, `bat`, `cmd`）
- ブラックリスト対象のアップロードは拒否される

## 2. 依存・前提

- 既存機能: `messageService.sendMessage`, `fileStorageService`（添付アップロード）, Admin routes
- 他 Issue との衝突: `messageService.sendMessage` で **#113 / #107 / #110 / #116 と衝突しやすい**。順序調整必要

## 3. スキーマ変更（`db/schema.hcl`）

```hcl
table "ng_words" {
  schema  = schema.public
  comment = "NG ワード"
  column "id"         { null = false, type = serial }
  column "pattern"    { null = false, type = text }   # 単純な文字列 or 正規表現
  column "is_regex"   { null = false, type = boolean, default = false }
  column "action"     { null = false, type = text, default = "block" }  # block / warn
  column "is_active"  { null = false, type = boolean, default = true }
  column "created_by" { null = true,  type = integer }
  column "created_at" { null = false, type = timestamptz, default = sql("NOW()") }
  column "updated_at" { null = false, type = timestamptz, default = sql("NOW()") }
  primary_key { columns = [column.id] }
  foreign_key "fk_ng_user" { columns = [column.created_by], ref_columns = [table.users.column.id], on_delete = SET_NULL, on_update = NO_ACTION }
  index "idx_ng_active" { columns = [column.is_active] }
}

table "attachment_blocklist" {
  schema  = schema.public
  comment = "添付拡張子ブロックリスト"
  column "id"         { null = false, type = serial }
  column "extension"  { null = false, type = text }   # ドット無しの小文字（exe, bat...）
  column "reason"     { null = true,  type = text }
  column "created_by" { null = true,  type = integer }
  column "created_at" { null = false, type = timestamptz, default = sql("NOW()") }
  primary_key { columns = [column.id] }
  foreign_key "fk_ablk_user" { columns = [column.created_by], ref_columns = [table.users.column.id], on_delete = SET_NULL, on_update = NO_ACTION }
  index "idx_ablk_ext" { unique = true, columns = [column.extension] }
}
```

## 4. shared types

```ts
// packages/shared/src/types/moderation.ts 新規
export type NgWordAction = 'block' | 'warn';
export interface NgWord {
  id: number; pattern: string; isRegex: boolean; action: NgWordAction;
  isActive: boolean; createdAt: string; updatedAt: string;
}
export interface BlockedExtension { id: number; extension: string; reason: string | null; createdAt: string; }
```

## 5. サーバー変更

### 新規ファイル
- `packages/server/src/services/moderationService.ts`
  - `listNgWords()` / `createNgWord(input, userId)` / `updateNgWord(id, input)` / `deleteNgWord(id)`
  - `listBlockedExtensions()` / `createBlockedExtension(ext, userId)` / `deleteBlockedExtension(id)`
  - `checkContent(content)` — 有効な NG ワードを先頭一致で評価し、`{ action: 'block'|'warn'|null, matched: string }` を返す
  - **キャッシュ**: 毎回 SELECT は重いので、プロセス内で 30 秒 TTL キャッシュ
- `packages/server/src/routes/moderation.ts`（admin サブルート）
  - CRUD: `/api/admin/ng-words`, `/api/admin/attachment-blocklist`

### 変更ファイル
- `packages/server/src/services/messageService.ts`
  - `sendMessage` 冒頭で `moderationService.checkContent`
    - `block` なら 400 返却
    - `warn` の扱い: サーバーでは送信許可、**レスポンスに `warning: string` を含める**。クライアント側で UX 実装
- `packages/server/src/services/fileStorageService.ts`（または `channelAttachmentsService`）
  - アップロード時に拡張子を抽出し、ブラックリスト照合
- `packages/server/src/socket/messageHandler.ts`
  - Socket 経由でも `checkContent` を必ず通す

### 監査ログ
- `moderation.ngword.create/update/delete`、`moderation.blocklist.add/remove` を記録

## 6. クライアント変更

### 変更ファイル
- `packages/client/src/pages/AdminPage.tsx`
  - 「モデレーション設定」タブを追加
  - NG ワード管理テーブル（pattern / is_regex / action / is_active の編集）
  - 拡張子ブロックリスト管理
- `packages/client/src/components/Chat/RichEditor.tsx`
  - 送信時にサーバーのレスポンスを確認し、`block` エラー or `warn` ならトースト表示
- `packages/client/src/api/client.ts`
  - `admin.ngWords.*` / `admin.blockedExtensions.*`

## 7. 実装手順

1. ブランチ作成
2. スキーマ変更 → atlas apply
3. shared types 追加
4. **テスト項目列挙**
   - server: `__tests__/moderation.test.ts`（NG ワード判定 / 添付拒否 / キャッシュ）
   - client: `AdminPage.test.tsx` 追記（モデレーション CRUD）、`MessageArea.test.tsx` 追記（送信拒否時のエラー表示）
5. **ユーザー確認**
6. テスト実装 → 実装 → build + test
7. PR 作成

## 8. テスト方針

### サーバー
- `block` ワードを含む投稿が 400 で拒否される
- `warn` ワードを含む投稿は送信成功、レスポンスに `warning` を含む
- `is_active = false` なワードは無視される
- 正規表現モード（`is_regex = true`）で動作する
- ブラックリスト拡張子のアップロードが拒否される（大文字拡張子も拒否）
- キャッシュ期限切れ後に変更が反映される

### クライアント
- Admin 管理画面での CRUD
- 送信時に `block` エラーを受けたら入力内容はそのまま残す（書き直しやすく）
- `warn` 時の警告ダイアログ

## 9. 注意点

- **正規表現の安全性**: ユーザー（管理者）入力の正規表現は ReDoS の危険。`safe-regex` などで事前検証するか、タイムアウトを設ける（Node には正規表現タイムアウトがないので **`RE2` ライブラリ** もしくは文字列一致のみ許可が無難）→ MVP は **文字列一致のみ** で実装し、`is_regex` は将来拡張としてスキーマだけ用意する選択肢も可
- **大文字・全角**: 正規化（lowercase + NFKC）してから照合する
- **パフォーマンス**: NG ワードが多数あると O(N*M) になる。初版は件数 200 以下想定。Aho–Corasick など高速化は将来

## 10. 見積もり / リスク

- 規模: 中（2 テーブル + CRUD + 送信経路のチェック）
- リスク: `messageService` への割り込みで他 Issue とコンフリクト。**#113 と同じブランチライフサイクル** で扱うことも検討
