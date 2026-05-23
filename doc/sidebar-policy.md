# ページ別サイドバー表示ポリシー

Issue #318 で定義したページごとのサイドバー（ChannelList）表示ポリシー。

## ポリシー一覧

| ページ | ルート | defaultSidebarOpen | 理由 |
|---|---|---|---|
| チャット | `/chat` | `true`（開き既定） | チャンネル切替が主操作のため常時表示が望ましい |
| 受信箱 | `/` | `false`（折り畳み既定） | サマリーとタブが主作業領域。ChannelList は補助的 |
| 検索 | `/search` | `false`（折り畳み既定） | 検索フォームと結果が主作業領域 |
| タスクボード | `/tasks` | `false`（折り畳み既定） | カンバン列が主作業領域 |
| カレンダー | `/calendar` | `false`（折り畳み既定） | カレンダービューが主作業領域 |

## 共通仕様

- `forceSidebarClosed` はどのページにも適用しない。ユーザーは常に手動でサイドバーを開閉できる。
- 開閉状態は `localStorage["sidebar.open"]` に永続化される（AppLayout が管理）。
- localStorage に値が存在する場合は `defaultSidebarOpen` より優先される。
  - 例: チャットページで手動でサイドバーを閉じると、その後は受信箱・検索でも閉じた状態を維持する。

## 実装箇所

- `AppLayout` (`packages/client/src/components/Layout/AppLayout.tsx`): 開閉 state・localStorage 永続化・トグルボタン
- 各ページコンポーネントが `<AppLayout defaultSidebarOpen={...}>` で初回表示ポリシーを宣言する
