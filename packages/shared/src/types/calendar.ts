// #152 カレンダー / 予定調整
// イベント本体・RSVP・リマインダー・日程調整（Poll）の共有型定義。
// 既存 types/event.ts（#108 会話イベント投稿）とは別系統。

export type CalendarRsvpStatus = 'accepted' | 'maybe' | 'declined' | 'pending';

export type CalendarVoteValue = 'yes' | 'maybe' | 'no';

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
  meetingUrl: string | null;
  startsAt: string;
  endsAt: string;
  organizerId: number;
  createdAt: string;
  updatedAt: string;
  attendees: CalendarEventAttendee[];
  reminderOffsetMinutes: number | null;
}

export interface CreateCalendarEventInput {
  channelId: number | null;
  title: string;
  description?: string | null;
  location?: string | null;
  meetingUrl?: string | null;
  startsAt: string;
  endsAt: string;
  attendeeUserIds?: number[];
  reminderOffsetMinutes?: number | null;
}

export interface UpdateCalendarEventInput {
  title?: string;
  description?: string | null;
  location?: string | null;
  meetingUrl?: string | null;
  startsAt?: string;
  endsAt?: string;
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
