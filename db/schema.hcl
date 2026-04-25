// Atlas 宣言モード スキーマ定義（PostgreSQL）
// このファイルがDBの正規スキーマ。変更はこのファイルを編集し atlas schema apply で適用する。

table "users" {
  schema  = schema.public
  comment = "ユーザー"
  column "id" {
    null    = false
    type    = serial
    comment = "ユーザーID"
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
    type    = timestamptz
    default = sql("NOW()")
    comment = "作成日時"
  }
  column "updated_at" {
    null    = false
    type    = timestamptz
    default = sql("NOW()")
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
    type    = boolean
    default = true
    comment = "アカウント有効フラグ"
  }
  column "last_login_at" {
    null    = true
    type    = timestamptz
    comment = "最終ログイン日時"
  }
  column "theme" {
    null    = false
    type    = text
    default = "light"
    comment = "UIテーマ（light / dark）"
  }
  column "onboarding_completed_at" {
    null    = true
    type    = timestamptz
    comment = "オンボーディング完了日時（NULL = 未完了）"
  }
  primary_key {
    columns = [column.id]
  }
  index "idx_users_username" {
    unique  = true
    columns = [column.username]
  }
  index "idx_users_email" {
    unique  = true
    columns = [column.email]
  }
}

table "channels" {
  schema  = schema.public
  comment = "チャンネル"
  column "id" {
    null    = false
    type    = serial
    comment = "チャンネルID"
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
    type    = boolean
    default = false
    comment = "プライベートチャンネルフラグ"
  }
  column "created_at" {
    null    = false
    type    = timestamptz
    default = sql("NOW()")
    comment = "作成日時"
  }
  column "topic" {
    null    = true
    type    = text
    comment = "チャンネルトピック"
  }
  column "is_archived" {
    null    = false
    type    = boolean
    default = false
    comment = "アーカイブ済みフラグ"
  }
  column "is_recommended" {
    null    = false
    type    = boolean
    default = false
    comment = "おすすめチャンネル（初回オンボーディング対象）"
  }
  column "posting_permission" {
    null    = false
    type    = text
    default = "everyone"
    comment = "投稿権限（everyone / admins / readonly）"
  }
  primary_key {
    columns = [column.id]
  }
  foreign_key "fk_channels_created_by" {
    columns     = [column.created_by]
    ref_columns = [table.users.column.id]
    on_update   = NO_ACTION
    on_delete   = SET_NULL
  }
  index "idx_channels_name" {
    unique  = true
    columns = [column.name]
  }
}

table "channel_members" {
  schema  = schema.public
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
    type    = timestamptz
    default = sql("NOW()")
    comment = "参加日時"
  }
  primary_key {
    columns = [column.channel_id, column.user_id]
  }
  foreign_key "fk_channel_members_user" {
    columns     = [column.user_id]
    ref_columns = [table.users.column.id]
    on_update   = NO_ACTION
    on_delete   = CASCADE
  }
  foreign_key "fk_channel_members_channel" {
    columns     = [column.channel_id]
    ref_columns = [table.channels.column.id]
    on_update   = NO_ACTION
    on_delete   = CASCADE
  }
}

table "messages" {
  schema  = schema.public
  comment = "メッセージ"
  column "id" {
    null    = false
    type    = serial
    comment = "メッセージID"
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
    type    = boolean
    default = false
    comment = "編集済みフラグ"
  }
  column "is_deleted" {
    null    = false
    type    = boolean
    default = false
    comment = "削除フラグ"
  }
  column "created_at" {
    null    = false
    type    = timestamptz
    default = sql("NOW()")
    comment = "投稿日時"
  }
  column "updated_at" {
    null    = false
    type    = timestamptz
    default = sql("NOW()")
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
  column "quoted_message_id" {
    null    = true
    type    = integer
    comment = "引用元メッセージID（NULLは引用なし）"
  }
  primary_key {
    columns = [column.id]
  }
  foreign_key "fk_messages_root" {
    columns     = [column.root_message_id]
    ref_columns = [table.messages.column.id]
    on_update   = NO_ACTION
    on_delete   = CASCADE
  }
  foreign_key "fk_messages_parent" {
    columns     = [column.parent_message_id]
    ref_columns = [table.messages.column.id]
    on_update   = NO_ACTION
    on_delete   = CASCADE
  }
  foreign_key "fk_messages_user" {
    columns     = [column.user_id]
    ref_columns = [table.users.column.id]
    on_update   = NO_ACTION
    on_delete   = SET_NULL
  }
  foreign_key "fk_messages_channel" {
    columns     = [column.channel_id]
    ref_columns = [table.channels.column.id]
    on_update   = NO_ACTION
    on_delete   = CASCADE
  }
  index "idx_messages_root_message_id" {
    columns = [column.root_message_id]
  }
}

table "mentions" {
  schema  = schema.public
  comment = "メンション"
  column "id" {
    null    = false
    type    = serial
    comment = "メンションID"
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
  column "created_at" {
    null    = false
    type    = timestamptz
    default = sql("NOW()")
    comment = "メンション日時"
  }
  column "channel_id" {
    null    = false
    type    = integer
    default = 0
    comment = "チャンネルID"
  }
  column "is_read" {
    null    = false
    type    = boolean
    default = false
    comment = "既読フラグ"
  }
  primary_key {
    columns = [column.id]
  }
  foreign_key "fk_mentions_user" {
    columns     = [column.mentioned_user_id]
    ref_columns = [table.users.column.id]
    on_update   = NO_ACTION
    on_delete   = CASCADE
  }
  foreign_key "fk_mentions_message" {
    columns     = [column.message_id]
    ref_columns = [table.messages.column.id]
    on_update   = NO_ACTION
    on_delete   = CASCADE
  }
}

table "message_attachments" {
  schema  = schema.public
  comment = "メッセージ添付ファイル"
  column "id" {
    null    = false
    type    = serial
    comment = "添付ファイルID"
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
    type    = timestamptz
    default = sql("NOW()")
    comment = "作成日時"
  }
  column "scheduled_message_id" {
    null    = true
    type    = integer
    comment = "予約送信メッセージID（NULL = 通常添付 / 投稿後は scheduled_messages.sent_message_id 経由で messages.id と紐付く）"
  }
  primary_key {
    columns = [column.id]
  }
  foreign_key "fk_attachments_message" {
    columns     = [column.message_id]
    ref_columns = [table.messages.column.id]
    on_update   = NO_ACTION
    on_delete   = CASCADE
  }
  foreign_key "fk_attachments_scheduled" {
    columns     = [column.scheduled_message_id]
    ref_columns = [table.scheduled_messages.column.id]
    on_update   = NO_ACTION
    on_delete   = CASCADE
  }
}

table "push_subscriptions" {
  schema  = schema.public
  comment = "プッシュ通知サブスクリプション"
  column "id" {
    null    = false
    type    = serial
    comment = "サブスクリプションID"
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
    type    = timestamptz
    default = sql("NOW()")
    comment = "登録日時"
  }
  primary_key {
    columns = [column.id]
  }
  foreign_key "fk_push_subscriptions_user" {
    columns     = [column.user_id]
    ref_columns = [table.users.column.id]
    on_update   = NO_ACTION
    on_delete   = CASCADE
  }
  index "idx_push_subscriptions_endpoint" {
    unique  = true
    columns = [column.endpoint]
  }
}

table "message_reactions" {
  schema  = schema.public
  comment = "メッセージリアクション"
  column "id" {
    null    = false
    type    = serial
    comment = "リアクションID"
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
    type    = timestamptz
    default = sql("NOW()")
    comment = "作成日時"
  }
  primary_key {
    columns = [column.id]
  }
  foreign_key "fk_reactions_user" {
    columns     = [column.user_id]
    ref_columns = [table.users.column.id]
    on_update   = NO_ACTION
    on_delete   = CASCADE
  }
  foreign_key "fk_reactions_message" {
    columns     = [column.message_id]
    ref_columns = [table.messages.column.id]
    on_update   = NO_ACTION
    on_delete   = CASCADE
  }
  index "idx_reactions_unique" {
    unique  = true
    columns = [column.message_id, column.user_id, column.emoji]
  }
}

table "channel_read_status" {
  schema  = schema.public
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
    type    = timestamptz
    default = sql("NOW()")
    comment = "更新日時"
  }
  primary_key {
    columns = [column.user_id, column.channel_id]
  }
  foreign_key "fk_read_status_channel" {
    columns     = [column.channel_id]
    ref_columns = [table.channels.column.id]
    on_update   = NO_ACTION
    on_delete   = CASCADE
  }
  foreign_key "fk_read_status_user" {
    columns     = [column.user_id]
    ref_columns = [table.users.column.id]
    on_update   = NO_ACTION
    on_delete   = CASCADE
  }
}

table "pinned_messages" {
  schema  = schema.public
  comment = "ピン留めメッセージ"
  column "id" {
    null    = false
    type    = serial
    comment = "ピン留めID"
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
    type    = timestamptz
    default = sql("NOW()")
    comment = "ピン留め日時"
  }
  primary_key {
    columns = [column.id]
  }
  foreign_key "fk_pinned_messages_user" {
    columns     = [column.pinned_by]
    ref_columns = [table.users.column.id]
    on_update   = NO_ACTION
    on_delete   = CASCADE
  }
  foreign_key "fk_pinned_messages_channel" {
    columns     = [column.channel_id]
    ref_columns = [table.channels.column.id]
    on_update   = NO_ACTION
    on_delete   = CASCADE
  }
  foreign_key "fk_pinned_messages_message" {
    columns     = [column.message_id]
    ref_columns = [table.messages.column.id]
    on_update   = NO_ACTION
    on_delete   = CASCADE
  }
  index "idx_pinned_messages_message_channel" {
    unique  = true
    columns = [column.message_id, column.channel_id]
  }
}

table "bookmarks" {
  schema  = schema.public
  comment = "メッセージブックマーク"
  column "id" {
    null    = false
    type    = serial
    comment = "ブックマークID"
  }
  column "user_id" {
    null    = false
    type    = integer
    comment = "ブックマークしたユーザーID"
  }
  column "message_id" {
    null    = false
    type    = integer
    comment = "ブックマーク対象メッセージID"
  }
  column "bookmarked_at" {
    null    = false
    type    = timestamptz
    default = sql("NOW()")
    comment = "ブックマーク日時"
  }
  primary_key {
    columns = [column.id]
  }
  foreign_key "fk_bookmarks_message" {
    columns     = [column.message_id]
    ref_columns = [table.messages.column.id]
    on_update   = NO_ACTION
    on_delete   = CASCADE
  }
  foreign_key "fk_bookmarks_user" {
    columns     = [column.user_id]
    ref_columns = [table.users.column.id]
    on_update   = NO_ACTION
    on_delete   = CASCADE
  }
  index "idx_bookmarks_user_message" {
    unique  = true
    columns = [column.user_id, column.message_id]
  }
}

table "dm_conversations" {
  schema  = schema.public
  comment = "DM会話"
  column "id" {
    null    = false
    type    = serial
    comment = "会話ID"
  }
  column "user_a_id" {
    null    = false
    type    = integer
    comment = "参加ユーザーA ID（小さい方）"
  }
  column "user_b_id" {
    null    = false
    type    = integer
    comment = "参加ユーザーB ID（大きい方）"
  }
  column "created_at" {
    null    = false
    type    = timestamptz
    default = sql("NOW()")
    comment = "作成日時"
  }
  column "updated_at" {
    null    = false
    type    = timestamptz
    default = sql("NOW()")
    comment = "最終更新日時"
  }
  primary_key {
    columns = [column.id]
  }
  foreign_key "fk_dm_conversations_user_b" {
    columns     = [column.user_b_id]
    ref_columns = [table.users.column.id]
    on_update   = NO_ACTION
    on_delete   = CASCADE
  }
  foreign_key "fk_dm_conversations_user_a" {
    columns     = [column.user_a_id]
    ref_columns = [table.users.column.id]
    on_update   = NO_ACTION
    on_delete   = CASCADE
  }
  index "idx_dm_conversations_user_pair" {
    unique  = true
    columns = [column.user_a_id, column.user_b_id]
  }
}

table "dm_messages" {
  schema  = schema.public
  comment = "DMメッセージ"
  column "id" {
    null    = false
    type    = serial
    comment = "メッセージID"
  }
  column "conversation_id" {
    null    = false
    type    = integer
    comment = "会話ID"
  }
  column "sender_id" {
    null    = false
    type    = integer
    comment = "送信者ユーザーID"
  }
  column "content" {
    null    = false
    type    = text
    comment = "メッセージ本文"
  }
  column "is_read" {
    null    = false
    type    = boolean
    default = false
    comment = "既読フラグ"
  }
  column "created_at" {
    null    = false
    type    = timestamptz
    default = sql("NOW()")
    comment = "送信日時"
  }
  primary_key {
    columns = [column.id]
  }
  foreign_key "fk_dm_messages_sender" {
    columns     = [column.sender_id]
    ref_columns = [table.users.column.id]
    on_update   = NO_ACTION
    on_delete   = CASCADE
  }
  foreign_key "fk_dm_messages_conversation" {
    columns     = [column.conversation_id]
    ref_columns = [table.dm_conversations.column.id]
    on_update   = NO_ACTION
    on_delete   = CASCADE
  }
  index "idx_dm_messages_conversation_id" {
    columns = [column.conversation_id]
  }
}

table "pinned_channels" {
  schema  = schema.public
  comment = "ピン留めチャンネル"
  column "id" {
    null    = false
    type    = serial
    comment = "ピン留めID"
  }
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
  column "created_at" {
    null    = false
    type    = timestamptz
    default = sql("NOW()")
    comment = "ピン留め日時"
  }
  primary_key {
    columns = [column.id]
  }
  foreign_key "fk_pinned_channels_channel" {
    columns     = [column.channel_id]
    ref_columns = [table.channels.column.id]
    on_update   = NO_ACTION
    on_delete   = CASCADE
  }
  foreign_key "fk_pinned_channels_user" {
    columns     = [column.user_id]
    ref_columns = [table.users.column.id]
    on_update   = NO_ACTION
    on_delete   = CASCADE
  }
  index "idx_pinned_channels_user_channel" {
    unique  = true
    columns = [column.user_id, column.channel_id]
  }
}

table "reminders" {
  schema  = schema.public
  comment = "リマインダー"
  column "id" {
    null    = false
    type    = serial
    comment = "リマインダーID"
  }
  column "user_id" {
    null    = false
    type    = integer
    comment = "ユーザーID"
  }
  column "message_id" {
    null    = false
    type    = integer
    comment = "リマインド対象メッセージID"
  }
  column "remind_at" {
    null    = false
    type    = timestamptz
    comment = "リマインド日時"
  }
  column "is_sent" {
    null    = false
    type    = boolean
    default = false
    comment = "送信済みフラグ"
  }
  column "created_at" {
    null    = false
    type    = timestamptz
    default = sql("NOW()")
    comment = "作成日時"
  }
  primary_key {
    columns = [column.id]
  }
  foreign_key "fk_reminders_message" {
    columns     = [column.message_id]
    ref_columns = [table.messages.column.id]
    on_update   = NO_ACTION
    on_delete   = CASCADE
  }
  foreign_key "fk_reminders_user" {
    columns     = [column.user_id]
    ref_columns = [table.users.column.id]
    on_update   = NO_ACTION
    on_delete   = CASCADE
  }
}

table "channel_categories" {
  schema  = schema.public
  comment = "チャンネルカテゴリ（ユーザー個人のサイドバー構成）"
  column "id" {
    null    = false
    type    = serial
    comment = "カテゴリID"
  }
  column "user_id" {
    null    = false
    type    = integer
    comment = "オーナーユーザーID"
  }
  column "name" {
    null    = false
    type    = text
    comment = "カテゴリ名"
  }
  column "position" {
    null    = false
    type    = integer
    default = 0
    comment = "並び順"
  }
  column "is_collapsed" {
    null    = false
    type    = boolean
    default = false
    comment = "折りたたみ状態"
  }
  column "created_at" {
    null    = false
    type    = timestamptz
    default = sql("NOW()")
    comment = "作成日時"
  }
  column "updated_at" {
    null    = false
    type    = timestamptz
    default = sql("NOW()")
    comment = "更新日時"
  }
  primary_key {
    columns = [column.id]
  }
  foreign_key "fk_channel_categories_user" {
    columns     = [column.user_id]
    ref_columns = [table.users.column.id]
    on_update   = NO_ACTION
    on_delete   = CASCADE
  }
  index "idx_channel_categories_user_position" {
    columns = [column.user_id, column.position]
  }
  index "idx_channel_categories_user_name" {
    unique  = true
    columns = [column.user_id, column.name]
  }
}

table "channel_category_assignments" {
  schema  = schema.public
  comment = "チャンネルカテゴリ割当（ユーザーごとの割当）"
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
  column "category_id" {
    null    = false
    type    = integer
    comment = "カテゴリID"
  }
  primary_key {
    columns = [column.user_id, column.channel_id]
  }
  foreign_key "fk_cca_user" {
    columns     = [column.user_id]
    ref_columns = [table.users.column.id]
    on_update   = NO_ACTION
    on_delete   = CASCADE
  }
  foreign_key "fk_cca_channel" {
    columns     = [column.channel_id]
    ref_columns = [table.channels.column.id]
    on_update   = NO_ACTION
    on_delete   = CASCADE
  }
  foreign_key "fk_cca_category" {
    columns     = [column.category_id]
    ref_columns = [table.channel_categories.column.id]
    on_update   = NO_ACTION
    on_delete   = CASCADE
  }
  index "idx_cca_user_channel" {
    unique  = true
    columns = [column.user_id, column.channel_id]
  }
}

table "audit_logs" {
  schema  = schema.public
  comment = "監査ログ"
  column "id" {
    null    = false
    type    = serial
    comment = "監査ログID"
  }
  column "actor_user_id" {
    null    = true
    type    = integer
    comment = "操作を実行したユーザーID（ユーザー削除時は NULL になる）"
  }
  column "action_type" {
    null    = false
    type    = text
    comment = "アクション種別（例: channel.create, auth.login 等）"
  }
  column "target_type" {
    null    = true
    type    = text
    comment = "対象エンティティ種別（channel / message / user）"
  }
  column "target_id" {
    null    = true
    type    = integer
    comment = "対象エンティティID（多態的参照のため FK は貼らない）"
  }
  column "metadata" {
    null    = true
    type    = jsonb
    comment = "補助情報（旧値・新値などのコンテキスト）"
  }
  column "created_at" {
    null    = false
    type    = timestamptz
    default = sql("NOW()")
    comment = "記録日時"
  }
  primary_key {
    columns = [column.id]
  }
  foreign_key "fk_audit_logs_actor" {
    columns     = [column.actor_user_id]
    ref_columns = [table.users.column.id]
    on_update   = NO_ACTION
    on_delete   = SET_NULL
  }
  index "idx_audit_logs_created_at" {
    columns = [column.created_at]
  }
  index "idx_audit_logs_action_type" {
    columns = [column.action_type]
  }
  index "idx_audit_logs_actor" {
    columns = [column.actor_user_id]
  }
}

table "message_templates" {
  schema  = schema.public
  comment = "メッセージテンプレート（ユーザー単位）"
  column "id" {
    null = false
    type = serial
  }
  column "user_id" {
    null = false
    type = integer
  }
  column "title" {
    null = false
    type = text
  }
  column "body" {
    null = false
    type = text
  }
  column "position" {
    null    = false
    type    = integer
    default = 0
  }
  column "created_at" {
    null    = false
    type    = timestamptz
    default = sql("NOW()")
  }
  column "updated_at" {
    null    = false
    type    = timestamptz
    default = sql("NOW()")
  }
  primary_key {
    columns = [column.id]
  }
  foreign_key "fk_message_templates_user" {
    columns     = [column.user_id]
    ref_columns = [table.users.column.id]
    on_update   = NO_ACTION
    on_delete   = CASCADE
  }
  index "idx_message_templates_user_position" {
    columns = [column.user_id, column.position]
  }
}

table "channel_notification_settings" {
  schema  = schema.public
  comment = "チャンネル通知設定（ユーザー × チャンネル / #109）"
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
  column "level" {
    null    = false
    type    = text
    default = "all"
    comment = "通知レベル（all / mentions / muted）"
  }
  column "updated_at" {
    null    = false
    type    = timestamptz
    default = sql("NOW()")
    comment = "更新日時"
  }
  primary_key {
    columns = [column.user_id, column.channel_id]
  }
  foreign_key "fk_cns_user" {
    columns     = [column.user_id]
    ref_columns = [table.users.column.id]
    on_update   = NO_ACTION
    on_delete   = CASCADE
  }
  foreign_key "fk_cns_channel" {
    columns     = [column.channel_id]
    ref_columns = [table.channels.column.id]
    on_update   = NO_ACTION
    on_delete   = CASCADE
  }
}

table "scheduled_messages" {
  schema  = schema.public
  comment = "予約送信メッセージ（#110）"
  column "id" {
    null    = false
    type    = serial
    comment = "予約ID"
  }
  column "user_id" {
    null    = false
    type    = integer
    comment = "予約したユーザーID"
  }
  column "channel_id" {
    null    = false
    type    = integer
    comment = "送信先チャンネルID"
  }
  column "content" {
    null    = false
    type    = text
    comment = "メッセージ本文"
  }
  column "scheduled_at" {
    null    = false
    type    = timestamptz
    comment = "送信予定日時（UTC）"
  }
  column "status" {
    null    = false
    type    = text
    default = "pending"
    comment = "ステータス（pending / sending / sent / failed / canceled）"
  }
  column "error" {
    null    = true
    type    = text
    comment = "失敗時のエラー理由"
  }
  column "sent_message_id" {
    null    = true
    type    = integer
    comment = "送信成功時に生成された messages.id"
  }
  column "created_at" {
    null    = false
    type    = timestamptz
    default = sql("NOW()")
    comment = "作成日時"
  }
  column "updated_at" {
    null    = false
    type    = timestamptz
    default = sql("NOW()")
    comment = "更新日時"
  }
  primary_key {
    columns = [column.id]
  }
  foreign_key "fk_sched_user" {
    columns     = [column.user_id]
    ref_columns = [table.users.column.id]
    on_update   = NO_ACTION
    on_delete   = CASCADE
  }
  foreign_key "fk_sched_channel" {
    columns     = [column.channel_id]
    ref_columns = [table.channels.column.id]
    on_update   = NO_ACTION
    on_delete   = CASCADE
  }
  foreign_key "fk_sched_sent" {
    columns     = [column.sent_message_id]
    ref_columns = [table.messages.column.id]
    on_update   = NO_ACTION
    on_delete   = SET_NULL
  }
  index "idx_sched_pending" {
    columns = [column.status, column.scheduled_at]
  }
}

table "invite_links" {
  schema  = schema.public
  comment = "招待リンク（#112）"
  column "id" {
    null    = false
    type    = serial
    comment = "招待ID"
  }
  column "token" {
    null    = false
    type    = text
    comment = "URL セーフ乱数トークン（base64url, 32 文字以上）"
  }
  column "channel_id" {
    null    = true
    type    = integer
    comment = "対象チャンネルID（NULL = ワークスペース全体招待）"
  }
  column "created_by" {
    null    = true
    type    = integer
    comment = "発行者ユーザーID（ユーザー削除時に NULL）"
  }
  column "max_uses" {
    null    = true
    type    = integer
    comment = "最大使用回数（NULL = 無制限）"
  }
  column "used_count" {
    null    = false
    type    = integer
    default = 0
    comment = "現在の使用回数"
  }
  column "expires_at" {
    null    = true
    type    = timestamptz
    comment = "有効期限（NULL = 無期限）"
  }
  column "is_revoked" {
    null    = false
    type    = boolean
    default = false
    comment = "無効化フラグ"
  }
  column "created_at" {
    null    = false
    type    = timestamptz
    default = sql("NOW()")
    comment = "作成日時"
  }
  primary_key {
    columns = [column.id]
  }
  foreign_key "fk_invite_channel" {
    columns     = [column.channel_id]
    ref_columns = [table.channels.column.id]
    on_update   = NO_ACTION
    on_delete   = CASCADE
  }
  foreign_key "fk_invite_creator" {
    columns     = [column.created_by]
    ref_columns = [table.users.column.id]
    on_update   = NO_ACTION
    on_delete   = SET_NULL
  }
  index "idx_invite_token" {
    unique  = true
    columns = [column.token]
  }
}

table "invite_link_uses" {
  schema  = schema.public
  comment = "招待リンク使用履歴（#112）"
  column "id" {
    null    = false
    type    = serial
    comment = "履歴ID"
  }
  column "invite_id" {
    null    = false
    type    = integer
    comment = "招待ID"
  }
  column "user_id" {
    null    = true
    type    = integer
    comment = "使用したユーザーID（ユーザー削除時に NULL）"
  }
  column "used_at" {
    null    = false
    type    = timestamptz
    default = sql("NOW()")
    comment = "使用日時"
  }
  primary_key {
    columns = [column.id]
  }
  foreign_key "fk_invite_use_invite" {
    columns     = [column.invite_id]
    ref_columns = [table.invite_links.column.id]
    on_update   = NO_ACTION
    on_delete   = CASCADE
  }
  foreign_key "fk_invite_use_user" {
    columns     = [column.user_id]
    ref_columns = [table.users.column.id]
    on_update   = NO_ACTION
    on_delete   = SET_NULL
  }
  index "idx_invite_use_invite" {
    columns = [column.invite_id]
  }
}

table "tags" {
  schema  = schema.public
  comment = "タグ（ワークスペース共有 / #115）"
  column "id" {
    null    = false
    type    = serial
    comment = "タグID"
  }
  column "name" {
    null    = false
    type    = text
    comment = "タグ名（小文字正規化）"
  }
  column "created_by" {
    null    = true
    type    = integer
    comment = "作成者ユーザーID"
  }
  column "use_count" {
    null    = false
    type    = integer
    default = 0
    comment = "使用回数"
  }
  column "created_at" {
    null    = false
    type    = timestamptz
    default = sql("NOW()")
    comment = "作成日時"
  }
  primary_key {
    columns = [column.id]
  }
  foreign_key "fk_tags_user" {
    columns     = [column.created_by]
    ref_columns = [table.users.column.id]
    on_update   = NO_ACTION
    on_delete   = SET_NULL
  }
  index "idx_tags_name" {
    unique  = true
    columns = [column.name]
  }
  index "idx_tags_use_count" {
    columns = [column.use_count]
  }
}

table "message_tags" {
  schema  = schema.public
  comment = "メッセージとタグの紐付け（#115）"
  column "message_id" {
    null    = false
    type    = integer
    comment = "メッセージID"
  }
  column "tag_id" {
    null    = false
    type    = integer
    comment = "タグID"
  }
  column "created_at" {
    null    = false
    type    = timestamptz
    default = sql("NOW()")
    comment = "付与日時"
  }
  column "created_by" {
    null    = true
    type    = integer
    comment = "付与者ユーザーID"
  }
  primary_key {
    columns = [column.message_id, column.tag_id]
  }
  foreign_key "fk_mt_message" {
    columns     = [column.message_id]
    ref_columns = [table.messages.column.id]
    on_update   = NO_ACTION
    on_delete   = CASCADE
  }
  foreign_key "fk_mt_tag" {
    columns     = [column.tag_id]
    ref_columns = [table.tags.column.id]
    on_update   = NO_ACTION
    on_delete   = CASCADE
  }
  foreign_key "fk_mt_user" {
    columns     = [column.created_by]
    ref_columns = [table.users.column.id]
    on_update   = NO_ACTION
    on_delete   = SET_NULL
  }
}

table "channel_tags" {
  schema  = schema.public
  comment = "チャンネルとタグの紐付け（#115）"
  column "channel_id" {
    null    = false
    type    = integer
    comment = "チャンネルID"
  }
  column "tag_id" {
    null    = false
    type    = integer
    comment = "タグID"
  }
  column "created_at" {
    null    = false
    type    = timestamptz
    default = sql("NOW()")
    comment = "付与日時"
  }
  primary_key {
    columns = [column.channel_id, column.tag_id]
  }
  foreign_key "fk_ct_channel" {
    columns     = [column.channel_id]
    ref_columns = [table.channels.column.id]
    on_update   = NO_ACTION
    on_delete   = CASCADE
  }
  foreign_key "fk_ct_tag" {
    columns     = [column.tag_id]
    ref_columns = [table.tags.column.id]
    on_update   = NO_ACTION
    on_delete   = CASCADE
  }
}

# #117 NGワード / 添付制限 — モデレーション用テーブル
table "ng_words" {
  schema  = schema.public
  comment = "NGワード"
  column "id" {
    null = false
    type = serial
  }
  column "pattern" {
    null    = false
    type    = text
    comment = "判定対象の文字列（lowercase + NFKC 正規化済みで保存することを想定）"
  }
  column "is_regex" {
    null    = false
    type    = boolean
    default = false
    comment = "正規表現として扱うか（MVPは未使用、将来拡張用）"
  }
  column "action" {
    null    = false
    type    = text
    default = "block"
    comment = "検出時の挙動（block / warn）"
  }
  column "is_active" {
    null    = false
    type    = boolean
    default = true
  }
  column "created_by" {
    null = true
    type = integer
  }
  column "created_at" {
    null    = false
    type    = timestamptz
    default = sql("NOW()")
  }
  column "updated_at" {
    null    = false
    type    = timestamptz
    default = sql("NOW()")
  }
  primary_key {
    columns = [column.id]
  }
  foreign_key "fk_ng_user" {
    columns     = [column.created_by]
    ref_columns = [table.users.column.id]
    on_update   = NO_ACTION
    on_delete   = SET_NULL
  }
  index "idx_ng_active" {
    columns = [column.is_active]
  }
}

table "attachment_blocklist" {
  schema  = schema.public
  comment = "添付ファイル拡張子ブロックリスト"
  column "id" {
    null = false
    type = serial
  }
  column "extension" {
    null    = false
    type    = text
    comment = "ドット無し小文字の拡張子（例: exe, bat, cmd）"
  }
  column "reason" {
    null = true
    type = text
  }
  column "created_by" {
    null = true
    type = integer
  }
  column "created_at" {
    null    = false
    type    = timestamptz
    default = sql("NOW()")
  }
  primary_key {
    columns = [column.id]
  }
  foreign_key "fk_ablk_user" {
    columns     = [column.created_by]
    ref_columns = [table.users.column.id]
    on_update   = NO_ACTION
    on_delete   = SET_NULL
  }
  index "idx_ablk_ext" {
    unique  = true
    columns = [column.extension]
  }
}

schema "public" {
}
