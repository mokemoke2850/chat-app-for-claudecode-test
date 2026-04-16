# 並列開発計画: Issue #56〜#63

作成日: 2026-04-16  
最終更新: 2026-04-16

## 進捗サマリー

| # | タイトル | 難易度 | フェーズ | 状態 |
|---|---------|--------|---------|------|
| [#56](https://github.com/mokemoke2850/chat-app-for-claudecode-test/issues/56) | ダークモード | 低 | Phase 2 | 未着手（着手可能） |
| [#57](https://github.com/mokemoke2850/chat-app-for-claudecode-test/issues/57) | メッセージ引用返信 | 低 | Phase 3 | 未着手（着手可能） |
| [#58](https://github.com/mokemoke2850/chat-app-for-claudecode-test/issues/58) | コードブロック構文ハイライト | 低 | Phase 2 | ✅ 完了 ([PR #68](https://github.com/mokemoke2850/chat-app-for-claudecode-test/pull/68) マージ済み 2026-04-16) |
| [#59](https://github.com/mokemoke2850/chat-app-for-claudecode-test/issues/59) | ピン留めチャンネル | 低 | Phase 2 | 未着手（着手可能） |
| [#60](https://github.com/mokemoke2850/chat-app-for-claudecode-test/issues/60) | メッセージ検索の高度化 | 中 | Phase 3 | 未着手（#57待ち） |
| [#61](https://github.com/mokemoke2850/chat-app-for-claudecode-test/issues/61) | リマインダー | 中 | Phase 3 | 未着手（#60待ち） |
| [#62](https://github.com/mokemoke2850/chat-app-for-claudecode-test/issues/62) | チャンネルトピック・説明 | 低 | Phase 2 | 未着手（着手可能） |
| [#63](https://github.com/mokemoke2850/chat-app-for-claudecode-test/issues/63) | ファイル一覧ページ | 低 | Phase 2 | ✅ 完了 ([PR #67](https://github.com/mokemoke2850/chat-app-for-claudecode-test/pull/67) マージ済み 2026-04-16) |

---

## 実行計画

### Phase 1: DBスキーマ統合 ✅ 完了

[PR #66](https://github.com/mokemoke2850/chat-app-for-claudecode-test/pull/66) マージ済み (2026-04-15)

適用済みスキーマ変更:
- `users.theme` カラム追加 (#56)
- `channels.topic` カラム追加 (#62)
- `messages.quoted_message_id` カラム追加 (#57)
- `pinned_channels` テーブル追加 (#59)
- `reminders` テーブル追加 (#61)

---

### Phase 2: 並列実装（Phase 1完了済み）

#### グループA: 完全独立

**#58 コードブロック構文ハイライト** ✅ 完了（PR #68 マージ済み）

**#63 ファイル一覧ページ** ✅ 完了（PR #67 マージ済み）

#### グループB: DBスキーマ完了済み（即着手可能・互いに独立）

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

### Phase 3: 順序依存タスク

**#57 メッセージ引用返信**（#58 マージ済みのため着手可能）
- 変更ファイル:
  - フロント: `MessageItem.tsx`, `RichEditor.tsx`, `renderMessageContent.tsx`
  - バック: `messageService.ts`, `messageController.ts`
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
| `RichEditor.tsx` | #57, #58 | ✅ #58マージ済み → #57 は直接着手可 |
| `renderMessageContent.tsx` | #57, #58 | 同上 |
| `ChannelList.tsx` | #59, #62 | 同一ファイル編集、マージ前に調整 |
| `messageService.ts` | #57, #60, #61 | 順番にマージ |
| `messageController.ts` | #57, #60, #61 | 順番にマージ |
| `AppLayout.tsx` | #56, #59 | 独立した変更箇所のため並列可 |

---

## 実施順序サマリー（現在地）

```
Phase 1 （完了）
  └─ ✅ DBスキーマ一括適用 (#56, #57, #59, #62) [PR #66]

Phase 2 （一部完了・残3件着手可能）
  ├─ ✅ #58 コードブロック構文ハイライト [PR #68]
  ├─ ✅ #63 ファイル一覧ページ          [PR #67]
  ├─ ⬜ #56 ダークモード                ← 今すぐ着手可能
  ├─ ⬜ #59 ピン留めチャンネル          ← 今すぐ着手可能
  └─ ⬜ #62 チャンネルトピック          ← 今すぐ着手可能（#59とChannelList.tsx競合注意）

Phase 3 （#58完了により#57着手可能）
  ⬜ #57 引用返信（着手可能）
    └─ ⬜ #60 検索高度化（#57 マージ後）
         └─ ⬜ #61 リマインダー（#60 マージ後）
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

### `/parallel-feature-dev` スキルの活用

Claude Code の `/parallel-feature-dev` スキルを使うと、ファイル競合を自動分析して並列worktreeで実装を自動化できる。  
現在は #56, #59, #62, #57 を同時並列で実行可能（#57は#58マージ済みのため解禁）。
