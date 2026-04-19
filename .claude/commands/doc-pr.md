---
description: ドキュメント変更のみの PR を作成し、差分をターミナル上で確認してからマージする
allowed-tools: Bash(git:*), Bash(gh:*), Read, Grep
---

# ドキュメント専用 PR 作成〜マージ

GitHub のページを開かずに、ターミナル内で「PR 作成 → 差分確認 → マージ」まで完結させる。

## Step 1: 変更内容の検証

以下を並列で実行して現状を把握する。

- `git status`
- `git diff --stat` — ステージ／未ステージ両方の差分規模
- `git rev-parse --abbrev-ref HEAD` — 現在のブランチ
- `git log main..HEAD --oneline` — main との差分コミット

### ドキュメントのみ変更かを検証

変更ファイルがすべて以下のいずれかにマッチすることを確認する:

- `*.md`
- `doc/**`
- `docs/**`
- `.github/**`（PR テンプレ等）
- `CLAUDE.md` / `AGENTS.md`（ルート）

**コード変更（`packages/*/src/**`, `db/**`, `*.ts`, `*.tsx`, `*.json` など）が含まれていた場合は即中断し、ユーザーに報告する。**
その際は「このコマンドはドキュメント専用です。通常の PR 作成フローで進めてください」と伝える。

## Step 2: ブランチとコミットの準備

- 現在のブランチが `main` の場合は中断し「作業ブランチを切ってから実行してください」と案内する
- 未コミット変更があれば、内容を確認のうえ `docs: <変更内容>` 形式でコミットする（コミットメッセージは変更内容から自動生成）
- コミットメッセージ末尾に以下を付ける:
  ```
  Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
  ```

## Step 3: PR 作成

まだ PR が存在しない場合のみ作成する。

1. `git push -u origin HEAD` でブランチを push
2. `.github/PULL_REQUEST_TEMPLATE.md` を読んで全セクションを埋める
3. `gh pr create --title "docs: <内容>" --body "<本文>"` で PR 作成（HEREDOC を使用）

すでに PR が存在する場合は `gh pr view --json number,url` で取得し、この PR を対象に進める。

## Step 4: 差分をターミナル上で表示

ユーザーが GitHub を開かずに確認できるよう、以下をこの順番で表示する。

1. PR 概要: `gh pr view <番号>`（タイトル・本文・レビュー状況）
2. 変更ファイル一覧: `gh pr diff <番号> --name-only`
3. 差分本体: `gh pr diff <番号>`
4. CI 状況: `gh pr checks <番号>`（失敗がある場合は必ず内容を提示）

差分が大きい場合は、まずファイル一覧を見せて「全差分を表示しますか？それともファイルを指定しますか？」とユーザーに聞く。

## Step 5: マージ可否の確認

以下を提示してユーザーの明示的な承認を得る。

```
## マージ確認

PR: #<番号> <タイトル>
URL: <URL>
変更ファイル: <件数>
CI: <成功 / 失敗 / 進行中>

このまま `gh pr merge --squash --admin --delete-branch` でマージしてよいですか？
(yes / no / 修正したい箇所を指摘)
```

- **CI が失敗している場合はマージを提案せず、失敗内容を報告して中断する**
- **ユーザーが yes と明示するまでマージを実行しない**

## Step 6: マージ実行

承認後:

1. `gh pr merge <番号> --squash --admin --delete-branch` でマージ＆リモートブランチ削除
2. ローカルを更新:
   - `git checkout main`
   - `git pull --ff-only origin main`
   - `git branch -d <元のブランチ>`（マージ済みなら安全に削除可能）

## Step 7: 結果報告

```
## マージ完了

- PR: #<番号> (squash merged)
- ローカル main: 最新に同期済み
- 作業ブランチ削除: 済み
```

## 禁止事項

- CI 失敗時のマージ
- ユーザー承認なしでの `--admin` マージ
- ドキュメント以外のファイルが含まれる PR の作成
- `main` ブランチへの直接コミット
