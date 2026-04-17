# プロジェクト開発ルール

エージェントの行動規範・開発フロー・テスト設計・Git ワークフローはすべて [AGENTS.md](AGENTS.md) に記載されている。必ず参照すること。

## DBマイグレーション

スキーマ管理には **Atlas**（宣言モード）を使用する。

- スキーマ定義: `db/schema.hcl`（このファイルを編集してスキーマを変更する）
- Atlas設定: `atlas.hcl`
- 適用コマンド: `atlas schema apply --env local`
- 差分確認: `atlas schema apply --env local --dry-run`

**スキーマを変更するときは必ず `db/schema.hcl` を編集し、`atlas schema apply` で適用する。`database.ts` の `initializeSchema` は新規インストール時の初期化専用であり、マイグレーションには使用しない。**

## フロントエンド開発ルール

フロントエンド（`packages/client`）は **React 19** で開発する。

- データフェッチには `useEffect` + API 呼び出しの組み合わせを使わず、React 19 の `use()` フックを使用する
- `use(promise)` でデータを読み取り、コンポーネントを `<Suspense>` でラップしてローディング状態を管理する
- `use(promise)` に渡す Promise は `useState` または `useMemo` で安定化させ、レンダリングごとに再生成しないこと

## PRテンプレート

プルリクエストを作成する際は `.github/PULL_REQUEST_TEMPLATE.md` の全セクションを必ず埋めること。
