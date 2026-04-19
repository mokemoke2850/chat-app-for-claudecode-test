# #111 メッセージテンプレート / 定型文 — 実行計画

- Issue: [#111](https://github.com/mokemoke2850/chat-app-for-claudecode-test/issues/111)
- 難易度: 低
- ブランチ: `feature/message-templates/#111`

## 1. ゴール（受入条件）

- ユーザーが任意のテンプレート（タイトル + 本文）を登録・編集・削除・並び替えできる
- メッセージ入力中に **スラッシュコマンド `/tpl`** もしくはツールバーボタンでテンプレート選択ダイアログを開ける
- 選択したテンプレートが RichEditor の本文へ挿入される（既存文字列は保持）
- テンプレートは **ユーザー単位で独立**（ワークスペース共有は対象外）

## 2. 依存・前提

- 既存機能: `RichEditor.tsx`（Quill ベース）、`MentionDropdown.tsx` のショートカット検知ロジック
- 他 Issue との衝突: なし（独立）

## 3. スキーマ変更（`db/schema.hcl`）

```hcl
table "message_templates" {
  schema  = schema.public
  comment = "メッセージテンプレート（ユーザー単位）"
  column "id"         { null = false, type = serial }
  column "user_id"    { null = false, type = integer }
  column "title"      { null = false, type = text }
  column "body"       { null = false, type = text }
  column "position"   { null = false, type = integer, default = 0 }
  column "created_at" { null = false, type = timestamptz, default = sql("NOW()") }
  column "updated_at" { null = false, type = timestamptz, default = sql("NOW()") }
  primary_key { columns = [column.id] }
  foreign_key "fk_message_templates_user" {
    columns = [column.user_id], ref_columns = [table.users.column.id],
    on_delete = CASCADE, on_update = NO_ACTION
  }
  index "idx_message_templates_user_position" { columns = [column.user_id, column.position] }
}
```

## 4. shared types（`packages/shared/src/types/messageTemplate.ts` 新規）

```ts
export interface MessageTemplate {
  id: number;
  userId: number;
  title: string;
  body: string;
  position: number;
  createdAt: string;
  updatedAt: string;
}
export interface CreateMessageTemplateInput { title: string; body: string; }
export interface UpdateMessageTemplateInput { title?: string; body?: string; position?: number; }
```

`packages/shared/src/index.ts` から re-export する。

## 5. サーバー変更

### 新規ファイル
- `packages/server/src/services/messageTemplateService.ts`
  - `list(userId)` / `create(userId, input)` / `update(userId, id, input)` / `remove(userId, id)` / `reorder(userId, orderedIds)`
- `packages/server/src/routes/messageTemplates.ts`
  - `GET /api/templates` / `POST /api/templates` / `PATCH /api/templates/:id` / `DELETE /api/templates/:id` / `PUT /api/templates/reorder`
  - 全エンドポイントで `authenticateToken` 必須、他人のレコード操作は 404 扱い

### 変更ファイル
- `packages/server/src/app.ts` にルート登録

## 6. クライアント変更

### 新規ファイル
- `packages/client/src/components/Chat/TemplatePicker.tsx` — テンプレート選択ダイアログ（検索 + 絞り込み、Enter で確定）
- `packages/client/src/pages/TemplatesPage.tsx` — テンプレート CRUD 管理画面（サイドメニューからアクセス）
- `packages/client/src/hooks/useMessageTemplates.ts` — `use()` で Promise を解決（`useMemo` で安定化）

### 変更ファイル
- `packages/client/src/api/client.ts` に `templates` セクション追加
- `packages/client/src/components/Chat/RichEditor.tsx`
  - `/` 検知時に `/tpl` コマンドをフィルタし、対応したら `TemplatePicker` を開く
  - `insertContent(text)` API を親へ公開し、選択後に挿入する
- サイドバーまたはプロフィールメニューに「テンプレート管理」導線を追加

## 7. 実装手順

1. ブランチ作成
2. `db/schema.hcl` を編集 → `atlas schema apply --env local --dry-run` で差分確認 → 適用
3. shared types を追加してビルド
4. **テスト項目列挙**（`describe`/`it` のみ）
   - server: `__tests__/messageTemplate.test.ts`
   - client: `__tests__/TemplatePicker.test.tsx`, `TemplatesPage.test.tsx`, `RichEditor.test.tsx` への追記
5. **ユーザー確認**
6. テスト実装 → 実装 → `npm run build && npm run test`
7. PR テンプレートを埋めて Draft PR 作成

## 8. テスト方針

### サーバー
- CRUD・並び順の整合性・他人の ID でのアクセス禁止
- `title`・`body` の空文字検証、`title` 長さ 100 文字上限（実装で enforce）

### クライアント
- `/tpl` 入力時にピッカーが開く
- 選択したテンプレート本文が RichEditor にカーソル位置挿入される
- テンプレート一覧の並び替え（drag & drop または ↑↓ ボタン）が API に反映される

## 9. 注意点

- RichEditor は Quill ベース。Delta 形式で挿入するとスタイルが壊れにくい。プレーンテキスト挿入の場合は `editor.insertText` を使う
- 既存 `MentionDropdown` が `@` を監視しているので、`/` のキーフックは衝突しないように **別イベントハンドラ** で実装する

## 10. 見積もり / リスク

- 規模: 小（サーバー 1 service + 1 route、クライアント 2 コンポーネント + 1 hook）
- リスク: Quill の挿入 API がテスト困難 → `TemplatesPage` のロジックと `insertContent` 呼び出し部分を切り離し、jsdom で扱えるスタブで検証する
