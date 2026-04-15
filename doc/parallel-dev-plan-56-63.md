# 並列開発計画: Issue #56〜#63

作成日: 2026-04-16

## 対象Issue一覧

| # | タイトル | 難易度 | フェーズ |
|---|---------|--------|---------|
| [#56](https://github.com/mokemoke2850/chat-app-for-claudecode-test/issues/56) | ダークモード | 低 | Phase 2 |
| [#57](https://github.com/mokemoke2850/chat-app-for-claudecode-test/issues/57) | メッセージ引用返信 | 低 | Phase 3 |
| [#58](https://github.com/mokemoke2850/chat-app-for-claudecode-test/issues/58) | コードブロック構文ハイライト | 低 | Phase 2 |
| [#59](https://github.com/mokemoke2850/chat-app-for-claudecode-test/issues/59) | ピン留めチャンネル | 低 | Phase 2 |
| [#60](https://github.com/mokemoke2850/chat-app-for-claudecode-test/issues/60) | メッセージ検索の高度化 | 中 | Phase 3 |
| [#61](https://github.com/mokemoke2850/chat-app-for-claudecode-test/issues/61) | リマインダー | 中 | Phase 3 |
| [#62](https://github.com/mokemoke2850/chat-app-for-claudecode-test/issues/62) | チャンネルトピック・説明 | 低 | Phase 2 |
| [#63](https://github.com/mokemoke2850/chat-app-for-claudecode-test/issues/63) | ファイル一覧ページ | 低 | Phase 2 |

---

## 実行計画

### Phase 1: DBスキーマ統合（全Issue着手前に必須）

**1人が `db/schema.hcl` に以下をまとめて追加し、`atlas schema apply` を実行する。**

```hcl
# users テーブルへの追加 (#56)
column "theme" {
  type    = text
  default = "light"
}

# channels テーブルへの追加 (#62)
column "topic" {
  type = text
  null = true
}

# messages テーブルへの追加 (#57)
column "quoted_message_id" {
  type = integer
  null = true
}

# 新規テーブル (#59)
table "pinned_channels" {
  column "id"         { type = integer }
  column "user_id"    { type = integer }
  column "channel_id" { type = integer }
  column "created_at" { type = text }
  primary_key { columns = [column.id] }
}

# 新規テーブル (#61)
table "reminders" {
  column "id"         { type = integer }
  column "user_id"    { type = integer }
  column "message_id" { type = integer }
  column "remind_at"  { type = text }
  column "created_at" { type = text }
  primary_key { columns = [column.id] }
}
```

適用コマンド:
```bash
atlas schema apply --env local --dry-run  # 差分確認
atlas schema apply --env local             # 適用
```

---

### Phase 2: 並列実装（Phase 1完了後、最大4並列）

#### グループA: 完全独立（同時着手可能）

**#58 コードブロック構文ハイライト**
- DBスキーマ変更なし、API変更なし
- 変更ファイル: `packages/client/src/components/RichEditor.tsx`, `renderMessageContent.tsx`
- ライブラリ: highlight.js または Prism.js を追加

**#63 ファイル一覧ページ**
- DBスキーマ変更なし（既存 `message_attachments` テーブルを読取のみ）
- 変更ファイル: 新規 `packages/client/src/pages/FilesPage.tsx`, `FileList.tsx`
- 新規APIエンドポイント: `GET /channels/:id/attachments`（`channelController.ts` に追加）

#### グループB: DBスキーマ完了待ち（互いに独立）

**#56 ダークモード**
- 変更ファイル:
  - フロント: `App.tsx`, `AppLayout.tsx`, 新規 `ThemeContext.tsx`
  - バック: `authController.ts`, `authService.ts`（プロフィール更新APIに `theme` 追加）
- `localStorage` フォールバックでOSのカラースキーム設定を初期値に使用

**#59 ピン留めチャンネル**
- 変更ファイル:
  - フロント: `ChannelList.tsx`, `AppLayout.tsx`
  - バック: `channelController.ts`, 新規 `pinnedChannelService.ts`
- 新規API: `POST /channels/:id/pin`, `DELETE /channels/:id/pin`

**#62 チャンネルトピック・説明**
- 変更ファイル:
  - フロント: `ChannelList.tsx`, `CreateChannelDialog.tsx`, 新規 `ChannelInfoDialog.tsx`
  - バック: `channelController.ts`, `channelService.ts`
- 新規API: `PATCH /channels/:id`（topic フィールドの更新）
- **注意**: `ChannelList.tsx` を #59 と共有 → #59 と調整してマージ順序を決める

---

### Phase 3: 順序依存タスク（Phase 2完了後、順番に実施）

**#57 メッセージ引用返信**（#58 完了後に着手）
- 変更ファイル:
  - フロント: `MessageItem.tsx`, `RichEditor.tsx`, `renderMessageContent.tsx`
  - バック: `messageService.ts`, `messageController.ts`
- `RichEditor.tsx` を #58 と共有するため、**#58 のPRマージ後に着手**すること
- 引用元の `message_id`, `sender`, `content` を入力欄にプリセットする

**#60 メッセージ検索の高度化**（#57 完了後に着手）
- 変更ファイル:
  - フロント: `SearchResults.tsx`, `ChatPage.tsx`（フィルタパネル追加）
  - バック: `messageService.ts`, `messageController.ts`
- `messageService.ts` を #57 と共有するため、**#57 のPRマージ後に着手**すること
- フィルタ項目: 日付範囲 / 送信者ユーザー / 添付ファイルの有無

**#61 リマインダー**（#60 完了後に着手）
- 変更ファイル:
  - フロント: `MessageItem.tsx`, 新規 `ReminderDialog.tsx`
  - バック: `messageController.ts`, 新規 `reminderService.ts`
- `MessageItem.tsx` を #57 と、`messageController.ts` を #57・#60 と共有するため**最後に実施**
- 通知は Socket.IO でサーバーからプッシュ、またはポーリングで実装

---

## ファイル競合マトリクス

| ファイル | 関連Issue | 推奨対応 |
|---------|----------|---------|
| `RichEditor.tsx` | #57, #58 | #58 → #57 の順でマージ |
| `renderMessageContent.tsx` | #57, #58 | 同上 |
| `ChannelList.tsx` | #59, #62 | 同一ファイル編集、マージ前に調整 |
| `messageService.ts` | #57, #60, #61 | 順番にマージ |
| `messageController.ts` | #57, #60, #61 | 順番にマージ |
| `AppLayout.tsx` | #56, #59 | 独立した変更箇所のため並列可 |

---

## 実施順序サマリー

```
Phase 1 （必須・先行）
  └─ DBスキーマ一括適用 (#56, #57, #59, #62)

Phase 2 （最大4並列）
  ├─ #58 コードブロック構文ハイライト  ← 独立
  ├─ #63 ファイル一覧ページ           ← 独立
  ├─ #56 ダークモード                 ← DB完了待ち
  ├─ #59 ピン留めチャンネル           ← DB完了待ち
  └─ #62 チャンネルトピック           ← DB完了待ち（#59とChannelList.txt競合注意）

Phase 3 （順序依存）
  #57 引用返信（#58 マージ後）
    └─ #60 検索高度化（#57 マージ後）
         └─ #61 リマインダー（#60 マージ後）
```

---

## 引き継ぎ事項（別セッション向け）

### アーキテクチャ前提

- フロント: React 19 + MUI + Socket.IO + Quill (`RichEditor`)
- バック: Express + better-sqlite3 + Socket.IO
- DB管理: Atlas 宣言モード（`db/schema.hcl` を編集 → `atlas schema apply --env local`）
- スキーマ変更は **`initializeSchema` ではなく必ず `schema.hcl` 経由** で行うこと（CLAUDE.md 参照）

### 開発フロー（AGENTS.md 準拠）

1. `feature/<name>/#<issue番号>` ブランチを作成
2. テスト項目ファイルを先に作成（TDD）
3. テスト実装 → プログラム実装
4. PR作成（`.github/PULL_REQUEST_TEMPLATE.md` 使用、`Fixes #番号` を記載）

### Phase 1 未実施の場合

DBスキーマ変更が未適用であれば、各Issueの実装前に必ず Phase 1 を完了させること。  
`atlas schema apply --env local --dry-run` で差分を確認してから適用する。

### `/parallel-feature-dev` スキルの活用

Claude Code の `/parallel-feature-dev` スキルを使うと、ファイル競合を自動分析して並列worktreeで実装を自動化できる。  
Phase 2 の独立グループ（#58, #63 など）から試すと効果的。
