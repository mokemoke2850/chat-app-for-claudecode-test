---
name: parallel-feature-dev
description: 複数の GitHub Issue を依存関係とファイル競合に基づいて並列 worktree で実装し、Issue ごとの独立 AI レビュー、検証、Playwright 確認、PR 作成まで進める Claude Code 用オーケストレータースキル。
---

# Parallel Feature Dev

共通フローは `AGENTS.md`、並列化判断は `doc/parallel-dev-guide.md`、レビュー書式は `doc/ai-review-tdd-guide.md` を正本とする。

## Phase 0: 計画

1. 各 Issue と関連仕様を読む。
2. 影響ファイル、依存関係、DB・共有型・Socket.IO・横断 UI の競合を見積もる。
3. 競合しない Issue を同一フェーズへまとめ、実行計画をユーザーに提示する。
4. 計画承認後、Issue ごとに worktree と `feature-worker` を起動する。

## Phase 1: テスト設計と独立レビュー

各 worker はテスト観点と `it.todo` を作る。Issue ごとに別の `ai-reviewer` を起動し、作成 worker へ `CHANGES_REQUESTED` を戻して修正させる。同じ reviewer が `APPROVED` を出すまで反復し、人間確認や Draft PR を挟まない。

## Phase 2: 実装と検証

承認済み Issue の worker を継続し、テスト、プログラム、ビルド、全テストの順に進める。高リスク変更は同じ reviewer の実装レビューを通す。画面影響がある Issue は Playwright で画面、コンソール、ネットワークを確認する。

各 worker は `.github/PULL_REQUEST_TEMPLATE.md` を埋めた通常 PR を作成し、マージしない。仕様資料から決められないプロダクト判断だけをユーザーへエスカレーションする。

## Phase 3: 集約

Issue、PR、ブランチ、AI レビュー、ビルド、テスト、Playwright、推奨マージ順を表で報告する。DB スキーマ変更の適用は並列実行しない。worker の transcript は継続的に tail せず、完了通知を待つ。
