# プロジェクト開発ルール

Claude Code 固有の入口ファイル。
エージェント共通の行動規範・開発フロー・テスト設計・Git ワークフローはすべて [AGENTS.md](AGENTS.md) に記載されている。必ず参照すること。

Codex と Claude Code で重複管理しないため、共通仕様と技術ガイドは [doc/agent-docs-guide.md](doc/agent-docs-guide.md) に従って `AGENTS.md` と `doc/` を正本にする。

## 機能開発

- 単一 Issue は `.claude/skills/feature-dev/SKILL.md` を使う
- 複数 Issue の並列開発は `.claude/skills/parallel-feature-dev/SKILL.md` を使う
- テスト設計と実装の独立レビューは `.claude/agents/ai-reviewer.md` に依頼する
- テスト観点とレビュー観点は [doc/ai-review-tdd-guide.md](doc/ai-review-tdd-guide.md) を参照する

## DBマイグレーション

DB スキーマ変更は [doc/db-migration-guide.md](doc/db-migration-guide.md) を参照する。

## フロントエンド開発ルール

フロントエンド（`packages/client`）は **React 19** で開発する。

- データフェッチには `useEffect` + API 呼び出しの組み合わせを使わず、React 19 の `use()` フックを使用する
- `use(promise)` でデータを読み取り、コンポーネントを `<Suspense>` でラップしてローディング状態を管理する
- `use(promise)` に渡す Promise は `useState` または `useMemo` で安定化させ、レンダリングごとに再生成しないこと

詳細な Suspense 境界の置き方、無限ループ診断、Vitest パターンは [doc/react19-suspense-guide.md](doc/react19-suspense-guide.md) を参照する。

## PRテンプレート

プルリクエストを作成する際は [AGENTS.md](AGENTS.md) の Git ワークフローに従い、`.github/PULL_REQUEST_TEMPLATE.md` の全セクションを必ず埋めること。
