# Issue #107〜#118 実行計画（全体俯瞰）

本ディレクトリは、`feat: メッセージ転送`〜`feat: 監査ログのエクスポート` の 12 Issue を **別セッションで個別実装** できるように切り分けた実行計画集である。

各 Issue の詳細は対応する `<番号>-<kebab名>.md` を参照すること。セッション開始時はまず該当ファイルを読み、`AGENTS.md` の TDD フロー（テスト項目 → 確認 → 実装 → テスト）を厳守する。

---

## 1. 実装対象 Issue 一覧

状態: ✅ 完了 / ⏳ 未着手

| # | タイトル | 難易度 | 主体 | 状態 | PR | 計画書 |
|---|---|---|---|---|---|---|
| [#107](https://github.com/mokemoke2850/chat-app-for-claudecode-test/issues/107) | メッセージ転送 | 中 | メッセージ | ⏳ | — | [107-message-forward.md](107-message-forward.md) |
| [#108](https://github.com/mokemoke2850/chat-app-for-claudecode-test/issues/108) | 会話イベント投稿 | 中 | メッセージ | ⏳ | — | [108-event-post.md](108-event-post.md) |
| [#109](https://github.com/mokemoke2850/chat-app-for-claudecode-test/issues/109) | 通知設定のカスタマイズ | 中 | チャンネル | ⏳ | — | [109-channel-notification-settings.md](109-channel-notification-settings.md) |
| [#110](https://github.com/mokemoke2850/chat-app-for-claudecode-test/issues/110) | 予約送信 | 中 | メッセージ | ⏳ | — | [110-scheduled-message.md](110-scheduled-message.md) |
| [#111](https://github.com/mokemoke2850/chat-app-for-claudecode-test/issues/111) | メッセージテンプレート/定型文 | 低 | 入力支援 | ✅ | [#122](https://github.com/mokemoke2850/chat-app-for-claudecode-test/pull/122) | [111-message-templates.md](111-message-templates.md) |
| [#112](https://github.com/mokemoke2850/chat-app-for-claudecode-test/issues/112) | 招待リンク | 中 | チャンネル | ⏳ | — | [112-invite-link.md](112-invite-link.md) |
| [#113](https://github.com/mokemoke2850/chat-app-for-claudecode-test/issues/113) | 投稿権限制御チャンネル | 中 | チャンネル | ⏳ | — | [113-channel-posting-permission.md](113-channel-posting-permission.md) |
| [#114](https://github.com/mokemoke2850/chat-app-for-claudecode-test/issues/114) | ワークスペース初回オンボーディング | 低 | オンボード | ✅ | [#123](https://github.com/mokemoke2850/chat-app-for-claudecode-test/pull/123) | [114-onboarding.md](114-onboarding.md) |
| [#115](https://github.com/mokemoke2850/chat-app-for-claudecode-test/issues/115) | タグ機能 | 中 | 情報整理 | ⏳ | — | [115-tags.md](115-tags.md) |
| [#116](https://github.com/mokemoke2850/chat-app-for-claudecode-test/issues/116) | 通報 / モデレーションキュー | 中 | 運用管理 | ⏳ | — | [116-moderation-queue.md](116-moderation-queue.md) |
| [#117](https://github.com/mokemoke2850/chat-app-for-claudecode-test/issues/117) | NG ワード / 添付制限 | 中 | 運用管理 | ⏳ | — | [117-ng-words-attachment-blocklist.md](117-ng-words-attachment-blocklist.md) |
| [#118](https://github.com/mokemoke2850/chat-app-for-claudecode-test/issues/118) | 監査ログのエクスポート | 低 | 運用管理 | ✅ | [#121](https://github.com/mokemoke2850/chat-app-for-claudecode-test/pull/121) | [118-audit-log-export.md](118-audit-log-export.md) |

---

## 2. Phase（推奨実装順）

各 Phase 内は **並列実装可能**。Phase をまたぐ順序性は「衝突回避」と「依存機能の前提成立」を目的とする。

### Phase 1 — 独立・低難易度（着手しやすい） ✅ 完了

- **#111** ✅ メッセージテンプレート／定型文（PR #122 マージ済み）
- **#114** ✅ ワークスペース初回オンボーディング（PR #123 マージ済み）
- **#118** ✅ 監査ログのエクスポート（PR #121 マージ済み）

### Phase 2 — 中難易度・独立性高

- **#109** 通知設定のカスタマイズ
- **#110** 予約送信
- **#112** 招待リンク
- **#115** タグ機能

### Phase 3 — メッセージ送信経路に影響

- **#113** 投稿権限制御チャンネル（送信前チェック基盤）
- **#117** NG ワード / 添付制限（送信前チェック基盤）
- **#107** メッセージ転送
- **#108** 会話イベント投稿
- **#116** 通報 / モデレーションキュー

> **ヒント**: Phase 3 は `messageService.sendMessage` や `MessageActions.tsx` で衝突しやすい。#113 と #117 を先にマージしてから、#107 / #108 / #116 に着手するとコンフリクトが減る。

---

## 3. ファイル競合マトリクス（主な共有ファイル）

`◎` 大きく変更 / `○` 追記 / `-` 無関係

| ファイル | 107 | 108 | 109 | 110 | 111 | 112 | 113 | 114 | 115 | 116 | 117 | 118 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| `db/schema.hcl` | ○ | ◎ | ○ | ◎ | ○ | ◎ | ○ | ○ | ◎ | ◎ | ◎ | - |
| `packages/shared/src/types/*` | ○ | ◎ | ○ | ◎ | ○ | ◎ | ○ | ○ | ◎ | ◎ | ◎ | ○ |
| `packages/shared/src/types/socket.ts` | ○ | ○ | ○ | ○ | - | ○ | - | - | ○ | ○ | ○ | - |
| `packages/server/src/services/messageService.ts` | ◎ | - | - | ○ | - | - | ○ | - | ○ | - | ◎ | - |
| `packages/server/src/routes/messages.ts` | ○ | - | - | - | - | - | ○ | - | ○ | ○ | ○ | - |
| `packages/server/src/routes/channels.ts` | - | - | ○ | - | - | ○ | ○ | - | - | - | - | - |
| `packages/server/src/routes/admin.ts` | - | - | - | - | - | - | - | - | - | ○ | ○ | ○ |
| `packages/server/src/services/adminService.ts` | - | - | - | - | - | - | - | - | - | ○ | ○ | ○ |
| `packages/server/src/services/auditLogService.ts` | - | - | - | - | - | - | - | - | - | ○ | - | ○ |
| `packages/client/src/api/client.ts` | ○ | ○ | ○ | ○ | ○ | ○ | ○ | ○ | ○ | ○ | ○ | ○ |
| `packages/client/src/components/Chat/MessageActions.tsx` | ◎ | - | - | - | - | - | - | - | ○ | ◎ | - | - |
| `packages/client/src/components/Chat/MessageItem.tsx` | ○ | ○ | - | - | - | - | - | - | ○ | - | - | - |
| `packages/client/src/components/Chat/RichEditor.tsx` | - | - | - | ○ | ○ | - | ○ | - | - | - | ○ | - |
| `packages/client/src/components/Channel/ChannelItem.tsx` | - | - | ◎ | - | - | - | ○ | - | - | - | - | - |
| `packages/client/src/components/Channel/CreateChannelDialog.tsx` | - | - | - | - | - | - | ◎ | - | - | - | - | - |
| `packages/client/src/pages/AdminPage.tsx` | - | - | - | - | - | - | - | - | - | ○ | ○ | ○ |
| `packages/client/src/pages/ChatPage.tsx` | ○ | ○ | ○ | ○ | - | - | - | ○ | - | - | - | - |
| `packages/client/src/App.tsx` | - | - | - | - | - | ○ | - | ○ | - | - | - | - |

**競合しやすいホットスポット**

- `packages/shared/src/types/socket.ts` — Socket.IO のイベント契約。複数 PR が同時にイベントを追加すると必ず衝突する。マージ順を調整する。
- `packages/client/src/api/client.ts` — 全 Issue が触る。マージ時に `git merge` の小さな衝突が起きやすい（新規メソッド追記だけなので機械的解決可能）。
- `packages/client/src/components/Chat/MessageActions.tsx` — **#107（転送）と #116（通報）が同じ「...」メニュー** を取り合う。先にマージされた方に合わせる。
- `packages/client/src/pages/AdminPage.tsx` — #116 / #117 / #118 が **タブ追加** で衝突。

---

## 4. 共通ルール（全 Issue 共通）

各計画書の「実装手順」は以下のテンプレートを具体化したもの。セッション開始前に必ず確認する。

### ブランチ命名

```
feature/<機能名kebab>/#<issue番号>
```
例: `feature/message-forward/#107`

### 実装フロー（TDD）

1. **ブランチ作成** `git checkout -b feature/xxx/#NNN`
2. **DB スキーマ変更**（必要な場合）
   - `db/schema.hcl` を編集
   - `atlas schema apply --env local --dry-run` で差分確認
   - `atlas schema apply --env local` で適用
3. **shared types 追加** `packages/shared/src/types/*.ts`
4. **テスト項目を列挙**（describe / it のネストのみ、中身は `// TODO`）
5. **ユーザー確認**（必須。承認後にアサーションを書く）
6. **テストコード実装** → **プログラム実装** → **テスト通過**
7. `npm run build` と `npm run test` を全通過
8. `.github/PULL_REQUEST_TEMPLATE.md` の全セクションを埋めて PR 作成

### テスト配置

- **サーバー**
  - 単体: `packages/server/src/__tests__/unit/<name>.test.ts`
  - 機能: `packages/server/src/__tests__/<name>.test.ts`
  - 統合: `packages/server/src/__tests__/integration/<controller>.test.ts`
- **クライアント**
  - 既存コンポーネントへの追加: 既存テストに **追記**（例: `MessageItem.test.tsx`）
  - 新規コンポーネント: 対応するファイル名で新規作成
  - ネットワーク: `vi.mock('../api/client')`、Socket.IO: 手動モック

### フロントエンド

- React 19 の `use()` フック + `<Suspense>` を使い、`useEffect + fetch` は避ける
- `use(promise)` に渡す Promise は `useState` または `useMemo` で安定化させる

### 監査ログ

- 管理者操作（ロール変更・チャンネル削除など）および本計画で新設する管理者操作（モデレーション対応・NG ワード更新・エクスポートなど）は `auditLogService.record()` を呼ぶ
- 既存の `AuditActionType` 文字列リテラルに不足があれば `packages/shared/src/types/auditLog.ts` に追加する

### 共通仕様

- スナックバー: `doc/snackbar-spec.md`
- DB テスト: `doc/db-test-guide.md`
- 既存機能一覧: `doc/feature-ideas.md`

---

## 5. スキーマ変更サマリ（全 Issue 合計）

| Issue | 新規テーブル | 既存テーブル変更 |
|---|---|---|
| #107 | （なし。`messages.forwarded_from_message_id` カラム追加で実装） | `messages` に `forwarded_from_message_id` 追加 |
| #108 | `events`, `event_rsvps` | （なし） |
| #109 | `channel_notification_settings` | （なし） |
| #110 | `scheduled_messages` | （なし） |
| #111 | `message_templates` | （なし） |
| #112 | `invite_links`, `invite_link_uses` | （なし） |
| #113 | （なし） | `channels` に `posting_permission` 追加 |
| #114 | （なし） | `users` に `onboarding_completed_at` 追加 |
| #115 | `tags`, `message_tags`, `channel_tags` | （なし） |
| #116 | `message_reports` | （なし） |
| #117 | `ng_words`, `attachment_blocklist` | （なし） |
| #118 | （なし。エクスポートのみ） | （なし） |

**重要**: 複数 Issue を並列で DB 変更すると `atlas schema apply` の差分が競合する可能性がある。**Phase 単位でマージしてから次の Phase に進む** か、Phase 内のローカル開発では各自が個別にスキーマ適用し、マージ後にメインブランチで `atlas schema apply` を必ず流す運用を徹底する。

---

## 6. セッション着手の手順（別セッション用）

新しいセッションを開く人は、以下を順に行えばよい。

1. 本 README で Phase と並列グループを確認する
2. 対象 Issue の計画書（例 `107-message-forward.md`）を **冒頭から末尾まで読み通す**
3. `AGENTS.md` と `CLAUDE.md`（プロジェクト / 個人）のルールを確認する
4. `gh issue view <番号>` で最新コメントを確認する（受入条件の更新があるかも）
5. 計画書の「実装手順」に従って TDD で進める
6. 迷ったらユーザーへ質問（推測禁止）

---

## 7. 未着手の feature-ideas（Issue 化候補）

本計画の範囲外だが、`doc/feature-ideas.md` 未チェック項目は将来 Issue 化の候補。今回の 12 Issue に依存しないので並行検討可能。
