# Issue #148 — feat: 下書き保存

> Phase 1 / 並列OK / 難易度: 中

## 概要

チャンネル / DM ごとに編集中の本文・添付状態を自動保存し、画面遷移しても復元する。下書きが存在するチャンネルはサイドバーで識別可能にする。

## 仕様確認事項

- **保存スコープ**: ユーザー × チャンネル / ユーザー × DM 会話 単位の (1, 1) 関係でよいか（同一チャンネルに複数下書きを持たない）。MVP は単一下書きで十分と想定。
- **永続化先**: サーバ DB に保存して複数デバイス間共有するか、それともクライアントの `localStorage` のみか。**サーバ DB 推奨**（issue 文の「画面遷移しても復元」「サイドバーで識別」がデバイス横断で機能する）。
- **添付の扱い**: 添付ファイルは既に `message_attachments` に `message_id IS NULL` の一時状態で存在しているため、下書きと紐付けるには「下書きと一時添付の関連」が必要。`message_attachments.draft_id` 列を足すか、別テーブルで関連管理するか確認。
- **保存タイミング**: デバウンス（1 秒程度）でサーバへ保存。Quill エディタの onChange に乗せる想定。
- **スレッド返信や引用送信中の本文**: 本人が後で開いた時に復元するか。MVP では「チャンネル本体の本文のみ」に限定するのが安全。

## 影響範囲

### DB

- `db/schema.hcl` に新規テーブル `drafts` 追加
  - `id serial pk`
  - `user_id integer not null fk users`
  - `channel_id integer null fk channels`
  - `dm_conversation_id integer null fk dm_conversations`
  - `content text not null`
  - `quoted_message_id integer null fk messages`
  - `parent_message_id integer null fk messages`（スレッド対応する場合）
  - `updated_at timestamptz`
  - 一意制約: `(user_id, channel_id)` と `(user_id, dm_conversation_id)` のいずれかが埋まる
- 必要なら `message_attachments` に `draft_id integer null` 列を追加して下書きへの紐付けを表現

### Server

- `packages/server/src/services/draftService.ts`（**新規**）
- `packages/server/src/routes/drafts.ts`（**新規**）
  - `GET /drafts` — 自分の全下書き
  - `PUT /drafts/channels/:channelId` — 上書き保存
  - `PUT /drafts/dm/:conversationId` — 上書き保存
  - `DELETE /drafts/...` — 送信完了時のクリア
- メッセージ送信成功時に対応する下書きを削除する処理を `messageService` / `dmService` に追記

### Client

- `packages/client/src/api/client.ts` に下書き API 追加
- `packages/client/src/components/Chat/RichEditor.tsx` または `MessageList` 直下の入力エリア — onChange でデバウンス保存
- `packages/client/src/components/Channel/ChannelItem.tsx` — 下書き存在時に視覚的識別（アイコン or サイドハンドル）
- DM 一覧でも同様
- 初期表示時に `GET /drafts` を取得してチャンネル切替で復元

## 並列実行時の競合警戒

- Phase 1 の #146 / #154 とは触るファイルが分離されている。
- `RichEditor.tsx` を書き換えるため、後続フェーズで本文入力に介入する Issue（#153 のレート制限警告表示など）と衝突する可能性あり。Phase 1 で main に取り込んでおけば #153 は警告表示のみの差分で済む。

## 実装ポイント / 落とし穴

- **送信成功時の下書き削除**: 送信レスポンスでクリア済みフラグを返すか、クライアントが手動で `DELETE` を叩くか。前者推奨。
- **デバウンス**: 1 秒未満は通信が増える。1〜2 秒が妥当。
- **本文が空文字列の場合**: 下書きを残さず削除する。
- **複数タブ間の同期**: タブ A で編集中にタブ B を開くと不整合になりうる。MVP は「最終保存勝ち」で割り切る。
- **添付のオーファン処理**: 下書き削除時に紐付く一時添付も削除する。
- **`message_attachments.scheduled_message_id` との競合**: 一時添付が「予約送信用」「下書き用」両方の経路を持つので、列分けまたはステートで明確に区別する。

## テスト観点

- ユニット
  - 下書き作成・上書き・取得・削除
  - チャンネルとDMで別エントリが管理される
  - 同一ユーザー × 同一チャンネルは 1 件に集約される
- 統合
  - 下書き保存後にメッセージ送信すると下書きが消える
- フロントエンド
  - 入力中の本文がチャンネル切替後に復元される
  - 下書きのあるチャンネルが `ChannelItem` で識別される

## ステータス（経過記録）

- 計画作成日: 2026-04-27
- ブランチ: -
- PR: -
- マージ: -
- 備考: -
