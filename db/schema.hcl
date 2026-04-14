// Atlas 宣言モード スキーマ定義
// このファイルがDBの正規スキーマ。変更はこのファイルを編集し atlas schema apply で適用する。
// comment 属性は MySQL / PostgreSQL 等の移行時にDB上のコメントとして適用される（SQLiteでは無視）。

table "users" {
  schema  = schema.main
  comment = "ユーザー"
  column "id" {
    null           = true
    type           = integer
    auto_increment = true
    comment        = "ユーザーID"
  }
  column "username" {
    null    = false
    type    = text
    comment = "ユーザー名（ログインID）"
  }
  column "email" {
    null    = false
    type    = text
    comment = "メールアドレス"
  }
  column "password_hash" {
    null    = false
    type    = text
    comment = "パスワードハッシュ"
  }
  column "avatar_url" {
    null    = true
    type    = text
    comment = "アバター画像URL"
  }
  column "created_at" {
    null    = false
    type    = text
    default = sql("datetime('now')")
    comment = "作成日時"
  }
  column "updated_at" {
    null    = false
    type    = text
    default = sql("datetime('now')")
    comment = "更新日時"
  }
  column "display_name" {
    null    = true
    type    = text
    comment = "表示名"
  }
  column "location" {
    null    = true
    type    = text
    comment = "所在地"
  }
  column "role" {
    null    = false
    type    = text
    default = "user"
    comment = "ロール（user / admin）"
  }
  column "is_active" {
    null    = false
    type    = integer
    default = 1
    comment = "アカウント有効フラグ（0: 停止中, 1: 有効）"
  }
  column "last_login_at" {
    null    = true
    type    = text
    comment = "最終ログイン日時"
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
  schema  = schema.main
  comment = "チャンネル"
  column "id" {
    null           = true
    type           = integer
    auto_increment = true
    comment        = "チャンネルID"
  }
  column "name" {
    null    = false
    type    = text
    comment = "チャンネル名"
  }
  column "description" {
    null    = true
    type    = text
    comment = "チャンネル説明"
  }
  column "created_by" {
    null    = true
    type    = integer
    comment = "作成者ユーザーID（ユーザー削除時に NULL になる）"
  }
  column "is_private" {
    null    = false
    type    = integer
    default = 0
    comment = "プライベートチャンネルフラグ（0: 公開, 1: プライベート）"
  }
  column "created_at" {
    null    = false
    type    = text
    default = sql("datetime('now')")
    comment = "作成日時"
  }
  primary_key {
    columns = [column.id]
  }
  foreign_key "0" {
    columns     = [column.created_by]
    ref_columns = [table.users.column.id]
    on_update   = NO_ACTION
    on_delete   = SET_NULL
  }
  index "channels_name" {
    unique  = true
    columns = [column.name]
  }
}

table "channel_members" {
  schema  = schema.main
  comment = "チャンネルメンバー"
  column "channel_id" {
    null    = false
    type    = integer
    comment = "チャンネルID"
  }
  column "user_id" {
    null    = false
    type    = integer
    comment = "ユーザーID"
  }
  column "joined_at" {
    null    = false
    type    = text
    default = sql("datetime('now')")
    comment = "参加日時"
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
  schema  = schema.main
  comment = "メッセージ"
  column "id" {
    null           = true
    type           = integer
    auto_increment = true
    comment        = "メッセージID"
  }
  column "channel_id" {
    null    = false
    type    = integer
    comment = "チャンネルID"
  }
  column "user_id" {
    null    = true
    type    = integer
    comment = "投稿者ユーザーID（ユーザー削除時に NULL になる）"
  }
  column "content" {
    null    = false
    type    = text
    comment = "メッセージ本文"
  }
  column "is_edited" {
    null    = false
    type    = integer
    default = 0
    comment = "編集済みフラグ（0: 未編集, 1: 編集済み）"
  }
  column "is_deleted" {
    null    = false
    type    = integer
    default = 0
    comment = "削除フラグ（0: 有効, 1: 削除済み）"
  }
  column "created_at" {
    null    = false
    type    = text
    default = sql("datetime('now')")
    comment = "投稿日時"
  }
  column "updated_at" {
    null    = false
    type    = text
    default = sql("datetime('now')")
    comment = "更新日時"
  }
  column "parent_message_id" {
    null    = true
    type    = integer
    comment = "直接の返信先メッセージID（NULLはルートメッセージ）"
  }
  column "root_message_id" {
    null    = true
    type    = integer
    comment = "スレッドのルートメッセージID（NULLはルートメッセージ自身）"
  }
  primary_key {
    columns = [column.id]
  }
  foreign_key "0" {
    columns     = [column.user_id]
    ref_columns = [table.users.column.id]
    on_update   = NO_ACTION
    on_delete   = SET_NULL
  }
  foreign_key "1" {
    columns     = [column.channel_id]
    ref_columns = [table.channels.column.id]
    on_update   = NO_ACTION
    on_delete   = CASCADE
  }
  foreign_key "parent_message" {
    columns     = [column.parent_message_id]
    ref_columns = [table.messages.column.id]
    on_update   = NO_ACTION
    on_delete   = CASCADE
  }
  foreign_key "root_message" {
    columns     = [column.root_message_id]
    ref_columns = [table.messages.column.id]
    on_update   = NO_ACTION
    on_delete   = CASCADE
  }
  index "messages_root_message_id" {
    columns = [column.root_message_id]
  }
}

table "mentions" {
  schema  = schema.main
  comment = "メンション"
  column "id" {
    null           = true
    type           = integer
    auto_increment = true
    comment        = "メンションID"
  }
  column "message_id" {
    null    = false
    type    = integer
    comment = "メッセージID"
  }
  column "mentioned_user_id" {
    null    = false
    type    = integer
    comment = "メンション対象ユーザーID"
  }
  column "channel_id" {
    null    = false
    type    = integer
    comment = "チャンネルID"
  }
  column "is_read" {
    null    = false
    type    = integer
    default = 0
    comment = "既読フラグ（0: 未読, 1: 既読）"
  }
  column "created_at" {
    null    = false
    type    = text
    default = sql("datetime('now')")
    comment = "メンション日時"
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
  foreign_key "2" {
    columns     = [column.channel_id]
    ref_columns = [table.channels.column.id]
    on_update   = NO_ACTION
    on_delete   = CASCADE
  }
}

table "message_attachments" {
  schema  = schema.main
  comment = "メッセージ添付ファイル"
  column "id" {
    null           = true
    type           = integer
    auto_increment = true
    comment        = "添付ファイルID"
  }
  column "message_id" {
    null    = true
    type    = integer
    comment = "メッセージID（NULL = メッセージ投稿前の一時状態）"
  }
  column "url" {
    null    = false
    type    = text
    comment = "ファイル公開URL"
  }
  column "original_name" {
    null    = false
    type    = text
    comment = "元のファイル名"
  }
  column "size" {
    null    = false
    type    = integer
    comment = "ファイルサイズ（バイト）"
  }
  column "mime_type" {
    null    = false
    type    = text
    comment = "MIMEタイプ"
  }
  column "created_at" {
    null    = false
    type    = text
    default = sql("datetime('now')")
    comment = "作成日時"
  }
  primary_key {
    columns = [column.id]
  }
  foreign_key "0" {
    columns     = [column.message_id]
    ref_columns = [table.messages.column.id]
    on_update   = NO_ACTION
    on_delete   = CASCADE
  }
}

table "push_subscriptions" {
  schema  = schema.main
  comment = "プッシュ通知サブスクリプション"
  column "id" {
    null           = true
    type           = integer
    auto_increment = true
    comment        = "サブスクリプションID"
  }
  column "user_id" {
    null    = false
    type    = integer
    comment = "ユーザーID"
  }
  column "endpoint" {
    null    = false
    type    = text
    comment = "プッシュエンドポイントURL"
  }
  column "p256dh" {
    null    = false
    type    = text
    comment = "公開鍵（p256dh）"
  }
  column "auth" {
    null    = false
    type    = text
    comment = "認証シークレット"
  }
  column "created_at" {
    null    = false
    type    = text
    default = sql("datetime('now')")
    comment = "登録日時"
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

table "message_reactions" {
  schema  = schema.main
  comment = "メッセージリアクション"
  column "id" {
    null           = true
    type           = integer
    auto_increment = true
    comment        = "リアクションID"
  }
  column "message_id" {
    null    = false
    type    = integer
    comment = "メッセージID"
  }
  column "user_id" {
    null    = false
    type    = integer
    comment = "リアクションしたユーザーID"
  }
  column "emoji" {
    null    = false
    type    = text
    comment = "絵文字（Unicode文字）"
  }
  column "created_at" {
    null    = false
    type    = text
    default = sql("datetime('now')")
    comment = "作成日時"
  }
  primary_key {
    columns = [column.id]
  }
  index "message_reactions_unique" {
    unique  = true
    columns = [column.message_id, column.user_id, column.emoji]
  }
  foreign_key "0" {
    columns     = [column.message_id]
    ref_columns = [table.messages.column.id]
    on_update   = NO_ACTION
    on_delete   = CASCADE
  }
  foreign_key "1" {
    columns     = [column.user_id]
    ref_columns = [table.users.column.id]
    on_update   = NO_ACTION
    on_delete   = CASCADE
  }
}

table "channel_read_status" {
  schema  = schema.main
  comment = "チャンネル既読ステータス"
  column "user_id" {
    null    = false
    type    = integer
    comment = "ユーザーID"
  }
  column "channel_id" {
    null    = false
    type    = integer
    comment = "チャンネルID"
  }
  column "last_read_message_id" {
    null    = true
    type    = integer
    comment = "最後に既読にしたメッセージID（NULLは一度も開いていない）"
  }
  column "updated_at" {
    null    = false
    type    = text
    default = sql("datetime('now')")
    comment = "更新日時"
  }
  primary_key {
    columns = [column.user_id, column.channel_id]
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


table "pinned_messages" {
  schema  = schema.main
  comment = "ピン留めメッセージ"
  column "id" {
    null           = true
    type           = integer
    auto_increment = true
    comment        = "ピン留めID"
  }
  column "message_id" {
    null    = false
    type    = integer
    comment = "ピン留め対象メッセージID"
  }
  column "channel_id" {
    null    = false
    type    = integer
    comment = "チャンネルID"
  }
  column "pinned_by" {
    null    = false
    type    = integer
    comment = "ピン留めしたユーザーID"
  }
  column "pinned_at" {
    null    = false
    type    = text
    default = sql("datetime('now')")
    comment = "ピン留め日時"
  }
  primary_key {
    columns = [column.id]
  }
  index "pinned_messages_unique" {
    unique  = true
    columns = [column.message_id, column.channel_id]
  }
  foreign_key "0" {
    columns     = [column.message_id]
    ref_columns = [table.messages.column.id]
    on_update   = NO_ACTION
    on_delete   = CASCADE
  }
  foreign_key "1" {
    columns     = [column.channel_id]
    ref_columns = [table.channels.column.id]
    on_update   = NO_ACTION
    on_delete   = CASCADE
  }
  foreign_key "2" {
    columns     = [column.pinned_by]
    ref_columns = [table.users.column.id]
    on_update   = NO_ACTION
    on_delete   = CASCADE
  }
}

schema "main" {
}
