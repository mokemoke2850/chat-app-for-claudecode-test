# chat-app

リアルタイムチャットアプリケーション。

## 技術スタック

- **フロントエンド:** React + TypeScript + Vite
- **バックエンド:** Node.js + Express + Socket.IO + TypeScript
- **データベース:** PostgreSQL 16 (node-postgres / `pg`)
- **DBマイグレーション:** [Atlas](https://atlasgo.io/)

## セットアップ

```bash
npm install
npm run build
npm run dev
```

## DBマイグレーション

スキーマ管理には **Atlas** を使用する（宣言モード）。

### Atlas のインストール

```bash
# macOS / Linux
curl -sSf https://atlasgo.sh | sh
```

### スキーマ定義

`db/schema.hcl` がDBの正規スキーマ定義。テーブルの追加・変更はこのファイルを編集する。

### 主なコマンド

```bash
# スキーマの差分確認（実行せず内容を表示）
atlas schema apply --env local --dry-run

# スキーマをDBに適用
atlas schema apply --env local

# 現在のDBスキーマをHCL形式で確認
atlas schema inspect --env local
```

### 設定ファイル

| ファイル | 役割 |
|---|---|
| `atlas.hcl` | Atlasプロジェクト設定（接続先・スキーマソース） |
| `db/schema.hcl` | 宣言型スキーマ定義（正規スキーマ） |
