---
name: feature-dev
description: 単一の GitHub Issue または機能変更を、独立 AI レビュー付き TDD、検証、Playwright 画面確認、PR 作成まで実行する Claude Code 用スキル。
---

# Feature Dev

共通フローは `AGENTS.md`、テンプレートは `doc/ai-review-tdd-guide.md` を正本とする。

1. Issue、関連仕様、既存実装、既存テストを調査する。
2. テスト観点を整理し、テストファイルへ `it.todo` のスケルトンを書く。
3. `ai-reviewer` agent を別コンテキストで起動し、テスト設計レビューを依頼する。
4. `CHANGES_REQUESTED` なら修正し、同じ reviewer を再開して `APPROVED` まで反復する。
5. テスト、プログラムの順に実装し、ビルドと全テストを通す。
6. 高リスク変更では `ai-reviewer` に実装レビューを依頼し、`APPROVED` まで反復する。
7. 画面影響があれば `playwright-e2e` skill で画面、コンソール、ネットワークを確認する。なければ根拠付きで `N/A` とする。
8. PR テンプレートへレビューと検証結果を記録して PR を作る。マージはしない。

通常のレビュー完了をユーザーへ問い合わせない。資料から一意に決められないプロダクト判断だけをエスカレーションする。
