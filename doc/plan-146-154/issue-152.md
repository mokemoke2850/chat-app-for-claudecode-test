# Issue #152 — feat: カレンダー / 予定調整

> Phase 3 / 並列OK / 難易度: 中

## 概要

イベント管理と候補日調整をワークスペース内で完結させる。

- カレンダー画面でイベントの作成・編集・削除
- 候補日を複数提示して参加者の都合を集計
- イベント開始前にチャンネルへリマインダー通知

## 仕様確認事項（**最重要**）

- **既存 `events` テーブルとの関係**: 既存の `events` / `event_rsvps` は #108 由来の「会話イベント投稿」（メッセージに紐づくイベント）。本 Issue の「カレンダー画面で管理」とはメンタルモデルが異なる。
  - **推奨**: 別テーブル `calendar_events` / `calendar_event_proposals` / `calendar_event_votes` を新設。既存 `events` には触らない。
  - 既存の `CreateEventDialog.tsx` / `EventCard.tsx` は #108 用として現状維持。本 Issue ではカレンダー専用のコンポーネントを新規追加。
- **リマインダー通知の方式**: 既存 `reminders` テーブルは「メッセージ単位のリマインダー」用。カレンダー用は別ジョブ + 別テーブル管理が無難。
- **タイムゾーン**: 全イベントは UTC で保存。クライアントがローカル TZ で表示。
- **候補日調整 UI**: 「日程調整くん」風の縦軸=候補日 × 横軸=参加者 の集計表で良いか。

## 影響範囲

### DB

- `db/schema.hcl` に新規テーブル追加
  - `calendar_events` — イベント本体（title / description / starts_at / ends_at / created_by / channel_id null）
  - `calendar_event_proposals` — 候補日（event_id / proposed_at）
  - `calendar_event_votes` — 投票（proposal_id / user_id / vote: yes/no/maybe）
  - `calendar_event_reminders` — リマインダー設定（event_id / remind_offset_minutes / sent_at）

### Server

- `packages/server/src/services/calendarService.ts`（**新規**）
- `packages/server/src/routes/calendar.ts`（**新規**）
- `packages/server/src/jobs/calendarReminderWorker.ts`（**新規**） — 既存 `scheduledMessageWorker` と同じパターンで実装

### Client

- `packages/client/src/pages/CalendarPage.tsx`（**新規**） — 月表示 / 週表示
- `packages/client/src/components/Calendar/EventDialog.tsx`（**新規**）
- `packages/client/src/components/Calendar/ProposalVotePanel.tsx`（**新規**） — 候補日投票 UI
- `packages/client/src/components/Layout/AppLayout.tsx` — 「カレンダー」ナビ追加
- ルーティング追加 `/calendar`

## 並列実行時の競合警戒

- 既存 `events` / `eventService` / `CreateEventDialog` には**手を入れない**運用が他機能と衝突しない最良の方針。
- `AppLayout.tsx` ナビ追加 / `package.json` 依存追加（カレンダーライブラリ採用時）は #149 / #153 と物理的に近接するため、ファイル末尾追記＆軽量ライブラリ選定で衝突を最小化。

## 実装ポイント / 落とし穴

- **カレンダーライブラリ選定**: フル機能の FullCalendar は重い。MVP は自前のシンプル月表示で十分かもしれない。要件次第で軽量な `react-day-picker` などを検討。
- **リマインダーの冪等性**: ワーカーが重複起動しても二重通知しないよう、`sent_at` で制御。
- **候補日確定**: 投票で最多得票の候補が選ばれた際、自動確定するか手動か。MVP は手動確定。
- **イベント編集時の通知**: 確定済みイベントの時刻変更時に再通知するか。MVP は通知しないで割り切るのが安全。

## テスト観点

- ユニット
  - イベント・候補日・投票の CRUD
  - リマインダーワーカーが対象時刻の通知のみ送る
- 統合
  - チャンネルにリマインダーが投稿される（別途、チャンネルメッセージとして作成される）
- フロントエンド
  - カレンダー画面でイベントが時刻順に表示される
  - 候補日に投票できる

## ステータス（経過記録）

- 計画作成日: 2026-04-27
- ブランチ: -
- PR: -
- マージ: -
- 備考: -
