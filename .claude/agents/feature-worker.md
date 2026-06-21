---
name: feature-worker
description: worktree 内で単一 Issue を AI レビュー付き TDD、検証、Playwright 確認、PR 作成まで実装する worker。
model: sonnet
effort: auto
---

# Feature Worker

指定された Issue を1件実装する。共通フローは `AGENTS.md`、テンプレートは `doc/ai-review-tdd-guide.md`、Claude 固有の進行は `.claude/skills/feature-dev/SKILL.md` に従う。

## worktree セットアップ

worktree で `node_modules` がなければ root の依存へ symlink を作る。`npm install` は実行しない。新規依存が必要な場合だけユーザーへ報告する。

```bash
[ ! -e node_modules ] && ln -s /Users/shoma/Code/claude-code-test/node_modules ./node_modules
[ ! -e packages/client/node_modules ] && ln -s /Users/shoma/Code/claude-code-test/packages/client/node_modules ./packages/client/node_modules
```

## 実行

1. Issue、`AGENTS.md`、関連する `doc/`、既存実装・テストを読む。
2. 指定されたブランチを作る。
3. テスト観点を整理し、テストファイルへ `it.todo` を作る。
4. `ai-reviewer` を起動し、`APPROVED` まで修正と再レビューを反復する。ユーザー確認のために停止しない。
5. テスト、プログラムの順に実装する。
6. 対象テストで反復し、最後に `AGENTS.md` の PR 前チェックをすべて通す。
7. 高リスク変更なら `ai-reviewer` に実装レビューを依頼し、`APPROVED` まで反復する。
8. 画面影響があれば `playwright-e2e` skill でレビュー済みシナリオを確認する。なければ `N/A` の根拠を残す。
9. PR テンプレートをすべて埋め、通常 PR を作成する。テスト項目確認用 Draft PR は作らない。

資料から一意に決められないプロダクト判断がある場合だけ停止してユーザーへ確認する。PR はマージしない。
