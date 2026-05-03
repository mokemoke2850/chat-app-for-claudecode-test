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
| **8c** | **Inbox カードクリック遷移** (Mentions/Threads/Reminders カードに `/chat?channel=X#message-Y` ナビ追加) | [#223](https://github.com/mokemoke2850/chat-app-for-claudecode-test/pull/223) | 🟢 完了 | 2026-05-03 |
| **8d** | **Sidebar 開閉機構** (折りたたみトグル + localStorage 永続化 + ページごと初期状態) | [#224](https://github.com/mokemoke2850/chat-app-for-claudecode-test/pull/224) | 🟢 完了 | 2026-05-03 |
| **8e-1** | **小規模クリーンアップ** (ロゴ刷新 / ホーム→受信箱 / ESLint warning 解消) | [#225](https://github.com/mokemoke2850/chat-app-for-claudecode-test/pull/225) | 🟢 完了 | 2026-05-03 |
| **8e-2** | **ContextRail メンバータブから DM 開始導線追加** | [#226](https://github.com/mokemoke2850/chat-app-for-claudecode-test/pull/226) | 🟢 完了 | 2026-05-03 |
| **8e-3** | **SidebarFooter を Rail に統合** (Sidebar 閉じてもアクセス可) | [#227](https://github.com/mokemoke2850/chat-app-for-claudecode-test/pull/227) | 🟢 完了 | 2026-05-03 |
| **8e-4** | **DmConversationList と SidebarDmList の重複整理** | [#228](https://github.com/mokemoke2850/chat-app-for-claudecode-test/pull/228) | 🟢 完了 | 2026-05-03 |
| **8e-5** | **AdminPage ダークモード対応 + sidebar 強制閉じページ** | [#229](https://github.com/mokemoke2850/chat-app-for-claudecode-test/pull/229) | 🟢 完了 | 2026-05-03 |
| **9a** | **AppLayout レスポンシブ化（基盤）** (useMediaQuery 導入 / モバイル時 1 列化 / AppBar 仮枠) | [#230](https://github.com/mokemoke2850/chat-app-for-claudecode-test/pull/230) | 🟢 完了 | 2026-05-03 |
| **9b** | **Rail → ボトムタブバー** (モバイル AppBar に検索 + 3 点メニュー / 底部 5 タブ) | [#232](https://github.com/mokemoke2850/chat-app-for-claudecode-test/pull/232) | 🟢 完了 | 2026-05-03 |
| **9c** | **Sidebar ドロワー化** (AppBar ハンバーガー + Drawer 280px + URL 変化で自動閉じ + 底部 SidebarFooter ListItem) | [#233](https://github.com/mokemoke2850/chat-app-for-claudecode-test/pull/233) | 🟢 完了 | 2026-05-03 |
| **9d** | **ContextRail ボトムシート化** (rightPane 連動で自動 open / モバイルプレースホルダー短縮) | [#234](https://github.com/mokemoke2850/chat-app-for-claudecode-test/pull/234) | 🟢 完了 | 2026-05-04 |

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
**ブランチ**: `feature/brush-up-uiux-step-8d-sidebar-collapse`

**タスク**:
- [x] AppLayout に `defaultSidebarOpen?: boolean` prop 追加 + 内部 state + `useEffect` で localStorage 永続化
- [x] Sidebar 開閉状態を `localStorage["sidebar.open"]` に永続化（ContextRail と同パターン）
- [x] 閉じた状態の Sidebar Box は `display: none`、grid 列は `${RAIL_WIDTH}px 0px 1fr [320px]` で完全消失
- [x] Rail のロゴ直下にトグルボタン (MenuOpen / Menu アイコン) 追加、AppLayout から `sidebarOpen` / `onToggleSidebar` props で連携
- [x] ページごとの初期状態: ChatPage/SearchPage はデフォルト省略 (= true)、その他 9 ページは `defaultSidebarOpen={false}` 明示
- [x] ContextRail との両立: rightPane あり/なしどちらでも Sidebar 列の幅変更が grid に反映される

**スコープ外**:
- SidebarFooter (ステータス・テーマ・通知・プロフィール・ログアウト) を Rail に統合 → **Step 8e**（閉じた状態でも一時的に Sidebar 開けばアクセス可能なので運用可能）

**テスト**:
- `AppLayout.test.tsx` に Step 8d describe (6 it) 追加: defaultSidebarOpen 効力 / localStorage 永続化値の優先 / grid 列値の動的化
- `Rail.test.tsx` に Step 8d describe (4 it) 追加: トグルボタン表示 / aria-label の状態切替 / クリックハンドラ呼び出し

#### Step 8e: 追加 UX 改善（残課題）
8e はスコープが大きいため、サブステップに分割して順次 PR を出す:

- **8e-1** (小規模クリーンアップ): ロゴ刷新 + ホームラベル変更 + ESLint warning 解消
- **8e-2** (中規模): ContextRail メンバータブから DM 開始導線
- **8e-3** (大規模): SidebarFooter を Rail に統合 (閉じてもアクセス可能)
- **8e-4** (中〜大規模): DmConversationList と SidebarDmList の重複整理

##### Step 8e-1: 小規模クリーンアップ
**ブランチ**: `feature/brush-up-uiux-step-8e-misc-ux`

**タスク**:
- [x] 保留 TODO #4 (Rail ロゴ刷新): "C" の四角を SVG 幾何学パターン C (上部 3 つの円 + 下部三角形) に差し替え
- [x] Rail のホームラベル「ホーム」→「受信箱」に変更 (Inbox 強調)
- [x] ESLint warning 解消: InboxPage `[tab, remindersKey]` / SearchPage `[savedViewsKey]` の意図的依存に `// eslint-disable-next-line react-hooks/exhaustive-deps`
- [x] 既存テスト (Rail.test.tsx 8 箇所 + AppLayout.test.tsx 1 箇所) の "ホーム" → "受信箱" 文字置換
- [x] InboxPage の `/?channel=X` リダイレクトコメント整理 → 既に明示済みのため作業不要と判断

**テスト**:
- `Rail.test.tsx` に Step 8e-1 describe (5 it) 追加: ロゴ SVG / "C" 撤去 / 受信箱ラベル / 受信箱→/ リンク
- 既存テストの「ホーム」を「受信箱」に置換 (sed 一括)

##### Step 8e-2: ContextRail メンバータブから DM 開始導線追加
**ブランチ**: `feature/brush-up-uiux-step-8e-2-contextrail-dm`

**タスク**:
- [x] `MembersContent` の props に `currentUserId: number` 追加
- [x] 各行 (自分以外) の右端に SendIcon (紙飛行機) の IconButton (`aria-label="DM を開始"`) を追加
- [x] クリックで `e.stopPropagation()` + `api.dm.createConversation(targetUserId)` → `navigate('/dm?conv=${conv.id}')`
- [x] エラー時は `useSnackbar().showError` で通知 (DMPage と同じパターン)
- [x] `ChannelMembersDialog` (default export) で `useAuth` から currentUserId 取得 → MembersContent に渡す
- [x] `ContextRail` でも MembersContent に `currentUserId` を渡す

**テスト**:
- `ChannelMembersDialog.test.tsx` に Step 8e-2 describe (6 it) 追加: 自分以外に DM ボタン / 自分には非表示 / createConversation 呼び出し / navigate 成功 / stopPropagation で handleToggle 抑止 / showError 失敗時

##### Step 8e-3: SidebarFooter を Rail に統合
**ブランチ**: `feature/brush-up-uiux-step-8e-3-sidebarfooter-rail`

**タスク**:
- [x] `SidebarFooter.tsx` を縦並び (64px Rail 幅) アイコン群に refactor: ステータス / テーマ / 通知 / プロフィール / ログアウトの 5 アイコン縦並び
- [x] ユーザー名 (displayName / username) は Rail 上に直接表示せず、ステータスボタンの Tooltip テキストに含める ("alice のステータスを設定")
- [x] `Rail.tsx` の最下部 (BOTTOM_ITEMS / 管理アイコンの下) に `<SidebarFooter />` を配置
- [x] `AppLayout.tsx` から `<SidebarFooter />` を撤去 (Sidebar 列は sidebar prop の中身のみ)
- [x] Sidebar が閉じた状態 (Step 8d) でも Rail 経由でテーマ切替・ログアウト等にアクセス可能に

**スコープ外**:
- ステータス選択ダイアログ (`StatusEditDialog`) は据置 (既存挙動)
- Push 通知 supported 判定は既存ロジック流用

**テスト**:
- `Rail.test.tsx` に Step 8e-3 describe (5 it) 追加: 各種ボタンが Rail 内に存在 / ユーザー名が直接表示されない
  - `SidebarFooter` を vi.mock で stub 化 (Rail 単体テストの依存連鎖を切る)
- `AppLayout.test.tsx` に Step 8e-3 describe (2 it) 追加: Sidebar 列にログアウトが含まれない / Rail (nav) 内に存在する
- `SidebarFooter.test.tsx` の「表示名が表示される」「username が表示される」を「直接表示されない (Tooltip 化)」に書き換え + 「表示名をクリック」を「ステータスボタンをクリック」に文言変更

##### Step 8e-4: DmConversationList と SidebarDmList の重複整理 (案 C)
**ブランチ**: `feature/brush-up-uiux-step-8e-4-dmlist-dedup`

**タスク**:
- [x] `useDmConversationsSocket` フック新設 (両者で重複していた `new_dm_message` 購読ロジックを集約)
  - 単一 updater で lastMessage / updatedAt / unreadCount を同時更新する仕様に改善
- [x] `DmListRow` コンポーネント新設 (共通行表示、`variant: 'expanded' | 'compact'` で密度・プレビュー有無を切替)
  - expanded: 32px avatar + presence indicator + lastMessage プレビュー + 時刻 (DMPage 用)
  - compact: 24px avatar + 名前のみ (Sidebar 用)
- [x] `DmConversationList.tsx` を wrapper 化 (ヘッダー + Box + DmListRow.expanded を使う)
- [x] `SidebarDmList.tsx` を wrapper 化 (ヘッダー + Box + DmListRow.compact を使う) + `useAuth` で currentUserId 取得
- [x] 既存テスト維持: socket 単一 updater 化に伴う `DmConversationList.test.tsx` 期待値修正、`SidebarDmList.test.tsx` に AuthContext mock 追加

**スコープ外**:
- API (`api.dm.listConversations`) 自体の変更なし
- DMPage / AppLayout の使用箇所インターフェース互換 (props 変更なし)

**テスト**:
- 新規 `DmListRow.test.tsx` (9 it): 共通表示 / expanded プレビュー / compact プレビュー無し / isActive selected 状態
- `DmConversationList.test.tsx`: socket 「2 回呼ばれる」期待を「1 回 (単一 updater)」に修正
- `SidebarDmList.test.tsx`: AuthContext mock 追加

##### Step 8e-5: AdminPage ダークモード対応 + sidebar 強制閉じページ
**ブランチ**: `feature/brush-up-uiux-step-8e-5-darkmode-forceclose`

**経緯**: ユーザーが PC 利用中に発見した追加課題:
- AdminPage がダークモードで背景白のまま (ハードコード `bgcolor: 'grey.50' / 'white'`)
- Admin / DM / Bookmark 等 sidebar 中身が空のページで sidebar デッドスペース。閉じても他ページの開閉状態を汚さないようにしたい

**タスク**:
- [x] AdminPage のハードコード色 (`bgcolor: 'grey.50'`, `'white'`) を MUI テーマ依存 (`background.default`, `background.paper`) に置換 → ダークモードで自動切替
- [x] `AppLayout` に `forceSidebarClosed?: boolean` prop 追加
  - `true` のとき: 表示状態を強制 false / localStorage 書き込み抑制 (他ページ状態を汚さない) / Rail トグルボタン非表示 (`onToggleSidebar={undefined}`)
- [x] sidebar 中身が空な 6 ページに `forceSidebarClosed={true}` を追加: AdminPage / DMPage / BookmarkPage / TemplatesPage / ProfilePage / FilesPage

**期待 UX**: Home (sidebar 開) → DM (強制閉じ、localStorage は "true" のまま) → Home 戻る (開いた状態維持)

**テスト**:
- `AppLayout.test.tsx` に Step 8e-5 describe (3 it) 追加: localStorage="true" でも force 時は 0px / localStorage 書き込み抑制 / Rail トグルボタン非表示

---

### Step 9: モバイル対応（最終 Step）

**経緯・方針**: ユーザー合意 (2026-05-03) によりサブステップ 9a〜9d に分割。ブレークポイントは **`< 768px`** (claude-code-prompt.md §7 準拠 / iPad 縦は 3 列維持)。

#### Step 9a: AppLayout レスポンシブ化（基盤）
**ブランチ**: `feature/brush-up-uiux-step-9a-applayout-responsive`

**タスク**:
- [x] `useMediaQuery('(max-width: 767px)')` で `isMobile` 判定追加 (AppLayout.tsx)
- [x] モバイル時: grid を `1fr` 1 列に切替、Rail / Sidebar / RightPane を条件付き非レンダリング
- [x] モバイル時: 上部に AppBar 仮枠 (`app-layout-mobile-header`、高さ 56px、`var(--bg-elev)` 背景) を追加
- [x] jsdom 用 `window.matchMedia` safety net mock を `setup.ts` に追加 (matches: false デフォルト)

**スコープ外（後続サブステップ）**:
- AppBar 内のハンバーガーボタン → 9c (Sidebar ドロワー化と同時)
- ボトムタブバー → 9b
- ContextRail のボトムシート化 → 9d
- AppBar 内のテーマ切替・プロフィール等 SidebarFooter 機能 → 9b/9c/9d で集約

**テスト**:
- `AppLayout.test.tsx` に Step 9a describe (8 it) 追加: デスクトップ/モバイル切替・各列表示有無・AppBar 表示有無
- `setViewport(isMobile)` ヘルパーで `matchMedia` 上書きしてビューポート切替
- 既存 1561 件 全 pass (デフォルト matchMedia mock が desktop 動作を返すため波及なし)

#### Step 9b: Rail → ボトムタブバー
**ブランチ**: `feature/brush-up-uiux-step-9b-bottom-nav`

**タスク**:
- [x] 新規 `components/Layout/MobileBottomNav.tsx` (5 タブ: 受信箱/チャット/DM/カレンダー/タスク)
- [x] 受信箱はメンション未読バッジ、DM は DM 未読バッジ
- [x] `useLocation` で aria-current="page" 設定 (受信箱は完全一致、それ以外は前方一致)
- [x] `position: fixed; bottom: 0` で全画面下固定 (zIndex: theme.zIndex.appBar)
- [x] AppLayout モバイル AppBar に機能追加:
  - 左: アプリロゴ (Rail と同じ SVG、タップで `/` 遷移)
  - 右: 検索アイコン (`/search` へ遷移)
  - 右: 3 点メニュー (ブックマーク / テンプレート / 管理 admin のみ)
- [x] モバイル時 Main 領域に `pb: 56px` 確保 (BottomNav に被らない)

**スコープ外**:
- ハンバーガーボタン → 9c (Sidebar ドロワー化)
- SidebarFooter 系 (テーマ・通知・プロフィール・ログアウト) のモバイル化 → 9c または 9d で集約

**テスト**:
- 新規 `MobileBottomNav.test.tsx` (9 it): 5 タブ表示 / リンク先 / 未読バッジ / aria-current
- `AppLayout.test.tsx` に Step 9b describe (8 it): モバイル/デスクトップ切替 / 3 点メニュー項目 / admin 権限分岐 / BottomNav 描画
- Playwright 実機検証: 375px (iPhone 想定) / 1280px (デスクトップ) 両方で動作確認済

#### Step 9c: Sidebar ドロワー化
**ブランチ**: `feature/brush-up-uiux-step-9c-sidebar-drawer`

**タスク**:
- [x] AppLayout に MUI `Drawer` (anchor="left", `variant="temporary"`, 幅 280px) を追加
- [x] モバイル AppBar 左にハンバーガーボタン (`MenuIcon`) を配置 (forceSidebarClosed ページでは非表示)
- [x] `useState<boolean>` で開閉管理、ハンバーガークリックで `setMobileDrawerOpen(true)`
- [x] `useLocation` で `pathname` / `search` 変化検知 → `setMobileDrawerOpen(false)` (URL 変化で自動閉じ)
- [x] Drawer 内: 上部に `sidebar` prop / 底部に `<SidebarFooter variant="drawer" />`
- [x] SidebarFooter に `variant?: 'rail' | 'drawer'` prop 追加 (default `'rail'` で後方互換)
  - `'drawer'`: `List` + `ListItemButton` 形式 (アイコン + ラベル横並び、48px 高)
  - `'rail'`: 従来の縦並びアイコン (Tooltip でラベル)

**スコープ外**:
- ContextRail のボトムシート化 → 9d
- ドロワーのスワイプジェスチャ対応 (`SwipeableDrawer`) → 9d 以降で必要なら

**テスト**:
- `AppLayout.test.tsx` Step 9c describe (7 it): ハンバーガー表示有無 (デスクトップ/モバイル/forceSidebarClosed) / ドロワー開閉 / sidebar 内容 / SidebarFooter 内容 / 初期閉状態 / URL 変化自動閉じ
- `SidebarFooter.test.tsx` Step 9c describe (3 it): variant=drawer ラベル表示 / variant=rail (default) でラベル非表示 / variant=drawer の logout 動作
- Playwright 実機検証: 375px でハンバーガー押下 → ドロワー (CHANNELS + Footer) → チャンネル選択 → `/chat?channel=5` 遷移 → ドロワー自動閉じ を確認

#### Step 9d: ContextRail ボトムシート化（最終 Step）
**ブランチ**: `feature/brush-up-uiux-step-9d-contextrail-bottomsheet`

**タスク**:
- [x] AppLayout に MUI `SwipeableDrawer` (anchor="bottom", 75vh, 上端角丸 16px, grabber バー) を追加
- [x] **rightPane の有無で自動開閉** (Step 9d-fix): `mobileBottomSheetOpen` state 廃止 → `open = isMobile && Boolean(rightPane)`
- [x] AppLayout に `onCloseRightPane?: () => void` prop 追加 (バックドロップ/スワイプダウン閉じ時に呼ぶ)
- [x] ChatPage で `onCloseRightPane={() => setContextRailOpen(false)}` を渡す
- [x] **AppBar 右の専用トグル廃止** (Step 9d-fix): ChatPage 内の既存「コンテキストペインを開く」ボタン 1 クリックで自動 open になり二段階操作を解消
- [x] **モバイルプレースホルダー短縮** (Step 9d-fix): `RichEditor.tsx` に `useMediaQuery` 追加、モバイル時は「メッセージを入力…」のみで枠はみ出し解消

**スコープ外**:
- ボトムシートのスナップポイント (中間高さ) → 今回省略 (固定 75vh)
- ContextRail 内のタブ・コンテンツ → 変更なし

**テスト**:
- `AppLayout.test.tsx` Step 9d describe (5 it): rightPane truthy で自動 open / rightPane falsy で非描画 / デスクトップで非描画 / 「詳細パネルを開く」トグル不在 / バックドロップタップで onCloseRightPane 呼び出し
- `beforeEach` に matchMedia リセット追加 (テスト間の mode 引き継ぎ問題を解消)
- Playwright 実機検証: 375px で ChatPage トグル 1 クリック → ボトムシート即時 open / プレースホルダー枠内収まり / 1280px で従来 4 列レイアウト維持

---

## 保留 TODO リスト

リリース前に必ず解決する必要がある「動線が未完成の UI 要素・機能」を一元管理する。

### ⚪ 未解決

なし (Step 8e-1 で残保留 TODO #4 解消予定)

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
| 17 | AppLayout の Sidebar が固定幅 (240px) で開閉できず、コンテンツが空のページではデッドスペース | Step 8d |
| 4 | Rail 最上部のロゴが暫定デザイン（"C" の四角） | Step 8e-1 |
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
- 統合ブランチ `feature/brush-up-uiux` は最新（Step 9d PR #234 + 仕上げ PR #235 / #237 マージ済み）
- **Step 1〜9 すべて完了 + 最終 PR 前のクリーンアップ完了**（保留 TODO #1〜#20 全件解消、コメント整理済み、テスト品質向上済み）
- **次のフェーズ**: 統合ブランチ → main の最終 PR 作成（リリース・実装方針: 「全 Step 完了後にまとめてリリース」）
- 関連 issue: #236 (thread_reads テーブル設計 + ThreadSummary.unreadCount 本実装、最終 PR 後の対応)

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
- **`use(promise)` で fetch する Suspense ラッパーは必ずモジュールレベルキャッシュを通す**: React 19 concurrent モードでは同じコンポーネントが複数回インスタンス化され、`useState(() => api.xxx())` イニシャライザが多重実行されて API が大量発行される（実例: PR #231 で `ChipFilterSection` が `/api/channels` `/api/tags/suggestions` を 3000 回以上発行していた）。`ChannelList` / `SidebarDmList` の `getOrCreateXxxPromise()` パターンを使うこと。`useState` だけで安定化したつもりは罠
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
| 2026-05-03 | **Step 8c (PR #223) マージ完了**。Mentions/Threads/Reminders カードに onClick + Enter キー対応 + a11y 属性 (role="button", tabIndex, aria-label) + hover 視覚フィードバックを追加し、`/chat?channel=X#message-Y` への遷移動線を確保。Reminders は完了ボタンを `e.stopPropagation()` で分離、`message` undefined 時はクリック無効化。`#message-Y` 自動スクロール処理は MessageList.tsx の既存実装を流用。保留 TODO #15 解消済み。残り Step: 8d → 8e → 9 |
| 2026-05-03 | **Step 8d (PR #224) マージ完了**。AppLayout に `defaultSidebarOpen` prop + `localStorage["sidebar.open"]` 永続化、Rail のロゴ直下にトグルボタン (MenuOpen/Menu アイコン) 追加。9 ページ (Inbox/Calendar/TaskBoard/Bookmark/DM/Templates/Admin/Profile/Files) に `defaultSidebarOpen={false}` 明示、ChatPage/SearchPage は省略 (= true)。追加修正: Sidebar 非表示時に `display: none` で grid auto-placement から外れて Main が縮むバグを `display: 'flex'` 固定 + grid 列幅 0px + overflow:hidden 方式に修正。保留 TODO #17 解消済み。残り Step: 8e → 9 (#4 のロゴデザインのみ未解決) |
| 2026-05-03 | **Step 8e-1 (PR #225) マージ完了**。Step 8e をサブステップ (8e-1〜8e-4) に分割。8e-1 では Rail ロゴを "C" の四角から SVG (上部 3 つの円 + 下部三角形 = コミュニティ + メッセージング) に刷新、Rail のホームラベルを「受信箱」に変更、InboxPage/SearchPage の意図的 useMemo 依存に eslint-disable 追加で warning 解消。保留 TODO #4 解消済み (全保留 TODO 解消)。残り Step: 8e-2 → 8e-3 → 8e-4 → 9 |
| 2026-05-03 | **Step 8e-2 (PR #226) マージ完了**。MembersContent (ContextRail メンバータブ + ChannelMembersDialog 共通) の自分以外のメンバー行に SendIcon (紙飛行機) ボタンを追加、`api.dm.createConversation` → `/dm?conv=N` navigate で DM 開始可能に。stopPropagation で ListItemButton 衝突回避、失敗時は useSnackbar.showError 通知。追加修正: ContextRail Tabs の MUI デフォルト minWidth=90px が効いて 5 タブ × 90 = 450px が右ペイン 320px に overflow し「メンバー」タブが画面外に隠れていたバグを `'& .MuiTab-root': { minWidth: 0, px: 1 }` で解消 (Playwright 実機検証済)。残り Step: 8e-3 → 8e-4 → 9 |
| 2026-05-03 | **Step 8e-3 (PR #227) マージ完了**。SidebarFooter (ステータス / テーマ / 通知 / プロフィール / ログアウト) を Rail 最下部に統合し AppLayout の Sidebar 列から撤去。SidebarFooter を縦並び 5 アイコン版に refactor、ユーザー名は Tooltip (`"alice のステータスを設定"`) に集約。Step 8d で Sidebar 閉じた状態でも Rail 経由ですべての SidebarFooter 機能にアクセス可能に。残り Step: 8e-4 → 9 |
| 2026-05-03 | **Step 8e-4 (PR #228) マージ完了**。DmConversationList と SidebarDmList の重複整理 (案 C: フック + 純粋表示コンポーネント抽出)。`useDmConversationsSocket` フック新設で `new_dm_message` 購読を集約 (単一 updater で lastMessage / unreadCount 同時更新するよう改善)。`DmListRow` コンポーネント新設、variant=`expanded`/`compact` で密度切替。両既存コンポーネントは wrapper 化。`SidebarDmList` は `useAuth` で currentUserId 取得。残り Step: 8e-5 → 9 |
| 2026-05-03 | **Step 8e-5 (PR #229) マージ完了**。ユーザーが PC 利用中に発見した 2 課題を解消。(1) AdminPage と関連子コンポーネント (AuditLogView / ModerationQueue) のハードコード色 (`grey.50` / `white`) を MUI テーマ依存 (`background.default` / `background.paper`) に置換でダークモード対応。(2) AppLayout に `forceSidebarClosed` prop 追加し、sidebar が空な 6 ページ (Admin / DM / Bookmark / Templates / Profile / Files) で強制閉じ + localStorage 書き込み抑制で他ページ状態を保持。追加修正 2: AttachmentPreview / ReminderDialog / GuestChannelPage の `grey.100` も `action.hover` に置換。**Step 8 (8a〜8e-5) 全完了**。残り Step: 9 (モバイル対応 / 最終 Step) |
| 2026-05-03 | **Step 9 を 9a〜9d に分割することにユーザー合意**。ブレークポイントは **`< 768px`** (claude-code-prompt.md §7 準拠、iPad 縦 768px は 3 列維持)。サブステップ: 9a (AppLayout レスポンシブ化基盤) / 9b (Rail → ボトムタブ) / 9c (Sidebar ドロワー化) / 9d (ContextRail ボトムシート化) |
| 2026-05-03 | **Step 9a (PR #230) マージ完了**。AppLayout に `useMediaQuery('(max-width: 767px)')` で isMobile 判定追加、モバイル時は grid を `1fr` 1 列に / Rail / Sidebar / RightPane を条件付き非レンダリング / 上部に AppBar 仮枠 (`app-layout-mobile-header`、56px) を追加。jsdom 用 `window.matchMedia` safety net mock を `setup.ts` に追加 (デフォルト `matches: false` で既存テスト 1561 件全 pass、波及なし)。残りサブステップ: 9b → 9c → 9d |
| 2026-05-03 | **fix: SearchPage リクエストループ修正 (PR #231) マージ完了**。Step 9b 着手前にユーザーが PC 利用中に発見した不具合。`ChipFilterSection` が `useState` initializer で毎回 `Promise.all` を生成しており、React 19 concurrent モードの多重インスタンス化で `/api/channels` と `/api/tags/suggestions?limit=1000` が **2 秒間で各 3000 回以上発行** されるループになっていた。`ChannelList` / `SidebarDmList` と同じモジュールレベルキャッシュ (`getOrCreateMasterDataPromise`) を導入。Playwright 実機計測で `/api/tags/suggestions?limit=1000` が 3252 → 1 回に激減することを確認。罠リストにも追記。残りサブステップ: 9b → 9c → 9d |
| 2026-05-03 | **Step 9b (PR #232) マージ完了**。新規 `MobileBottomNav.tsx` で底部 5 タブ (受信箱 / チャット / DM / カレンダー / タスク) を実装、受信箱と DM に未読バッジ、`aria-current="page"` でアクティブ表示。AppLayout モバイル AppBar 強化: 左にアプリロゴ (タップで `/`)、右に検索アイコン (`/search` へ遷移) + 3 点メニュー (ブックマーク / テンプレート / 管理 admin のみ)。モバイル時 Main 領域に `pb: 56px` を確保 (BottomNav 被り防止)。Playwright 実機検証で 375px / 1280px 両方の動作を確認。残りサブステップ: 9c → 9d |
| 2026-05-03 | **Step 9c (PR #233) マージ完了**。AppLayout に MUI `Drawer` (左 slide-in、280px 幅) を追加、AppBar 左にハンバーガーボタンを配置 (forceSidebarClosed ページでは非表示)。`useLocation` で pathname/search 変化を検知して `setMobileDrawerOpen(false)` で自動閉じ。`SidebarFooter.tsx` に `variant?: 'rail' \| 'drawer'` prop 追加 (default 'rail' で後方互換)、'drawer' は `List` + `ListItemButton` (アイコン + ラベル横並び、48px 高) で表示しモバイルからも全機能アクセス可能に。Playwright 実機検証で 375px のハンバーガー → ドロワー (CHANNELS + Footer) → チャンネル選択 → `/chat?channel=5` 遷移 + ドロワー自動閉じ を確認。残りサブステップ: 9d (ContextRail ボトムシート化、最終 Step) |
| 2026-05-04 | **Step 9d (PR #234) マージ完了 = Step 1〜9 全完了**。AppLayout に MUI `SwipeableDrawer` (anchor=bottom, 75vh, 上端角丸 16px, grabber バー) を追加。当初は AppBar 右にトグルボタンを置いたが、ユーザーフィードバックで「ChatPage トグル + AppBar トグルの二段階操作が冗長」となり Step 9d-fix で AppBar トグル廃止 → SwipeableDrawer の open は `isMobile && Boolean(rightPane)` で自動判定する設計に変更。AppLayout に `onCloseRightPane?: () => void` prop 追加し、ChatPage が `setContextRailOpen(false)` を渡してバックドロップ/スワイプ閉じ動作を実現。あわせて `RichEditor.tsx` に `useMediaQuery` を追加してモバイル時のプレースホルダーを「メッセージを入力…」のみに短縮 (枠はみ出し修正)。Playwright 実機検証 (375px / 1280px 両方) で動作確認済。 |
| 2026-05-04 | **コメント整理 (PR #235) マージ完了**。Step 1〜9 を通じて記入した「Step N: 〜」「Step N で〜」形式の Step 番号コメントを 137 行 → 0 行に整理。コードを見れば自明な説明は削除し、WHY や設計意図 / バグ回避の文脈は表現を改めて残した。48 ファイル変更。 |
| 2026-05-04 | **テスト品質向上 (PR #237) マージ完了**。サブエージェント 4 並列で Step 1〜9 全 50 テストファイルを「不足 / トートロジー / 重複」の 3 観点でレビューし、結果を反映。Critical 修正 (TODO のみの空 it / DnD `toBeDefined()` のみ / mock 自己参照トートロジー / テスト名と内容の乖離) と Important 修正 (重複統合・aria-current 強化・並び替え 3 要素拡張・changePassword 集約等) を実施。15 ファイル変更、削除/統合 約 12 it / 強化・リライト 約 10 it。サーバ側 `threadsSubscribed.test.ts` の `unreadCount` 0 固定検証を `it.skip` 化 (issue #236 で本実装予定)。**次フェーズ**: 統合ブランチ → main の最終 PR 着手 |
