// Issue #152 — カレンダー / 予定調整のサービス層
// 既存 eventService.ts (#108) とは別系統。
// 「予定」(calendar_events) と「日程調整」(calendar_polls) を完全分離。

import { createError } from '../middleware/errorHandler';
import { execute, query, queryOne, withTransaction } from '../db/database';
import type {
  CalendarEvent,
  CalendarEventAttendee,
  CalendarPoll,
  CalendarPollCandidate,
  CalendarPollVote,
  CalendarRsvpStatus,
  CalendarVoteValue,
  CastCalendarVoteInput,
  CreateCalendarEventInput,
  CreateCalendarPollInput,
  UpdateCalendarEventInput,
} from '@chat-app/shared';

const VALID_RSVP_STATUSES: readonly CalendarRsvpStatus[] = [
  'accepted',
  'maybe',
  'declined',
  'pending',
];

const VALID_VOTE_VALUES: readonly CalendarVoteValue[] = ['yes', 'maybe', 'no'];

const NOT_IMPLEMENTED_MSG = 'calendarService: not implemented yet';

interface EventRow {
  id: number;
  channel_id: number | null;
  title: string;
  description: string | null;
  location: string | null;
  starts_at: string | Date;
  ends_at: string | Date;
  organizer_id: number;
  created_at: string | Date;
  updated_at: string | Date;
}

interface AttendeeRow {
  event_id: number;
  user_id: number;
  status: string;
  responded_at: string | Date;
}

interface ReminderRow {
  id: number;
  event_id: number;
  remind_offset_minutes: number;
  sent_at: string | Date | null;
}

function toIso(value: string | Date): string {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function rowToEvent(
  row: EventRow,
  attendees: CalendarEventAttendee[],
  reminderOffset: number | null,
): CalendarEvent {
  return {
    id: row.id,
    channelId: row.channel_id,
    title: row.title,
    description: row.description,
    location: row.location,
    startsAt: toIso(row.starts_at),
    endsAt: toIso(row.ends_at),
    organizerId: row.organizer_id,
    createdAt: toIso(row.created_at),
    updatedAt: toIso(row.updated_at),
    attendees,
    reminderOffsetMinutes: reminderOffset,
  };
}

function attendeeRowToObject(row: AttendeeRow): CalendarEventAttendee {
  return {
    userId: row.user_id,
    status: row.status as CalendarRsvpStatus,
    respondedAt: toIso(row.responded_at),
  };
}

function validateTimeOrder(startsAt: string, endsAt: string): void {
  const s = Date.parse(startsAt);
  const e = Date.parse(endsAt);
  if (Number.isNaN(s) || Number.isNaN(e)) {
    throw createError('日時の形式が不正です', 400);
  }
  if (s >= e) {
    throw createError('終了日時は開始日時より後である必要があります', 400);
  }
}

// ===== イベント本体 =====

export async function createEvent(
  organizerId: number,
  input: CreateCalendarEventInput,
): Promise<CalendarEvent> {
  if (!input.title || input.title.trim() === '') {
    throw createError('タイトルを入力してください', 400);
  }
  validateTimeOrder(input.startsAt, input.endsAt);

  return withTransaction(async () => {
    const eventRow = await queryOne<EventRow>(
      `INSERT INTO calendar_events (channel_id, title, description, location, starts_at, ends_at, organizer_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [
        input.channelId,
        input.title,
        input.description ?? null,
        input.location ?? null,
        input.startsAt,
        input.endsAt,
        organizerId,
      ],
    );
    if (!eventRow) {
      throw createError('イベントの作成に失敗しました', 500);
    }

    const attendees: CalendarEventAttendee[] = [];
    if (input.attendeeUserIds && input.attendeeUserIds.length > 0) {
      const uniqueIds = Array.from(new Set(input.attendeeUserIds));
      for (const uid of uniqueIds) {
        const aRow = await queryOne<AttendeeRow>(
          `INSERT INTO calendar_event_attendees (event_id, user_id, status)
           VALUES ($1, $2, 'pending')
           RETURNING *`,
          [eventRow.id, uid],
        );
        if (aRow) attendees.push(attendeeRowToObject(aRow));
      }
    }

    let reminderOffset: number | null = null;
    if (input.reminderOffsetMinutes !== null && input.reminderOffsetMinutes !== undefined) {
      await execute(
        `INSERT INTO calendar_event_reminders (event_id, remind_offset_minutes)
         VALUES ($1, $2)`,
        [eventRow.id, input.reminderOffsetMinutes],
      );
      reminderOffset = input.reminderOffsetMinutes;
    }

    return rowToEvent(eventRow, attendees, reminderOffset);
  });
}

export async function updateEvent(
  userId: number,
  eventId: number,
  input: UpdateCalendarEventInput,
): Promise<CalendarEvent> {
  const existing = await queryOne<EventRow>('SELECT * FROM calendar_events WHERE id = $1', [
    eventId,
  ]);
  if (!existing) throw createError('Event not found', 404);
  if (existing.organizer_id !== userId) throw createError('Forbidden', 403);

  const nextStartsAt = input.startsAt ?? toIso(existing.starts_at);
  const nextEndsAt = input.endsAt ?? toIso(existing.ends_at);
  validateTimeOrder(nextStartsAt, nextEndsAt);

  const sets: string[] = [];
  const values: unknown[] = [];
  let idx = 1;
  if (input.title !== undefined) {
    sets.push(`title = $${idx++}`);
    values.push(input.title);
  }
  if (input.description !== undefined) {
    sets.push(`description = $${idx++}`);
    values.push(input.description);
  }
  if (input.location !== undefined) {
    sets.push(`location = $${idx++}`);
    values.push(input.location);
  }
  if (input.startsAt !== undefined) {
    sets.push(`starts_at = $${idx++}`);
    values.push(input.startsAt);
  }
  if (input.endsAt !== undefined) {
    sets.push(`ends_at = $${idx++}`);
    values.push(input.endsAt);
  }
  sets.push(`updated_at = NOW()`);

  values.push(eventId);
  const updated = await queryOne<EventRow>(
    `UPDATE calendar_events SET ${sets.join(', ')} WHERE id = $${idx} RETURNING *`,
    values,
  );
  if (!updated) throw createError('Event not found', 404);

  const attendees = await loadAttendees(eventId);
  const reminderOffset = await loadReminderOffset(eventId);
  return rowToEvent(updated, attendees, reminderOffset);
}

export async function deleteEvent(userId: number, eventId: number): Promise<void> {
  const existing = await queryOne<EventRow>('SELECT * FROM calendar_events WHERE id = $1', [
    eventId,
  ]);
  if (!existing) throw createError('Event not found', 404);
  if (existing.organizer_id !== userId) throw createError('Forbidden', 403);

  await execute('DELETE FROM calendar_events WHERE id = $1', [eventId]);
}

export async function getEventById(eventId: number): Promise<CalendarEvent | null> {
  const row = await queryOne<EventRow>('SELECT * FROM calendar_events WHERE id = $1', [eventId]);
  if (!row) return null;
  const attendees = await loadAttendees(eventId);
  const reminderOffset = await loadReminderOffset(eventId);
  return rowToEvent(row, attendees, reminderOffset);
}

export interface ListEventsInRangeOptions {
  from: string;
  to: string;
  channelIds?: number[];
}

export async function listEventsInRange(opts: ListEventsInRangeOptions): Promise<CalendarEvent[]> {
  const sql: string[] = ['SELECT * FROM calendar_events'];
  const wheres: string[] = ['starts_at >= $1', 'starts_at <= $2'];
  const params: unknown[] = [opts.from, opts.to];

  if (opts.channelIds !== undefined) {
    if (opts.channelIds.length === 0) {
      return [];
    }
    const placeholders = opts.channelIds.map((_, i) => `$${i + 3}`).join(', ');
    wheres.push(`channel_id IN (${placeholders})`);
    params.push(...opts.channelIds);
  }

  sql.push('WHERE', wheres.join(' AND '), 'ORDER BY starts_at ASC');
  const rows = await query<EventRow>(sql.join(' '), params);
  if (rows.length === 0) return [];

  const ids = rows.map((r) => r.id);
  const attendeeMap = await loadAttendeesForEvents(ids);
  const reminderMap = await loadReminderOffsetsForEvents(ids);
  return rows.map((r) => rowToEvent(r, attendeeMap.get(r.id) ?? [], reminderMap.get(r.id) ?? null));
}

async function loadAttendees(eventId: number): Promise<CalendarEventAttendee[]> {
  const rows = await query<AttendeeRow>(
    'SELECT * FROM calendar_event_attendees WHERE event_id = $1 ORDER BY user_id ASC',
    [eventId],
  );
  return rows.map(attendeeRowToObject);
}

async function loadAttendeesForEvents(
  eventIds: number[],
): Promise<Map<number, CalendarEventAttendee[]>> {
  const map = new Map<number, CalendarEventAttendee[]>();
  if (eventIds.length === 0) return map;
  const placeholders = eventIds.map((_, i) => `$${i + 1}`).join(', ');
  const rows = await query<AttendeeRow>(
    `SELECT * FROM calendar_event_attendees WHERE event_id IN (${placeholders}) ORDER BY user_id ASC`,
    eventIds,
  );
  for (const r of rows) {
    const list = map.get(r.event_id) ?? [];
    list.push(attendeeRowToObject(r));
    map.set(r.event_id, list);
  }
  return map;
}

async function loadReminderOffset(eventId: number): Promise<number | null> {
  const row = await queryOne<ReminderRow>(
    'SELECT * FROM calendar_event_reminders WHERE event_id = $1 ORDER BY id ASC LIMIT 1',
    [eventId],
  );
  return row ? row.remind_offset_minutes : null;
}

async function loadReminderOffsetsForEvents(eventIds: number[]): Promise<Map<number, number>> {
  const map = new Map<number, number>();
  if (eventIds.length === 0) return map;
  const placeholders = eventIds.map((_, i) => `$${i + 1}`).join(', ');
  const rows = await query<ReminderRow>(
    `SELECT DISTINCT ON (event_id) event_id, remind_offset_minutes
     FROM calendar_event_reminders
     WHERE event_id IN (${placeholders})
     ORDER BY event_id, id ASC`,
    eventIds,
  );
  for (const r of rows) {
    map.set(r.event_id, r.remind_offset_minutes);
  }
  return map;
}

// ===== Phase B: RSVP（次フェーズで実装）=====

export async function setRsvp(
  _userId: number,
  _eventId: number,
  _status: CalendarRsvpStatus,
): Promise<CalendarEventAttendee> {
  void VALID_RSVP_STATUSES;
  throw new Error(NOT_IMPLEMENTED_MSG);
}

// ===== Phase C: 日程調整（次フェーズで実装）=====

export async function createPoll(
  _organizerId: number,
  _input: CreateCalendarPollInput,
): Promise<CalendarPoll> {
  throw new Error(NOT_IMPLEMENTED_MSG);
}

export async function getPollWithVotes(_pollId: number): Promise<CalendarPoll | null> {
  throw new Error(NOT_IMPLEMENTED_MSG);
}

export async function listPollsByChannel(_channelId: number): Promise<CalendarPoll[]> {
  throw new Error(NOT_IMPLEMENTED_MSG);
}

export async function castVote(
  _userId: number,
  _pollId: number,
  _votes: CastCalendarVoteInput[],
): Promise<CalendarPoll> {
  void VALID_VOTE_VALUES;
  throw new Error(NOT_IMPLEMENTED_MSG);
}

export async function confirmPoll(
  _userId: number,
  _pollId: number,
  _candidateId: number,
): Promise<CalendarEvent> {
  throw new Error(NOT_IMPLEMENTED_MSG);
}

// 関連型を再エクスポート（型を1か所から取りたい呼び出し側の利便性のため）
export type {
  CalendarEvent,
  CalendarEventAttendee,
  CalendarPoll,
  CalendarPollCandidate,
  CalendarPollVote,
  CalendarRsvpStatus,
  CalendarVoteValue,
  CreateCalendarEventInput,
  UpdateCalendarEventInput,
};
