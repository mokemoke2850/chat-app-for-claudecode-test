---
name: Playwright E2E 検証
description: このプロジェクト（chat-app）で Claude Code の Playwright MCP を使ってブラウザ上の挙動を検証する手順。Vitest だけでは検出できない CSS レイアウト崩れ・実描画の不具合・ユーザー操作フローを確認する必要があるときに使う。
version: 0.1.0
---

# Playwright E2E 検証

共通の確認観点、開発サーバー確認、React 19 Suspense のリクエスト数確認、一時ファイルの扱いは
`doc/browser-e2e-guide.md` を正本として参照する。

## Claude Code 固有の手順

Playwright MCP のツールは必要に応じて ToolSearch でロードする。

- `browser_navigate`
- `browser_snapshot`
- `browser_click`
- `browser_type`
- `browser_press_key`
- `browser_fill_form`
- `browser_evaluate`
- `browser_take_screenshot`
- `browser_close`

## 操作メモ

- 接続先は通常 `http://localhost:5173`
- ログイン後にオンボーディングダイアログが出たらスキップする
- チャネル選択などで ref が古くなることがあるため、操作直前に `browser_snapshot` を取り直す
- Quill の入力欄は `.ql-editor` にフォーカスし、必要に応じて `browser_press_key` を 1 文字ずつ送る
- CSS 修正が反映されないときは `browser_navigate` でフルリロードする

## 生成ファイル

Playwright MCP は以下を生成することがある。

- `.playwright-mcp/page-*.yml`
- `.playwright-mcp/console-*.log`
- `browser_take_screenshot` で指定したスクリーンショット

これらは作業中の一時成果物であり、コミットしない。
削除する場合は `doc/browser-e2e-guide.md` に従い、一覧を示してユーザー確認を取る。
