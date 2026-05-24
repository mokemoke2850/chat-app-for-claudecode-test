---
name: codex-browser-dev
description: このプロジェクト（chat-app）で Codex の Playwright CLI Skill を使ってブラウザ上の画面操作、E2E 的な動作確認、実描画確認、コンソール・ネットワーク確認を行うための Codex 専用スキル。Claude Code の Playwright MCP ではなく Codex で画面操作が必要なときに使う。
---

# Codex Browser Dev

このスキルは Codex 専用のブラウザ動作確認入口である。
共通の確認観点、開発サーバー確認、React 19 Suspense のリクエスト数確認、一時ファイルの扱いは `doc/browser-e2e-guide.md` を正本として参照する。

## 使うツール

1. Codex の `playwright` skill を第一候補にする。
   - `Playwright CLI Skill` の wrapper script で実ブラウザを起動し、`snapshot` の ref を使って操作する。
   - `Browser` プラグインの `iab` は確認しない。Codex Browser が使えるかどうかに依存せず、Playwright CLI で進める。
2. Playwright CLI が使えない場合だけ `Computer Use` にフォールバックする。
   - `playwright` skill が未インストール、`npx` がない、CLI 起動に失敗するなど、CLI で進められない場合に限る。
   - `computer-use:computer-use` skill の確認ポリシーに従う。
3. どちらも使えない場合は、画面操作できない理由と、代替で実施した確認範囲をユーザーに報告する。

## 開発サーバー

まず既存サーバーの有無を確認する。

```bash
lsof -i :3001 -i :5173
```

- `node` が LISTEN していれば `http://localhost:5173` を開く。
- 未起動の場合だけ `npm run dev` を起動する。
- Codex sandbox では dev server の listen や PostgreSQL 接続が `EPERM` になることがある。その場合は同じ `npm run dev` を権限付きで再実行する。
- 自分が起動したサーバーだけを終了する。ユーザーや別プロセスのサーバーは止めない。

## Playwright CLI での確認手順

先に `playwright` skill を読み、wrapper script を使う。

```bash
export CODEX_HOME="${CODEX_HOME:-$HOME/.codex}"
export PWCLI="$CODEX_HOME/skills/playwright/scripts/playwright_cli.sh"
```

通常は作業ごとに session 名を付け、生成物を `output/playwright/<label>/` に閉じ込める。

```bash
mkdir -p output/playwright/<label>
cd output/playwright/<label>
"$PWCLI" --session <label> open http://localhost:5173 --headed
"$PWCLI" --session <label> snapshot
"$PWCLI" --session <label> fill e14 "example"
"$PWCLI" --session <label> screenshot
"$PWCLI" --session <label> console
"$PWCLI" --session <label> close
```

確認の流れ:

1. `open` で `http://localhost:5173` または対象 URL を開く。
2. `snapshot` で操作対象の ref を確認する。
3. `fill` / `click` / `press` などを ref 指定で実行する。
4. 画面状態が変わったら `snapshot` を取り直す。
5. UI 崩れ、重なり、スクロール、レスポンシブ表示を確認する場合は `screenshot` を使う。
6. React 19 Suspense や API 連打が疑わしい場合は `console` / `requests` を確認する。
7. 最後に `close` で Playwright session を閉じる。

Codex sandbox では `npx --package @playwright/cli` の取得やブラウザ起動でネットワーク・プロセス権限が必要になる場合がある。その場合は、同じ `$PWCLI ...` コマンドを権限付きで再実行する。

## 操作メモ

- 接続先は通常 `http://localhost:5173`。
- ログイン後にオンボーディングダイアログが出たら、検証対象でなければスキップする。
- チャネル選択、モーダル開閉、リスト更新の直後は locator が古くなるため、操作直前に snapshot を取り直す。
- Quill の入力欄は `.ql-editor` を使う。通常の textbox locator で拾えない場合は CSS locator でフォーカスする。
- CSS 修正後に HMR 反映が怪しい場合は明示的に reload してから再確認する。
- スクリーンショット、snapshot、console log などの一時ファイルは `output/playwright/` 配下に生成する。
- 生成物は原則コミットしない。削除する場合は `doc/browser-e2e-guide.md` に従い、ユーザー確認を取る。ただしユーザーが明示的に削除を指示した場合は削除してよい。

## Computer Use フォールバック

Computer Use を使う場合は、ブラウザでの直接操作に限定し、次の手順で進める。

1. ローカルアプリの URL を開く。
2. スクリーンショット相当の画面理解で現在状態を確認する。
3. クリック、入力、スクロールなどを一操作ずつ行う。
4. 各操作後に画面を再確認してから次に進む。

フォーム送信、アカウント作成、権限変更、外部サービスへの送信など副作用がある操作は、Computer Use の確認ポリシーに従って直前にユーザー確認を取る。
