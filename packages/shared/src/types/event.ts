// #108 会話イベント投稿
// イベントメッセージ（events）と RSVP（event_rsvps）の共有型定義。

export type RsvpStatus = 'going' | 'not_going' | 'maybe';

export interface RsvpCounts {
  going: number;
  notGoing: number;
  maybe: number;
}

export interface ChatEvent {
  id: number;
  messageId: number;
  title: string;
  description: string | null;
  startsAt: string;
  endsAt: string | null;
  createdBy: number | null;
  createdAt: string;
  updatedAt: string;
  rsvpCounts: RsvpCounts;
  myRsvp: RsvpStatus | null;
}

export interface CreateEventInput {
  channelId: number;
  title: string;
  description?: string;
  startsAt: string;
  endsAt?: string;
}

export interface UpdateEventInput {
  title?: string;
  description?: string | null;
  startsAt?: string;
  endsAt?: string | null;
}

export interface RsvpUser {
  userId: number;
  username: string;
  displayName: string | null;
  avatarUrl: string | null;
  status: RsvpStatus;
  updatedAt: string;
}
