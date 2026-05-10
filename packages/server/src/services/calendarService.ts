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
  RecurrenceEditScope,
  RecurrenceInput,
  RecurrenceRule,
  UpdateCalendarEventInput,
} from '@chat-app/shared';

const VALID_RSVP_STATUSES: readonly CalendarRsvpStatus[] = [
  'accepted',
  'maybe',
  'declined',
  'pending',
];

const VALID_VOTE_VALUES: readonly CalendarVoteValue[] = ['yes', 'maybe', 'no'];
const VALID_RECURRENCE_RULES: readonly RecurrenceRule[] = ['DAILY', 'WEEKLY', 'MONTHLY', 'YEARLY'];
const VALID_EDIT_SCOPES: readonly RecurrenceEditScope[] = ['one', 'following', 'all'];

/** 繰り返し展開上限（マスター含む） */
export const RECURRENCE_MAX_INSTANCES = 365;

const NOT_IMPLEMENTED_MSG = 'calendarService: not implemented yet';

interface EventRow {
  id: number;
  channel_id: number | null;
  title: string;
  description: string | null;
  location: string | null;
  meeting_url: string | null;
  starts_at: string | Date;
  ends_at: string | Date;
  organizer_id: number;
  created_at: string | Date;
  updated_at: string | Date;
  recurrence_rule: string | null;
  recurrence_interval: number;
  recurrence_days_of_week: string | null;
  recurrence_end_date: string | Date | null;
  recurrence_count: number | null;
  recurrence_master_id: number | null;
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

function parseDaysOfWeek(value: string | null): number[] | null {
  if (value === null || value === '') return null;
  const parts = value
    .split(',')
    .map((s) => parseInt(s.trim(), 10))
    .filter((n) => Number.isInteger(n) && n >= 0 && n <= 6);
  return parts.length > 0 ? parts : null;
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
    meetingUrl: row.meeting_url,
    startsAt: toIso(row.starts_at),
    endsAt: toIso(row.ends_at),
    organizerId: row.organizer_id,
    createdAt: toIso(row.created_at),
    updatedAt: toIso(row.updated_at),
    attendees,
    reminderOffsetMinutes: reminderOffset,
    recurrenceRule: (row.recurrence_rule ?? null) as RecurrenceRule | null,
    recurrenceInterval: row.recurrence_interval ?? 1,
    recurrenceDaysOfWeek: parseDaysOfWeek(row.recurrence_days_of_week),
    recurrenceEndDate: row.recurrence_end_date ? toIso(row.recurrence_end_date) : null,
    recurrenceCount: row.recurrence_count,
    recurrenceMasterId: row.recurrence_master_id,
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

/**
 * #302 繰り返し設定の検証。
 * 不正な値の場合は createError(400) を投げる。
 */
function validateRecurrence(rec: RecurrenceInput, startsAt: string): RecurrenceInput {
  if (!VALID_RECURRENCE_RULES.includes(rec.rule)) {
    throw createError('繰り返しルールが不正です', 400);
  }
  const interval = rec.interval ?? 1;
  if (!Number.isInteger(interval) || interval < 1) {
    throw createError('繰り返し間隔は 1 以上の整数で指定してください', 400);
  }
  if (rec.endDate && rec.count) {
    throw createError('繰り返し終了日と回数は同時に指定できません', 400);
  }
  if (rec.count !== undefined && rec.count !== null) {
    if (!Number.isInteger(rec.count) || rec.count < 1) {
      throw createError('繰り返し回数は 1 以上の整数で指定してください', 400);
    }
  }
  if (rec.endDate) {
    const e = Date.parse(rec.endDate);
    const s = Date.parse(startsAt);
    if (Number.isNaN(e)) throw createError('繰り返し終了日の形式が不正です', 400);
    if (e < s) throw createError('繰り返し終了日は開始日より後である必要があります', 400);
  }
  if (rec.daysOfWeek !== undefined && rec.daysOfWeek !== null) {
    if (rec.rule !== 'WEEKLY') {
      throw createError('曜日指定は WEEKLY のみで有効です', 400);
    }
    if (!Array.isArray(rec.daysOfWeek) || rec.daysOfWeek.length === 0) {
      throw createError('曜日を 1 つ以上選択してください', 400);
    }
    for (const d of rec.daysOfWeek) {
      if (!Number.isInteger(d) || d < 0 || d > 6) {
        throw createError('曜日の値が不正です（0=日 〜 6=土）', 400);
      }
    }
  }
  return { ...rec, interval };
}

/**
 * 繰り返しルールに基づいて、startsAt から始まる開始時刻のリストを返す。
 * 上限は RECURRENCE_MAX_INSTANCES。マスターも先頭要素として含む。
 */
export function expandRecurrence(
  rule: RecurrenceRule,
  startsAt: string,
  endsAt: string,
  options: {
    interval?: number;
    daysOfWeek?: number[] | null;
    endDate?: string | null;
    count?: number | null;
  } = {},
): { startsAt: string; endsAt: string }[] {
  const interval = options.interval ?? 1;
  const start = new Date(startsAt);
  const end = new Date(endsAt);
  const durationMs = end.getTime() - start.getTime();
  const limit = options.count ?? RECURRENCE_MAX_INSTANCES;
  const maxCount = Math.min(limit, RECURRENCE_MAX_INSTANCES);
  const endDateMs = options.endDate ? Date.parse(options.endDate) : null;

  const results: { startsAt: string; endsAt: string }[] = [];
  // 上限を超えない範囲で時刻列を生成。
  // DAILY/WEEKLY/MONTHLY/YEARLY ごとに「次の候補」を計算して進める。
  const safetyLimit = RECURRENCE_MAX_INSTANCES * 8;
  let cursor = new Date(start);
  let stepsTried = 0;

  if (rule === 'WEEKLY' && options.daysOfWeek && options.daysOfWeek.length > 0) {
    const days = Array.from(new Set(options.daysOfWeek)).sort();
    // 週単位で進めながら、各週の対象曜日を加える
    const weekStart = new Date(start);
    weekStart.setDate(weekStart.getDate() - weekStart.getDay()); // その週の日曜
    let weekIndex = 0;
    while (results.length < maxCount && stepsTried < safetyLimit) {
      stepsTried++;
      for (const d of days) {
        const candidate = new Date(weekStart);
        candidate.setDate(weekStart.getDate() + weekIndex * 7 * interval + d);
        candidate.setHours(start.getHours(), start.getMinutes(), start.getSeconds(), 0);
        if (candidate.getTime() < start.getTime()) continue;
        if (endDateMs !== null && candidate.getTime() > endDateMs) {
          return results;
        }
        results.push({
          startsAt: candidate.toISOString(),
          endsAt: new Date(candidate.getTime() + durationMs).toISOString(),
        });
        if (results.length >= maxCount) return results;
      }
      weekIndex++;
    }
    return results;
  }

  // 通常ループ: 先頭はマスターの startsAt をそのまま入れ、以降は rule に従って加算する
  let isFirst = true;
  while (results.length < maxCount && stepsTried < safetyLimit) {
    stepsTried++;
    if (endDateMs !== null && cursor.getTime() > endDateMs) break;

    // 月またぎで「該当日が無い」場合は、results.push せず次の候補へ進める
    let pushable = true;
    if (!isFirst && rule === 'MONTHLY') {
      const lastDayOfMonth = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0).getDate();
      if (start.getDate() > lastDayOfMonth) {
        pushable = false;
      }
    }
    if (pushable) {
      results.push({
        startsAt: cursor.toISOString(),
        endsAt: new Date(cursor.getTime() + durationMs).toISOString(),
      });
      if (results.length >= maxCount) break;
    }
    isFirst = false;

    const next = new Date(cursor);
    if (rule === 'DAILY') {
      next.setDate(next.getDate() + interval);
    } else if (rule === 'WEEKLY') {
      next.setDate(next.getDate() + 7 * interval);
    } else if (rule === 'MONTHLY') {
      const targetDay = start.getDate();
      next.setDate(1);
      next.setMonth(next.getMonth() + interval);
      const lastDay = new Date(next.getFullYear(), next.getMonth() + 1, 0).getDate();
      // 該当日があれば設定、無ければ月初のまま（次イテレーションで pushable=false になる）
      if (targetDay <= lastDay) {
        next.setDate(targetDay);
      }
    } else if (rule === 'YEARLY') {
      next.setFullYear(next.getFullYear() + interval);
    }
    cursor = next;
  }
  return results;
}

export async function createEvent(
  organizerId: number,
  input: CreateCalendarEventInput,
): Promise<CalendarEvent> {
  if (!input.title || input.title.trim() === '') {
    throw createError('タイトルを入力してください', 400);
  }
  validateTimeOrder(input.startsAt, input.endsAt);
  const recurrence = input.recurrence ? validateRecurrence(input.recurrence, input.startsAt) : null;

  // 繰り返し展開（事前計算）。マスター行の時刻はリスト先頭に合わせる。
  let instances: { startsAt: string; endsAt: string }[] = [];
  let masterStartsAt = input.startsAt;
  let masterEndsAt = input.endsAt;
  if (recurrence) {
    instances = expandRecurrence(recurrence.rule, input.startsAt, input.endsAt, {
      interval: recurrence.interval,
      daysOfWeek: recurrence.daysOfWeek ?? null,
      endDate: recurrence.endDate ?? null,
      count: recurrence.count ?? null,
    });
    if (instances.length > 0) {
      masterStartsAt = instances[0].startsAt;
      masterEndsAt = instances[0].endsAt;
    }
  }

  return withTransaction(async () => {
    // マスターイベントを INSERT
    const masterRow = await queryOne<EventRow>(
      `INSERT INTO calendar_events (channel_id, title, description, location, meeting_url, starts_at, ends_at, organizer_id,
                                    recurrence_rule, recurrence_interval, recurrence_days_of_week,
                                    recurrence_end_date, recurrence_count)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
       RETURNING *`,
      [
        input.channelId,
        input.title,
        input.description ?? null,
        input.location ?? null,
        input.meetingUrl ?? null,
        masterStartsAt,
        masterEndsAt,
        organizerId,
        recurrence ? recurrence.rule : null,
        recurrence ? (recurrence.interval ?? 1) : 1,
        recurrence && recurrence.daysOfWeek && recurrence.daysOfWeek.length > 0
          ? recurrence.daysOfWeek.join(',')
          : null,
        recurrence?.endDate ?? null,
        recurrence?.count ?? null,
      ],
    );
    if (!masterRow) {
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
          [masterRow.id, uid],
        );
        if (aRow) attendees.push(attendeeRowToObject(aRow));
      }
    }

    let reminderOffset: number | null = null;
    if (input.reminderOffsetMinutes !== null && input.reminderOffsetMinutes !== undefined) {
      await execute(
        `INSERT INTO calendar_event_reminders (event_id, remind_offset_minutes)
         VALUES ($1, $2)`,
        [masterRow.id, input.reminderOffsetMinutes],
      );
      reminderOffset = input.reminderOffsetMinutes;
    }

    // 繰り返し展開: マスター（先頭インスタンス）以外を子として INSERT
    if (recurrence) {
      for (let i = 1; i < instances.length; i++) {
        const inst = instances[i];
        await execute(
          `INSERT INTO calendar_events (channel_id, title, description, location, meeting_url, starts_at, ends_at, organizer_id,
                                        recurrence_master_id)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
          [
            input.channelId,
            input.title,
            input.description ?? null,
            input.location ?? null,
            input.meetingUrl ?? null,
            inst.startsAt,
            inst.endsAt,
            organizerId,
            masterRow.id,
          ],
        );
      }
    }

    return rowToEvent(masterRow, attendees, reminderOffset);
  });
}

/**
 * 単一行に対する UPDATE 句を組み立てて実行する。
 * #302 編集スコープに応じて updateEvent から複数回呼ぶ。
 */
async function applyEventFieldUpdate(
  eventId: number,
  input: UpdateCalendarEventInput,
): Promise<EventRow | null> {
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
  if (input.meetingUrl !== undefined) {
    sets.push(`meeting_url = $${idx++}`);
    values.push(input.meetingUrl);
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
  return queryOne<EventRow>(
    `UPDATE calendar_events SET ${sets.join(', ')} WHERE id = $${idx} RETURNING *`,
    values,
  );
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

  const scope: RecurrenceEditScope = input.scope ?? 'one';
  if (!VALID_EDIT_SCOPES.includes(scope)) {
    throw createError('編集スコープが不正です', 400);
  }

  const nextStartsAt = input.startsAt ?? toIso(existing.starts_at);
  const nextEndsAt = input.endsAt ?? toIso(existing.ends_at);
  validateTimeOrder(nextStartsAt, nextEndsAt);

  // スコープ計算: 「単発」(recurrence_master_id も recurrence_rule もない) では scope を実質無視して 'one' 相当
  const isStandalone = existing.recurrence_master_id === null && existing.recurrence_rule === null;

  return withTransaction(async () => {
    if (isStandalone || scope === 'one') {
      const updated = await applyEventFieldUpdate(eventId, input);
      if (!updated) throw createError('Event not found', 404);
      const attendees = await loadAttendees(eventId);
      const reminderOffset = await loadReminderOffset(eventId);
      return rowToEvent(updated, attendees, reminderOffset);
    }

    // 'all' / 'following' は親（マスター）+ 子イベントを束ねて更新する。
    const masterId = existing.recurrence_master_id ?? existing.id;

    if (scope === 'all') {
      // マスターと全子イベントを更新（startsAt/endsAt は時刻のみ反映、日付の差分は維持しないシンプル方式）
      // ここでは title/description/location のみ全件更新する。
      // startsAt/endsAt が指定されていた場合、対象レコード自身のみ反映する（複雑な再計算は避ける）。
      const nonTimeInput: UpdateCalendarEventInput = {
        title: input.title,
        description: input.description,
        location: input.location,
      };
      const ids = await query<{ id: number }>(
        `SELECT id FROM calendar_events WHERE id = $1 OR recurrence_master_id = $1 ORDER BY starts_at ASC`,
        [masterId],
      );
      for (const r of ids) {
        await applyEventFieldUpdate(r.id, nonTimeInput);
      }
      // 対象レコード自体の時刻は反映する
      if (input.startsAt !== undefined || input.endsAt !== undefined) {
        await applyEventFieldUpdate(eventId, {
          startsAt: input.startsAt,
          endsAt: input.endsAt,
        });
      }
    } else {
      // 'following': 対象レコード以降（startsAt 以降）を更新
      const targetStartsAt = toIso(existing.starts_at);
      const nonTimeInput: UpdateCalendarEventInput = {
        title: input.title,
        description: input.description,
        location: input.location,
      };
      const ids = await query<{ id: number }>(
        `SELECT id FROM calendar_events
         WHERE (id = $1 OR recurrence_master_id = $1)
           AND starts_at >= $2
         ORDER BY starts_at ASC`,
        [masterId, targetStartsAt],
      );
      for (const r of ids) {
        await applyEventFieldUpdate(r.id, nonTimeInput);
      }
      if (input.startsAt !== undefined || input.endsAt !== undefined) {
        await applyEventFieldUpdate(eventId, {
          startsAt: input.startsAt,
          endsAt: input.endsAt,
        });
      }
    }

    const refreshed = await queryOne<EventRow>('SELECT * FROM calendar_events WHERE id = $1', [
      eventId,
    ]);
    if (!refreshed) throw createError('Event not found', 404);
    const attendees = await loadAttendees(eventId);
    const reminderOffset = await loadReminderOffset(eventId);
    return rowToEvent(refreshed, attendees, reminderOffset);
  });
}

export async function deleteEvent(
  userId: number,
  eventId: number,
  options: { scope?: RecurrenceEditScope } = {},
): Promise<void> {
  const existing = await queryOne<EventRow>('SELECT * FROM calendar_events WHERE id = $1', [
    eventId,
  ]);
  if (!existing) throw createError('Event not found', 404);
  if (existing.organizer_id !== userId) throw createError('Forbidden', 403);

  const scope: RecurrenceEditScope = options.scope ?? 'one';
  if (!VALID_EDIT_SCOPES.includes(scope)) {
    throw createError('削除スコープが不正です', 400);
  }

  const isStandalone = existing.recurrence_master_id === null && existing.recurrence_rule === null;
  if (isStandalone || scope === 'one') {
    await execute('DELETE FROM calendar_events WHERE id = $1', [eventId]);
    return;
  }

  const masterId = existing.recurrence_master_id ?? existing.id;
  if (scope === 'all') {
    // 子イベントを先に削除してからマスターを削除する
    // （PostgreSQL の自己参照 FK は ON DELETE CASCADE 設定済みだが、テスト用 pg-mem では自己参照 CASCADE が効かないため明示削除）
    await execute('DELETE FROM calendar_events WHERE recurrence_master_id = $1', [masterId]);
    await execute('DELETE FROM calendar_events WHERE id = $1', [masterId]);
    return;
  }

  // following: 当該レコード以降を削除
  const targetStartsAt = toIso(existing.starts_at);
  await execute(
    `DELETE FROM calendar_events
     WHERE (id = $1 OR recurrence_master_id = $1)
       AND starts_at >= $2`,
    [masterId, targetStartsAt],
  );
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

// ===== Phase B: RSVP =====

export async function setRsvp(
  userId: number,
  eventId: number,
  status: CalendarRsvpStatus,
): Promise<CalendarEventAttendee> {
  if (!VALID_RSVP_STATUSES.includes(status)) {
    throw createError('Invalid RSVP status', 400);
  }
  const event = await queryOne<EventRow>('SELECT id FROM calendar_events WHERE id = $1', [eventId]);
  if (!event) throw createError('Event not found', 404);

  const row = await queryOne<AttendeeRow>(
    `INSERT INTO calendar_event_attendees (event_id, user_id, status, responded_at)
     VALUES ($1, $2, $3, NOW())
     ON CONFLICT (event_id, user_id)
     DO UPDATE SET status = EXCLUDED.status, responded_at = NOW()
     RETURNING *`,
    [eventId, userId, status],
  );
  if (!row) throw createError('Failed to upsert RSVP', 500);
  return attendeeRowToObject(row);
}

// ===== Phase C: 日程調整（Poll） =====

interface PollRow {
  id: number;
  channel_id: number;
  title: string;
  organizer_id: number;
  deadline: string | Date | null;
  confirmed_event_id: number | null;
  created_at: string | Date;
}

interface CandidateRow {
  id: number;
  poll_id: number;
  starts_at: string | Date;
  ends_at: string | Date;
}

interface VoteRow {
  candidate_id: number;
  user_id: number;
  vote: string;
  voted_at: string | Date;
}

function candidateRowToObject(row: CandidateRow): CalendarPollCandidate {
  return {
    id: row.id,
    pollId: row.poll_id,
    startsAt: toIso(row.starts_at),
    endsAt: toIso(row.ends_at),
  };
}

function voteRowToObject(row: VoteRow): CalendarPollVote {
  return {
    candidateId: row.candidate_id,
    userId: row.user_id,
    vote: row.vote as CalendarVoteValue,
    votedAt: toIso(row.voted_at),
  };
}

function pollRowToObject(
  row: PollRow,
  candidates: CalendarPollCandidate[],
  votes: CalendarPollVote[],
): CalendarPoll {
  return {
    id: row.id,
    channelId: row.channel_id,
    title: row.title,
    organizerId: row.organizer_id,
    deadline: row.deadline ? toIso(row.deadline) : null,
    confirmedEventId: row.confirmed_event_id,
    createdAt: toIso(row.created_at),
    candidates,
    votes,
  };
}

async function loadPollChildren(
  pollId: number,
): Promise<{ candidates: CalendarPollCandidate[]; votes: CalendarPollVote[] }> {
  const candidates = await query<CandidateRow>(
    'SELECT * FROM calendar_poll_candidates WHERE poll_id = $1 ORDER BY starts_at ASC, id ASC',
    [pollId],
  );
  const candidateIds = candidates.map((c) => c.id);
  let votes: VoteRow[] = [];
  if (candidateIds.length > 0) {
    const placeholders = candidateIds.map((_, i) => `$${i + 1}`).join(', ');
    votes = await query<VoteRow>(
      `SELECT * FROM calendar_poll_votes WHERE candidate_id IN (${placeholders})`,
      candidateIds,
    );
  }
  return {
    candidates: candidates.map(candidateRowToObject),
    votes: votes.map(voteRowToObject),
  };
}

export async function createPoll(
  organizerId: number,
  input: CreateCalendarPollInput,
): Promise<CalendarPoll> {
  if (!input.title || input.title.trim() === '') {
    throw createError('タイトルを入力してください', 400);
  }
  if (!input.candidates || input.candidates.length === 0) {
    throw createError('候補日を 1 件以上指定してください', 400);
  }
  for (const c of input.candidates) {
    validateTimeOrder(c.startsAt, c.endsAt);
  }

  return withTransaction(async () => {
    const pollRow = await queryOne<PollRow>(
      `INSERT INTO calendar_polls (channel_id, title, organizer_id, deadline)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [input.channelId, input.title, organizerId, input.deadline ?? null],
    );
    if (!pollRow) throw createError('Poll の作成に失敗しました', 500);

    const candidates: CalendarPollCandidate[] = [];
    for (const c of input.candidates) {
      const cRow = await queryOne<CandidateRow>(
        `INSERT INTO calendar_poll_candidates (poll_id, starts_at, ends_at)
         VALUES ($1, $2, $3)
         RETURNING *`,
        [pollRow.id, c.startsAt, c.endsAt],
      );
      if (cRow) candidates.push(candidateRowToObject(cRow));
    }

    return pollRowToObject(pollRow, candidates, []);
  });
}

export async function getPollWithVotes(pollId: number): Promise<CalendarPoll | null> {
  const row = await queryOne<PollRow>('SELECT * FROM calendar_polls WHERE id = $1', [pollId]);
  if (!row) return null;
  const { candidates, votes } = await loadPollChildren(pollId);
  return pollRowToObject(row, candidates, votes);
}

export async function listPollsByChannel(channelId: number): Promise<CalendarPoll[]> {
  const rows = await query<PollRow>(
    'SELECT * FROM calendar_polls WHERE channel_id = $1 ORDER BY created_at DESC',
    [channelId],
  );
  if (rows.length === 0) return [];
  const result: CalendarPoll[] = [];
  for (const r of rows) {
    const { candidates, votes } = await loadPollChildren(r.id);
    result.push(pollRowToObject(r, candidates, votes));
  }
  return result;
}

export async function castVote(
  userId: number,
  pollId: number,
  votes: CastCalendarVoteInput[],
): Promise<CalendarPoll> {
  const poll = await queryOne<PollRow>('SELECT * FROM calendar_polls WHERE id = $1', [pollId]);
  if (!poll) throw createError('Poll not found', 404);
  if (poll.confirmed_event_id !== null) {
    throw createError('確定済みの日程調整には投票できません', 409);
  }

  // 投票値のバリデーション
  for (const v of votes) {
    if (v.vote !== null && !VALID_VOTE_VALUES.includes(v.vote)) {
      throw createError('Invalid vote value', 400);
    }
  }

  // 候補が当該 poll に属することを確認
  const candidateIds = votes.map((v) => v.candidateId);
  if (candidateIds.length > 0) {
    const placeholders = candidateIds.map((_, i) => `$${i + 2}`).join(', ');
    const validCands = await query<{ id: number }>(
      `SELECT id FROM calendar_poll_candidates WHERE poll_id = $1 AND id IN (${placeholders})`,
      [pollId, ...candidateIds],
    );
    if (validCands.length !== new Set(candidateIds).size) {
      throw createError('Invalid candidate', 400);
    }
  }

  await withTransaction(async () => {
    for (const v of votes) {
      if (v.vote === null) {
        await execute('DELETE FROM calendar_poll_votes WHERE candidate_id = $1 AND user_id = $2', [
          v.candidateId,
          userId,
        ]);
      } else {
        await execute(
          `INSERT INTO calendar_poll_votes (candidate_id, user_id, vote, voted_at)
           VALUES ($1, $2, $3, NOW())
           ON CONFLICT (candidate_id, user_id)
           DO UPDATE SET vote = EXCLUDED.vote, voted_at = NOW()`,
          [v.candidateId, userId, v.vote],
        );
      }
    }
  });

  const updated = await getPollWithVotes(pollId);
  if (!updated) throw createError('Poll not found after vote', 500);
  return updated;
}

export async function deletePoll(userId: number, pollId: number): Promise<void> {
  const poll = await queryOne<PollRow>('SELECT * FROM calendar_polls WHERE id = $1', [pollId]);
  if (!poll) throw createError('Poll not found', 404);
  if (poll.organizer_id !== userId) throw createError('Forbidden', 403);
  await execute('DELETE FROM calendar_polls WHERE id = $1', [pollId]);
}

export async function confirmPoll(
  userId: number,
  pollId: number,
  candidateId: number,
): Promise<CalendarEvent> {
  const poll = await queryOne<PollRow>('SELECT * FROM calendar_polls WHERE id = $1', [pollId]);
  if (!poll) throw createError('Poll not found', 404);
  if (poll.organizer_id !== userId) throw createError('Forbidden', 403);
  if (poll.confirmed_event_id !== null) {
    throw createError('既に確定済みの日程調整です', 409);
  }

  const candidate = await queryOne<CandidateRow>(
    'SELECT * FROM calendar_poll_candidates WHERE id = $1 AND poll_id = $2',
    [candidateId, pollId],
  );
  if (!candidate) throw createError('Invalid candidate', 400);

  return withTransaction(async () => {
    const eventRow = await queryOne<EventRow>(
      `INSERT INTO calendar_events (channel_id, title, starts_at, ends_at, organizer_id)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [
        poll.channel_id,
        poll.title,
        toIso(candidate.starts_at),
        toIso(candidate.ends_at),
        poll.organizer_id,
      ],
    );
    if (!eventRow) throw createError('Event 作成に失敗しました', 500);

    await execute('UPDATE calendar_polls SET confirmed_event_id = $1 WHERE id = $2', [
      eventRow.id,
      pollId,
    ]);

    return rowToEvent(eventRow, [], null);
  });
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
