// Atlas 宣言モード スキーマ定義
// このファイルがDBの正規スキーマ。変更はこのファイルを編集し atlas schema apply で適用する。

table "users" {
  schema = schema.main
  column "id" {
    null           = true
    type           = integer
    auto_increment = true
  }
  column "username" {
    null = false
    type = text
  }
  column "email" {
    null = false
    type = text
  }
  column "password_hash" {
    null = false
    type = text
  }
  column "avatar_url" {
    null = true
    type = text
  }
  column "created_at" {
    null    = false
    type    = text
    default = sql("datetime('now')")
  }
  column "updated_at" {
    null    = false
    type    = text
    default = sql("datetime('now')")
  }
  column "display_name" {
    null = true
    type = text
  }
  column "location" {
    null = true
    type = text
  }
  primary_key {
    columns = [column.id]
  }
  index "users_username" {
    unique  = true
    columns = [column.username]
  }
  index "users_email" {
    unique  = true
    columns = [column.email]
  }
}

table "channels" {
  schema = schema.main
  column "id" {
    null           = true
    type           = integer
    auto_increment = true
  }
  column "name" {
    null = false
    type = text
  }
  column "description" {
    null = true
    type = text
  }
  column "created_by" {
    null = false
    type = integer
  }
  column "created_at" {
    null    = false
    type    = text
    default = sql("datetime('now')")
  }
  primary_key {
    columns = [column.id]
  }
  foreign_key "0" {
    columns     = [column.created_by]
    ref_columns = [table.users.column.id]
    on_update   = NO_ACTION
    on_delete   = NO_ACTION
  }
  index "channels_name" {
    unique  = true
    columns = [column.name]
  }
}

table "channel_members" {
  schema = schema.main
  column "channel_id" {
    null = false
    type = integer
  }
  column "user_id" {
    null = false
    type = integer
  }
  column "joined_at" {
    null    = false
    type    = text
    default = sql("datetime('now')")
  }
  primary_key {
    columns = [column.channel_id, column.user_id]
  }
  foreign_key "0" {
    columns     = [column.user_id]
    ref_columns = [table.users.column.id]
    on_update   = NO_ACTION
    on_delete   = CASCADE
  }
  foreign_key "1" {
    columns     = [column.channel_id]
    ref_columns = [table.channels.column.id]
    on_update   = NO_ACTION
    on_delete   = CASCADE
  }
}

table "messages" {
  schema = schema.main
  column "id" {
    null           = true
    type           = integer
    auto_increment = true
  }
  column "channel_id" {
    null = false
    type = integer
  }
  column "user_id" {
    null = false
    type = integer
  }
  column "content" {
    null = false
    type = text
  }
  column "is_edited" {
    null    = false
    type    = integer
    default = 0
  }
  column "is_deleted" {
    null    = false
    type    = integer
    default = 0
  }
  column "created_at" {
    null    = false
    type    = text
    default = sql("datetime('now')")
  }
  column "updated_at" {
    null    = false
    type    = text
    default = sql("datetime('now')")
  }
  primary_key {
    columns = [column.id]
  }
  foreign_key "0" {
    columns     = [column.user_id]
    ref_columns = [table.users.column.id]
    on_update   = NO_ACTION
    on_delete   = NO_ACTION
  }
  foreign_key "1" {
    columns     = [column.channel_id]
    ref_columns = [table.channels.column.id]
    on_update   = NO_ACTION
    on_delete   = CASCADE
  }
}

table "mentions" {
  schema = schema.main
  column "id" {
    null           = true
    type           = integer
    auto_increment = true
  }
  column "message_id" {
    null = false
    type = integer
  }
  column "mentioned_user_id" {
    null = false
    type = integer
  }
  column "created_at" {
    null    = false
    type    = text
    default = sql("datetime('now')")
  }
  primary_key {
    columns = [column.id]
  }
  foreign_key "0" {
    columns     = [column.mentioned_user_id]
    ref_columns = [table.users.column.id]
    on_update   = NO_ACTION
    on_delete   = CASCADE
  }
  foreign_key "1" {
    columns     = [column.message_id]
    ref_columns = [table.messages.column.id]
    on_update   = NO_ACTION
    on_delete   = CASCADE
  }
}

table "push_subscriptions" {
  schema = schema.main
  column "id" {
    null           = true
    type           = integer
    auto_increment = true
  }
  column "user_id" {
    null = false
    type = integer
  }
  column "endpoint" {
    null = false
    type = text
  }
  column "p256dh" {
    null = false
    type = text
  }
  column "auth" {
    null = false
    type = text
  }
  column "created_at" {
    null    = false
    type    = text
    default = sql("datetime('now')")
  }
  primary_key {
    columns = [column.id]
  }
  foreign_key "0" {
    columns     = [column.user_id]
    ref_columns = [table.users.column.id]
    on_update   = NO_ACTION
    on_delete   = CASCADE
  }
  index "push_subscriptions_endpoint" {
    unique  = true
    columns = [column.endpoint]
  }
}

schema "main" {
}
