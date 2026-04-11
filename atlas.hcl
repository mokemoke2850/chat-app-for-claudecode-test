// Atlas プロジェクト設定ファイル
// 宣言モード: db/schema.hcl を正規スキーマとして管理する

data "hcl_schema" "app" {
  path = "db/schema.hcl"
}

env "local" {
  src = data.hcl_schema.app.url
  url = "sqlite://packages/server/data/chat.db"
  dev = "sqlite://file?mode=memory&_fk=1"
}
