---
name: Playwright E2E 検証
description: このプロジェクト（chat-app）で Playwright MCP を使ってブラウザ上の挙動を検証する手順。Vitest だけでは検出できない CSS レイアウト崩れ・実描画の不具合・ユーザー操作フロー（ログイン〜送信〜表示）を確認する必要があるときに使う。例えば「画面が崩れている」「修正したのに見た目が変わらない」「単体テストは通るが実機で再現する」などの状況で起動する。
version: 0.1.0
---

# Playwright E2E 検証

このプロジェクトでは jsdom 上の Vitest が単体テストの中心だが、**CSS layout / 実描画 / 複数コンポーネントの相互作用**は jsdom では検証できない。Playwright MCP を使って実ブラウザで挙動を確認する手順をまとめる。

## いつ使うか

- 単体テストは通るが、ユーザーから「画面の挙動が直っていない」と報告された
- CSS / レイアウト / flex shrink / フォントメトリクスが絡む不具合
- Quill / dangerouslySetInnerHTML / Highlight.js など jsdom で動かないコンポーネント
- ログイン → チャネル切替 → メッセージ送信のような end-to-end フロー検証
- HMR で修正が反映されているか確認したいとき

## 前提：開発サーバーの確認

このプロジェクトの dev サーバーは `npm run dev` で起動するが、**既に起動中の場合がほとんど**。重複起動するとポート競合（5173 / 3001）で失敗する。

```bash
lsof -i :3001 -i :5173 2>/dev/null | head -5
```

`node` プロセスが LISTEN していれば既存サーバーがあるので、`npm run dev` は実行せずそのまま `http://localhost:5173` に接続する。

未起動なら `npm run dev` を `run_in_background` で立ち上げ、`until grep -qE "Local:|ready in" <log> ...` で起動を待つ。

## テストユーザーの用意

DB 上に毎回テストユーザーを作る必要があるとき、Playwright のフォームで登録するより API を叩く方が速い。

```bash
curl -s -X POST http://localhost:3001/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"username":"e2etest","email":"e2etest@example.com","password":"password1234"}'
```

レスポンスの `user.id` は将来のクリーンアップ用に控えておく。
登録済みユーザーが既にあるなら再利用してよい（テストごとにユーザーを増やさない）。

## ブラウザ操作の基本フロー

Playwright MCP のツールはまとまって提供されているが、毎回スキーマをロードする必要がある。先に以下を `ToolSearch` でロードしておく:

- `browser_navigate` / `browser_snapshot` / `browser_click` / `browser_type`
- `browser_press_key` / `browser_fill_form` / `browser_evaluate`
- `browser_take_screenshot` / `browser_close`

### 1. ログイン

```
browser_navigate → http://localhost:5173/
browser_fill_form → Email / Password に入力
browser_click → "Sign in" ボタン
```

初回ログイン時は **オンボーディングダイアログ**が出るので「スキップ」をクリック。

### 2. チャネル選択

サイドバーの `# テスト` などの button をクリック。`browser_snapshot` の ref が再描画で変わることがあるので、操作の直前に snapshot を取り直す。

`getByRole('button', { name: '# テスト' })` がうまく当たらないときは `getByRole('listitem').filter({ hasText: '# テスト' })` を使う。

### 3. メッセージ送信

`.ql-editor` にフォーカスしてキー入力する。`browser_type` は Quill の input event に追従しないことがあるので、**`browser_press_key` を 1 文字ずつ**送る方が確実。

```
browser_evaluate: () => document.querySelector('.ql-editor').focus()
browser_press_key: a (×3)
browser_press_key: Enter   ← Enter で送信される設定
```


## スクリーンショットの取り方

`browser_take_screenshot` の `filename` は相対パスで指定（`.playwright-mcp/` 配下に保存される）。

- viewport 全体: 引数なし
- 特定要素にフォーカスしたいとき: 先に `browser_evaluate` で `target.scrollIntoView({block: 'center'})` してから撮る

## HMR が効かない / 古い表示が残る

Vite の HMR でも、**React Refresh が State を保持**したり、過去にレンダー済みのメッセージが古い CSS のまま残ったりする。確実に最新コードを試すには:

```
browser_navigate → http://localhost:5173/   (フルリロード)
```

CSS 修正が反映されているかは、サーバーから直接 transformed source を取って確認できる:

```bash
curl -s "http://localhost:5173/src/components/Chat/MessageBubble.tsx?t=$(date +%s)" | grep "fit-content\|maxWidth"
```

## 終了処理

セッション終了時は `browser_close` でタブを閉じる。dev サーバーは元々ユーザーが立ち上げていたものなら**止めない**（`TaskStop` するのは自分が `run_in_background` で立てた場合のみ）。

### 自動生成ファイルの扱い

Playwright MCP を使うと以下のファイルがプロジェクト内に自動生成される:

- `.playwright-mcp/page-*.yml` — `browser_snapshot` の生成物
- `.playwright-mcp/console-*.log` — ブラウザコンソール出力
- `*.png` — `browser_take_screenshot` の保存先（filename を相対パスで指定するとプロジェクトルートに作成される）

これらは**作業中の一時成果物**であり、**絶対にコミットしてはならない**。`git add .` や `git add -A` を使うと巻き込む危険があるので、コミット時は `git add <具体的なパス>` で必要なファイルだけをステージする。

作業完了報告の直前に、必ず以下を実行する:

1. `git status` で残存ファイルを列挙する
2. ユーザーに「Playwright で生成された一時ファイル（一覧を提示）を削除してよいか」を尋ねる
3. ユーザーから **削除許可が得られた場合のみ** `rm -rf .playwright-mcp/ <生成された png 群>` で削除する
4. 削除しない判断（後で再確認したいなど）になった場合は、その旨を完了報告に明記する

ユーザーの確認なしに自動削除しないこと。スクリーンショットは原因調査の根拠として後から見たいケースがある。

## チェックリスト

ユーザーから「同じ現象が続いている」と報告されたときは、必ず以下の順で確認する:

1. 単体テストが通っているか → 通っているなら **テストロジックがカバーしていない領域**にバグがある
2. dev サーバーが最新コードを配信しているか（curl で確認）
3. ブラウザを `browser_navigate` でフルリロードしたか
4. `outerHTML` だけでなく `getBoundingClientRect` で**実描画サイズ**を取ったか
5. 親階層の CSS（特に `flex` / `minWidth: 0` / `wordBreak`）を遡ったか
6. 過去メッセージと新規メッセージの**両方**で再現／解消を確認したか

## 参考：このプロジェクト固有の落とし穴

- メッセージは Quill の Delta 形式（JSON）で保存される。表示は `renderMessageContent` が React ノードに変換する
- `MessageBubble` の `maxWidth` は親 column container の幅を基準にする。**親が flex item として shrink すると bubble も縮む**
- 投稿権限のないチャネルでは入力欄が「このチャンネルには投稿できません」になる。送信検証は **権限のあるチャネル**を選ぶ
- オンボーディングダイアログは新規ユーザーで初回ログイン時に出る。スキップを忘れると以降の操作が阻害される
