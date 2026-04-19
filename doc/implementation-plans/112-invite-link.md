# #112 招待リンク — 実行計画

- Issue: [#112](https://github.com/mokemoke2850/chat-app-for-claudecode-test/issues/112)
- 難易度: 中
- ブランチ: `feature/invite-link/#112`

## 1. ゴール（受入条件）

- チャンネル or ワークスペース単位で招待リンクを発行できる（ワークスペース全体招待は全公開チャンネルへの一括参加を意味する）
- リンクに **有効期限** と **最大使用回数** を設定できる
- リンクにアクセスしたログイン済みユーザーは対象に自動参加する
- 未ログインユーザーはログイン／登録後に参加フローへ誘導される
- 管理者は発行されたリンクを一覧・無効化できる

## 2. 依存・前提

- 既存機能: `authService`, `channelService.addMember`, `channel_members`
- 他 Issue との衝突: なし

## 3. スキーマ変更（`db/schema.hcl`）

```hcl
table "invite_links" {
  schema  = schema.public
  comment = "招待リンク"
  column "id"              { null = false, type = serial }
  column "token"           { null = false, type = text }           # URL-safe 乱数（32 文字以上）
  column "channel_id"      { null = true,  type = integer }        # NULL = ワークスペース全体
  column "created_by"      { null = true,  type = integer }
  column "max_uses"        { null = true,  type = integer }        # NULL = 無制限
  column "used_count"      { null = false, type = integer, default = 0 }
  column "expires_at"      { null = true,  type = timestamptz }    # NULL = 無期限
  column "is_revoked"      { null = false, type = boolean, default = false }
  column "created_at"      { null = false, type = timestamptz, default = sql("NOW()") }
  primary_key { columns = [column.id] }
  foreign_key "fk_invite_channel" { columns = [column.channel_id], ref_columns = [table.channels.column.id], on_delete = CASCADE, on_update = NO_ACTION }
  foreign_key "fk_invite_creator" { columns = [column.created_by], ref_columns = [table.users.column.id], on_delete = SET_NULL, on_update = NO_ACTION }
  index "idx_invite_token" { unique = true, columns = [column.token] }
}

table "invite_link_uses" {
  schema  = schema.public
  comment = "招待リンク使用履歴"
  column "id"        { null = false, type = serial }
  column "invite_id" { null = false, type = integer }
  column "user_id"   { null = true,  type = integer }
  column "used_at"   { null = false, type = timestamptz, default = sql("NOW()") }
  primary_key { columns = [column.id] }
  foreign_key "fk_invite_use_invite" { columns = [column.invite_id], ref_columns = [table.invite_links.column.id], on_delete = CASCADE, on_update = NO_ACTION }
  foreign_key "fk_invite_use_user"   { columns = [column.user_id], ref_columns = [table.users.column.id], on_delete = SET_NULL, on_update = NO_ACTION }
}
```

## 4. shared types

```ts
// packages/shared/src/types/invite.ts 新規
export interface InviteLink {
  id: number;
  token: string;
  channelId: number | null;
  createdBy: number | null;
  maxUses: number | null;
  usedCount: number;
  expiresAt: string | null;
  isRevoked: boolean;
  createdAt: string;
}
export interface CreateInviteLinkInput {
  channelId?: number | null;
  maxUses?: number | null;
  expiresInHours?: number | null;
}
```

## 5. サーバー変更

### 新規ファイル
- `packages/server/src/services/inviteService.ts`
  - `create(userId, input)` — token を `crypto.randomBytes(24).toString('base64url')` で生成
  - `listByChannel(channelId)` / `listAll()`（管理者用）
  - `revoke(userId, id)`
  - `redeem(token, userId)` — **トランザクション** で `used_count < max_uses` かつ `expires_at > NOW()` かつ `is_revoked = false` を満たす場合に `channel_members` を INSERT し `used_count += 1`、`invite_link_uses` に INSERT
- `packages/server/src/routes/invites.ts`
  - `POST /api/invites` — 作成（チャンネル管理者または admin のみ）
  - `GET /api/invites?channelId=...` — 一覧
  - `DELETE /api/invites/:id` — 無効化
  - `POST /api/invites/:token/redeem` — 参加（認証必須）
  - `GET /api/invites/:token` — トークンの有効性と対象チャンネル情報を返す（認証不要でもよい。ログイン前に「このチャンネルに招待されています」表示用）

### 監査ログ
- `invite.create` / `invite.revoke` / `invite.redeem` を `AuditActionType` に追加し、`auditLogService.record` を呼ぶ

## 6. クライアント変更

### 新規ファイル
- `packages/client/src/pages/InviteRedeemPage.tsx` — `/invite/:token` ルート
  - 未ログインなら「ログインして参加」→ ログイン後に token を保持してリダイレクト
  - ログイン済みなら即 `redeem` API を叩く
- `packages/client/src/components/Channel/InviteLinkDialog.tsx` — リンク生成・一覧・無効化 UI

### 変更ファイル
- `packages/client/src/App.tsx` — ルート `/invite/:token` を追加
- `packages/client/src/components/Channel/ChannelMembersDialog.tsx` — 「招待リンクを作成」ボタンを追加
- `packages/client/src/api/client.ts` — `invites.create` / `list` / `revoke` / `redeem` / `lookup`

## 7. 実装手順

1. ブランチ作成
2. スキーマ変更 → atlas apply
3. shared types 追加
4. **テスト項目列挙**
   - server: `__tests__/invite.test.ts`（生成・使用・期限切れ・上限到達・無効化）
   - client: `InviteLinkDialog.test.tsx` / `InviteRedeemPage.test.tsx`
5. **ユーザー確認**
6. テスト実装 → 実装 → build + test
7. PR 作成

## 8. テスト方針

### サーバー
- token は 32 文字以上、URL セーフ、一意
- `maxUses` 到達後は `redeem` が 410 Gone
- `expiresAt` 経過後は `redeem` が 410 Gone
- `is_revoked = true` のリンクは `redeem` 不可
- 既にメンバーのユーザーが再使用しても成功扱い（`used_count` は増やさない／増やすかは仕様決定要）→ **増やさない** で実装
- 同時 redeem（レースコンディション）で `used_count` が `max_uses` を超えないこと（行ロックまたは条件付き UPDATE）
- ワークスペース招待で全公開チャンネルに参加させる挙動の確認

### クライアント
- ダイアログ内でリンクが生成されコピーできる
- 期限・上限を選択して作成できる
- 管理者／作成者のみ「無効化」ボタンが見える
- `/invite/:token` に未ログインでアクセスするとログインへリダイレクト
- ログイン後に自動で `redeem` が走り該当チャンネルへ遷移する

## 9. 注意点

- **トークン推測攻撃**: 24 bytes の `randomBytes` で十分だが、**試行回数のレート制限** を `POST /api/invites/:token/redeem` に設ける（IP 単位で 60req/min など）。初版は最低限のスロットリングでもよい
- **自動参加の範囲**: ワークスペース招待 = `is_private = false` の全チャンネルに `addMember`。既に参加しているものはスキップ
- **プライベートチャンネル招待**: `channel_id` が指定されたリンクは `is_private = true` でも参加可能（発行者が権限を持つことが前提）
- **ログイン前の token 保存**: `sessionStorage` に `redirect_after_login=/invite/<token>` を入れておきログイン成功後に読み出す

## 10. 見積もり / リスク

- 規模: 中（CRUD + redeem フロー + ログイン前リダイレクト）
- リスク: レースコンディションでの `used_count` 超過 → 行ロック or `UPDATE ... WHERE used_count < max_uses` を `affectedRows` で判定
