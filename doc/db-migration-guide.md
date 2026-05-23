# DB マイグレーションガイド

スキーマ管理には Atlas の宣言モードを使用する。

## ファイル

| 用途 | ファイル |
|---|---|
| スキーマ定義 | `db/schema.hcl` |
| Atlas 設定 | `atlas.hcl` |

## コマンド

```bash
atlas schema apply --env local --dry-run
atlas schema apply --env local
```

## ルール

- スキーマを変更するときは必ず `db/schema.hcl` を編集する
- 差分確認には `atlas schema apply --env local --dry-run` を使う
- 適用には `atlas schema apply --env local` を使う
- `packages/server/src/db/database.ts` の `initializeSchema` は新規インストール時の初期化専用であり、マイグレーションには使用しない
- worktree で複数 Issue を並列実装する場合、共有ローカル DB に対する `atlas schema apply` を並列実行しない

