# UI/UX ブラッシュアップ 進捗管理

`packages/client` のチャット UI を、モック (`UI改善モック.html`) の方向性に合わせて段階的にリニューアルする作業の進捗管理ドキュメント。実装依頼の本文は [`claude-code-prompt.md`](./claude-code-prompt.md) を参照。

## リリース・実装方針（2026-05-02 ユーザー指示）

- **リリースタイミング**: UI/UX ブラッシュアップは **全 Step 完了後にまとめてリリース** する。途中段階の中間ブランチが本番に出ることはない。
- **動線が存在しない UI は許容**: PR の途中段階で「Rail にアイコンはあるが遷移先がない」「ボタンを押しても何も起きない」などの **動線が未完成の UI 要素は許容する**。リリース前に全て繋がる予定。
- **実装忘れの防止 (必須)**: 動線が未完成の UI 要素・機能・ボタンを残す場合は、後述「[保留 TODO リスト](#保留-todo-リスト)」に **必ず** 追記する。コード内に放置せず、本ドキュメントを単一情報源とする。
- **このルール自体の明記**: 上記方針はユーザーから明示された不変ルールであり、後続 Step を担当する誰（または別セッションの Claude）が見ても理解できるよう本ドキュメントに残す。

---

## ブランチ運用方針

- 統合ブランチ: `feature/brush-up-uiux`（main から切る、長命）
- 各ステップ用作業ブランチ: `feature/brush-up-uiux-step-N-<topic>` を統合ブランチから切る
  - Git 制約により、統合ブランチと同名ディレクトリ階層は作れないためハイフン区切りで命名する
- PR は **作業ブランチ → 統合ブランチ** にマージ（レビュー単位を小さく保つ）
- 全ステップ完了後に **統合ブランチ → main** の最終 PR を作成
- 統合ブランチは定期的に `main` を取り込んで差分の肥大化を防ぐ（週 1 目安、または main 側で関連箇所が変わったタイミング）

```
main
 └─ feature/brush-up-uiux                       ← 統合ブランチ
     ├─ feature/brush-up-uiux-step-1-tokens
     ├─ feature/brush-up-uiux-step-2-applayout-rail
     ├─ feature/brush-up-uiux-step-3-channel-list
     ├─ feature/brush-up-uiux-step-4-message-flat
     ├─ feature/brush-up-uiux-step-5-context-rail
     ├─ feature/brush-up-uiux-step-6-inbox-page
     ├─ feature/brush-up-uiux-step-7-search-page
     └─ feature/brush-up-uiux-step-8-mobile
```

## ステップ一覧

| # | テーマ | ブランチ | PR | 状態 | 完了日 |
|---|--------|----------|----|------|--------|
| 0 | 準備（モック取り込み + 進捗ドキュメント） | `feature/brush-up-uiux` | - | 🟡 進行中 | - |
| 1 | トークン刷新（`index.css` 新設 + ThemeContext で `data-theme` 出力） | `feature/brush-up-uiux-step-1-tokens` | [#200](https://github.com/mokemoke2850/chat-app-for-claudecode-test/pull/200) | 🟢 完了 | 2026-05-01 |
| 2a | AppLayout の 3 列化 + Rail 新設（最小機能） | `feature/brush-up-uiux-step-2-applayout-rail` | [#201](https://github.com/mokemoke2850/chat-app-for-claudecode-test/pull/201) | 🟢 完了 | 2026-05-02 |
| 2b | AppBar 撤去 + ロゴ/ユーザーメニュー移設 (検索撤去 / 未読バッジは Step 2c) | `feature/brush-up-uiux-step-2b-rail-absorb` | [#202](https://github.com/mokemoke2850/chat-app-for-claudecode-test/pull/202) | 🟢 完了 | 2026-05-02 |
| 2c | Rail に DM 未読バッジ実装（メンション数は Step 6 へ繰り延べ） | `feature/brush-up-uiux-step-2c-unread-badges` | [#203](https://github.com/mokemoke2850/chat-app-for-claudecode-test/pull/203) | 🟢 完了 | 2026-05-02 |
| 3a | ChannelList から保存ビュー / DmNavigationItems を削除 | `feature/brush-up-uiux-step-3-channel-list` | [#204](https://github.com/mokemoke2850/chat-app-for-claudecode-test/pull/204) | 🟢 完了 | 2026-05-02 |
| 3b | ChannelList の行コンパクト化（28px / `#`/🔒/ピン整形） | `feature/brush-up-uiux-step-3b-row-compact` | [#205](https://github.com/mokemoke2850/chat-app-for-claudecode-test/pull/205) | 🟢 完了 | 2026-05-02 |
| 3c | Sidebar の ChannelList 下部に DM 会話一覧ブロック追加 | `feature/brush-up-uiux-step-3c-dm-block` | [#206](https://github.com/mokemoke2850/chat-app-for-claudecode-test/pull/206) | 🟢 完了 | 2026-05-02 |
| 4 | MessageItem のフラット化 + 連投マージ + ホバーアクションバー | `feature/brush-up-uiux-step-4-message-flat` | [#207](https://github.com/mokemoke2850/chat-app-for-claudecode-test/pull/207) | 🟢 完了 | 2026-05-02 |
| 5a | ContextRail 新設（概要/ピン留め/メンバー 3 タブ）+ AppLayout 4 列対応 + 開閉永続化 | `feature/brush-up-uiux-step-5-context-rail` | [#208](https://github.com/mokemoke2850/chat-app-for-claudecode-test/pull/208) | 🟢 完了 | 2026-05-02 |
| 5b | ContextRail にファイル/予定タブ追加（予定は準備中プレースホルダ）+ Main 上部 PinnedMessages バー撤去 | `feature/brush-up-uiux-step-5b-context-rail-cleanup` | [#209](https://github.com/mokemoke2850/chat-app-for-claudecode-test/pull/209) | 🟢 完了 | 2026-05-02 |
| 5c-1 | ChannelTopicBar 編集系を ChannelSettingsForm に分離 + 予定タブ実機データ化（既存 `api.calendar.events.list` 活用） | `feature/brush-up-uiux-step-5c-1-topic-events` | [#210](https://github.com/mokemoke2850/chat-app-for-claudecode-test/pull/210) | 🟢 完了 | 2026-05-02 |
| 5c-2 | ChannelList から ChannelMembersDialog 起動撤去（onOpenMembersDialog props 伝搬削除 + 関連テスト整理） | `feature/brush-up-uiux-step-5c-2-members-dialog-cleanup` | [#211](https://github.com/mokemoke2850/chat-app-for-claudecode-test/pull/211) | 🟢 完了 | 2026-05-02 |
| 6a | InboxPage 新設 + ルート `/` 差し替え + サマリーカード 3 連 + リマインダー/下書き/すべてタブ実装 | `feature/brush-up-uiux-step-6a-inbox-page` | [#212](https://github.com/mokemoke2850/chat-app-for-claudecode-test/pull/212) | 🟢 完了 | 2026-05-02 |
| 6b | メンションタブ実機データ化（サーバー側 search API に `mentionedToMe` / `unreadOnly` フィルタ追加） | `feature/brush-up-uiux-step-6b-mentions-tab` | [#213](https://github.com/mokemoke2850/chat-app-for-claudecode-test/pull/213) | 🟢 完了 | 2026-05-02 |
| 6c | スレッドタブ実機データ化（サーバー側 `GET /api/threads/subscribed` 新設） | `feature/brush-up-uiux-step-6c-threads-tab` | [#214](https://github.com/mokemoke2850/chat-app-for-claudecode-test/pull/214) | 🟢 完了 | 2026-05-02 |
| 6d | バッジ連携（Rail メンション数 / ChannelList 未読数）+ Inbox クイックアクション（リマインダー完了 / 下書き再開） | `feature/brush-up-uiux-step-6d-badges-actions` | [#215](https://github.com/mokemoke2850/chat-app-for-claudecode-test/pull/215) | 🟢 完了 | 2026-05-02 |
| 7a | 検索ページ新設 + Rail 検索アイコン有効化 + ChatPage 検索 dead code 撤去 | `feature/brush-up-uiux-step-7a-search-page` | [#217](https://github.com/mokemoke2850/chat-app-for-claudecode-test/pull/217) | 🟢 完了 | 2026-05-03 |
| 7b | 保存ビューのピル一覧表示 + クリックで条件適用 + 削除アクション | `feature/brush-up-uiux-step-7b-saved-view-pills` | [#218](https://github.com/mokemoke2850/chat-app-for-claudecode-test/pull/218) | 🟢 完了 | 2026-05-03 |
| 7c-1 | チップ式フィルタ入力 (`from:` `in:` `has:file` `before:` `after:` `tag:`) + サーバー `channelId` フィルタ追加 | `feature/brush-up-uiux-step-7c-search-chips` | [#219](https://github.com/mokemoke2850/chat-app-for-claudecode-test/pull/219) | 🟢 完了 | 2026-05-03 |
| 7c-2 | 結果リストのスニペット + ハイライト | `feature/brush-up-uiux-step-7c-2-snippet-highlight` | [#220](https://github.com/mokemoke2850/chat-app-for-claudecode-test/pull/220) | 🟢 完了 | 2026-05-03 |
| 8 | モバイル対応（ボトムタブ + ContextRail のボトムシート化） | `feature/brush-up-uiux-step-8-mobile` | - | ⚪ 未着手 | - |

凡例: ⚪ 未着手 / 🟡 進行中 / 🔵 レビュー中 / 🟢 完了 / 🔴 ブロック

---

## ステップ詳細

### Step 0: 準備
**目的**: モック資料の取り込みと進捗管理の枠組みづくり。

- [x] `feature/brush-up-uiux` ブランチを `main` から作成
- [x] `doc/brushup-uiux-plan/` 配下のモック資料を Git 追跡対象に追加
- [x] `PROGRESS.md`（このドキュメント）を作成
- [x] 統合ブランチをリモートに push して可視化

---

### Step 1: トークン刷新
**ブランチ**: `feature/brush-up-uiux-step-1-tokens`
**方針**: ハイブリッド案。MUI v5 (`MuiThemeProvider`) は維持しつつ、グローバル CSS でトークンを定義する。本 Step ではトークン定義 + `data-theme` 出力までを行い、既存ハードコード色の置換は **後続 PR で段階的に** 実施する（Step 1 を肥大化させない）。

**対象ファイル**:
- `packages/client/src/index.css`（**新規作成**：モックの `styles.css` をベースにトークン定義）
- `packages/client/src/main.tsx`（`index.css` の import を追加）
- `packages/client/src/contexts/ThemeContext.tsx`（`<html data-theme>` 属性出力を追加）
- `packages/client/src/__tests__/ThemeContext.test.tsx`（**新規**）

**タスク**:
- [x] モック `styles.css` の `:root` / `[data-theme="dark"]` ブロックを `index.css` に取り込み（`oklch` ベース）
- [x] アクセント色を `--accent: oklch(0.55 0.15 250)` に統一
- [x] フォント設定を `Inter Tight` + `Noto Sans JP` + `JetBrains Mono` に変更（変数定義のみ。フォント本体読み込みは後続 Step で実施）
- [x] `main.tsx` で `index.css` を import
- [x] `ThemeContext` で mode 切替時に `<html data-theme="dark|light">` 属性を出力（MUI mode 切替も維持）
- [x] ThemeContext のテストを追加・更新（`DarkMode.test.tsx` に 7 ケース追加）
- [x] ライト/ダーク両方でコントラスト破綻がないか目視確認（本 Step は変数供給のみで描画変化なしのため、Step 2 以降の参照開始時にあらためて確認）

**Step 1 のスコープ外（後続 PR）**:
- ハードコードされた色（MUI `sx` / inline style）の CSS 変数化 → 各コンポーネント Step に分散
- フォント本体（Inter Tight / Noto Sans JP / JetBrains Mono）の読み込み（Step 2 以降で `index.html` に追加）

**受け入れ基準**:
- 既存 UI が壊れない範囲で（色は MUI palette 経由のまま）トークン基盤が整っている
- `<html data-theme>` の切替が動作する
- Light / Dark の両方でスクリーンショットを PR に添付

---

### Step 2a: AppLayout の 3 列化 + Rail 新設（最小機能）
**ブランチ**: `feature/brush-up-uiux-step-2-applayout-rail`
**PR**: [#201](https://github.com/mokemoke2850/chat-app-for-claudecode-test/pull/201)
**方針**: プロンプトの Step 2 を 2a / 2b に分割。本 PR では「3 列グリッド土台 + Rail 最小機能」のみで、AppBar はそのまま維持する。Sidebar 列の幅は既存と同じ 240px。

**対象ファイル**:
- `packages/client/src/components/Layout/AppLayout.tsx`（3 列グリッド化、Drawer 撤去）
- `packages/client/src/components/Layout/Rail.tsx`（新規）
- `packages/client/src/__tests__/Rail.test.tsx`（新規 16 ケース）
- `packages/client/src/__tests__/AppLayout.test.tsx`（旧ナビテストを Rail.test に移管、`MemoryRouter` ラップに変更）
- `packages/client/src/__tests__/TaskBoardPage.test.tsx`（react-router-dom mock を `importActual` パターンに変更）

**タスク**:
- [x] `[Rail 64px] [Sidebar 240px] [Main 1fr]` の 3 列グリッドに変更
- [x] `Rail.tsx` を新規作成（react-router の `NavLink` を使用、`aria-current` で選択状態）
- [x] レール上部: ホーム / DM / カレンダー / タスク / ブックマーク（検索/ファイル/チャットは後続 Step）
- [x] レール下部（区切り線後）: テンプレート / 管理（admin ロールのみ）
- [x] 既存 Drawer (persistent) を撤去、ハンバーガーボタン削除
- [x] Drawer 内のチャット/カレンダー/タスクボードナビを Rail に移譲
- [x] テスト追加・更新

**受け入れ基準（本 Step）**:
- [x] 3 列レイアウトで既存機能が動作する（既存 1308 テスト全 pass）
- [x] レールアイコンから各画面に遷移できる

---

### Step 2b: AppBar 撤去 + ロゴ/ユーザーメニュー移設
**ブランチ**: `feature/brush-up-uiux-step-2b-rail-absorb`
**PR**: [#202](https://github.com/mokemoke2850/chat-app-for-claudecode-test/pull/202)
**方針**: 検索 box は dead code として残置し、未読バッジは Step 2c に分離。Step 2b は最小限のスコープで AppBar 撤去とユーザーメニュー移設に集中。

**対象ファイル**:
- `packages/client/src/components/Layout/SidebarFooter.tsx`（**新規**）
- `packages/client/src/components/Layout/AppLayout.tsx`（AppBar 撤去）
- `packages/client/src/components/Layout/Rail.tsx`（ロゴと検索アイコン追加）
- `packages/client/src/pages/ChatPage.tsx`（AppLayout への検索 props 削除）
- `packages/client/src/__tests__/SidebarFooter.test.tsx`（**新規** 12 ケース）
- `packages/client/src/__tests__/Rail.test.tsx`（+3 ケース）
- `packages/client/src/__tests__/AppLayout.test.tsx`（旧ヘッダー displayName を削除、+2 ケース）
- `packages/client/src/__tests__/ChatPage.test.tsx`（検索系 5 ケースを `describe.skip`）

**タスク**:
- [x] ロゴを Rail 最上部の四角ロゴに移動（暫定 "C" デザイン）
- [x] ユーザーメニュー（ステータス / テーマ切替 / 通知 / プロフィール / ログアウト）を Sidebar 列フッターに移設
- [x] AppBar を完全撤去
- [x] Rail に検索アイコンを disabled で追加（**動線未完成**、保留 TODO #1）
- [x] AppLayout から `searchQuery` / `onSearchChange` / `onSearchFocus` props を撤去
- [x] ChatPage 側で AppLayout への検索 props 渡し 3 行を削除（内部 state は dead code として残置、保留 TODO #2）
- [x] 検索系テスト 5 ケースを `describe.skip` に変更
- [x] テスト追加・更新

**Step 2b のスコープ外（後続 Step に分離）**:
- 未読バッジの実装 → Step 2c
- 検索動線の復活 → Step 7
- レール幅・Sidebar 幅・Context rail 表示状態の `useState` + `localStorage` 管理 → Step 5 (Context rail) で対応

---

### Step 2c: Rail に DM 未読バッジ実装
**ブランチ**: `feature/brush-up-uiux-step-2c-unread-badges`
**PR**: [#203](https://github.com/mokemoke2850/chat-app-for-claudecode-test/pull/203)

**対象ファイル**:
- `packages/client/src/hooks/useDmUnreadCount.ts`（**新規**）
- `packages/client/src/hooks/__tests__/useDmUnreadCount.test.tsx`（**新規** 10 ケース）
- `packages/client/src/components/Layout/Rail.tsx`（Badge 統合）
- `packages/client/src/__tests__/Rail.test.tsx`（+4 ケース）
- `packages/client/src/__tests__/TaskBoardPage.test.tsx`（api モックに `dm.listConversations` 追加）

**タスク**:
- [x] DM 未読数バッジ（Rail の DM アイコン右上、`<Badge max={9}>`）
- [x] DM 未読数集計 hook (`useDmUnreadCount`) 作成
- [x] Socket `dm_notification` 連動でリアルタイム加算
- [x] `/dm` 配下のパスでは 0 表示（既存 DmNavigationItems の挙動踏襲）
- [x] aria-label に未読数を反映（screen reader 対応）

**Step 2c のスコープ外**:
- メンション未読数バッジ → Step 6 (InboxPage) で実装（保留 TODO #5）
- Channel 未読数バッジ → Step 6 (InboxPage) 連動

**既知の事象（Step 3 で解消予定）**:
- マージ後は **DM 未読バッジが Sidebar (DmNavigationItems) と Rail の両方で重複表示** される
- Step 3 で `DmNavigationItems` を撤去すれば自然に解消

---

### Step 3: ChannelList の整理（3a / 3b / 3c に分割）
プロンプト §3.3 を 3 つのサブステップに分割し、各 PR を小さく保つ。

#### Step 3a: 不要セクションの削除（本サブ Step）
**ブランチ**: `feature/brush-up-uiux-step-3-channel-list`
**対象ファイル**:
- `packages/client/src/components/Channel/ChannelList.tsx`
- `packages/client/src/components/Channel/SavedViewSection.tsx`（削除）
- `packages/client/src/components/Channel/DmNavigationItems.tsx`（削除）
- `packages/client/src/__tests__/SavedViewSection.test.tsx`（削除）
- `packages/client/src/__tests__/DmNavigationItems.test.tsx`（削除）
- `packages/client/src/__tests__/ChannelList.test.tsx`（保存ビュー関連 2 ケース削除）
- `packages/client/src/pages/ChatPage.tsx`（`onSelectSavedView` を渡す行のみ削除、handler 本体は dead code として残置）

**タスク**:
- [ ] `SavedViewSection.tsx` を削除（検索画面に移設予定 = Step 7、保留 TODO #2）
- [ ] `DmNavigationItems.tsx` を削除（DM 未読は Rail に移譲済み = Step 2c）
- [ ] ChannelList から両者の参照・関連 state / Promise を削除
- [ ] ChatPage の `onSelectSavedView` props 渡しを削除（handler は保留 TODO #2 に従い残置）
- [ ] 既存テストの該当ケースを整理

#### Step 3b: 行コンパクト化（次の PR）
**ブランチ**: `feature/brush-up-uiux-step-3b-row-compact`（予定）
**タスク**:
- [ ] ChannelItem の高さを 28px に
- [ ] 左に `#` / 🔒 / ピンアイコンを配置
- [ ] ホバー時のアクションバー位置を調整（既存の右端ボタン群整理）

#### Step 3c: Sidebar に DM 会話一覧ブロック追加（次々の PR）
**ブランチ**: `feature/brush-up-uiux-step-3c-dm-block`（予定）
**タスク**:
- [ ] ChannelList 下部に DM 会話一覧ブロックを追加
- [ ] 既存 `/dm` DMPage と並立（Sidebar の DM 行クリックで対応する DM 会話を開く）
- [ ] 会話の未読バッジ / アバター / 最終メッセージ時刻 などを表示

**Step 3 共通のスコープ外（後続 Step に分離）**:
- 未読数バッジ（メンション色分け、`#` チャンネルアイコン色変化）→ Step 6 (InboxPage) 連動でメンション集計と同時実装

**依存**: Step 2 完了後（済）

---

### Step 4: MessageItem のフラット化
**ブランチ**: `feature/brush-up-uiux-step-4-message-flat`
**PR**: [#207](https://github.com/mokemoke2850/chat-app-for-claudecode-test/pull/207)

**対象ファイル**:
- `packages/client/src/components/Chat/MessageBubble.tsx`（バブル装飾撤去 + `isOwn` props 削除）
- `packages/client/src/components/Chat/MessageItem.tsx`（自分メッセ右寄せ撤去 + `isContinued` props 追加 + アクションバー絶対配置）
- `packages/client/src/components/Chat/MessageList.tsx`（`isContinuedMessage()` で連投マージ判定）
- `packages/client/src/components/Chat/MessageActions.tsx`（`opacity: 0` を撤去し外側 `.msg-actions-floating` の opacity に統一）
- `packages/client/src/components/Chat/ReactionBadge.tsx`（22px ピル形状 + accent 色化、inline `style` で渡す）
- `packages/client/src/__tests__/MessageList.test.tsx`（連投マージ判定 +6 ケース、MessageItem スタブに `data-continued`）
- `packages/client/src/__tests__/MessageItem.test.tsx`（連投マージ表示 +6 ケース、Edit/Delete クリックに `pointerEventsCheck: 0`）
- `packages/client/src/__tests__/ReactionBadge.test.tsx`（**新規** 8 ケース）
- `packages/client/src/__tests__/BookmarkPage.test.tsx` / `MessageItemReaction.test.tsx` / `MessageItemThread.test.tsx` / `QuoteReply.test.tsx`（アクションバー内ボタン click に `pointerEventsCheck: 0` 付与で計 14 件対応）

**タスク**:
- [x] `MessageBubble` の角丸 + 背景 + パディングを撤去しプレーンな縦組みへ
- [x] 自分メッセージの右寄せ (`flexDirection: 'row-reverse'`) を撤去し全行左揃え統一 + `maxWidth: '75%'` 撤去
- [x] 連投マージ: 直前メッセージと「同送信者・5 分未満・どちらも非削除」のとき avatar/名前/時刻ヘッダーを非表示
- [x] ホバー時アクションバーを `position: absolute; top: -12px; right: 24px;` でフロート（`opacity + pointer-events` で表示制御）
- [x] リアクションを 22px ピル形状（自分のリアクションは `var(--accent)` 枠 + 文字色）

**Step 4 のスコープ外（後続 Step に分離）**:
- 連投時の時刻 hover 表示（モックの `.continued .gutter` の opacity 切替）→ ビジュアル微調整なので別途検討
- リアクション追加 (+) ボタンの 22px 円形ピル化（モックの `.reaction-add`）→ 現状は `MessageActions` 内のアイコンボタンであり、独立化は別 Step
- 行全体の `:hover` 背景薄化 → CSS 変数経由のトークン適用と合わせて Step 7/8 で対応する選択肢

**受け入れ基準**:
- [x] バブルがない / 連投マージ動作 / ホバーでアクションバー浮上 / リアクション 22px ピル
- [x] 既存 1330 件 + 追加 20 件 = 全 1344 件 pass / 型チェック・ESLint エラーなし

---

### Step 5: ContextRail 新設（5a / 5b に分割）

#### Step 5a: ContextRail コンポーネント新設 + 概要/ピン留め/メンバー 3 タブ + AppLayout 4 列対応
**ブランチ**: `feature/brush-up-uiux-step-5-context-rail`
**PR**: [#208](https://github.com/mokemoke2850/chat-app-for-claudecode-test/pull/208)

**対象ファイル**:
- `packages/client/src/components/Channel/ContextRail.tsx`（**新規** Tabs + TabPanel 構造）
- `packages/client/src/components/Channel/ChannelMembersDialog.tsx`（`MembersContent` / `MembersData` を named export 化、ContextRail から再利用）
- `packages/client/src/components/Layout/AppLayout.tsx`（`rightPane?: ReactNode` prop 追加 → 4 列 grid 対応）
- `packages/client/src/pages/ChatPage.tsx`（panelR トグルボタン + ContextRail 配置 + `localStorage["contextRail.open"]` 永続化）
- `packages/client/src/__tests__/ContextRail.test.tsx`（**新規** 8 ケース）
- `packages/client/src/__tests__/AppLayout.test.tsx`（rightPane 関連 +3 ケース）
- `packages/client/src/__tests__/ChatPage.test.tsx`（トグル/永続化 +4 ケース、AppLayout モック拡張、ContextRail スタブ追加）

**タスク**:
- [x] 320px の折り畳み可能ペインを右端に追加（AppLayout の rightPane prop 経由で 4 列化）
- [x] タブ: 概要 / ピン留め / メンバー（ファイル・予定は 5b）
- [x] 既存の `ChannelTopicBar` / `PinnedMessages` / `MembersContent` を **再利用** で集約（移譲は 5b）
- [x] トップバー右端の `panelR` アイコン（`ViewSidebarIcon`）でトグル
- [x] 開閉状態を `localStorage["contextRail.open"]` に永続化（初期表示時に復元）

**Step 5a のスコープ外（Step 5b に分離）**:
- ファイル / 予定タブの追加
- 既存 UI（TopicBar 編集ボタン群 / PinnedMessages 上部バー / ChannelMembersDialog）の撤去 — 現状は ContextRail と併設しており UI 重複あり
- モバイル幅でのボトムシートフォールバック（Step 8）

**受け入れ基準**:
- [x] panelR ボタンで開閉できる / リロード後も開閉状態が復元される
- [x] 概要・ピン留め・メンバーの 3 タブが切替可能
- [x] 既存 1344 件 + 追加 15 件 = 全 1359 件 pass / 型チェック・ESLint エラーなし

#### Step 5b: ファイル/予定タブ追加 + Main 上部 PinnedMessages バー撤去
**ブランチ**: `feature/brush-up-uiux-step-5b-context-rail-cleanup`
**PR**: [#209](https://github.com/mokemoke2850/chat-app-for-claudecode-test/pull/209)

**スコープ判断**: 当初想定の「ファイル/予定タブ追加 + 既存 UI 全撤去」は PR が肥大化しテスト破壊リスクが高いため、ユーザー合意のもと「案 1: ミニマム (A + B + C)」に絞った。残作業は Step 5c へ繰り延べ。

**対象ファイル**:
- `packages/client/src/components/Channel/ContextRail.tsx`（`TabKey` 拡張 + ファイル/予定タブ追加）
- `packages/client/src/pages/ChatPage.tsx`（Main 上部 `<PinnedMessages>` 撤去 + import 削除）
- `packages/client/src/__tests__/ContextRail.test.tsx`（タブ拡張 +4 ケース、`ChannelFilesTab` を `vi.mock`）
- `packages/client/src/__tests__/ChatPage.test.tsx`（PinnedMessages mock を `vi.hoisted` の `vi.fn` に変更し track、Main 上部に呼ばれない +1 ケース）

**タスク**:
- [x] ContextRail に「ファイル」タブを追加（既存 `ChannelFilesTab` を再利用、Suspense でラップ）
- [x] ContextRail に「予定」タブを追加（**準備中プレースホルダ**で暫定対応。実機データ化は Step 5c）
- [x] 既存 `PinnedMessages` の Main 上部バー表示を撤去（ContextRail のピン留めタブに集約）

**Step 5b のスコープ外（Step 5c へ繰り延べ）**:
- 既存 `ChannelTopicBar` の編集ボタン群（招待 / ゲスト / 編集）を ContextRail に完全移譲して TopicBar 編集系撤去
- `ChannelList` からの `ChannelMembersDialog` 起動撤去（ContextRail メンバータブで代替）
- 予定タブの実機データ化（`/api/channels/:id/events` のような新エンドポイント追加が前提）

**受け入れ基準**:
- [x] 5 タブ全てが切替可能 / ファイルタブで添付一覧、予定タブで「準備中」表示
- [x] Main 上部に PinnedMessages バーが表示されなくなる
- [x] 全 1364 件 pass / 型チェック・ESLint エラーなし

### Step 5c: ContextRail 仕上げ（5c-1 / 5c-2 に分割）

ユーザー合意のもと **案 B** で 2 サブステップに分割。5c-1 で ContextRail を 5 タブすべて実機データ完成形にし、5c-2 で ChannelList の MembersDialog 起動箇所を整理する。

#### Step 5c-1: TopicBar 編集系を ChannelSettingsForm に分離 + 予定タブ実機データ化
**ブランチ**: `feature/brush-up-uiux-step-5c-1-topic-events`
**PR**: [#210](https://github.com/mokemoke2850/chat-app-for-claudecode-test/pull/210)

**重要発見（着手時）**: 当初想定では「予定タブはサーバーに `GET /api/channels/:id/events` を新設する必要がある」と見込んでいたが、調査の結果 **既存の `api.calendar.events.list({ channelIds: [...] })` で対応可能** と判明。サーバー追加・DB スキーマ変更ともに不要となり、5c-1 のスコープが大幅に縮小された。

**対象ファイル**:
- `packages/client/src/components/Channel/ChannelSettingsForm.tsx`（**新規** 旧 ChannelTopicBar から編集ロジック移植）
- `packages/client/src/components/Channel/ChannelTopicBar.tsx`（239 行 → 49 行に簡素化、props を `{ channel, onTagClick? }` のみに）
- `packages/client/src/components/Channel/ContextRail.tsx`（概要タブで ChannelSettingsForm 使用 / 予定タブを `useMemo + Suspense + use(promise)` で実機データ化、CalendarEvent 一覧表示）
- `packages/client/src/pages/ChatPage.tsx`（Main トップバーの ChannelTopicBar 呼出を縮小 props に対応）
- `packages/client/src/__tests__/ChannelSettingsForm.test.tsx`（**新規** 5 ケース）
- `packages/client/src/__tests__/ChannelTopic.test.tsx`（519 行 → 100 行に圧縮、編集系/招待/投稿権限の describe を撤去）
- `packages/client/src/__tests__/ContextRail.test.tsx`（+5 ケース、`api.calendar.events.list` を `vi.hoisted` で track）

**タスク**:
- [x] ChannelSettingsForm.tsx 新規作成（招待 / ゲスト / 編集ダイアログ + 投稿権限変更）
- [x] ChannelTopicBar.tsx を topic + tags 表示専用に簡素化
- [x] ContextRail 概要タブで ChannelSettingsForm を使用
- [x] ContextRail 予定タブを `api.calendar.events.list({ channelIds: [channel.id] })` で実機データ化
- [x] Main トップバーの ChannelTopicBar 呼出を縮小 props に対応
- [x] ChannelTopic.test.tsx の編集系テスト 491 行を削除（責務を ChannelSettingsForm.test に移譲）

**Step 5c-1 のスコープ外（Step 5c-2 へ繰り延べ）**:
- ChannelList からの ChannelMembersDialog 起動撤去（props 伝搬の削除と関連テスト整理）

**受け入れ基準**:
- [x] ContextRail が 5 タブすべて実機データの完成形になる
- [x] Main トップバーの編集ボタン群（招待/ゲスト/編集）が ContextRail 経由のみの動線に統一
- [x] 全 1356 件 pass / 5 件 skip / 型チェック・ESLint エラーなし

#### Step 5c-2: ChannelList から ChannelMembersDialog 起動撤去
**ブランチ**: `feature/brush-up-uiux-step-5c-2-members-dialog-cleanup`
**PR**: [#211](https://github.com/mokemoke2850/chat-app-for-claudecode-test/pull/211)

**対象ファイル**:
- `packages/client/src/components/Channel/ChannelItem.tsx`（Props から `onOpenMembersDialog` 削除 / `handleMembersClick` 削除 / 「メンバー管理」MenuItem 削除）
- `packages/client/src/components/Channel/ChannelCategorySection.tsx`（Props 伝搬削除）
- `packages/client/src/components/Channel/ChannelList.tsx`（`ChannelMembersDialog` import 削除 / `membersDialogChannel` state 削除 / Dialog 描画削除 / 子コンポーネントへの渡し計 5 箇所削除）
- `packages/client/src/__tests__/ChannelItem.test.tsx`（`defaultProps` から `onOpenMembersDialog` 削除 / 既存「メンバー管理が表示される (private)」を「private でも表示されない」に反転 / 「クリック」テスト 2 件を削除）

**タスク**:
- [x] `ChannelList` → `ChannelCategorySection` → `ChannelItem` の `onOpenMembersDialog` props 伝搬を全削除
- [x] `ChannelList` の `<ChannelMembersDialog>` 描画と `membersDialogChannel` state を削除
- [x] `ChannelMembersDialog.tsx` 自体は残す判断（ContextRail メンバータブが `MembersContent` を named export 経由で使っているため）
- [x] 関連テスト整理（`ChannelItem.test.tsx` の Members 系テスト整理。`ChannelMembersDialog.test.tsx` 235 行は変更なし — Dialog コンポーネント自体のテストとして機能継続）

**Step 5c-2 のスコープ外（影響なし）**:
- なし（Step 5 すべてのサブステップが本 PR で完了）

**受け入れ基準**:
- [x] ChannelList の右クリックメニュー (private チャンネル) から「メンバー管理」項目が消える
- [x] メンバー管理動線が ContextRail メンバータブ経由のみに統一
- [x] 全 1354 件 pass / 5 件 skip / 型チェック・ESLint エラーなし

**🎉 これで Step 5 (ContextRail) のすべてのサブステップ (5a / 5b / 5c-1 / 5c-2) が完了しました。**

---

### Step 6: InboxPage 新設（6a / 6b / 6c / 6d に分割）

ユーザー合意のもと **案 B** で 4 サブステップに分割。レートリミット対策として各 PR を小さく保つ方針。

#### Step 6a: InboxPage 新設 + ルート `/` 差し替え + サマリーカード + リマインダー/下書き/すべてタブ
**ブランチ**: `feature/brush-up-uiux-step-6a-inbox-page`
**PR**: [#212](https://github.com/mokemoke2850/chat-app-for-claudecode-test/pull/212)

**対象ファイル**:
- `packages/client/src/pages/InboxPage.tsx`（**新規** Focus Inbox 本体）
- `packages/client/src/components/Inbox/SummaryCards.tsx`（**新規** 純粋コンポーネント、data props）
- `packages/client/src/components/Inbox/RemindersList.tsx`（**新規** 純粋コンポーネント、reminders props）
- `packages/client/src/components/Inbox/DraftsList.tsx`（**新規** 純粋コンポーネント、drafts props）
- `packages/client/src/App.tsx`（`/chat/*` 新設 + `/*` を InboxPage に切替）
- `packages/client/src/__tests__/SummaryCards.test.tsx` / `RemindersList.test.tsx` / `DraftsList.test.tsx` / `InboxPage.test.tsx`（**新規** 計 17 ケース）

**タスク**:
- [x] ルート `/` を `InboxPage` に変更（チャット画面は `/chat/*` に移動）
- [x] 後方互換: `?channel=X` クエリで `/chat?channel=X` にリダイレクト
- [x] サマリーカード 3 連（未読 / 今日の予定 / 未完タスク）— `Promise.all([api.channels.list, api.calendar.events.list, api.tasks.list])` を Suspense で取得
- [x] タブ 5 つ（URL は `?tab=mentions|threads|reminders|drafts|all`）
  - [x] リマインダータブ: `api.reminders.list()`
  - [x] 下書きタブ: `api.drafts.getAll()`
  - [x] すべてタブ: リマインダー + 下書きを統合
  - [x] メンション/スレッドタブ: 「準備中」プレースホルダ（Step 6b/6c で実装）
- [x] React 19 ルール: `use(promise)` + Suspense / Promise は `useState` で安定化
- [x] 純粋コンポーネント（data props）と Suspense ラッパー（`use(promise)`）を分離してテスト容易化

**Step 6a のスコープ外（Step 6b/6c/6d へ繰り延べ）**:
- メンションタブの実機データ化 → 6b
- スレッドタブの実機データ化 → 6c
- バッジ連携（Rail メンション数 / ChannelList 未読数）+ クイックアクション（返信/完了）→ 6d

**設計判断**:
- 当初は `SummaryCards` 等が直接 `use(promise)` していたが、jsdom + vitest 環境で **Promise.all + use(promise) の Suspense 解決が再現困難** だったため、純粋コンポーネント (data 配列を props で受け取る) と Suspense ラッパー (`use(promise)` で配列を取り出す) に分離する設計を採用。これによりロジック検証は純粋コンポーネントの単体テストでカバーし、Suspense 経由の表示確認は E2E に逃がす方針。

**受け入れ基準**:
- [x] `/` を開くと InboxPage が表示される
- [x] 既存 `/?channel=X` リンクは `/chat?channel=X` にリダイレクトされる
- [x] サマリーカード 3 連 + 5 タブが表示される
- [x] 全 1371 件 pass / 5 件 skip / 型チェック・ESLint エラーなし

#### Step 6b: メンションタブ実機データ化
**ブランチ**: `feature/brush-up-uiux-step-6b-mentions-tab`
**PR**: [#213](https://github.com/mokemoke2850/chat-app-for-claudecode-test/pull/213)

**重要発見**: DB の `mentions` テーブルに既に `is_read` フラグがあるため、**DB スキーマ変更不要**。サーバー側は既存 `searchMessages` の責務拡張のみで完了。

**対象ファイル**:
- `packages/shared/src/types/message.ts`（`MessageSearchFilters` に `mentionedToMe?: boolean` / `unreadOnly?: boolean` を追加）
- `packages/server/src/services/messageService.ts`（`searchMessages(q, filters, currentUserId?)` のシグネチャ拡張、mentions JOIN + is_read フィルタ）
- `packages/server/src/controllers/messageController.ts`（クエリ抽出 + `req.userId` を `currentUserId` として渡す + `q` 空 + `mentionedToMe=true` だけで 200 を返す）
- `packages/server/src/__tests__/integration/search.test.ts`（+3 ケース）
- `packages/client/src/api/client.ts`（URLSearchParams に `mentionedToMe` / `unreadOnly` を渡すロジック追加）
- `packages/client/src/components/Inbox/MentionsList.tsx`（**新規** 純粋コンポーネント、messages props）
- `packages/client/src/__tests__/MentionsList.test.tsx`（**新規** 4 ケース）
- `packages/client/src/pages/InboxPage.tsx`（`MentionsSection` Suspense ラッパー追加 / `AllSection` に mentions を統合 / 「準備中」プレースホルダ撤去）
- `packages/client/src/__tests__/InboxPage.test.tsx`（api mock に `messages.search` 追加 / メンション「準備中」テスト削除）

**タスク**:
- [x] `MessageSearchFilters` に `mentionedToMe` / `unreadOnly` フィルタ追加
- [x] サーバー側 `searchMessages` で mentions テーブル JOIN + `mn.is_read` フィルタ実装
- [x] フロント側 `api.messages.search` の URLSearchParams 拡張
- [x] InboxPage のメンションタブで `api.messages.search('', { mentionedToMe: true, unreadOnly: true })` を呼ぶ
- [x] 「準備中」プレースホルダ撤去
- [x] `MentionsList.tsx` 純粋コンポーネント新設

**Step 6b のスコープ外（後続 Step）**:
- スレッドタブ実機データ化 → 6c
- バッジ連携 + クイックアクション → 6d

**受け入れ基準**:
- [x] メンションタブで自分宛の未読メンションが表示される
- [x] 全 1374 件 (client) + 1363 件 (server) pass / 型チェック・ESLint エラーなし

#### Step 6c: スレッドタブ実機データ化（PR #214 マージ済み）
**ブランチ**: `feature/brush-up-uiux-step-6c-threads-tab`
**PR**: [#214](https://github.com/mokemoke2850/chat-app-for-claudecode-test/pull/214)

**対象ファイル**:
- `packages/shared/src/types/thread.ts` (新規) — `ThreadSummary` 型定義
- `packages/server/src/services/threadService.ts` (新規) — `listSubscribedThreads(userId)`
- `packages/server/src/routes/threads.ts` (新規) — `GET /api/threads/subscribed`
- `packages/server/src/app.ts` — `/api/threads` ルート登録
- `packages/server/src/__tests__/integration/threadsSubscribed.test.ts` (新規) — 10 件
- `packages/client/src/api/client.ts` — `api.threads.listSubscribed()` 追加
- `packages/client/src/components/Inbox/ThreadsList.tsx` (新規) — 純粋コンポーネント
- `packages/client/src/__tests__/ThreadsList.test.tsx` (新規) — 3 件
- `packages/client/src/pages/InboxPage.tsx` — スレッドタブ実機データ化 / `PlaceholderTab` 撤去
- `packages/client/src/__tests__/InboxPage.test.tsx` — 既存「準備中プレースホルダ」テストを `api.threads.listSubscribed` 呼び出し検証に置換

**達成タスク**:
- [x] サーバー側 `GET /api/threads/subscribed` を新設（自分が返信投稿したスレッドのルートメッセージを集約）
- [x] フロント側 `api.threads.listSubscribed()` を追加
- [x] InboxPage のスレッドタブで連携
- [x] 「準備中」プレースホルダを撤去
- [x] `ThreadsList.tsx` 純粋コンポーネント新設

**「購読中スレッド」確定スコープ**:
- `parent_message_id IS NOT NULL` かつ `user_id = me` の返信メッセージが存在するスレッドのルート
- 結果ソート: `lastReplyAt` 降順
- ルートメッセージが論理削除済みの場合は除外
- リアクション関与・メンション関与は対象外（後続 Step で拡張可）

**重要発見・実装メモ**:
- pg-mem は **相関サブクエリ（FROM 外のエイリアス参照）を実行できない**。集計クエリは `LEFT JOIN + GROUP BY` で組み直す必要があった。今後 `messageService` の集計を追加する際は事前に確認すること。
- `messageService.getMessageById` は既存に存在していた（誤って重複定義しそうになったので注意）。新規ヘルパー追加前に既存実装を確認するのが安全。
- `ThreadSummary.unreadCount` は **0 固定**。`thread_reads` テーブルが未設計のため Step 6d 以降で本実装する。

**受け入れ基準**:
- [x] スレッドタブで自分が返信投稿したスレッドのルートメッセージが表示される
- [x] 全 1377 件 (client) + 1373 件 (server) pass / 型チェック・ビルドエラーなし

#### Step 6d: バッジ連携 + Inbox クイックアクション（PR #215 マージ済み）
**ブランチ**: `feature/brush-up-uiux-step-6d-badges-actions`
**PR**: [#215](https://github.com/mokemoke2850/chat-app-for-claudecode-test/pull/215)

**対象ファイル**:
- `packages/client/src/hooks/useMentionUnreadCount.ts` (新規) — `api.messages.search('', { mentionedToMe: true, unreadOnly: true })` を再利用してメンション未読数を集計
- `packages/client/src/hooks/__tests__/useMentionUnreadCount.test.tsx` (新規) — 4 件
- `packages/client/src/components/Layout/Rail.tsx` — ホームアイコンに `useMentionUnreadCount` を渡してバッジ表示
- `packages/client/src/__tests__/Rail.test.tsx` — メンション未読バッジテスト 4 件追加
- `packages/client/src/components/Channel/ChannelItem.tsx` — バッジ色を CSS 変数 (`var(--accent)` / `var(--text-muted)`) に切替
- `packages/client/src/components/Inbox/RemindersList.tsx` — 「完了」ボタン + `onComplete` props 追加
- `packages/client/src/__tests__/RemindersList.test.tsx` — 「完了」アクションテスト 3 件追加
- `packages/client/src/components/Inbox/DraftsList.tsx` — 「再開」ボタン + `onResume` props (DraftResumeTarget 型) 追加
- `packages/client/src/__tests__/DraftsList.test.tsx` — 「再開」アクションテスト 4 件追加
- `packages/client/src/pages/InboxPage.tsx` — `handleReminderComplete` (api.reminders.delete + remindersKey 更新) / `handleDraftResume` (navigate) を実装
- `packages/client/src/__tests__/TaskBoardPage.test.tsx` — Rail 経由の `api.messages.search` モック追加（既存テスト改修）

**達成タスク**:
- [x] Rail のメンション数バッジを Step 6b の API 結果から導出（保留 TODO #5 解消）
- [x] ChannelList の未読数バッジ色調整（メンション = accent / 通常 = muted、保留 TODO #7 解消）
- [x] InboxPage のリマインダーカードに「完了」クイックアクション追加（`api.reminders.delete` + 再フェッチ）
- [x] InboxPage の下書きカードに「再開」クイックアクション追加（チャンネル → `/chat?channel=X`、DM → `/dm?conversation=Y`）

**スコープ外（後続 Step / 別 issue）**:
- メンション既読化アクション（個別メンション既読化 API の新設が必要）
- スレッド既読化アクション（thread_reads テーブル新設 + API が必要）
- スレッド `unreadCount` の本実装（Step 6c で 0 固定にしたまま）

**重要発見・実装メモ**:
- **AppLayout 経由で動く新規 hook の影響**: `useMentionUnreadCount` を Rail に組み込んだことで、AppLayout を使う既存テスト (TaskBoardPage.test.tsx) で `api.messages.search` 不足の TypeError が発生。ハマりどころに既出の罠を再体験。**Rail に新しい hook を追加するときは AppLayout 経由のページ（TaskBoardPage / CalendarPage / ChatPage）の api モックも忘れず追加する**
- `useMentionUnreadCount` は現在パスが `/` のとき 0 を返す設計（自分が見ている画面に冗長表示しないため）。`useDmUnreadCount` の `pathname.startsWith('/dm')` パターンを踏襲
- リマインダー完了後の再フェッチは `useState<number>` のキー更新でシンプルに実装。`useMemo` の deps に key を追加することで Suspense 互換のまま再フェッチ可能

**受け入れ基準**:
- [x] Rail のホームアイコンにメンション未読数バッジが表示される
- [x] ChannelList のメンション/未読バッジが accent / muted 色になっている
- [x] リマインダー「完了」/ 下書き「再開」が動作する
- [x] 全 1392 件 (client) + 1373 件 (server) pass / 型チェック・ビルドエラーなし

---

### Step 7: 検索ページ作り直し + 保存ビュー移設
**サブステップに分割（ユーザー合意「案 A」、レートリミット対策で各 PR を小さく）**

#### Step 7a: 検索ページ新設 + Rail アイコン有効化 + ChatPage dead code 撤去（PR #217 マージ済み）
**ブランチ**: `feature/brush-up-uiux-step-7a-search-page`
**PR**: [#217](https://github.com/mokemoke2850/chat-app-for-claudecode-test/pull/217)

**対象ファイル**:
- `packages/client/src/pages/SearchPage.tsx` (新規) — 検索画面（既存 SearchFilterPanel / SearchResults 流用）
- `packages/client/src/__tests__/SearchPage.test.tsx` (新規) — 8 件
- `packages/client/src/App.tsx` — `/search` ルート追加
- `packages/client/src/components/Layout/Rail.tsx` — 検索アイコン disabled 解除 → `NavLink to="/search"` 化
- `packages/client/src/__tests__/Rail.test.tsx` — 検索アイコン disabled テスト → /search リンクテストに置換、TOP_ITEMS 5→6 アイコン
- `packages/client/src/pages/ChatPage.tsx` — 検索系 dead code 約 130 行を撤去（state / hasAnyFilter / debounce useEffect / handleNavigate / isSearchMode / SearchFilterPanel/SearchResults 表示ロジック / 関連 import / チャンネル切替時の検索リセット）
- `packages/client/src/__tests__/ChatPage.test.tsx` — `describe.skip('検索モードの切り替え')` 撤去、AppLayout スタブの search props と SearchFilterPanel/SearchResults スタブを撤去

**達成タスク**:
- [x] 検索を独立ページ化（モーダル → ページ）
- [x] Rail 検索アイコン有効化（保留 TODO #1 解消）
- [x] ChatPage dead code 撤去（保留 TODO #2 解消）
- [x] 「現在の条件を保存」ボタン（既存 SearchFilterPanel の `onSaveView` を SearchPage で再構築）

**スコープ外（後続 7b/7c）**:
- 保存ビューのピル一覧表示 + クリックで条件適用 → Step 7b
- チップ式フィルタ入力 (`from:` `in:` `has:` 等の構文パーサー) + 結果スニペットハイライト → Step 7c

**重要発見**:
- ChatPage 内の検索系 state は `searchActive` 含めて完全に dead だった（AppLayout から検索 props が無いため発動経路ゼロ）。dead code 撤去で約 130 行削減
- 既存 `SearchFilterPanel.tsx` は既に `onSaveView` 機能を持っており、SearchPage への移植は API 互換のままで完了

**受け入れ基準**:
- [x] Rail 検索アイコンクリックで `/search` に遷移する
- [x] クエリ入力 + フィルタで `api.messages.search` が debounce 込みで呼ばれる
- [x] 結果クリックで `/chat?channel=X#message-Y` に遷移する
- [x] 「保存」ボタンで `api.savedViews.create` が呼ばれる
- [x] 全 1411 件 (client) + 1373 件 (server) pass / 型チェック・ビルドエラーなし

#### Step 7b: 保存ビューのピル一覧表示（PR #218 マージ済み）
**ブランチ**: `feature/brush-up-uiux-step-7b-saved-view-pills`
**PR**: [#218](https://github.com/mokemoke2850/chat-app-for-claudecode-test/pull/218)

**対象ファイル**:
- `packages/client/src/components/Search/SavedViewPills.tsx` (新規) — 純粋コンポーネント / MUI Chip + onSelect / onDelete
- `packages/client/src/components/Search/SavedViewsSection.tsx` (新規) — Suspense ラッパー / `use(promise)` で savedViews 取得 → SavedViewPills に渡す
- `packages/client/src/__tests__/SavedViewPills.test.tsx` (新規) — 5 件
- `packages/client/src/pages/SearchPage.tsx` — `useMemo + savedViewsKey` で promise 安定化、Suspense 内に SavedViewsSection を配置、handleSelectSavedView / handleDeleteSavedView 実装
- `packages/client/src/__tests__/SearchPage.test.tsx` — api モックに `savedViews.list` / `savedViews.delete` 追加 / SavedViewsSection スタブ + Step 7b テスト 2 件追加

**達成タスク**:
- [x] `SavedViewPills.tsx` を SearchPage 上部に配置（`api.savedViews.list()` で取得）
- [x] ピルクリックで保存ビューの query を SearchPage の state（searchQuery / searchFilters）に流し込む
- [x] 削除アクション（×ボタン）を各ピルに配置 + 再フェッチ
- [x] 保存ボタン押下時にもピル一覧を即時更新

**重要発見（再確認）**:
- `useMemo + Suspense + use(promise)` のテストが jsdom + vitest 環境で安定しない Step 6a 由来のハマりどころが再発
- **対策パターン**: Suspense ラッパー (`SavedViewsSection.tsx`) を **別ファイルに切り出して** テスト時に `vi.mock` で丸ごとスタブ化する。これにより SearchPage のテストでは `use(promise)` を経由せずに onSelect / onDelete を直接駆動できる
- Inbox では SearchPage 内の関数として定義していたパターンを、本 PR で別ファイル化することで責務分離 + テスト容易性が向上した。今後 Suspense ラッパーは積極的に別ファイル化する方針

**スコープ外（後続 7c）**:
- チップ式フィルタ入力 (`from:` `in:` `has:` 等)
- 結果リストのスニペットハイライト

**受け入れ基準**:
- [x] `/search` でピル一覧が表示される（保存ビューがある場合）
- [x] ピルクリックで条件が適用される（searchQuery + searchFilters）
- [x] × アイコンで削除 → ピル消失 + 再フェッチ
- [x] 保存ボタンで新規ピル即時表示
- [x] 全 1418 件 (client) + 1373 件 (server) pass / 型チェック・ビルドエラーなし

#### Step 7c: チップ式フィルタ入力 + スニペットハイライト（**さらに 7c-1 / 7c-2 に分割**）
**ユーザー合意で `has:link` はスコープ外、SearchFilterPanel は併存**

##### Step 7c-1: チップ式フィルタ入力 + サーバー `channelId` 対応（PR #219 マージ済み）
**ブランチ**: `feature/brush-up-uiux-step-7c-search-chips`
**PR**: [#219](https://github.com/mokemoke2850/chat-app-for-claudecode-test/pull/219)

**対象ファイル**:
- `packages/client/src/utils/parseSearchChips.ts` (新規) — Slack 風構文を解析する純粋関数
- `packages/client/src/utils/__tests__/parseSearchChips.test.ts` (新規) — 16 件
- `packages/client/src/components/Search/ChipFilterInput.tsx` (新規) — TextField + 解析チップ表示の純粋コンポーネント
- `packages/client/src/__tests__/ChipFilterInput.test.tsx` (新規) — 12 件
- `packages/client/src/components/Search/ChipFilterSection.tsx` (新規) — Suspense ラッパー / 別ファイル化パターン踏襲
- `packages/shared/src/types/message.ts` — `MessageSearchFilters.channelId?: number` 追加
- `packages/server/src/services/messageService.ts` — searchMessages に channelId フィルタ追加
- `packages/server/src/controllers/messageController.ts` — channelId クエリ受付 + hasAnyFilter 判定追加
- `packages/server/src/__tests__/integration/search.test.ts` — channelId フィルタテスト 3 件追加
- `packages/client/src/api/client.ts` — `messages.search` の URLSearchParams で channelId 送信
- `packages/client/src/components/Chat/SearchFilterPanel.tsx` — `SearchFilters` 型に channelId?: number 追加
- `packages/client/src/pages/SearchPage.tsx` — 既存 TextField を ChipFilterSection に置換、`chipFilters` と `searchFilters` を独立管理し effectiveFilters でマージ
- `packages/client/src/__tests__/SearchPage.test.tsx` — ChipFilterSection スタブ + Step 7c-1 テスト 1 件追加

**達成タスク**:
- [x] チップ式フィルタ入力欄（`from:user` `in:channel` `has:file` `before:YYYY-MM-DD` `after:YYYY-MM-DD` `tag:name`）の構文パーサー
- [x] サーバー `searchMessages` に `channelId` フィルタを追加（`in:channel` 実現のため）
- [x] 既存 `SearchFilterPanel` のドロップダウン UI と併存（チップで指定したフィールドは searchFilters を上書き）

**重要発見・実装メモ**:
- `chipFilters` と `searchFilters` のマージ動作: チップ由来のフィールドが SearchFilterPanel 由来を上書きする（Step 7c-1 の合理的妥協。双方向同期は Step 8 後に検討）
- マスタ照合（username → userId 等）で該当が無い項目は **チップを「グレー」で表示** し、フィルタへは反映しない（誤入力時の UX 配慮）
- `tags` のマスタは `api.tags.suggestions('', 1000)` で取得（`api.tags.list` が無いため）

**スコープ外（後続 7c-2）**:
- 結果リストでクエリにマッチした部分のハイライト表示
- スニペット表示（前後の文脈数十文字）
- `has:link` 対応（サーバー側 URL 正規表現マッチが必要、別 issue）

**受け入れ基準**:
- [x] `from:alice has:file 議事録` のような複数構文を入力してチップで可視化される
- [x] マスタに該当しない `from:bob` などはグレーチップ表示 + フィルタ未反映
- [x] サーバー側 `channelId` フィルタが効く（テスト 3 件で検証済み）
- [x] 全 1447 件 (client) + 1376 件 (server) pass / 型チェック・ビルドエラーなし

##### Step 7c-2: 結果リストのスニペット + ハイライト（PR #220 マージ済み）
**ブランチ**: `feature/brush-up-uiux-step-7c-2-snippet-highlight`
**PR**: [#220](https://github.com/mokemoke2850/chat-app-for-claudecode-test/pull/220)

**対象ファイル**:
- `packages/client/src/utils/buildSnippet.ts` (新規) — `(text, keyword) => { before, match, after }` の純粋関数
- `packages/client/src/utils/__tests__/buildSnippet.test.ts` (新規) — 12 件
- `packages/client/src/components/Chat/SearchResults.tsx` — `keyword?: string` props を追加、`buildSnippet` で本文を分割し `<Box component="mark">` でハイライト
- `packages/client/src/__tests__/SearchResults.test.tsx` — スニペット + ハイライトテスト 4 件追加
- `packages/client/src/pages/SearchPage.tsx` — `<SearchResults keyword={searchQuery} />` を渡す

**達成タスク**:
- [x] 結果リストでクエリにマッチした部分を `<mark>` でハイライト表示
- [x] スニペット表示（マッチ位置の前後 30 文字を抜粋、最大 80 文字、省略記号 `…` 付与）
- [x] 大文字小文字を無視してマッチ + 元のケースを保持

**実装メモ**:
- ハイライトカラー: `var(--accent-soft, #fff59d)` のフォールバック付き
- 複数マッチは最初のみハイライト（シンプル化）
- `extractMessageText` で本文を純粋テキスト化してから snippet 生成（Quill Delta / TipTap / プレーンテキスト全形式に対応）

**受け入れ基準**:
- [x] クエリ入力時、結果カードにハイライト表示 + スニペット抜粋
- [x] keyword 未指定時は本文先頭抜粋（ハイライトなし）
- [x] 全 1463 件 (client) + 1376 件 (server) pass / 型チェック・ビルドエラーなし

---

### Step 8: モバイル対応
**ブランチ**: `feature/brush-up-uiux-step-8-mobile`
**対象ファイル**:
- `AppLayout.tsx` のレスポンシブ対応
- `ContextRail.tsx` のボトムシート化

**タスク**:
- [ ] モバイル幅（< 768px）でボトムタブバーに切り替え
- [ ] サイドバーをドロワー化
- [ ] ContextRail をボトムシートにフォールバック

---

## 保留 TODO リスト

リリース前に必ず解決する必要がある「動線が未完成の UI 要素・機能」を一元管理する。各エントリは PR 番号 / Step 番号 / 解決予定 Step を明記する。

| # | 内容 | 由来 PR | 解決予定 Step | 状態 |
|---|------|---------|---------------|------|
| 1 | Rail の検索アイコンが disabled（クリックしても何も起きない） | Step 2b | Step 7a | 🟢 解決済み |
| 2 | 検索 UI が画面から消失（AppBar 撤去）。ChatPage 内の検索 state / `SearchResults` / `SearchFilterPanel` の描画ロジック / `onSelectSavedView` handler が dead code として残置。Ctrl+F ショートカット撤去 | Step 2b / Step 3a | Step 7a (検索ページ新設で dead code 撤去) | 🟢 解決済み |
| 3 | Rail の DM 未読バッジ未実装 | Step 2b | Step 2c | 🟢 解決済み |
| 5 | Rail のメンション数バッジ未実装 (Inbox 連動) | Step 2b | Step 6d | 🟢 解決済み |
| 6 | ChannelList の行コンパクト化 (28px / `#` 🔒 ピン アイコン整形) | Step 3a | Step 3b | 🟢 解決済み |
| 7 | ChannelList の未読数バッジ (メンション = accent / 通常 = muted) | Step 3a | Step 6d | 🟢 解決済み |
| 8 | Sidebar に DM 会話一覧ブロック未追加（プロンプト §3.3 の "DM" ブロック） | Step 3a | Step 3c | 🟢 解決済み |
| 4 | Rail 最上部のロゴが暫定デザイン（"C" の四角） | Step 2b | 任意 Step（最終デザイン調整時） | ⚪ 未解決 |
| 9 | ContextRail と既存 UI（ChatPage トップバーの `ChannelTopicBar` 編集ボタン群）が併設されている。ContextRail の「概要」タブ完成後に TopicBar の編集系を撤去予定 | Step 5a | Step 5c-1 | 🟢 解決済み |
| 10 | ContextRail と既存 UI（メッセージエリア上部の `PinnedMessages` バー）が併設されている。ContextRail の「ピン留め」タブで代替できるため撤去予定 | Step 5a | Step 5b | 🟢 解決済み |
| 11 | ContextRail と既存 UI（`ChannelList` から呼ばれる `ChannelMembersDialog`）が併設されている。ContextRail の「メンバー」タブで代替できるため撤去予定 | Step 5a | Step 5c-2 | 🟢 解決済み |
| 12 | ContextRail に「ファイル」タブが未実装（5a スコープ外） | Step 5a | Step 5b | 🟢 解決済み |
| 13 | ContextRail の「予定」タブが準備中プレースホルダのみ。実機データ化が必要 | Step 5b | Step 5c-1 | 🟢 解決済み（既存 `api.calendar.events.list` で対応） |

凡例: ⚪ 未解決 / 🟢 解決済み

---

## 全体の最終受け入れ基準（プロンプト §7 より転記）

- [ ] `/` を開くと Focus inbox が表示される
- [ ] 左 64px のアイコンレール + 280px のリスト列の 3 列レイアウト
- [ ] チャンネル画面で右ペイン（Context rail）の開閉ができ、状態が永続化される
- [ ] メッセージにバブルがない / 連投はアバター省略マージ / ホバーでアクションバー浮上
- [ ] 検索ページでチップ式フィルタが使える / 保存ビューのピル一覧
- [ ] ダークモードで全画面のコントラストが破綻していない（WCAG AA 以上）
- [ ] モバイル幅でボトムタブバーに切り替わり、サイドバーがドロワー化
- [ ] 既存主要機能（送信 / リアクション / スレッド / DM / カレンダー / タスク / 検索）が維持
- [ ] ESLint / Prettier / 型チェック / 既存テスト全部通過

---

## 次セッションへの引き継ぎ（2026-05-02 時点）

このセッションでは Step 1〜3c を完了。コンテキストが溜まったため別セッションへ引き継ぐ。**このセクションは引き継ぎ専用**であり、ブランチ運用方針・リリース実装方針・TDD フロー等のルールは上部のセクションを必読とする（重複記載しない）。

### 直近の状態
- 統合ブランチ `feature/brush-up-uiux` は最新（Step 7c-2 PR #220 マージ済み）
- マージ済み PR: #200 / #201 / #202 / #203 / #204 / #205 / #206 / #207 / #208 / #209 / #210 / #211 / #212 / #213 / #214 / #215 / #216 / #217 / #218 / #219 / #220
- **Step 6 全完了 / Step 7 全完了** (7a / 7b / 7c-1 / 7c-2 すべて完了、保留 TODO #1, #2 解消)
- 残り Step: **8 (モバイル対応) のみ**

### 次セッションで真っ先にやるべきこと
1. `git checkout feature/brush-up-uiux && git pull --ff-only`
2. **「[リリース・実装方針](#リリース実装方針2026-05-02-ユーザー指示)」と「[ブランチ運用方針](#ブランチ運用方針)」を必読**
3. main を統合ブランチに取り込んで差分肥大化を防ぐ（前回取り込みから時間経過があれば）: `git fetch origin main && git merge origin/main`
4. ユーザーから次の Step を指示してもらう（残るのは Step 8 のみ）

### Step 8 (モバイル対応) 着手時の論点
- ブレークポイント: `< 768px` でモバイル UI に切替
- AppLayout のグリッド構造をレスポンシブ化（Rail 64px + Sidebar 240px + Main + RightPane 320px → モバイルでは Main のみ + ボトムタブバー）
- Rail のナビゲーション項目をモバイル底部のボトムタブバーに移動（ホーム / DM / カレンダー / タスク / ブックマーク / 検索）
- Sidebar (ChannelList) はドロワー化（ハンバーガーアイコンで開閉）
- ContextRail はボトムシートにフォールバック（タブで開閉）
- 既存のテストは `width: 768px+` を想定しているので、モバイル切替を `useMediaQuery` で実装し既存テストの挙動を維持
- 影響範囲: AppLayout / Rail / ContextRail + 関連ページ（ChatPage / SearchPage / TaskBoardPage / CalendarPage / DMPage / InboxPage / BookmarkPage / FilesPage / TemplatesPage）

### Suspense 解決の罠（Step 6a で判明）
- jsdom + vitest 環境で **`Promise.all([...]) + use(promise)` を使うと Suspense fallback のまま固まる** ことがある
- **対策**: `use(promise)` するコンポーネントを「**配列を props で受け取る純粋コンポーネント**」と「**`use(promise)` する Suspense ラッパー**」に分離する
  - ロジック検証は純粋コンポーネントの単体テストで実施 (data 直接渡し、Suspense 不要)
  - Suspense 経由表示は E2E (Playwright 等) でカバー
- 詳細: Step 6a の `SummaryCards.tsx` / `RemindersList.tsx` / `DraftsList.tsx` 実装を参照


### 開発上のハマりどころ（過去 Step で判明した罠）
- **cwd**: `npm run test` / `npx vitest` は `packages/client` 配下から実行する。リポジトリルートだと jsdom 環境設定 (`vite.config.ts`) が読まれず `ReferenceError: document is not defined` で全テスト失敗する
- **Edit 並列失敗**: PostToolUse の formatter フックが走った直後に同じファイルへ複数 Edit を並列発行すると、後続 Edit が `File has been modified since read` で失敗する。Edit は **直前に Read してから順次（直列）発行する**
- **AppLayout 経由で動く新規 hook / 子コンポーネント**: AppLayout が新たに hook (`useDmUnreadCount` 等) や子コンポーネント (`SidebarDmList` 等) を呼ぶと、AppLayout を使う既存テスト (`TaskBoardPage.test.tsx` / `CalendarPage.test.tsx` / `ChatPage.test.tsx`) で `api.xxx` 不足の `TypeError` や Suspense 解決失敗が起きる。**新規依存追加 PR では、AppLayout 経由の既存テストにも `vi.mock` でスタブ化 or `api` モック追加が必要**
- **`react-router-dom` の完全 mock 禁止**: `vi.mock('react-router-dom', () => ({ useNavigate: ... }))` のような完全 mock は `NavLink` / `MemoryRouter` を undefined にする。`importActual` パターン (`vi.mock('react-router-dom', async (importOriginal) => { const actual = await importOriginal(); return { ...actual, useNavigate: ... } })`) を使う
- **PROGRESS.md コンフリクト**: PR マージ前に統合ブランチ側で PROGRESS.md ステータスを「レビュー中」へ先行更新するとマージ時にコンフリクトする。**ステータスはマージ後にまとめて統合ブランチで更新する**運用に統一済み（本セクションの追記もこの運用に従う）
- **MUI の `sx` は jsdom で `toHaveStyle` が効きづらい**: `<ListItemButton sx={{ minHeight: 28 }}>` だと Emotion 経由の class になり jsdom で値が取れないことがある。テスト容易性が必要な箇所では `style={{ ... }}` props で渡す（Step 3b で採用）
- **CSS 変数 `var(--xxx)` を `toHaveStyle` で検証できない**: jsdom は CSS カスタムプロパティを解決しないため、`toHaveStyle({ borderColor: 'var(--accent)' })` は期待通りに動かない。**inline `style` で渡している場合は `element.style.borderColor` を直接読む**（Step 4 の `ReactionBadge.test.tsx` で採用）
- **`display: none` でアクションバーを隠すと a11y tree から消える**: `getByRole('button', { name: /edit/i })` などのアクセシビリティクエリが `display: none` の中身を検出できない。フロート表示でホバー前の見せ消しは **`opacity: 0; pointer-events: none;`** に統一する（Step 4 の `MessageItem.tsx` で採用）。同時に `userEvent.click` は `pointer-events: none` の要素をクリックできないため、対応の必要なテストには `userEvent.click(el, { pointerEventsCheck: 0 })` を渡す
- **モック内 `useEffect` で onSelect を自動発火する際の無限ループ**: `MockChannelList` 等の親 stub から子に渡される `onSelect` がレンダリング毎に inline 関数として再生成されるとき、`React.useEffect(() => onSelect?.(...), [onSelect])` だと毎レンダーで trigger され続ける。**依存配列を空 `[]` にして mount 時のみ発火させる**（Step 5a の `ChatPage.test.tsx` で採用、無限ループで vitest worker タイムアウト経験あり）
- **`vi.hoisted(() => vi.fn(() => null))` の型シグネチャ**: 後から `mockImplementation(({ onSelect }) => ...)` のように引数取り関数を渡すと TS2345 で「Target signature provides too few arguments」エラー。**`mockImplementation` の引数の直前行に `// @ts-expect-error` を置く**（Step 5a の `ChatPage.test.tsx` で採用）
- **`api` 依存コンポーネントを mock しないと unhandled rejection になる**: ContextRail のような `useMemo(() => Promise.all([api.xxx()]))` パターンを含むコンポーネントを vitest 環境で render すると、jsdom 環境では fetch が解決できず `ERR_INVALID_URL` の unhandled rejection が出る（テスト自体は pass しても warning として残る）。**子コンポーネントを `vi.mock` でスタブ化していても api 呼び出しは親が行うため、`api/client` 自体も `vi.mock` で stub にする必要あり**（Step 5a の `ContextRail.test.tsx` で採用）
- **`Promise.all([...]) + use(promise)` の Suspense 解決が jsdom + vitest で再現困難**: `useState(() => Promise.all([api.foo(), api.bar()]))` で promise を作って `use()` で受け取るパターンが、**vitest 環境では Suspense fallback のまま解決されない** ケースがある（`Promise.resolve` 直書きでも同様）。**対策: `use(promise)` するコンポーネントを「配列 props を受け取る純粋コンポーネント」と「`use(promise)` する Suspense ラッパー」に分離し、ロジック検証は純粋コンポーネントの単体テストで実施 / Suspense 経由表示は E2E に逃がす**（Step 6a の `SummaryCards.tsx` / `RemindersList.tsx` / `DraftsList.tsx` で採用）
- **Suspense ラッパーは別ファイル化する** (Step 7b で確立): InboxPage では `MentionsSection` 等の Suspense ラッパーを **同じファイル内の関数** として定義していたが、これだとテストから `vi.mock` で個別にスタブ化できず、 `useMemo + Suspense + use(promise)` のテストが安定しない。**対策: Suspense ラッパー自体を別ファイル (例: `SavedViewsSection.tsx`) に切り出し、テスト時に `vi.mock` で丸ごとスタブ化する**。これにより親コンポーネント (例: SearchPage) のテストでは Suspense 解決を経由せずに onSelect / onDelete などを直接駆動できる。今後 `use(promise)` するラッパーは原則として別ファイルに切り出す方針
- **`useAuth()` mock がレンダー毎に新オブジェクトを返すと `useMemo([user])` が無限 suspend する**: `vi.mock('../contexts/AuthContext', () => ({ useAuth: () => ({ user: { id: 1, ... } }) }))` のようにファクトリ関数内で毎回 user オブジェクトを生成すると、`useMemo([user])` で promise が再生成され続け Suspense が永久に解決しない。**対策: `vi.hoisted` で固定参照を作って返す**（Step 6a の `InboxPage.test.tsx` で採用）
- **pg-mem は相関サブクエリ（FROM 外のエイリアス参照）を実行できない**: `(SELECT MAX(x) FROM messages r WHERE r.id = outer_alias.id)` のような外部スコープのエイリアス参照は `ColumnNotFound` で実行時エラーになる。本物の Postgres では動くが pg-mem は限定対応。**対策: `LEFT JOIN + GROUP BY` か `WHERE id IN (subquery)` に書き換える**（Step 6c の `threadService.ts` で採用）
- **既存 export 関数を再定義しない**: `messageService.getMessageById` のように既に export されている関数を新規追加しようとすると TS2393 (Duplicate function implementation) で全テスト suite が落ちる。**新規ヘルパー追加前に grep で同名関数の有無を確認する**（Step 6c で実体験）
- **squash merge 後のローカルブランチ**: GitHub 側で squash merge されると親が変わって `git branch -d` が「未マージ」と判定する。マージ確認済みなら `-D` で削除して問題ない
- **describe.skip での退避は `// 保留 TODO #N` コメントで参照**: AGENTS.md ルール「機能未実装で skip する場合は別 issue 参照」を満たすため、本プロジェクトでは PROGRESS.md の保留 TODO 番号を参照する形で代替している

### このセッションで確立した運用パターン
- **TDD フロー**: ブランチ作成 → 現状調査 → スコープ提示・合意 → テスト項目 `it.todo` 記述 → ユーザー確認 → 実テスト書き換え → red 確認 → 実装 → green 確認 → PR 作成 → 統合ブランチで PROGRESS.md 更新（マージ後）
- **PR スコープを絞る**: プロンプト原文に対し過剰な場合は a/b/c 等のサブ Step に分割する（実例: Step 2 → 2a/2b/2c、Step 3 → 3a/3b/3c）
- **動線未完成 UI の許容**: ユーザー指示により dead code / disabled UI / dummy 表示は許容、ただし **必ず保留 TODO リストに登録**
- **PR 説明テンプレ**: `.github/PULL_REQUEST_TEMPLATE.md` の全セクション（概要 / 変更内容 / 影響範囲 / 動作確認・テスト結果 / 関連Issue / チェックリスト）を埋める
- **PROGRESS.md 更新タイミング**:
  - PR 作成時: 作業ブランチ側で「該当 Step の対象ファイル / タスク / スコープ外」を詳述、保留 TODO 状態を変更
  - マージ後: 統合ブランチ側でステータス（⚪→🟢）と完了日、更新履歴行を追加

### スコープ外で残しているもの（次セッション以降で処理）
- DMPage を AppLayout に統合（現状 DMPage は独自レイアウト、Sidebar/Footer/Rail 非表示） → 別 Step で検討
- 既存 DMPage 内 `DmConversationList` と新規 `SidebarDmList` の重複 → 上記統合時に解消
- CalendarPage / TaskBoardPage の Sidebar 列下部に SidebarDmList を表示するか → Step 6 InboxPage 連動で判断
- ChatPage 内に残る検索系 dead code (state / `SearchResults` / `SearchFilterPanel` / `onSelectSavedView` handler) → Step 7 で再構築 or 削除判断

---

## 開発ルール（必読）

- フロントは React 19。新規データフェッチは **`use(promise)` + `<Suspense>`**。`useEffect` + `setState` のフェッチは禁止。
- `use()` に渡す Promise は `useState` / `useMemo` で安定化させる。
- 変更したコンポーネントはテスト追加 / 更新。
- DB 変更が伴う場合は `db/schema.hcl` を編集 → `atlas schema apply --env local`。`initializeSchema` は触らない。
- PR は `.github/PULL_REQUEST_TEMPLATE.md` の全セクションを必ず埋める。
- 各 PR にはスクリーンショット（Light + Dark）を添付。

---

## 更新履歴

| 日付 | 変更内容 |
|------|----------|
| 2026-05-01 | 初版作成 / Step 0 開始 |
| 2026-05-01 | ブランチ命名規約をハイフン区切りに変更（Git 制約） / Step 1 方針を MUI ハイブリッドに確定 |
| 2026-05-01 | Step 1 PR #200 作成（レビュー中） |
| 2026-05-01 | Step 1 PR #200 マージ完了 |
| 2026-05-02 | Step 2 を 2a / 2b に分割。Step 2a PR #201 作成（レビュー中） |
| 2026-05-02 | Step 2a PR #201 マージ完了 / Step 2b 着手 |
| 2026-05-02 | リリース・実装方針セクションと保留 TODO リストを新設（ユーザー指示に基づく） |
| 2026-05-02 | Step 2b PR #202 作成（レビュー中）/ Step 2c (未読バッジ) を分離 |
| 2026-05-02 | Step 2b PR #202 マージ完了 |
| 2026-05-02 | Step 2c PR #203 作成・マージ完了（DM 未読バッジ実装） |
| 2026-05-02 | Step 3 を 3a / 3b / 3c に分割。3a 着手（削除のみ）。保留 TODO #6/#7/#8 を新設 |
| 2026-05-02 | Step 3a PR #204 マージ完了（保存ビュー / DmNavigationItems 撤去） |
| 2026-05-02 | Step 3b PR #205 マージ完了（ChannelList 行コンパクト化） |
| 2026-05-02 | Step 3c PR #206 マージ完了（Sidebar に SidebarDmList 追加） / セッション切替前に引き継ぎコメントを追記 |
| 2026-05-02 | Step 4 PR #207 マージ完了（MessageBubble バブル撤去 + 連投マージ + アクションバーフロート化 + ReactionBadge ピル化） / 開発上のハマりどころに pointer-events / CSS 変数の罠を追記 |
| 2026-05-02 | Step 5 を 5a / 5b に分割。Step 5a PR #208 マージ完了（ContextRail 概要/ピン/メンバー 3 タブ + AppLayout 4 列対応 + 開閉永続化）。保留 TODO #9〜#12（既存 UI 撤去 + ファイル/予定タブ）を Step 5b 用に新設。ハマりどころに onSelect 自動発火無限ループ / vi.hoisted の TS シグネチャ / api 依存 unhandled rejection の罠を追記 |
| 2026-05-02 | Step 5b PR #209 マージ完了（ContextRail にファイル/予定タブ追加 + Main 上部 PinnedMessages バー撤去）。ユーザー合意のもと「案 1: ミニマム (A + B + C)」スコープで実施し、TopicBar 編集系撤去 / MembersDialog 起動撤去 / 予定タブ実機データ化を Step 5c に繰り延べ。保留 TODO #10/#12 を解決済みに、#13（予定タブ実機データ化）を新設。Step 5c をテーブル + 詳述に追加 |
| 2026-05-02 | Step 5c を 5c-1 / 5c-2 に分割（ユーザー合意「案 B」）。Step 5c-1 PR #210 マージ完了（TopicBar 編集系を ChannelSettingsForm に分離 + 予定タブ実機データ化）。重要発見: 既存 `api.calendar.events.list` でチャンネル別予定一覧を取得できるためサーバー API 追加不要。ContextRail が 5 タブすべて実機データ完成形に。ChannelTopicBar 簡素化 (239→49 行)、ChannelTopic.test.tsx 491 行を削除し ChannelSettingsForm.test.tsx に責務移譲。保留 TODO #9/#13 を解決済みに |
| 2026-05-02 | Step 5c-2 PR #211 マージ完了（ChannelList → ChannelCategorySection → ChannelItem の onOpenMembersDialog props 伝搬を全削除 + Dialog 描画撤去）。**Step 5 (ContextRail) のすべてのサブステップ (5a / 5b / 5c-1 / 5c-2) が完了**。保留 TODO #11 (MembersDialog 撤去) を 🟢 解決済みに。残り Step は 6 (InboxPage) / 7 (検索ページ) / 8 (モバイル) のみ |
| 2026-05-02 | Step 6 を 6a / 6b / 6c / 6d に分割（ユーザー合意「案 B」、レートリミット対策で各 PR を小さく）。Step 6a PR #212 マージ完了（InboxPage 新設 + ルート `/` 差し替え + サマリーカード + リマインダー/下書き/すべてタブ実装）。React 19 Suspense + jsdom テストの問題で純粋コンポーネント (data props) と Suspense ラッパー (`use(promise)`) を分離する設計を採用。ハマりどころに「Promise.all + use(promise) の jsdom 解決失敗」「useAuth mock の新オブジェクト返しで useMemo 無限 suspend」を追記 |
| 2026-05-02 | Step 6b PR #213 マージ完了（メンションタブ実機データ化 + サーバー側 search API に `mentionedToMe` / `unreadOnly` フィルタ追加）。重要発見: 既存 `mentions.is_read` フラグを活用できるため DB スキーマ変更不要。`MentionsList.tsx` 純粋コンポーネント新設で Step 6a の分離パターンを踏襲。サーバー +3 統合テスト / クライアント +4 単体テスト |
| 2026-05-02 | Step 6c PR #214 マージ完了（スレッドタブ実機データ化 + サーバー側 `GET /api/threads/subscribed` 新設）。「購読中スレッド」を「自分が返信投稿したスレッド」と定義し DB スキーマ追加なしで実装。**重要発見: pg-mem は相関サブクエリ（FROM 外のエイリアス参照）を実行できない** → 集計クエリは `LEFT JOIN + GROUP BY` で組み直す必要あり。`unreadCount` は thread_reads 未設計のため 0 固定（Step 6d で本実装予定）。サーバー +10 統合テスト / クライアント +3 単体テスト + InboxPage テスト 1 件改修 |
| 2026-05-02 | Step 6d PR #215 マージ完了（Rail メンション数バッジ + ChannelList バッジ色 accent/muted 化 + Inbox リマインダー完了 / 下書き再開クイックアクション）。**Step 6 (Inbox 系) のすべてのサブステップ (6a/6b/6c/6d) が完了**。保留 TODO #5 (Rail メンション数バッジ) / #7 (ChannelList 未読バッジ色分け) を 🟢 解決済みに。`useMentionUnreadCount` hook を新設し Step 6b API を再利用。**ハマり再体験**: AppLayout 経由の TaskBoardPage.test.tsx で `api.messages.search` モックが必要（Rail に新 hook を追加する PR で繰り返し発生する罠）。クイックアクションのスコープはリマインダー / 下書きのみ。メンション既読 / スレッド既読は API 新設が必要なため後続 Step に持ち越し。残り Step は 7 (検索ページ) / 8 (モバイル) のみ |
| 2026-05-03 | 修正 PR #216 マージ完了（Inbox/Thread/Search の生 JSON 表示問題を修正 + `extractMessageText` util を共通化）。Inbox 4 コンポーネント + ThreadPanel + SearchResults の合計 6 箇所で重複していたパース関数を `packages/client/src/utils/extractMessageText.ts` に集約し、Quill Delta / TipTap / プレーンテキストの 3 形式に対応。構造不明な JSON は空文字を返して生 JSON が UI に透ける事故を防ぐ。`packages/shared/src/types/message.ts` の `Message.content` 型コメントを「TipTap JSON string」→「Quill Delta JSON string」に訂正（実際の RichEditor は Quill ベース） |
| 2026-05-03 | Step 7 を 7a / 7b / 7c に分割（ユーザー合意「案 A」、レートリミット対策で各 PR を小さく）。Step 7a PR #217 マージ完了（検索ページ新設 + Rail 検索アイコン有効化 + ChatPage の検索系 dead code 約 130 行を撤去）。保留 TODO #1 (Rail 検索アイコン disabled) / #2 (ChatPage 検索 dead code) を 🟢 解決済みに。既存 `SearchFilterPanel` / `SearchResults` を SearchPage に流用し、結果クリックで `/chat?channel=X#message-Y` へ navigate。保存ビュー作成 (`onSaveView` → `api.savedViews.create`) は 7a で対応済。後続 7b で保存ビューのピル一覧表示、7c でチップ式フィルタ + スニペットハイライトを実装予定 |
| 2026-05-03 | Step 7b PR #218 マージ完了（保存ビューのピル一覧表示 + クリックで条件適用 + 削除アクション）。SearchPage 上部に `SavedViewPills.tsx` (純粋) と `SavedViewsSection.tsx` (Suspense ラッパー) を新規追加、`useMemo + savedViewsKey` で promise を安定化し削除/作成後に再フェッチ。`SavedView.query → SearchFilters` の変換ロジックは `keyword` → `searchQuery`、それ以外 (`dateFrom`/`dateTo`/`userId`/`hasAttachment`/`tagIds`) → `searchFilters`（`channelId` は SearchFilters に無いため対象外）。**重要発見の再確認**: `useMemo + Suspense + use(promise)` の Inbox 由来パターンが SearchPage でも再発したため、**Suspense ラッパーを別ファイル化** することで `vi.mock` で丸ごとスタブ化できる責務分離パターンを確立（ハマりどころに追記）。残り Step は 7c (チップ式フィルタ + スニペット) / 8 (モバイル) のみ |
| 2026-05-03 | Step 7c を 7c-1 / 7c-2 に分割（ユーザー合意「案 A」）。Step 7c-1 PR #219 マージ完了（チップ式フィルタ入力 + サーバー `channelId` フィルタ追加）。`parseSearchChips.ts` (Slack 風構文解析) + `ChipFilterInput.tsx` (純粋コンポーネント) + `ChipFilterSection.tsx` (Suspense ラッパー、Step 7b 確立パターン踏襲) を新規追加。対応構文は `from:user` / `in:channel` / `has:file` / `before:YYYY-MM-DD` / `after:YYYY-MM-DD` / `tag:name`（`has:link` はスコープ外）。マスタ照合（username → userId / channel name → channelId / tag name → tagId）で該当が無い項目はチップを「グレー」表示してフィルタ未反映（誤入力時 UX）。`SearchFilters` に `channelId?: number` を追加し、サーバー `messageService.searchMessages` + `messageController` + 統合テスト 3 件にも対応。`SearchPage` では `chipFilters` と `searchFilters` を独立管理し `effectiveFilters` でマージ（チップ由来が SearchFilterPanel 由来を上書きする合理的妥協）。残り Step は 7c-2 (スニペット + ハイライト) / 8 (モバイル) のみ |
| 2026-05-03 | Step 7c-2 PR #220 マージ完了（結果リストのスニペット + ハイライト）。**Step 7 (検索ページ作り直し) のすべてのサブステップ (7a / 7b / 7c-1 / 7c-2) が完了**。`utils/buildSnippet.ts` (純粋関数) を新規追加し、 `(text, keyword) => { before, match, after }` 構造体を返す。大文字小文字無視マッチ + 元のケース保持、複数マッチは最初のみ、前後 30 文字抜粋・最大 80 文字、省略記号 `…` 付与。`SearchResults.tsx` に `keyword?: string` props を追加し、`<Box component="mark">` + `var(--accent-soft, #fff59d)` でハイライト。残り Step は **Step 8 (モバイル対応) のみ** で、ブラッシュアップ全体の終わりが見えた状態 |
