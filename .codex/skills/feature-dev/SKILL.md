---
name: feature-dev
description: このプロジェクトで単一の GitHub Issue または機能変更を、独立 AI レビュー付き TDD、検証、Playwright 画面確認、PR 作成まで実行する。Codex で機能追加、既存機能修正、バグ修正を完遂するときに使う。
---

# Feature Dev

1. `AGENTS.md`、`doc/ai-review-tdd-guide.md`、Issue と関連仕様を読む。
2. ブランチを作り、テスト観点を整理してテストファイルへ `it.todo` のスケルトンを書く。
3. 作成担当と別コンテキストの reviewer agent を起動する。Issue、関連仕様、既存実装・テスト、差分を渡し、共通レビュー観点による判定を求める。
4. `CHANGES_REQUESTED` なら修正し、同じ reviewer に再レビューを依頼する。`APPROVED` までアサーションを書かない。
5. 承認済みスケルトンをテストへ変換し、テストが定義する仕様に合わせて実装する。
6. 対象テスト、`npm run build`、`npm run test`、未実装テスト残存確認を行う。
7. `AGENTS.md` が定める高リスク変更では、同じ reviewer に実装差分とテストのレビューを依頼し、`APPROVED` まで修正する。
8. 画面影響がある場合は `$codex-browser-dev` を使い、レビューで定めたシナリオ、コンソール、ネットワークを確認する。画面影響がなければ `N/A` の根拠を記録する。
9. `.github/PULL_REQUEST_TEMPLATE.md` を埋め、レビューと検証の結果を含む PR を作る。マージはしない。

既存の goal 実行中は通常の AI レビューを理由に停止せず、仕様資料から決められないプロダクト判断だけをユーザーへ確認する。重大な技術指摘は修正し、PR と完了報告へ記録する。
