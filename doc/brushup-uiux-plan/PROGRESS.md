# UI/UX ブラッシュアップ 進捗管理

`packages/client` のチャット UI を、モック (`UI改善モック.html`) の方向性に合わせて段階的にリニューアルする作業の進捗管理ドキュメント。実装依頼の本文は [`claude-code-prompt.md`](./claude-code-prompt.md) を参照。

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
| 2b | AppBar 撤去 + ロゴ/ユーザーメニュー移設 (検索撤去 / 未読バッジは Step 2c) | `feature/brush-up-uiux-step-2b-rail-absorb` | [#202](https://github.com/mokemoke2850/chat-app-for-claudecode-test/pull/202) | 🔵 レビュー中 | - |
| 2c | Rail 未読バッジ実装 + 検索アイコンの動線復活準備 | `feature/brush-up-uiux-step-2c-unread-badges` (予定) | - | ⚪ 未着手 | - |
| 3 | ChannelList の整理（保存ビュー等の削除 + 3 段構成） | `feature/brush-up-uiux-step-3-channel-list` | - | ⚪ 未着手 | - |
| 4 | MessageItem のフラット化 + 連投マージ + ホバーアクションバー | `feature/brush-up-uiux-step-4-message-flat` | - | ⚪ 未着手 | - |
| 5 | ContextRail 新設（概要/ピン/ファイル/予定/メンバー） | `feature/brush-up-uiux-step-5-context-rail` | - | ⚪ 未着手 | - |
| 6 | InboxPage 新設（ルート `/` 差し替え） | `feature/brush-up-uiux-step-6-inbox-page` | - | ⚪ 未着手 | - |
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

### Step 2c: Rail 未読バッジ実装 (予定)
**ブランチ**: `feature/brush-up-uiux-step-2c-unread-badges`（予定）

**タスク**:
- [ ] DM 未読数バッジ（Rail の DM アイコン右上）
- [ ] メンション未読数バッジ（必要なら）
- [ ] 未読数の集計 hook 作成（既存 `useChannelNotifications` 等を利用）
- [ ] Socket イベント連動でリアルタイム更新

---

### Step 3: ChannelList の整理
**ブランチ**: `feature/brush-up-uiux-step-3-channel-list`
**対象ファイル**:
- `packages/client/src/components/Channel/ChannelList.tsx`
- `packages/client/src/components/Channel/ChannelCategorySection.tsx`
- `packages/client/src/components/Channel/SavedViewSection.tsx`（削除）

**タスク**:
- [ ] 「ピン留め」「カテゴリ別」「DM」の 3 ブロック構成
- [ ] 行はコンパクト表示（高さ 28px、左に `#` / 🔒 / ピンアイコン）
- [ ] 未読は太字 + 右端バッジ、メンションは accent 色バッジ、その他は muted バッジ
- [ ] `SavedViewSection.tsx` を削除（検索画面に移設予定 = Step 7）
- [ ] 「ブックマーク」「テンプレート管理」「管理画面」の項目を削除（Rail に移譲済み）

**依存**: Step 2 完了後

---

### Step 4: MessageItem のフラット化
**ブランチ**: `feature/brush-up-uiux-step-4-message-flat`
**対象ファイル**:
- `packages/client/src/components/Chat/MessageItem.tsx`
- `packages/client/src/components/Chat/MessageBubble.tsx`

**タスク**:
- [ ] `MessageBubble` の角丸 + 影 + 背景を撤去 → プレーンな縦組みへ
- [ ] 連投マージ: 直前メッセージと「同送信者・5 分以内」なら `continued` クラスでアバター/名前/時刻を非表示
- [ ] ホバー時アクションバーを `position: absolute; top: -12px; right: 24px;` でフロート
- [ ] リアクションを 22px ピル形状（自分のリアクションは accent 色枠）
- [ ] 行ホバーで背景を薄く

**受け入れ基準**:
- バブルがない / 連投マージ動作 / ホバーでアクションバー浮上

---

### Step 5: ContextRail 新設
**ブランチ**: `feature/brush-up-uiux-step-5-context-rail`
**対象ファイル**:
- `packages/client/src/components/Channel/ContextRail.tsx`（新規）
- `packages/client/src/components/Channel/ChannelTopicBar.tsx`（ロジック移譲）
- `packages/client/src/components/Channel/PinnedMessages.tsx`（同上）
- `packages/client/src/components/Channel/ChannelMembersDialog.tsx`（同上）

**タスク**:
- [ ] 320px の折り畳み可能ペインを右端に追加
- [ ] タブ: 概要 / ピン留め / ファイル / 予定 / メンバー
- [ ] 既存の TopicBar / PinnedMessages / MembersDialog ロジックを集約
- [ ] トップバー右端の `panelR` アイコンでトグル
- [ ] 開閉状態を `localStorage["contextRail.open"]` に永続化

**依存**: Step 2 完了後

---

### Step 6: InboxPage 新設
**ブランチ**: `feature/brush-up-uiux-step-6-inbox-page`
**対象ファイル**:
- `packages/client/src/pages/InboxPage.tsx`（新規）
- ルーティング設定（`App.tsx` 等）

**タスク**:
- [ ] ルート `/` を `InboxPage` に変更（"最後に開いたチャンネル" 起動を廃止）
- [ ] サマリーカード 3 連（未読 / 予定 / タスク）
- [ ] タブ: メンション / スレッド / リマインダー / 下書き / すべて（URL は `?tab=mentions`）
- [ ] タイムラインカードに **返信** / **完了（既読化）** クイックアクション
- [ ] 既存 API を組み合わせる: `GET /api/messages?mention=me&unread=1` 等（必要なら新エンドポイント追加可）
- [ ] React 19 ルール: `use(promise)` + `<Suspense>` でデータ取得、Promise は `useState` / `useMemo` で安定化

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
