# Issue #152 — feat: カレンダー / 予定調整

> Phase 3 / 並列OK / 難易度: 中 → **大（モック準拠で実装範囲拡張）**

最終更新: 2026-04-30（実装計画清書 + モック準拠でテーブル構成変更）

---

## 概要

イベント管理と候補日調整をワークスペース内で完結させる。

- グローバルカレンダー画面で月/週/アジェンダの 3 ビュー切替表示
- イベントの作成・編集・削除と参加可否回答（RSVP: accepted/maybe/declined/pending）
- 候補日を複数提示して参加者の都合を集計（ヒートマップ投票 UI）
- イベント開始前にチャンネルへリマインダー通知

モックは `doc/plan-146-154/Calendar Mock.html` および `doc/calendar-mock/` 配下の jsx 群を参照。

---

## 仕様確定事項（実装着手時点）

| 論点 | 決定 |
|---|---|
| 既存 `events` / `event_rsvps`（#108 由来） | **触らない**。カレンダー機能は完全に別テーブル群で構築 |
| カレンダーライブラリ | **自前のシンプル月/週グリッド**（FullCalendar 等の依存追加なし） |
| RSVP の値 | **accepted / maybe / declined / pending**（モック準拠。既存 `going/not_going/maybe` とは別系統） |
| 候補日確定 | **MVP は手動確定**（自動確定はスコープ外） |
| イベント編集時の再通知 | **MVP は再通知しない**（割り切る） |
| タイムゾーン | **保存は UTC、表示はクライアント TZ**（`new Date(isoString)` でローカル解釈） |
| 候補日 UI | **ヒートマップ**（縦=投票者、横=候補、`◯/△/×/未回答` を色分け、最多得票候補ハイライト + 参加可能率バー） |
| チャンネル別予定タブ | **MVP では `/calendar` に集約**（チャンネル詳細ページへの「予定」タブ追加は本 Issue ではスコープ外、フォローアップ Issue 候補） |
| 「予定」と「日程調整」の関係 | **完全分離**（モック準拠）。日程調整確定操作で `calendar_polls` から `calendar_events` へレコード変換 |
| イベント色 | **チャンネル色から導出**（DB に保存しない） |
| デフォルトビュー | **月**（`Calendar Mock.html` 内 `__TWEAK_DEFAULTS__.defaultView` と一致） |

---

## データモデル

### 新規テーブル（`db/schema.hcl` に追加）

```hcl
# 1. calendar_events — 確定済みイベント本体
table "calendar_events" {
  schema = schema.public
  column "id"            { type = serial,    null = false }
  column "channel_id"    { type = integer,   null = true  }  # null = ワークスペース全体
  column "title"         { type = text,      null = false }
  column "description"   { type = text,      null = true  }
  column "location"      { type = text,      null = true  }
  column "starts_at"     { type = timestamptz, null = false }
  column "ends_at"       { type = timestamptz, null = false }
  column "organizer_id"  { type = integer,   null = false } # users.id (FK)
  column "created_at"    { type = timestamptz, null = false, default = sql("now()") }
  column "updated_at"    { type = timestamptz, null = false, default = sql("now()") }
  primary_key { columns = [column.id] }
  foreign_key "fk_cal_event_channel"   { columns=[column.channel_id]  ref_columns=[table.channels.column.id] on_delete=CASCADE }
  foreign_key "fk_cal_event_organizer" { columns=[column.organizer_id] ref_columns=[table.users.column.id]   on_delete=CASCADE }
  index "idx_cal_events_starts_at" { columns=[column.starts_at] }
  index "idx_cal_events_channel"   { columns=[column.channel_id] }
}

# 2. calendar_event_attendees — RSVP
table "calendar_event_attendees" {
  schema = schema.public
  column "event_id" { type = integer, null = false }
  column "user_id"  { type = integer, null = false }
  column "status"   { type = text,    null = false } # 'accepted'|'maybe'|'declined'|'pending'
  column "responded_at" { type = timestamptz, null = false, default = sql("now()") }
  primary_key { columns=[column.event_id, column.user_id] }
  foreign_key "fk_cal_attendee_event" { columns=[column.event_id] ref_columns=[table.calendar_events.column.id] on_delete=CASCADE }
  foreign_key "fk_cal_attendee_user"  { columns=[column.user_id]  ref_columns=[table.users.column.id]            on_delete=CASCADE }
  check "calendar_event_attendees_status_check" {
    expr = "status IN ('accepted','maybe','declined','pending')"
  }
}

# 3. calendar_event_reminders — リマインダー
table "calendar_event_reminders" {
  schema = schema.public
  column "id"                    { type = serial, null = false }
  column "event_id"              { type = integer, null = false }
  column "remind_offset_minutes" { type = integer, null = false } # 5/15/30/60/1440 等
  column "sent_at"               { type = timestamptz, null = true } # 冪等性: 送信済みなら値あり
  primary_key { columns=[column.id] }
  foreign_key "fk_cal_reminder_event" { columns=[column.event_id] ref_columns=[table.calendar_events.column.id] on_delete=CASCADE }
  index "idx_cal_reminders_pending" {
    columns = [column.event_id, column.sent_at]
  }
}

# 4. calendar_polls — 日程調整
table "calendar_polls" {
  schema = schema.public
  column "id"            { type = serial,      null = false }
  column "channel_id"    { type = integer,     null = false }
  column "title"         { type = text,        null = false }
  column "organizer_id"  { type = integer,     null = false }
  column "deadline"      { type = timestamptz, null = true }
  column "confirmed_event_id" { type = integer, null = true } # 確定後に calendar_events.id を入れる
  column "created_at"    { type = timestamptz, null = false, default = sql("now()") }
  primary_key { columns=[column.id] }
  foreign_key "fk_cal_poll_channel"   { columns=[column.channel_id]  ref_columns=[table.channels.column.id] on_delete=CASCADE }
  foreign_key "fk_cal_poll_organizer" { columns=[column.organizer_id] ref_columns=[table.users.column.id]   on_delete=CASCADE }
  foreign_key "fk_cal_poll_confirmed" { columns=[column.confirmed_event_id] ref_columns=[table.calendar_events.column.id] on_delete=SET_NULL }
}

# 5. calendar_poll_candidates — 候補日時帯
table "calendar_poll_candidates" {
  schema = schema.public
  column "id"        { type = serial,      null = false }
  column "poll_id"   { type = integer,     null = false }
  column "starts_at" { type = timestamptz, null = false }
  column "ends_at"   { type = timestamptz, null = false }
  primary_key { columns=[column.id] }
  foreign_key "fk_cal_cand_poll" { columns=[column.poll_id] ref_columns=[table.calendar_polls.column.id] on_delete=CASCADE }
}

# 6. calendar_poll_votes — 投票
table "calendar_poll_votes" {
  schema = schema.public
  column "candidate_id" { type = integer, null = false }
  column "user_id"      { type = integer, null = false }
  column "vote"         { type = text,    null = false } # 'yes'|'maybe'|'no'
  column "voted_at"     { type = timestamptz, null = false, default = sql("now()") }
  primary_key { columns=[column.candidate_id, column.user_id] }
  foreign_key "fk_cal_vote_candidate" { columns=[column.candidate_id] ref_columns=[table.calendar_poll_candidates.column.id] on_delete=CASCADE }
  foreign_key "fk_cal_vote_user"      { columns=[column.user_id]      ref_columns=[table.users.column.id]                      on_delete=CASCADE }
  check "calendar_poll_votes_vote_check" {
    expr = "vote IN ('yes','maybe','no')"
  }
}
```

> 適用方法: `db/schema.hcl` 編集 → `atlas schema apply --env local --dry-run` で差分確認 → `atlas schema apply --env local`。

---

## API 設計（`/api/calendar`）

### イベント

| Method | Path | 役割 |
|---|---|---|
| GET    | `/api/calendar/events?from=ISO&to=ISO&channelIds=10,11` | 期間内 + チャンネル絞り込みでイベント一覧 |
| POST   | `/api/calendar/events` | 作成（body: title/channelId?/startsAt/endsAt/location?/description?/attendees[]/reminderOffsetMinutes?/notifyChannel?） |
| GET    | `/api/calendar/events/:id` | 取得（attendees / reminder 同梱） |
| PATCH  | `/api/calendar/events/:id` | 編集（title/startsAt/endsAt/location/description） |
| DELETE | `/api/calendar/events/:id` | 削除 |
| POST   | `/api/calendar/events/:id/rsvp` | 自分の RSVP 更新（body: status） |

### 日程調整

| Method | Path | 役割 |
|---|---|---|
| GET    | `/api/calendar/polls?channelId=11` | チャンネルの日程調整一覧（candidates/votes 同梱） |
| POST   | `/api/calendar/polls` | 作成（body: channelId/title/deadline?/candidates[{startsAt,endsAt}]） |
| GET    | `/api/calendar/polls/:id` | 取得 |
| DELETE | `/api/calendar/polls/:id` | 削除 |
| POST   | `/api/calendar/polls/:id/votes` | 自分の投票更新（body: [{candidateId, vote}]） |
| POST   | `/api/calendar/polls/:id/confirm` | 候補を選んでイベント化（body: candidateId） → `calendar_events` 作成 + `confirmed_event_id` 更新 |

### Socket イベント

| イベント名 | 配信先 | 内容 |
|---|---|---|
| `calendar:event_created` | `channel:{channelId}` または全員 | 新規イベント |
| `calendar:event_updated` | 同上 | 編集 |
| `calendar:event_deleted` | 同上 | 削除（id のみ） |
| `calendar:rsvp_updated` | 関係者 | RSVP 更新 |
| `calendar:poll_updated` | `channel:{channelId}` | 投票・候補追加・確定など |

---

## サーバ実装ファイル

| ファイル | 状態 | 役割 |
|---|---|---|
| `packages/server/src/services/calendarService.ts` | 新規 | イベント / 投票の永続化ロジック |
| `packages/server/src/routes/calendar.ts` | 新規 | `/api/calendar` ルーター |
| `packages/server/src/jobs/calendarReminderWorker.ts` | 新規 | 30 秒間隔のリマインダー送信ジョブ |
| `packages/server/src/app.ts` | 編集 | `app.use('/api/calendar', calendarRoutes)` 追加 |
| `packages/server/src/index.ts` | 編集 | `startCalendarReminderWorker()` 起動（NODE_ENV !== 'test'） |

### リマインダーワーカーの設計

- パターンは `packages/server/src/jobs/scheduledMessageWorker.ts` を踏襲
- 30 秒ごとに「`now() >= starts_at - remind_offset_minutes` かつ `sent_at IS NULL`」の reminder を抽出
- `messageService.createMessage` で対象 channel にリマインダーメッセージを投稿（content: 「⏰ {title} が {N} 分後に開始します」）
- 完了したら `sent_at = now()` に更新（**冪等性確保**）
- `channel_id` が null のイベントはチャンネル投稿をスキップ（リマインダー機能の対象外、もしくは organizer DM 等で代替）

---

## クライアント実装ファイル

| ファイル | 状態 | 役割 |
|---|---|---|
| `packages/shared/src/types/calendar.ts` | 新規 | 型定義 |
| `packages/shared/src/index.ts` | 編集 | `export * from './types/calendar'` |
| `packages/client/src/api/client.ts` | 編集 | `calendar` 名前空間追加（events / polls の CRUD） |
| `packages/client/src/pages/CalendarPage.tsx` | 新規 | グローバル `/calendar` 画面のオーケストレーター |
| `packages/client/src/components/Calendar/CalendarHeader.tsx` | 新規 | 「今日」ボタン + ナビ + ビュー切替 |
| `packages/client/src/components/Calendar/ChannelFilterPanel.tsx` | 新規 | 左 220px サイドバー（チャンネル絞り込み + 今日の予定） |
| `packages/client/src/components/Calendar/MonthView.tsx` | 新規 | 月表示（7×6 グリッド） |
| `packages/client/src/components/Calendar/WeekView.tsx` | 新規 | 週表示（時刻 × 7 日） |
| `packages/client/src/components/Calendar/AgendaView.tsx` | 新規 | アジェンダ表示（日付別グルーピング） |
| `packages/client/src/components/Calendar/EventDetailDrawer.tsx` | 新規 | 右ドロワーのイベント詳細 + RSVP |
| `packages/client/src/components/Calendar/EventDialog.tsx` | 新規 | 作成・編集ダイアログ（予定 / 日程調整タブ） |
| `packages/client/src/components/Calendar/PollHeatmap.tsx` | 新規 | 日程調整のヒートマップ表示 + 投票 |
| `packages/client/src/components/Layout/AppLayout.tsx` | 編集 | サイドバーに「カレンダー」ナビ追加 |
| `packages/client/src/App.tsx` | 編集 | `<Route path="/calendar">` を `/*` より前に追加 |

### React 19 use() + Suspense パターン

`CalendarPage.tsx` は `App.tsx` の既存 `ChatWithUsers` パターン踏襲:

```tsx
function CalendarPage() {
  const [eventsPromise] = useState(() => fetchCalendarEvents(/* range */));
  return (
    <Suspense fallback={<CircularProgress />}>
      <CalendarPageContent eventsPromise={eventsPromise} />
    </Suspense>
  );
}
function CalendarPageContent({ eventsPromise }) {
  const { events } = use(eventsPromise);
  // ...
}
```

期間（cursor）変更時は **モジュールレベルキャッシュをキー（`${year}-${month}`）で持つ**ことで concurrent mode 対応する（`getOrCreateUsersPromise` パターン）。

---

## 実装フェーズと進捗管理

長丁場で watchdog 強制終了等の中断にも耐えるよう、**各サブステップ完了ごとに commit + push** する。

### Phase A: DB + 型 + サーバ基本 CRUD（イベント本体）

- [x] A1. `db/schema.hcl` に 6 テーブル追加 → `atlas schema apply --env local` 適用済 (commit `062f1ad`)
- [x] A2. `packages/shared/src/types/calendar.ts` + `index.ts` re-export (commit `4325fdf`)
- [x] A3. `packages/server/src/services/calendarService.ts` のイベント CRUD 実装 + `__tests__/calendar.test.ts` Phase A 範囲 25 件 pass (commit `422e2fe`)
- [x] A4. `packages/server/src/routes/calendar.ts` 新規 + `app.ts` mount (commit `95d1c57`)
- [x] A5. `__tests__/calendar-route.test.ts` Phase A 範囲 20 件 pass (commit `95d1c57`)

### Phase B: RSVP + リマインダー API

- [x] B1. `calendarService.setRsvp` (UPSERT) + `POST /events/:id/rsvp` ルート (commit `3f5e874`)
- [x] B2. リマインダー登録は Phase A の createEvent で実装済（`reminderOffsetMinutes` を渡すと `calendar_event_reminders` 行を同時 INSERT）
- [x] B3. service 5 件 + route 4 件 = 9 件 pass
- [x] B4. (commit `3f5e874`)

### Phase C: 日程調整 API

- [x] C1. `calendarService` に poll 関数追加（createPoll / getPollWithVotes / listPollsByChannel / castVote / confirmPoll / deletePoll） (commit `3987115`)
- [x] C2. `/api/calendar/polls` 系 6 エンドポイント追加 (commit `3987115`)
- [x] C3. `confirmPoll` トランザクションで event INSERT + confirmed_event_id 更新 (commit `3987115`)
- [x] C4. service 26 件 + route 22 件 = 48 件 pass
- [x] C5. (commit `3987115`)

### Phase D: リマインダーワーカー

- [x] D1. `jobs/calendarReminderWorker.ts` 実装（30 秒間隔、JS 側で due 判定、sent_at で冪等）
- [x] D2. `index.ts` で `NODE_ENV !== 'test'` ガード付きで起動
- [x] D3. unit test 13 件 pass（pickDueReminders / runOnce / ライフサイクル）
- [x] D4. **コミット: reminder worker**

### Phase E: クライアント — 画面骨格 + 月表示

- [x] E1. `api/client.ts` に `calendar.events / calendar.polls` 名前空間 (commit `492e29e`)
- [x] E2. `pages/CalendarPage.tsx` + Suspense / use() / モジュールレベル Promise キャッシュ (commit `492e29e`)
- [x] E3. `App.tsx` に `/calendar` ルート追加 (commit `492e29e`)
- [x] E4. `AppLayout.tsx` のサイドバーに「カレンダー」リンク追加 (commit `492e29e`)
- [x] E5. `components/Calendar/CalendarHeader.tsx`
- [x] E6. `components/Calendar/ChannelFilterPanel.tsx`
- [x] E7. `components/Calendar/MonthView.tsx`
- [x] E8. テストロジック実装：MonthView 10/10 + CalendarPage 10/10 pass（Phase G/H 範囲は todo）
- [ ] E9. Playwright で画面が出ることを実機確認 ← Phase G 終了時にまとめて行う方針

### Phase F: 週表示 + アジェンダ表示

- [x] F1. `components/Calendar/WeekView.tsx`（時刻 × 7 日、now-line、絶対配置イベントブロック）
- [x] F2. `components/Calendar/AgendaView.tsx`（日付別グルーピング、参加者アバター + 自分の RSVP チップ）
- [x] F3. CalendarPage の placeholder を WeekView/AgendaView 本実装に差し替え + usersPromise 追加
- [x] F4. テスト 18 件 (WeekView 9 + AgendaView 9) 全 pass

### Phase G: イベント作成 / 編集 / 詳細

- [x] G1. `components/Calendar/EventDetailDrawer.tsx` 実装（RSVP / 参加者一覧 / 削除確認 MUI Dialog）
- [x] G2. `components/Calendar/EventDialog.tsx` 実装（予定/日程調整 タブ、編集兼用、バリデーション）
- [x] G3. CalendarPage で Drawer/Dialog を結線、refresh() で当月キャッシュをクリア
- [x] G4. テスト 33 件 pass（EventDetailDrawer 19 + EventDialog 14、参加者 Autocomplete 1 件のみ todo）

### Phase H: 日程調整 UI（ヒートマップ）

- [x] H1. `components/Calendar/PollHeatmap.tsx`（投票循環 yes→maybe→no→null、最多 yes ハイライト、参加可能率バー）
- [x] H2. `components/Calendar/PollListDrawer.tsx` 新規 + CalendarHeader に「日程調整」ボタン追加 + CalendarPage 結線
- [x] H3. 「最多回答で確定」ボタン → `api.calendar.polls.confirm` 呼び出し
- [x] H4. PollHeatmap テスト 17 件 pass、クライアント全 86 ファイル / 1279 件 pass + 8 todo（Phase I で消化）

### Phase J: チャットイベント機能 (#108) との連携 ★追加スコープ

#### 背景
既存 #108「チャンネル内イベント投稿」と本機能 #152「カレンダー」が独立しており、
チャット投稿したイベントがカレンダー画面に現れず、双方の整合が取れない。
ユーザー体験を統一するため、**チャット投稿 → カレンダー自動反映** を実装する。

#### 仕様（MVP・要ユーザー確認）

| 論点 | 推奨案 | スコープ外（将来 Issue 候補） |
|---|---|---|
| **chat → calendar 反映** | `eventService.create()` 内で `calendarService.createEvent()` も呼び、`events.calendar_event_id` で相互参照 | - |
| **calendar → chat 反映** | **MVP は対応しない**。EventDialog の「チャンネルに投稿」スイッチは削除（誤解防止） | カレンダーで作ったイベントを既存 events 経由でチャンネル投稿 |
| **編集同期** | events 更新時に `calendar_events` も同期更新 | カレンダー側編集の events への逆同期 |
| **削除同期** | events 削除時に `calendar_events` も削除 / `calendar_events` 削除時は `events.calendar_event_id` を NULL（メッセージ履歴は残す） | - |
| **RSVP 統合** | **しない**。`going/not_going/maybe` と `accepted/maybe/declined/pending` は意味論が異なるため別系統で運用 | RSVP の値マッピング統合 |
| **既存 #108 UI**（CreateEventDialog / EventCard） | **残す**。メッセージ投稿フローは変えない、カレンダー反映だけ追加 | - |
| **既存データの backfill** | **しない**。新規データから連携、古いものは現状維持 | スクリプトで古い events を calendar_events に転送 |

#### スキーマ変更（最小）

```hcl
# events テーブルに 1 カラム追加
table "events" {
  ...
  column "calendar_event_id" {
    null    = true
    type    = integer
    comment = "#152 連携: 対応する calendar_events.id (NULL は連携前の古いレコード)"
  }
  foreign_key "fk_events_calendar_event" {
    columns     = [column.calendar_event_id]
    ref_columns = [table.calendar_events.column.id]
    on_update   = NO_ACTION
    on_delete   = SET_NULL  # calendar_events 削除でも events 行は残す
  }
}
```

#### サーバ実装

- `services/eventService.ts`
  - `create()`: 既存の message + events INSERT 後に `calendarService.createEvent()` を呼び、戻り値の id を `events.calendar_event_id` に UPDATE
  - `update()`: events 更新後に `events.calendar_event_id` があれば `calendarService.updateEvent()` も呼ぶ
  - `deleteEvent()`: events 削除前に `events.calendar_event_id` があれば `calendarService.deleteEvent()` を呼ぶ
  - 同期失敗時の挙動: トランザクションで atomic に。失敗したら全体ロールバック
- `pgTestHelper.ts`: events テーブルに `calendar_event_id` カラム追加

#### クライアント実装

- `components/Calendar/EventDialog.tsx`
  - 「チャンネルに投稿」スイッチを削除（MVP では機能しないため誤解を招く）
- それ以外は変更なし（CalendarPage は calendar_events を取得するため、chat 由来のイベントも自動的に表示される）

#### テスト追加

- `__tests__/event.test.ts`（既存ファイルに追記）
  - chat イベント作成時に対応する calendar_events が同時作成される
  - chat イベント編集時に calendar_events も更新される
  - chat イベント削除時に calendar_events も削除される
  - calendar_events 単独削除時に events.calendar_event_id が NULL になる（CASCADE SET NULL）
- `__tests__/integration/messageController.test.ts` または既存 events-route テストに 1 件追加: HTTP 経由で events 作成 → カレンダー API でも参照可能

#### 実機検証

- Playwright MCP でチャット画面からイベント投稿 → カレンダー画面に切替 → 同じイベントが表示されることを確認

#### タスク

- [x] J1. 連携仕様のユーザー確認（推奨案で OK）
- [x] J2. `db/schema.hcl`: `events.calendar_event_id` 追加 → atlas apply (commit `f891677`)
- [x] J3. `pgTestHelper.ts` の events CREATE 文に `calendar_event_id` を追加
- [x] J4. `eventService.create()` に calendar 同期追加 + テスト 2 件
- [x] J5. `eventService.update()` に calendar 同期追加 + テスト 1 件
- [x] J6. `eventService.deleteEvent()` に calendar 同期追加 + テスト 2 件（CASCADE / SET NULL）
- [x] J7. EventDialog の「チャンネルに投稿」スイッチを削除 + 未使用 import 整理
- [x] J8. Playwright で chat → calendar の反映を実機検証完了
  - `POST /api/events`（chat 経由）で 5/22 にイベント作成
  - `/calendar` 月ビューに `19:00 チャット連携テスト` が即時反映されることを確認
  - 既存 calendar 直接作成のイベント（5/15、5/25）と並んで正しく表示
- [x] J9. issue-152.md 更新済み
- [x] J10. `npm run build` + `npm run test` 全通過確認（サーバ 1361 件 / クライアント 1280 件 + 8 todo）

### Phase I: 仕上げ + 実機検証

- [x] I1. Playwright MCP で golden path テスト完了
  - ログイン → /calendar → 月表示
  - 5/15 日付クリック → EventDialog → タイトル入力 → 作成 → 月表示反映
  - イベントクリック → EventDetailDrawer → RSVP「参加」→ 反映確認（contained variant、参加 1 カウント）
  - 削除アイコン → MUI 確認 Dialog 表示確認
  - 週/アジェンダ ビュー切替確認
  - 5/20 セルクリック → EventDialog → 「日程調整」タブ → 候補日 5/25 / 5/26 入力 → 投票開始
  - 「日程調整」ボタン → PollListDrawer → PollHeatmap 表示
  - セルクリック → yes 投票 → 「最多回答で確定」 → 月表示に新規イベント反映
- [x] I2. 実機検証で発見した不具合を修正：Drawer Paper が AppBar に隠れる問題（top: 64 + height calc）(commit `1883011`)
- [x] I3. `npm run build` + `npm run test` 全通過確認（サーバ 1357 件 / クライアント 1279 件 + 8 todo）
- [x] I4. [PR #174](https://github.com/mokemoke2850/chat-app-for-claudecode-test/pull/174) 作成完了

---

## 落とし穴・注意点

### スキーマ
- `calendar_polls.confirmed_event_id` は `ON DELETE SET NULL`（イベント削除でも poll 履歴を残す）
- `calendar_events.channel_id` は **null 許容**（モックでは全イベントに channel あるが、ワークスペース全体イベントの余地を残す）
- 既存 `events` / `event_rsvps` テーブルは **触らない**

### サーバ
- `confirmPoll` はトランザクション必須（イベント INSERT + poll 更新を atomic）
- `listEventsInRange` は `(starts_at, ends_at)` どちらかが範囲に重なるイベントを返す（複数日イベント対応の余地、MVP は単日のみで OK）
- ルート登録順序: `app.use('/api/calendar', ...)` を `/api/events` の近くに置く（場所論的な可読性）

### クライアント
- React 19 `use()` の Promise は `useState(() => promise)` で安定化（CLAUDE.md 必須）
- 月切替で再フェッチする際、Promise キャッシュは `${year}-${month}` キーで管理（concurrent モード対応）
- Date 操作: `new Date(d.getFullYear(), d.getMonth(), 1)` パターンでローカル TZ 計算（モック準拠）。ISO 文字列との変換は `toISOString()` で UTC 化
- Material Symbols アイコンは既存プロジェクトの慣例に合わせる（モックで使用しているアイコン名: `calendar_month`, `event`, `schedule`, `place`, `person`, `notes`, `how_to_vote`, `event_busy`, `event_available`, `chat_bubble`, `notifications`）
- AppLayout の既存タスクボード追記行（`AppLayout.tsx:251-256`）の隣に同じ `<List>` で「カレンダー」追記 → 衝突源にしない

### Playwright 実機検証で見るべきポイント
- 月切替（前月 / 次月 / 今日）で正しく日付が変わる
- 日付クリックで EventDialog が開き、その日付がデフォルト
- イベント作成後、月表示にイベントが現れる
- イベントクリックで右ドロワーが開く
- RSVP ボタン押下で `myStatus` が変わる
- 日程調整作成 → 投票 → 確定の一連フローでイベントが生成される
- リマインダー: 単体テストでロジック確認（ワーカーは setInterval なので実機検証は省略可）

### 並列実行時の競合警戒（注: #152 は既に他 Phase 3 マージ後）
- `db/schema.hcl` 末尾追記方針 → 衝突低リスク
- `packages/shared/src/index.ts` 末尾追記
- `App.tsx` の Route 追加 / `AppLayout.tsx` のナビ追加 → ファイル末尾近く・追記中心で対応
- `packages/client/src/api/client.ts` の calendar 名前空間は末尾追加

---

## ステータス（経過記録）

- 計画作成日: 2026-04-27
- 計画清書日: 2026-04-30
- ブランチ: `feature/calendar/#152`（main から派生）
- PR: [#174](https://github.com/mokemoke2850/chat-app-for-claudecode-test/pull/174)
- マージ: 待機中
- 備考: モック (`doc/calendar-mock/`) 準拠でテーブル構成を「予定と日程調整を完全分離」に変更
- 2026-04-30: Phase A 完了。サーバテスト 25 + 統合テスト 20 = 45 件 pass。Phase B/C/D は todo 状態で次フェーズ着手待ち。
- 2026-05-01: Phase B/C/D 完了。サーバ全体 115 件 pass（calendar.test.ts 56 + calendar-route.test.ts 46 + calendarReminderWorker.test.ts 13）。次は Phase E〜H（クライアント実装）に着手。
- 2026-05-01: Phase E〜I 完了。Playwright 実機検証 + Drawer top オフセット修正 (#152 PR `1883011`)。コードレビュー対応 7 件 (`d2324d1`)。
- 2026-05-01: Phase J（chat events 連携）実装。J2〜J7・J9・J10 完了 (commit `f891677`)。サーバ 1361 件 / クライアント 1280 件 + 8 todo。J8（実機検証）残。
