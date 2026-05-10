// #152 カレンダー / 予定調整
// イベント本体・RSVP・リマインダー・日程調整（Poll）の共有型定義。
// 既存 types/event.ts（#108 会話イベント投稿）とは別系統。

export type CalendarRsvpStatus = 'accepted' | 'maybe' | 'declined' | 'pending';

export type CalendarVoteValue = 'yes' | 'maybe' | 'no';

// #302 繰り返しイベント
export type RecurrenceRule = 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'YEARLY';

/** 繰り返し編集/削除のスコープ */
export type RecurrenceEditScope = 'one' | 'following' | 'all';

export interface RecurrenceInput {
  /** 繰り返し種別 */
  rule: RecurrenceRule;
  /** 間隔（毎N日/週/月/年）。省略時は 1。 */
  interval?: number;
  /** WEEKLY 時のみ: 曜日 0=日 〜 6=土 */
  daysOfWeek?: number[];
  /** 終了日（ISO 文字列）。null/未指定の場合は無期限（count または上限まで） */
  endDate?: string | null;
  /** 終了回数（マスター含む）。endDate と同時指定不可 */
  count?: number | null;
}

export interface CalendarEventAttendee {
  userId: number;
  status: CalendarRsvpStatus;
  respondedAt: string;
}

export interface CalendarEvent {
  id: number;
  channelId: number | null;
  title: string;
  description: string | null;
  location: string | null;
  startsAt: string;
  endsAt: string;
  organizerId: number;
  createdAt: string;
  updatedAt: string;
  attendees: CalendarEventAttendee[];
  reminderOffsetMinutes: number | null;
  // #302 繰り返し設定（マスター行のみ rule が入る。子は recurrenceMasterId のみ）
  recurrenceRule: RecurrenceRule | null;
  recurrenceInterval: number;
  recurrenceDaysOfWeek: number[] | null;
  recurrenceEndDate: string | null;
  recurrenceCount: number | null;
  recurrenceMasterId: number | null;
}

export interface CreateCalendarEventInput {
  channelId: number | null;
  title: string;
  description?: string | null;
  location?: string | null;
  startsAt: string;
  endsAt: string;
  attendeeUserIds?: number[];
  reminderOffsetMinutes?: number | null;
  /** #302 繰り返し設定 */
  recurrence?: RecurrenceInput | null;
}

export interface UpdateCalendarEventInput {
  title?: string;
  description?: string | null;
  location?: string | null;
  startsAt?: string;
  endsAt?: string;
  /** #302 繰り返し編集スコープ。省略時は 'one'。単発イベントでは無視される。 */
  scope?: RecurrenceEditScope;
}

/** #302 繰り返し削除スコープ */
export interface DeleteCalendarEventOptions {
  scope?: RecurrenceEditScope;
}

export interface CalendarPollCandidate {
  id: number;
  pollId: number;
  startsAt: string;
  endsAt: string;
}

export interface CalendarPollVote {
  candidateId: number;
  userId: number;
  vote: CalendarVoteValue;
  votedAt: string;
}

export interface CalendarPoll {
  id: number;
  channelId: number;
  title: string;
  organizerId: number;
  deadline: string | null;
  confirmedEventId: number | null;
  createdAt: string;
  candidates: CalendarPollCandidate[];
  votes: CalendarPollVote[];
}

export interface CreateCalendarPollInput {
  channelId: number;
  title: string;
  deadline?: string | null;
  candidates: { startsAt: string; endsAt: string }[];
}

export interface CastCalendarVoteInput {
  candidateId: number;
  vote: CalendarVoteValue | null; // null は投票削除
}

export interface ConfirmCalendarPollInput {
  candidateId: number;
}
