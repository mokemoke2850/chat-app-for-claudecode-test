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
| 6b | メンションタブ実機データ化（サーバー側 search API に `mentionedToMe` / `unreadOnly` フィルタ追加） | `feature/brush-up-uiux-step-6b-mentions-tab`（予定） | - | ⚪ 未着手 | - |
| 6c | スレッドタブ実機データ化（サーバー側 `GET /api/threads/subscribed` 新設） | `feature/brush-up-uiux-step-6c-threads-tab`（予定） | - | ⚪ 未着手 | - |
| 6d | バッジ連携（Rail メンション数 / ChannelList 未読数）+ クイックアクション（返信 / 完了） | `feature/brush-up-uiux-step-6d-badges-actions`（予定） | - | ⚪ 未着手 | - |
| 7 | 検索ページ作り直し + 保存ビュー移設 | `feature/brush-up-uiux-step-7-search-page` | - | ⚪ 未着手 | - |
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

#### Step 6b: メンションタブ実機データ化（次の PR）
**ブランチ**: `feature/brush-up-uiux-step-6b-mentions-tab`（予定）

**タスク**:
- [ ] サーバー側 `MessageSearchFilters` に `mentionedToMe?: boolean` / `unreadOnly?: boolean` フィルタを追加
- [ ] `GET /api/messages/search` の WHERE 句で mentions テーブル JOIN + 既読/未読の判定追加
- [ ] フロント側 `api.messages.search` の型を拡張
- [ ] InboxPage のメンションタブで `api.messages.search('', { mentionedToMe: true, unreadOnly: true })` を呼ぶ
- [ ] 「準備中」プレースホルダを撤去
- [ ] `MentionsList.tsx` 純粋コンポーネント新設 (Suspense 解決問題回避のため)

#### Step 6c: スレッドタブ実機データ化（その次の PR）
**ブランチ**: `feature/brush-up-uiux-step-6c-threads-tab`（予定）

**タスク**:
- [ ] サーバー側 `GET /api/threads/subscribed` を新設（自分が返信したスレッド or リアクションしたスレッドを返す）
- [ ] フロント側 `api.threads.listSubscribed()` を追加
- [ ] InboxPage のスレッドタブで連携
- [ ] 「準備中」プレースホルダを撤去
- [ ] `ThreadsList.tsx` 純粋コンポーネント新設

#### Step 6d: バッジ連携 + クイックアクション（最後の PR）
**ブランチ**: `feature/brush-up-uiux-step-6d-badges-actions`（予定）

**タスク**:
- [ ] Rail のメンション数バッジ（`<Badge max={9}>`）を Step 6b の API 結果から導出（保留 TODO #5 解消）
- [ ] ChannelList の未読数バッジ（メンション = accent / 通常 = muted）を Step 6b/6c の集計から導出（保留 TODO #7 解消）
- [ ] InboxPage のタイムラインカードに **返信** / **完了（既読化）** クイックアクションを追加

---

### Step 7: 検索ページ作り直し + 保存ビュー移設
**ブランチ**: `feature/brush-up-uiux-step-7-search-page`
**対象ファイル**:
- `packages/client/src/components/Chat/SearchResults.tsx`
- `packages/client/src/components/Chat/SearchFilterPanel.tsx`
- 検索ページの新規ルート

**タスク**:
- [ ] 検索を独立ページ化（モーダル → ページ）
- [ ] チップ式フィルタ入力欄（`from:` `in:` `has:` `before:` `after:` `tag:`）
- [ ] 「現在の条件を保存」ボタン
- [ ] 保存ビューのピル一覧を上部に表示（クリックで条件適用）
- [ ] 結果リスト: チャンネル / 時刻 / 名前 / スニペット + ハイライト

**依存**: Step 3 完了後（保存ビュー削除済み）

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
| 1 | Rail の検索アイコンが disabled（クリックしても何も起きない） | Step 2b | Step 7 | ⚪ 未解決 |
| 2 | 検索 UI が画面から消失（AppBar 撤去）。ChatPage 内の検索 state / `SearchResults` / `SearchFilterPanel` の描画ロジック / `onSelectSavedView` handler が dead code として残置。Ctrl+F ショートカット撤去 | Step 2b / Step 3a | Step 7 (検索ページ新設時に再構築 or 撤去判断) | ⚪ 未解決 |
| 3 | Rail の DM 未読バッジ未実装 | Step 2b | Step 2c | 🟢 解決済み |
| 5 | Rail のメンション数バッジ未実装 (Inbox 連動) | Step 2b | Step 6 (InboxPage) | ⚪ 未解決 |
| 6 | ChannelList の行コンパクト化 (28px / `#` 🔒 ピン アイコン整形) | Step 3a | Step 3b | 🟢 解決済み |
| 7 | ChannelList の未読数バッジ (メンション = accent / 通常 = muted) | Step 3a | Step 6 (InboxPage 連動) | ⚪ 未解決 |
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
- 統合ブランチ `feature/brush-up-uiux` は最新（Step 6a PR #212 マージ済み）
- マージ済み PR: #200 / #201 / #202 / #203 / #204 / #205 / #206 / #207 / #208 / #209 / #210 / #211 / #212
- 残り Step: 6b (メンションタブ実機データ化) / 6c (スレッドタブ実機データ化) / 6d (バッジ + クイックアクション) / 7 (検索ページ) / 8 (モバイル)

### 次セッションで真っ先にやるべきこと
1. `git checkout feature/brush-up-uiux && git pull --ff-only`
2. **「[リリース・実装方針](#リリース実装方針2026-05-02-ユーザー指示)」と「[ブランチ運用方針](#ブランチ運用方針)」を必読**
3. main を統合ブランチに取り込んで差分肥大化を防ぐ（前回取り込みから時間経過があれば）: `git fetch origin main && git merge origin/main`
4. ユーザーから次の Step を指示してもらう（推奨順は Step 6b → 6c → 6d → 7 → 8。6b/6c はサーバー API 拡張を伴う。6d で保留 TODO #5/#7 が解消される）

### Step 6b (メンションタブ実機データ化) 着手時の論点
- 既存 `MessageSearchFilters` には `mentionedToMe` / `unreadOnly` フィルタがないため**サーバー側拡張が必須**
- DB スキーマ確認: `mentions` テーブル (message_id, user_id) を JOIN して mentioned_user_id でフィルタ
- 既読/未読は `read_states` または同等のテーブルが必要。既存の Channel.unreadCount の計算ロジックを参考にする
- フロント側 `api.messages.search` の戻り値 `MessageSearchResult` に既読フラグを追加するか、別 API にするか判断
- InboxPage のメンションタブで promise を取得 → `MentionsList.tsx`（**新規** 純粋コンポーネント）に渡す
- 既存の `RemindersList.tsx` / `DraftsList.tsx` パターンに沿って実装

### Step 6c (スレッドタブ実機データ化) 着手時の論点
- 「購読中スレッド」の定義を確認: 自分が返信投稿したスレッド or 自分がリアクションしたスレッド or 自分宛のメンションを含むスレッド
- DB クエリ: `messages` テーブルで `parent_message_id IS NOT NULL` (= 返信) で自分が関与したものを集計
- サーバー側 `GET /api/threads/subscribed` を新設。レスポンスはスレッドルート + 最終返信時刻 + 未読カウント
- フロント側 `api.threads.listSubscribed()` を追加 (現状 `api.threads` ネームスペース自体ない、新設)
- `ThreadsList.tsx`（**新規**）でルートメッセージとサマリーを表示

### Step 6d (バッジ連携 + クイックアクション) 着手時の論点
- **保留 TODO #5 解消**: Rail のメンション数バッジ
  - Step 6b で実装したメンション API を再利用 (Rail コンポーネント or AppLayout 配下の hook で集計)
  - DM 未読バッジ (Step 2c) と同じ位置に追加
- **保留 TODO #7 解消**: ChannelList の未読数バッジ
  - メンション数 = accent 色 / 通常未読 = muted 色 で色分け
  - 既存 `Channel.unreadCount` を ChannelItem で表示 + メンション数を別フィールドで分離
- **クイックアクション**: タイムラインカード上に「返信」「完了 (既読化)」ボタン
  - メンションタブ: 返信 → `/chat?channel=X#message-Y` に navigate / 完了 → メンション既読 API を呼ぶ
  - スレッドタブ: 返信 → スレッドペイン open / 完了 → 同上
  - リマインダータブ: 完了 → `api.reminders.delete(id)`
  - 下書きタブ: 「再開」→ `/chat?channel=X` に navigate

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
- **`useAuth()` mock がレンダー毎に新オブジェクトを返すと `useMemo([user])` が無限 suspend する**: `vi.mock('../contexts/AuthContext', () => ({ useAuth: () => ({ user: { id: 1, ... } }) }))` のようにファクトリ関数内で毎回 user オブジェクトを生成すると、`useMemo([user])` で promise が再生成され続け Suspense が永久に解決しない。**対策: `vi.hoisted` で固定参照を作って返す**（Step 6a の `InboxPage.test.tsx` で採用）
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
