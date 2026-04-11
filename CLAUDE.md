# プロジェクト開発ルール

エージェントの行動規範・開発フロー・テスト設計・Git ワークフローはすべて [AGENT.md](AGENT.md) に記載されている。必ず参照すること。

## DBマイグレーション

スキーマ管理には **Atlas**（宣言モード）を使用する。

- スキーマ定義: `db/schema.hcl`（このファイルを編集してスキーマを変更する）
- Atlas設定: `atlas.hcl`
- 適用コマンド: `atlas schema apply --env local`
- 差分確認: `atlas schema apply --env local --dry-run`

**スキーマを変更するときは必ず `db/schema.hcl` を編集し、`atlas schema apply` で適用する。`database.ts` の `initializeSchema` は新規インストール時の初期化専用であり、マイグレーションには使用しない。**
