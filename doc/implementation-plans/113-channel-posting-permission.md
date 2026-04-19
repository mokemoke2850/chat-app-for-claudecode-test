# #113 投稿権限制御チャンネル — 実行計画

- Issue: [#113](https://github.com/mokemoke2850/chat-app-for-claudecode-test/issues/113)
- 難易度: 中
- ブランチ: `feature/channel-posting-permission/#113`

## 1. ゴール（受入条件）

- チャンネル作成・編集時に **投稿権限** を選択できる
  - `everyone` — 全員（既定・現状の挙動）
  - `admins` — 管理者のみ（`users.role = 'admin'` または Moderator 以上）
  - `readonly` — 閲覧専用（全員投稿不可。管理者による通知用チャンネルを想定）
- 権限のないユーザーは `RichEditor` の入力欄が **disabled** になり、送信 API も 403 を返す
- 既存ロール管理（Admin / Moderator / Member）と連携する

## 2. 依存・前提

- 既存機能: `users.role`, `channels`, `messageService.sendMessage`, `RichEditor`
- 他 Issue との衝突: `messageService.sendMessage` に権限チェックを追加するので **#107 / #110 / #117 と衝突しやすい**。**#113 を先にマージ** 推奨

## 3. スキーマ変更（`db/schema.hcl`）

```hcl
# channels テーブルに追加
column "posting_permission" {
  null    = false
  type    = text
  default = "everyone"
  comment = "投稿権限（everyone / admins / readonly）"
}
```

## 4. shared types

```ts
// packages/shared/src/types/channel.ts
export type ChannelPostingPermission = 'everyone' | 'admins' | 'readonly';
// Channel に追加
postingPermission: ChannelPostingPermission;
// CreateChannelInput / UpdateChannelInput に追加
postingPermission?: ChannelPostingPermission;
```

## 5. サーバー変更

### 変更ファイル
- `packages/server/src/services/channelService.ts`
  - create / update で `posting_permission` を扱う
  - `canPost(userId, channelId)` helper を追加
    - `readonly` → false
    - `admins` → `users.role` が admin or moderator ならば true
    - `everyone` → channel member か確認
- `packages/server/src/services/messageService.ts`
  - `sendMessage` の冒頭で `canPost` を呼び、false なら `throw createError(403, 'POSTING_FORBIDDEN', '...')`
- `packages/server/src/routes/channels.ts`
  - 既存の create / patch エンドポイントで `postingPermission` を受け取り検証
- `packages/server/src/controllers/messageController.ts`
  - `sendMessage` のエラーハンドリングで 403 を明確に

### 監査ログ
- `channel.permission.update` を追加し、`auditLogService.record` を呼ぶ

## 6. クライアント変更

### 変更ファイル
- `packages/client/src/components/Channel/CreateChannelDialog.tsx`
  - 権限選択（ラジオ 3 択）を追加
- `packages/client/src/components/Channel/ChannelTopicBar.tsx` or 既存の設定ダイアログ
  - 権限変更 UI を追加（管理者のみ変更可）
- `packages/client/src/components/Chat/RichEditor.tsx`
  - `canPost: boolean` prop を受け取り、disabled 時はプレースホルダを「このチャンネルには投稿できません」にする
- `packages/client/src/pages/ChatPage.tsx`
  - 現在チャンネルの `postingPermission` と `currentUser.role` から `canPost` を計算して `RichEditor` に渡す
- `packages/client/src/api/client.ts`
  - `channels.updatePermission(id, permission)`

## 7. 実装手順

1. ブランチ作成
2. スキーマ変更 → atlas apply
3. shared types 追加
4. **テスト項目列挙**
   - server: `__tests__/channelPermission.test.ts`、既存 `messageController.test.ts` に「readonly で 403」など追記
   - client: `CreateChannelDialog.test.tsx` 追記、`ChatPage.test.tsx` に「readonly チャンネルで RichEditor が disabled」を追記
5. **ユーザー確認**
6. テスト実装 → 実装 → build + test
7. PR 作成

## 8. テスト方針

### サーバー
- 権限値バリデーション（3 値以外は 400）
- 一般ユーザーが `admins` チャンネルに投稿すると 403
- `readonly` チャンネルは admin でも投稿不可（設計判断が必要。**admin も不可** を推奨。設定変更で `everyone` に戻すべき）
- 既存チャンネル（新カラムのデフォルト）は `everyone` として振る舞う
- Socket の `message:send` 経由でも同様に拒否される

### クライアント
- RichEditor の disabled 切替
- 作成ダイアログ / 設定画面から権限変更できる
- 権限変更が Socket 経由で他メンバーにも即時反映される（任意。重い場合はリロード時反映でも可）

## 9. 注意点

- **Socket 経由の送信**: `socket/messageHandler.ts` で emit 前にサーバー側で権限チェックを必ず行う
- **Moderator の扱い**: 既存プロジェクトで Moderator ロールが定義されていれば admins に含める。未定義なら admin のみ
- `readonly` 時の `#113` に合わせた UI 表示（グレーアウト + ツールチップ）

## 10. 見積もり / リスク

- 規模: 中
- リスク: 既存の `sendMessage` 経路すべてに権限チェックを入れるので抜け漏れに注意（`socket/messageHandler.ts` も含む）
