// #108 会話イベント投稿
// イベントメッセージ（events）と RSVP（event_rsvps）の共有型定義。

export type RsvpStatus = 'going' | 'not_going' | 'maybe';

export interface RsvpCounts {
  going: number;
  notGoing: number;
  maybe: number;
}

/** #324 アバタープレビュー用の最小ユーザー情報 */
export type EventGoingUserPreview = Pick<RsvpUser, 'userId' | 'displayName' | 'avatarUrl'>;

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
  /** #324 going 参加者の先頭 N 名プレビュー（古い RSVP 順、最大 3 件）。総数は rsvpCounts.going を参照する。 */
  goingUsersPreview?: EventGoingUserPreview[];
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
