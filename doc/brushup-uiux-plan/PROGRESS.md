# UI/UX ブラッシュアップ 進捗管理

`packages/client` のチャット UI を、モック (`UI改善モック.html`) の方向性に合わせて段階的にリニューアルする作業の進捗管理ドキュメント。実装依頼の本文は [`claude-code-prompt.md`](./claude-code-prompt.md) を参照。

> **2026-05-03 追記**: Step 1〜7 は全て完了。当初予定の Step 8 (モバイル) より前に PC 版ブラッシュアップを行うこととなり、番号混乱を避けるため **Step 8 = PC 版ブラッシュアップ / Step 9 = モバイル対応** に再採番。本ドキュメントは Step 8 / Step 9 を中心とし、過去 Step は要約のみとする。

## リリース・実装方針

- **リリースタイミング**: UI/UX ブラッシュアップは **全 Step 完了後にまとめてリリース** する。途中段階の中間ブランチが本番に出ることはない。
- **動線が存在しない UI は許容**: PR の途中段階で「Rail にアイコンはあるが遷移先がない」「ボタンを押しても何も起きない」などの **動線が未完成の UI 要素は許容する**。リリース前に全て繋がる予定。
- **実装忘れの防止 (必須)**: 動線が未完成の UI 要素・機能・ボタンを残す場合は、後述「[保留 TODO リスト](#保留-todo-リスト)」に **必ず** 追記する。コード内に放置せず、本ドキュメントを単一情報源とする。

---

## ブランチ運用方針

- 統合ブランチ: `feature/brush-up-uiux`（main から切る、長命）
- 各ステップ用作業ブランチ: `feature/brush-up-uiux-step-N-<topic>` を統合ブランチから切る
  - Git 制約により、統合ブランチと同名ディレクトリ階層は作れないためハイフン区切りで命名する
- PR は **作業ブランチ → 統合ブランチ** にマージ（レビュー単位を小さく保つ）
- 全ステップ完了後に **統合ブランチ → main** の最終 PR を作成
- 統合ブランチは定期的に `main` を取り込んで差分の肥大化を防ぐ（週 1 目安、または main 側で関連箇所が変わったタイミング）

---

## ステップ一覧

| # | テーマ | PR | 状態 | 完了日 |
|---|--------|----|------|--------|
| 1 | トークン刷新（CSS 変数 + ThemeContext） | [#200](https://github.com/mokemoke2850/chat-app-for-claudecode-test/pull/200) | 🟢 完了 | 2026-05-01 |
| 2a / 2b / 2c | AppLayout 3 列化 + Rail + AppBar 撤去 + DM 未読バッジ | #201 / #202 / #203 | 🟢 完了 | 2026-05-02 |
| 3a / 3b / 3c | ChannelList 整理 + 行コンパクト化 + Sidebar に DM 一覧 | #204 / #205 / #206 | 🟢 完了 | 2026-05-02 |
| 4 | MessageItem フラット化 + 連投マージ + ホバーアクションバー | [#207](https://github.com/mokemoke2850/chat-app-for-claudecode-test/pull/207) | 🟢 完了 | 2026-05-02 |
| 5a / 5b / 5c-1 / 5c-2 | ContextRail 新設 + 5 タブ実機データ化 + 既存 UI 撤去 | #208 / #209 / #210 / #211 | 🟢 完了 | 2026-05-02 |
| 6a / 6b / 6c / 6d | InboxPage 新設 + メンション/スレッドタブ + バッジ + クイックアクション | #212 / #213 / #214 / #215 | 🟢 完了 | 2026-05-02 |
| - (修正) | Inbox/Thread/Search の生 JSON 表示修正 + extractMessageText 共通化 | [#216](https://github.com/mokemoke2850/chat-app-for-claudecode-test/pull/216) | 🟢 完了 | 2026-05-03 |
| 7a / 7b / 7c-1 / 7c-2 | 検索ページ新設 + 保存ビューピル + チップ式フィルタ + スニペットハイライト | #217 / #218 / #219 / #220 | 🟢 完了 | 2026-05-03 |
| **8a** | **AppLayout 適用拡大** (BookmarkPage / DMPage / TemplatesPage / AdminPage / ProfilePage / FilesPage を AppLayout 化) | [#221](https://github.com/mokemoke2850/chat-app-for-claudecode-test/pull/221) | 🟢 完了 | 2026-05-03 |
| **8b** | **ChatPage 動線確保** (Rail に「チャット」追加 / Inbox/Calendar/TaskBoard の Sidebar に ChannelList / SearchPage onSelect 修正 / URL 更新 / DM 開始導線 / ホームラベル再考) | [#222](https://github.com/mokemoke2850/chat-app-for-claudecode-test/pull/222) | 🟢 完了 | 2026-05-03 |
| **8c** | **Inbox カードクリック遷移** (Mentions/Threads/Reminders カードに `/chat?channel=X#message-Y` ナビ追加) | (作成中) | 🟡 進行中 | - |
| **8d** | **Sidebar 開閉機構** (折りたたみトグル + localStorage 永続化 + ページごと初期状態) | - | ⚪ 未着手 | - |
| **8e** | **追加 UX 改善** (TODO #4 ロゴ刷新 / ContextRail DM 開始導線確認 等の残課題) | - | ⚪ 未着手 | - |
| 9 | モバイル対応（ボトムタブ + ContextRail のボトムシート化） | - | ⚪ 未着手 | - |

凡例: ⚪ 未着手 / 🟡 進行中 / 🔵 レビュー中 / 🟢 完了 / 🔴 ブロック

> Step 1〜7 の各サブステップの詳細は [`git log`](https://github.com/mokemoke2850/chat-app-for-claudecode-test/commits/feature/brush-up-uiux) と各 PR の説明を参照。

---

## ステップ詳細（未着手 / 進行中のみ）

### Step 8: PC 版ブラッシュアップ（モバイル対応の前段階）

**経緯**: Step 7 完了後、ユーザーが PC 版で利用しながら以下の課題を発見:
1. 各ページのレイアウトが不統一（DMPage / BookmarkPage / TemplatesPage / AdminPage 等）
2. Inbox のメンション/スレッド/その他カードをクリックしても何も起きない
3. チャット投稿画面への動線が分かりにくい（Rail に「チャット」項目が無く、Inbox の Sidebar が空）
4. Sidebar の 2 列目（ChannelList が表示される領域）がページによってデッドスペースになっており、開閉できない

これらに加えて Step 1〜7 の刷新で生じた追加の動線・UX 課題が複数あり、Step 9 (モバイル) 前に解消する。

#### Step 8a: AppLayout 適用拡大
**ブランチ**: `feature/brush-up-uiux-step-8a-applayout-expand`

**対象ページ（AppLayout 非適用 → 適用化）**:
- `pages/BookmarkPage.tsx` 🟢
- `pages/DMPage.tsx` 🟢
- `pages/TemplatesPage.tsx` 🟢
- `pages/AdminPage.tsx` 🟢
- `pages/ProfilePage.tsx` 🟢
- `pages/FilesPage.tsx` 🟢

**タスク**:
- [x] 各ページの独自 `AppBar` を撤去し `AppLayout` の `sidebar={<Box />}` / `children` 構造に揃える
- [x] 各ページのメイン領域上部に統一見出し行 (Icon + h6 + `borderBottom: 1px solid var(--border)` + `background: var(--bg-elev)` + `px:3 py:2`) を配置
- [x] `FilesPage` と `ChatPage` 内 `activeTab='files'` の二重化整理 (E-6) — 既に `ChannelFilesTab` 共有で整理済みであることを確認、FilesPage 側を AppLayout 化することで完了
- [x] AppLayout 化により SidebarFooter (テーマ切替・通知・プロフィール・ログアウト) への到達経路が全ページで確保される (E-3)
- [x] App.tsx で `/admin /bookmarks /templates /profile /channels/:channelId/files` を `SocketProvider` 内に移動し、Rail の DM/メンション未読バッジを全ページで動作させる
- [x] BookmarkPage の `handleJump` を `/?channel=...` → `/chat?channel=...` に変更 (ルート / が Inbox に変わったため)

**スコープ外**:
- AppLayout の `sidebar` 中身の標準化（ChannelList を全ページに置くか等）→ Step 8b
- Sidebar の開閉機構 → Step 8d
- DMPage 内 `DmConversationList` と新規 `SidebarDmList` の重複整理 → Step 8b で再検討（DMPage 内部では DmConversationList を据え置き、AppLayout の sidebar は空 Box）

**テスト**:
- `BookmarkPage.test.tsx` `DMPage.test.tsx` `TemplatesPage.test.tsx` `AdminPage.test.tsx` `ProfilePage.test.tsx` `FilesPage.test.tsx` に Step 8a describe ブロック (合計 23 it) 追加
- 既存テスト保護のため `ProfilePage.changePassword.test.tsx` `AuditLogView.test.tsx` にも `vi.mock('../components/Layout/AppLayout', ...)` を追加

#### Step 8b: ChatPage 動線確保
**ブランチ**: `feature/brush-up-uiux-step-8b-chat-routing`

**タスク**:
- [x] Rail に「チャット」項目を追加（`/chat` への直接遷移、ForumOutlinedIcon、ホーム直後に配置）
- [x] Inbox / Calendar / TaskBoard ページの `sidebar={<Box />}` を ChannelList + SidebarDmList に置換
- [x] SearchPage の `<ChannelList onSelect={() => {}} />` を `/chat?channel=X` に navigate するハンドラに置換（保留 TODO #20 解消）
- [x] チャンネル切替時に URL を `useSearchParams` で `setSearchParams({ channel: id })` 同期、ブラウザ戻る対応（保留 TODO #18 解消）
- [x] チャット未選択時のメイン領域 UX 改善（ForumIcon + 「チャンネルを選択してください」案内文 + サブテキスト）
- [x] 新規 DM 開始の導線確保（SidebarDmList の「新規 DM」ボタン経由で全ページから `/dm` 遷移可能、保留 TODO #19 解消）

**スコープ外**:
- ホームを「Inbox / 受信箱」にラベル変更 → Step 8e
- InboxPage の `/?channel=X` リダイレクト動作再検討（後方互換維持の現状で動線として成立）→ 8b では据置
- DmConversationList と SidebarDmList の重複整理 → 据置（DMPage 内部レイアウトはそのまま）

**テスト**:
- `Rail.test.tsx`: 「上部 6 つ → 7 つ」既存テスト更新 + Step 8b describe (2 it) 追加
- `InboxPage.test.tsx` `CalendarPage.test.tsx` `TaskBoardPage.test.tsx`: AppLayout stub を sidebar 露出版に拡張、ChannelList/SidebarDmList を stub 化、Step 8b describe (3 it × 3 ファイル) 追加
- `SearchPage.test.tsx`: AppLayout stub 拡張 + ChannelList stub に onSelect ボタン追加、Step 8b describe (1 it) 追加
- `ChatPage.test.tsx`: `useSearchParams` 化に伴い `MemoryRouter` ベースの `renderChatPage` ヘルパー導入、`window.location.search` 設定撤去、Step 8b describe (3 it) 追加

#### Step 8c: Inbox カードクリック遷移
**ブランチ**: `feature/brush-up-uiux-step-8c-inbox-cards`

**タスク**:
- [x] `MentionsList` カードクリック → `/chat?channel=${m.channelId}#message-${m.id}` へ navigate
- [x] `ThreadsList` カードクリック → rootMessage の `/chat?channel=X#message-Y` へ navigate (hash 遷移、スレッドペイン自動 open はスコープ外)
- [x] `RemindersList` カードクリック → `r.message.channelId` / `r.messageId` で navigate (完了ボタンは `e.stopPropagation()` で別動線、`message` undefined のときはクリック無効)
- [x] 各カードの hover で視覚フィードバック (`cursor: pointer` + `&:hover { bgcolor: 'action.hover' }`)
- [x] A11y: `role="button"` + `tabIndex={0}` + `onKeyDown` (Enter/Space) + `aria-label`

**スコープ外**:
- スレッドペイン自動 open (ChatPage 側で `?thread=Y` URL 対応必要、複雑)
- ハッシュ `#message-Y` 自動スクロール処理 → 既に `MessageList.tsx:84-93` に実装済 (流用)

**テスト**:
- `MentionsList.test.tsx` `ThreadsList.test.tsx` `RemindersList.test.tsx` に Step 8c describe (合計 10 it) 追加
  - クリック navigate / Enter キー navigate / role="button" 属性検証
  - Reminders は完了ボタン stopPropagation / message undefined 時の無効化も検証

#### Step 8d: Sidebar 開閉機構
**ブランチ**: `feature/brush-up-uiux-step-8d-sidebar-collapse`（予定）

**タスク**:
- [ ] AppLayout の Sidebar (240px) に開閉トグルを追加
- [ ] 開閉状態を `localStorage["sidebar.open"]` に永続化（ContextRail と同パターン）
- [ ] 閉じた状態のレイアウト要件: ChannelList 等を非表示、SidebarFooter のアイコンのみ残す or Rail に統合
- [ ] 各ページごとの初期状態を指定（Inbox/Calendar/TaskBoard: 閉、ChatPage/SearchPage: 開）
- [ ] Sidebar 開閉時のグリッド再計算（ContextRail との両立確認）

#### Step 8e: 追加 UX 改善（残課題）
**ブランチ**: `feature/brush-up-uiux-step-8e-misc-ux`（予定）

**タスク**:
- [ ] 保留 TODO #4 (Rail 最上部のロゴ "C" 暫定デザイン) の最終デザイン決定（E-5）
- [ ] ContextRail メンバータブから DM 開始導線の確認・実装（E-7）
- [ ] その他、8a〜8d 進行中に発見された残課題

**注**: Step 8e は 8a〜8d 完了時点での残課題を集約する位置づけ。スコープは着手時に再確認。

---

### Step 9: モバイル対応（最終 Step）

**ブランチ**: `feature/brush-up-uiux-step-9-mobile`（予定）

**タスク**:
- [ ] モバイル幅（< 768px）でボトムタブバーに切り替え
- [ ] サイドバーをドロワー化
- [ ] ContextRail をボトムシートにフォールバック

**着手時の論点**:
- ブレークポイント: `< 768px` で `useMediaQuery` を使い切替
- AppLayout のグリッド構造をレスポンシブ化（Rail + Sidebar + Main + RightPane → モバイルでは Main のみ + ボトムタブバー）
- Rail のナビゲーション項目をモバイル底部のボトムタブバーに移動
- Sidebar (ChannelList) はドロワー化（ハンバーガーアイコンで開閉）
- ContextRail はボトムシートにフォールバック（タブで開閉）
- 既存テストは `width: 768px+` 想定。`useMediaQuery` の挙動を維持
- 影響範囲: AppLayout / Rail / ContextRail + 関連ページ全部（Step 8a で AppLayout 化が進めば対象ページが減る）

---

## 保留 TODO リスト

リリース前に必ず解決する必要がある「動線が未完成の UI 要素・機能」を一元管理する。

### ⚪ 未解決

| # | 内容 | 解決予定 Step |
|---|------|---------------|
| 4 | Rail 最上部のロゴが暫定デザイン（"C" の四角） | Step 8e |
| 17 | AppLayout の Sidebar が固定幅 (240px) で開閉できず、コンテンツが空のページではデッドスペース | Step 8d |

### 🟢 解決済み（参考）

| # | 内容 | 解決 Step |
|---|------|-----------|
| 1 | Rail 検索アイコン disabled | Step 7a |
| 2 | ChatPage 検索 dead code | Step 7a |
| 3 | Rail DM 未読バッジ | Step 2c |
| 5 | Rail メンション数バッジ | Step 6d |
| 6 | ChannelList 行コンパクト化 | Step 3b |
| 7 | ChannelList 未読数バッジ色分け | Step 6d |
| 8 | Sidebar に DM 会話一覧ブロック | Step 3c |
| 9 | ContextRail と TopicBar 編集系の併存撤去 | Step 5c-1 |
| 10 | ContextRail と PinnedMessages バーの併存撤去 | Step 5b |
| 11 | ContextRail と MembersDialog の併存撤去 | Step 5c-2 |
| 12 | ContextRail のファイルタブ実装 | Step 5b |
| 13 | ContextRail の予定タブ実機データ化 | Step 5c-1 |
| 14 | DMPage / BookmarkPage / TemplatesPage / AdminPage / ProfilePage / FilesPage が AppLayout 非適用でレイアウト不統一 | Step 8a |
| 15 | Inbox の Mentions / Threads / Reminders カードがクリックしても遷移しない | Step 8c |
| 16 | Rail に「チャット」項目が無く、Inbox/Calendar/TaskBoard の Sidebar が空でチャット画面への動線が見えない | Step 8b |
| 18 | チャンネル切替時に URL が更新されない（ブラウザ戻る不可） | Step 8b |
| 19 | 新規 DM 開始導線が DMPage 内のみ（Inbox / ChatPage から開始できない） | Step 8b |
| 20 | SearchPage の Sidebar ChannelList の `onSelect` が空関数でクリック無反応 | Step 8b |

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

## 次セッションへの引き継ぎ

### 直近の状態
- 統合ブランチ `feature/brush-up-uiux` は最新（Step 8b PR #222 マージ済み）
- **Step 1〜7 + Step 8a + Step 8b 完了**（保留 TODO #1, #2, #3, #5〜#14, #16, #18, #19, #20 解消済み）
- **Step 8 (PC ブラッシュアップ) を Step 9 (モバイル) の前に実施することにユーザー合意**（2026-05-03）
  - もとの計画では 8 = モバイル対応だったが、PC 系課題を先に解消するため番号を入れ替え
  - 現: Step 8 = PC ブラッシュアップ / Step 9 = モバイル対応
- 残り Step: **8c → 8d → 8e → 9**

### 次セッションで真っ先にやるべきこと
1. `git checkout feature/brush-up-uiux && git pull --ff-only`
2. **「[リリース・実装方針](#リリース実装方針)」と「[ブランチ運用方針](#ブランチ運用方針)」を必読**
3. main を統合ブランチに取り込んで差分肥大化を防ぐ（前回取り込みから時間経過があれば）: `git fetch origin main && git merge origin/main`
4. ユーザーに次の Step を指示してもらう（推奨順は 8a → 8b → 8c → 8d → 8e → 9）

### Step 8 着手時の注意点
- **影響範囲が広い**: 8a / 8b / 8d は AppLayout / Rail / Sidebar の構造変更を伴うため、AppLayout を使う全ページの既存テストにも波及する可能性あり（過去 Step 6d のハマり再発注意）
- **動線整理が中心**: 新機能追加というより既存動線の繋ぎ直し。サーバー API 追加は基本的に不要
- **8a〜8d は順序依存あり**: 8a (AppLayout 化) → 8b (Sidebar 中身) → 8d (開閉) の順が論理的。8c (Inbox カード) は他と独立

---

## 開発上のハマりどころ（過去 Step で判明した罠）

> 後続 Step で繰り返し遭遇する罠を集約。新規 PR 作成前に一読推奨。

- **cwd**: `npm run test` / `npx vitest` は `packages/client` 配下から実行する。リポジトリルートだと jsdom 環境設定 (`vite.config.ts`) が読まれず `ReferenceError: document is not defined` で全テスト失敗する
- **Edit 並列失敗**: PostToolUse の formatter フックが走った直後に同じファイルへ複数 Edit を並列発行すると、後続 Edit が `File has been modified since read` で失敗する。Edit は **直前に Read してから順次（直列）発行する**
- **AppLayout 経由で動く新規 hook / 子コンポーネント**: AppLayout が新たに hook (`useDmUnreadCount` / `useMentionUnreadCount` 等) や子コンポーネント (`SidebarDmList` 等) を呼ぶと、AppLayout を使う既存テスト (`TaskBoardPage.test.tsx` / `CalendarPage.test.tsx` / `ChatPage.test.tsx` 等) で `api.xxx` 不足の `TypeError` や Suspense 解決失敗が起きる。**新規依存追加 PR では、AppLayout 経由の既存テストにも `vi.mock` でスタブ化 or `api` モック追加が必要**（Step 9 では特に頻発する見込み）
- **`react-router-dom` の完全 mock 禁止**: `vi.mock('react-router-dom', () => ({ useNavigate: ... }))` のような完全 mock は `NavLink` / `MemoryRouter` を undefined にする。`importActual` パターン (`vi.mock('react-router-dom', async (importOriginal) => { const actual = await importOriginal(); return { ...actual, useNavigate: ... } })`) を使う
- **PROGRESS.md コンフリクト**: PR マージ前に統合ブランチ側で PROGRESS.md ステータスを「レビュー中」へ先行更新するとマージ時にコンフリクトする。**ステータスはマージ後にまとめて統合ブランチで更新する**運用に統一済み
- **MUI の `sx` は jsdom で `toHaveStyle` が効きづらい**: Emotion 経由の class になり jsdom で値が取れないことがある。テスト容易性が必要な箇所では `style={{ ... }}` props で渡す
- **CSS 変数 `var(--xxx)` を `toHaveStyle` で検証できない**: jsdom は CSS カスタムプロパティを解決しない。inline `style` で渡している場合は `element.style.borderColor` を直接読む
- **`display: none` でアクションバーを隠すと a11y tree から消える**: `getByRole('button', { name: /edit/i })` が `display: none` の中身を検出できない。フロート表示でホバー前の見せ消しは **`opacity: 0; pointer-events: none;`** に統一する。同時に `userEvent.click` は `pointer-events: none` の要素をクリックできないため、対応の必要なテストには `userEvent.click(el, { pointerEventsCheck: 0 })` を渡す
- **モック内 `useEffect` で onSelect を自動発火する際の無限ループ**: モック子 stub から渡される `onSelect` がレンダリング毎に inline 関数として再生成されるとき、`React.useEffect(() => onSelect?.(...), [onSelect])` だと毎レンダーで trigger され続ける。**依存配列を空 `[]` にして mount 時のみ発火させる**
- **`vi.hoisted(() => vi.fn(() => null))` の型シグネチャ**: 後から `mockImplementation(({ onSelect }) => ...)` のように引数取り関数を渡すと TS2345 エラー。**`mockImplementation` の引数の直前行に `// @ts-expect-error` を置く**
- **`api` 依存コンポーネントを mock しないと unhandled rejection になる**: 子コンポーネントを `vi.mock` でスタブ化していても api 呼び出しは親が行うため、`api/client` 自体も `vi.mock` で stub にする必要あり
- **`Promise.all([...]) + use(promise)` の Suspense 解決が jsdom + vitest で再現困難**: vitest 環境では Suspense fallback のまま解決されないケースがある。**対策: `use(promise)` するコンポーネントを「配列 props を受け取る純粋コンポーネント」と「`use(promise)` する Suspense ラッパー」に分離し、ロジック検証は純粋コンポーネントの単体テストで実施 / Suspense 経由表示は E2E に逃がす**
- **Suspense ラッパーは別ファイル化する** (Step 7b 確立): 同一ファイル内の Suspense ラッパー関数だとテストから `vi.mock` で個別スタブ化できず安定しない。**対策: Suspense ラッパー自体を別ファイルに切り出し、テスト時に `vi.mock` で丸ごとスタブ化する**
- **`useAuth()` mock がレンダー毎に新オブジェクトを返すと `useMemo([user])` が無限 suspend する**: ファクトリ関数内で毎回 user オブジェクトを生成すると `useMemo([user])` で promise が再生成され続け Suspense が永久に解決しない。**対策: `vi.hoisted` で固定参照を作って返す**
- **pg-mem は相関サブクエリ（FROM 外のエイリアス参照）を実行できない**: 外部スコープのエイリアス参照は `ColumnNotFound` で実行時エラー。**対策: `LEFT JOIN + GROUP BY` か `WHERE id IN (subquery)` に書き換える**
- **既存 export 関数を再定義しない**: 同名関数の重複定義で TS2393 になる。**新規ヘルパー追加前に grep で同名関数の有無を確認する**
- **squash merge 後のローカルブランチ**: GitHub 側で squash merge されると `git branch -d` が「未マージ」と判定する。マージ確認済みなら `-D` で削除して問題ない
- **describe.skip での退避は `// 保留 TODO #N` コメントで参照**: AGENTS.md ルール「機能未実装で skip する場合は別 issue 参照」を満たすため、本プロジェクトでは PROGRESS.md の保留 TODO 番号を参照する形で代替

---

## このセッションで確立した運用パターン

- **TDD フロー**: ブランチ作成 → 現状調査 → スコープ提示・合意 → テスト項目 `it.todo` 記述 → ユーザー確認 → 実テスト書き換え → red 確認 → 実装 → green 確認 → PR 作成 → 統合ブランチで PROGRESS.md 更新（マージ後）
- **PR スコープを絞る**: プロンプト原文に対し過剰な場合は a/b/c 等のサブ Step に分割する（実例: Step 2 → 2a/2b/2c、Step 6 → 6a/6b/6c/6d、Step 7 → 7a/7b/7c-1/7c-2）
- **動線未完成 UI の許容**: dead code / disabled UI / dummy 表示は許容、ただし **必ず保留 TODO リストに登録**
- **PR 説明テンプレ**: `.github/PULL_REQUEST_TEMPLATE.md` の全セクションを埋める
- **PROGRESS.md 更新タイミング**:
  - PR 作成時: 作業ブランチ側で「該当 Step の対象ファイル / タスク / スコープ外」を詳述、保留 TODO 状態を変更
  - マージ後: 統合ブランチ側でステータス（⚪→🟢）と完了日、更新履歴行を追加

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

> 直近のもののみ残し、Step 1〜7 の細かい履歴は省略（git log / 各 PR を参照）。

| 日付 | 変更内容 |
|------|----------|
| 2026-05-01〜05-03 | Step 1〜7 全完了（PR #200〜#220、サブステップ分割含む 21 PR）。詳細は git log と各 PR を参照 |
| 2026-05-03 | **PC ブラッシュアップを先に実施することをユーザー合意**。番号混乱を避けるため **Step 8 = PC ブラッシュアップ / Step 9 = モバイル対応** に番号入れ替え（元計画では 8 = モバイルだった）。Step 8 を 8a (AppLayout 適用拡大) / 8b (ChatPage 動線確保) / 8c (Inbox カードクリック遷移) / 8d (Sidebar 開閉機構) / 8e (追加 UX 改善) に分割。保留 TODO に #14〜#20 を新規登録。本ドキュメントを大幅整理 (過去 Step を要約化、Step 8 を中心に) |
| 2026-05-03 | **Step 8a (PR #221) マージ完了**。BookmarkPage / DMPage / TemplatesPage / AdminPage / ProfilePage / FilesPage の 6 ページを AppLayout 化、独自 AppBar / 戻るボタン撤去、メイン領域上部に統一見出し行配置。App.tsx で 5 ルートを SocketProvider 内に移動。BookmarkPage の遷移先を `/chat?channel=...` に修正。保留 TODO #14 解消済み。残り Step: 8b → 8c → 8d → 8e → 9 |
| 2026-05-03 | **Step 8b (PR #222) マージ完了**。Rail に「チャット」項目追加、Inbox/Calendar/TaskBoard の Sidebar を ChannelList + SidebarDmList 構成に統一、SearchPage の onSelect を `/chat?channel=X` navigate に修正、ChatPage の URL 同期を `useSearchParams` 化、チャット未選択時の案内文表示。追加修正: ChannelList の `handleToggleCollapse` で `_categoriesPromise` キャッシュも同期更新 (別画面遷移→戻り時に折りたたみ状態が初期化される問題を解消)。保留 TODO #16/#18/#19/#20 解消済み。残り Step: 8c → 8d → 8e → 9 |
