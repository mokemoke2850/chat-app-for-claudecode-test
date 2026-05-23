---
name: parallel-feature-dev
description: 複数の GitHub Issue を依存関係を考慮して並列 worktree で実装する Claude Code 用オーケストレータースキル。ファイル競合を分析して並列グループを決定し、worker エージェントを並列起動して PR draft 作成まで進める。
version: 1.0.0
---

# Parallel Feature Dev（オーケストレーター）

複数 Issue を並列で実装する。
フェーズ分割、競合判定、worktree 運用の共通方針は `doc/parallel-dev-guide.md` を正本として参照する。
TDD フロー、PR 前チェック、報告フォーマットは `AGENTS.md` に従う。

この skill には Claude Code のサブエージェント起動、モデル指定、draft PR 運用などツール固有の手順だけを書く。

## 呼び出し方

```text
/parallel-feature-dev #44 #45 #46 #43
/parallel-feature-dev #44 #46
```

## Phase 0: 計画

1. 各 Issue を `gh issue view {番号}` で読む
2. `doc/parallel-dev-guide.md` に従って影響ファイルと競合リスクを見積もる
3. DB スキーマ変更、共有型、Socket.IO、横断的 UI 変更を含む Issue は慎重に分離する
4. 高難度 Issue は `opus`、低〜中難度 Issue は `sonnet` を worker モデル候補にする
5. フェーズ分割表をユーザーに提示して承認を得る

承認前に worker を起動しない。

## Phase 1: テスト項目作成

承認された並列グループごとに worker を worktree isolation で背景実行する。

worker への必須指示:

- `AGENTS.md` と関連 `doc/` を読む
- ブランチを作成する
- テストファイルに `describe` と `it.todo('日本語の項目名')` だけを書く
- アサーション、空ボディの `it`、`// TODO` だけのテストは書かない
- プログラム実装はしない
- テスト項目確認用の draft PR を作成する
- PR URL と作成ファイルを報告する

全 worker 完了後、draft PR の Files タブでテスト項目を確認するようユーザーに依頼する。
ユーザー承認前にテストロジックや実装へ進まない。

## Phase 2: 実装

ユーザーが承認した Issue だけ worker を再起動する。

worker への必須指示:

- 承認済みの `it.todo` を `it` に変換し、アサーションを書く
- テストが定義した仕様に合わせてプログラムを実装する
- DB 変更は `db/schema.hcl` を正とし、Atlas 宣言モードの注意点を守る
- React 19 の `use()` / `<Suspense>` は `doc/react19-suspense-guide.md` に従う
- ブラウザ確認が必要な場合は `doc/browser-e2e-guide.md` に従う
- `npm run build` と必要なテストを通す
- draft PR を通常 PR に変換し、PR テンプレートを埋める
- PR のマージはしない

`gh pr edit` が失敗した場合は REST API でタイトルと本文を更新し、反映を確認する。

## Phase 3: 集約

全 worker の結果を集約し、以下を報告する。

```md
## 並列実装完了

### 作成されたPR
| Issue | PR | ブランチ | ステータス |
|---|---|---|---|

### ビルド・テスト結果
| Issue | ビルド | テスト |
|---|---|---|

### 推奨マージ順序
1. ...

### 次のフェーズ
- ...
```

## Claude Code 固有の注意

- worker は背景実行にし、起動後は完了通知を待つ
- worker の transcript を継続的に tail しない
- worktree の `node_modules` が空の場合は root の `node_modules` への symlink で対応し、勝手に `npm install` しない
- DB スキーマ変更を含む worker の `atlas schema apply` は並列実行しない
- worker 失敗時はエラー内容を報告し、再試行か手動対応かをユーザーに確認する
- PR の承認とマージはユーザーが実施する
