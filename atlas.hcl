// Atlas プロジェクト設定ファイル
// 宣言モード: db/schema.hcl を正規スキーマとして管理する

data "hcl_schema" "app" {
  path = "db/schema.hcl"
}

env "local" {
  src = data.hcl_schema.app.url
  url = "postgres://chatapp:chatapp@localhost:5432/chatapp?sslmode=disable"
  dev = "docker://postgres/16/dev?search_path=public"
}
