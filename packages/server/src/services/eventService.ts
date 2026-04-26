// #108 会話イベント投稿
// イベント（events）と RSVP（event_rsvps）を扱うサービス層。
// イベント本体は messages の特殊形として扱い、ChatEvent は messages.id に 1:1 で紐付く。

import { query, queryOne, execute } from '../db/database';
import { createError } from '../middleware/errorHandler';
import { canPost } from './channelService';
import type {
  ChatEvent,
  CreateEventInput,
  RsvpCounts,
  RsvpStatus,
  RsvpUser,
  UpdateEventInput,
} from '@chat-app/shared';

const VALID_RSVP_STATUSES: readonly RsvpStatus[] = ['going', 'not_going', 'maybe'];

interface EventRow {
  id: number;
  message_id: number;
  title: string;
  description: string | null;
  starts_at: string;
  ends_at: string | null;
  created_by: number | null;
  created_at: string;
  updated_at: string;
}

interface RsvpCountRow {
  event_id: number;
  status: RsvpStatus;
  cnt: string;
}

/** イベント本体行に集計（rsvpCounts / myRsvp）を載せて返す */
async function withCounts(row: EventRow, viewerUserId?: number): Promise<ChatEvent> {
  const counts = await getRsvpCountsForEvents([row.id]);
  const myRsvp = viewerUserId !== undefined ? await getMyRsvpStatus(row.id, viewerUserId) : null;
  return rowToChatEvent(row, counts.get(row.id) ?? emptyCounts(), myRsvp);
}

function rowToChatEvent(row: EventRow, counts: RsvpCounts, myRsvp: RsvpStatus | null): ChatEvent {
  return {
    id: row.id,
    messageId: row.message_id,
    title: row.title,
    description: row.description,
    startsAt: row.starts_at,
    endsAt: row.ends_at,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    rsvpCounts: counts,
    myRsvp,
  };
}

function emptyCounts(): RsvpCounts {
  return { going: 0, notGoing: 0, maybe: 0 };
}

function validateDateRange(startsAt: string, endsAt: string | null | undefined): void {
  const start = new Date(startsAt);
  if (Number.isNaN(start.getTime())) {
    throw createError('開始日時が不正です', 400);
  }
  if (endsAt !== null && endsAt !== undefined) {
    const end = new Date(endsAt);
    if (Number.isNaN(end.getTime())) {
      throw createError('終了日時が不正です', 400);
    }
    if (end.getTime() <= start.getTime()) {
      throw createError('終了日時は開始日時より後である必要があります', 400);
    }
  }
}

/** メッセージとイベントを 1 トランザクション相当で作成する */
export async function create(userId: number, input: CreateEventInput): Promise<ChatEvent> {
  const title = input.title?.trim();
  if (!title) {
    throw createError('タイトルを入力してください', 400);
  }
  validateDateRange(input.startsAt, input.endsAt ?? null);

  // チャンネル存在確認 + 投稿権限チェック
  const channel = await queryOne<{ id: number }>('SELECT id FROM channels WHERE id = $1', [
    input.channelId,
  ]);
  if (!channel) throw createError('Channel not found', 404);
  if (!(await canPost(userId, input.channelId))) {
    throw createError('Posting is not allowed in this channel', 403);
  }

  // 1) プレースホルダーメッセージを作成（本文はクライアントが描画用に上書き可能）
  const placeholder = `[event] ${title}`;
  const inserted = await queryOne<{ id: number }>(
    'INSERT INTO messages (channel_id, user_id, content) VALUES ($1, $2, $3) RETURNING id',
    [input.channelId, userId, placeholder],
  );
  const messageId = inserted!.id;

  // 2) events 行を作成
  const eventRow = await queryOne<EventRow>(
    `INSERT INTO events (message_id, title, description, starts_at, ends_at, created_by)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING id, message_id, title, description, starts_at, ends_at, created_by, created_at, updated_at`,
    [messageId, title, input.description ?? null, input.startsAt, input.endsAt ?? null, userId],
  );

  return rowToChatEvent(eventRow!, emptyCounts(), null);
}

export async function update(
  userId: number,
  eventId: number,
  input: UpdateEventInput,
): Promise<ChatEvent> {
  const existing = await queryOne<EventRow>(
    `SELECT id, message_id, title, description, starts_at, ends_at, created_by, created_at, updated_at
     FROM events WHERE id = $1`,
    [eventId],
  );
  if (!existing) throw createError('Event not found', 404);
  if (existing.created_by !== userId) {
    throw createError('Forbidden', 403);
  }

  const nextStartsAt = input.startsAt ?? existing.starts_at;
  const nextEndsAt = input.endsAt === undefined ? existing.ends_at : input.endsAt;
  validateDateRange(nextStartsAt, nextEndsAt);

  const nextTitle = input.title === undefined ? existing.title : input.title.trim();
  if (!nextTitle) {
    throw createError('タイトルを入力してください', 400);
  }
  const nextDescription =
    input.description === undefined ? existing.description : input.description;

  const updated = await queryOne<EventRow>(
    `UPDATE events
       SET title = $1, description = $2, starts_at = $3, ends_at = $4, updated_at = NOW()
     WHERE id = $5
     RETURNING id, message_id, title, description, starts_at, ends_at, created_by, created_at, updated_at`,
    [nextTitle, nextDescription, nextStartsAt, nextEndsAt, eventId],
  );

  return withCounts(updated!, userId);
}

export async function deleteEvent(userId: number, eventId: number): Promise<number> {
  const existing = await queryOne<{ id: number; message_id: number; created_by: number | null }>(
    'SELECT id, message_id, created_by FROM events WHERE id = $1',
    [eventId],
  );
  if (!existing) throw createError('Event not found', 404);
  if (existing.created_by !== userId) {
    throw createError('Forbidden', 403);
  }

  // メッセージ削除で events / event_rsvps が CASCADE 削除される
  await execute('DELETE FROM messages WHERE id = $1', [existing.message_id]);
  return existing.message_id;
}

export async function setRsvp(
  userId: number,
  eventId: number,
  status: RsvpStatus,
): Promise<{ event: ChatEvent; channelId: number; messageId: number }> {
  if (!VALID_RSVP_STATUSES.includes(status)) {
    throw createError('Invalid RSVP status', 400);
  }

  const event = await queryOne<EventRow & { channel_id: number }>(
    `SELECT e.id, e.message_id, e.title, e.description, e.starts_at, e.ends_at,
            e.created_by, e.created_at, e.updated_at, m.channel_id
       FROM events e
       JOIN messages m ON m.id = e.message_id
      WHERE e.id = $1`,
    [eventId],
  );
  if (!event) throw createError('Event not found', 404);

  // UPSERT（PG 標準の ON CONFLICT を pg-mem も支持）
  await execute(
    `INSERT INTO event_rsvps (event_id, user_id, status, updated_at)
     VALUES ($1, $2, $3, NOW())
     ON CONFLICT (event_id, user_id)
     DO UPDATE SET status = EXCLUDED.status, updated_at = NOW()`,
    [eventId, userId, status],
  );

  const refreshed = await withCounts(event, userId);
  return { event: refreshed, channelId: event.channel_id, messageId: event.message_id };
}

/** event_rsvps から現在の集計を bulk fetch する */
export async function getRsvpCountsForEvents(eventIds: number[]): Promise<Map<number, RsvpCounts>> {
  const result = new Map<number, RsvpCounts>();
  if (eventIds.length === 0) return result;
  const placeholders = eventIds.map((_, i) => `$${i + 1}`).join(',');
  const rows = await query<RsvpCountRow>(
    `SELECT event_id, status, COUNT(*) AS cnt
       FROM event_rsvps
      WHERE event_id IN (${placeholders})
      GROUP BY event_id, status`,
    eventIds,
  );

  for (const row of rows) {
    const current = result.get(row.event_id) ?? emptyCounts();
    const cnt = Number(row.cnt);
    if (row.status === 'going') current.going = cnt;
    else if (row.status === 'not_going') current.notGoing = cnt;
    else if (row.status === 'maybe') current.maybe = cnt;
    result.set(row.event_id, current);
  }

  // eventIds に存在するが集計が無いものは 0 で埋める
  for (const id of eventIds) {
    if (!result.has(id)) result.set(id, emptyCounts());
  }
  return result;
}

export async function getMyRsvpStatus(eventId: number, userId: number): Promise<RsvpStatus | null> {
  const row = await queryOne<{ status: RsvpStatus }>(
    'SELECT status FROM event_rsvps WHERE event_id = $1 AND user_id = $2',
    [eventId, userId],
  );
  return row?.status ?? null;
}

/** 単一メッセージから ChatEvent を取得 */
export async function getByMessageId(
  messageId: number,
  viewerUserId?: number,
): Promise<ChatEvent | null> {
  const row = await queryOne<EventRow>(
    `SELECT id, message_id, title, description, starts_at, ends_at, created_by, created_at, updated_at
       FROM events WHERE message_id = $1`,
    [messageId],
  );
  if (!row) return null;
  return withCounts(row, viewerUserId);
}

/** 複数メッセージから紐づく ChatEvent を bulk fetch（n+1 回避） */
export async function getByMessageIds(
  messageIds: number[],
  viewerUserId?: number,
): Promise<Map<number, ChatEvent>> {
  const result = new Map<number, ChatEvent>();
  if (messageIds.length === 0) return result;

  const placeholders = messageIds.map((_, i) => `$${i + 1}`).join(',');
  const rows = await query<EventRow>(
    `SELECT id, message_id, title, description, starts_at, ends_at, created_by, created_at, updated_at
       FROM events WHERE message_id IN (${placeholders})`,
    messageIds,
  );

  if (rows.length === 0) return result;

  const eventIds = rows.map((r) => r.id);
  const counts = await getRsvpCountsForEvents(eventIds);

  // viewer の RSVP は 1 クエリで bulk fetch
  let myRsvpMap = new Map<number, RsvpStatus>();
  if (viewerUserId !== undefined && eventIds.length > 0) {
    const ePlaceholders = eventIds.map((_, i) => `$${i + 2}`).join(',');
    const myRows = await query<{ event_id: number; status: RsvpStatus }>(
      `SELECT event_id, status FROM event_rsvps
        WHERE user_id = $1 AND event_id IN (${ePlaceholders})`,
      [viewerUserId, ...eventIds],
    );
    myRsvpMap = new Map(myRows.map((r) => [r.event_id, r.status]));
  }

  for (const row of rows) {
    result.set(
      row.message_id,
      rowToChatEvent(row, counts.get(row.id) ?? emptyCounts(), myRsvpMap.get(row.id) ?? null),
    );
  }
  return result;
}

export async function getRsvpUsers(eventId: number): Promise<RsvpUser[]> {
  const exists = await queryOne('SELECT id FROM events WHERE id = $1', [eventId]);
  if (!exists) throw createError('Event not found', 404);

  const rows = await query<{
    user_id: number;
    username: string;
    display_name: string | null;
    avatar_url: string | null;
    status: RsvpStatus;
    updated_at: string;
  }>(
    `SELECT er.user_id, u.username, u.display_name, u.avatar_url, er.status, er.updated_at
       FROM event_rsvps er
       JOIN users u ON u.id = er.user_id
      WHERE er.event_id = $1
      ORDER BY er.updated_at ASC`,
    [eventId],
  );

  return rows.map((r) => ({
    userId: r.user_id,
    username: r.username,
    displayName: r.display_name,
    avatarUrl: r.avatar_url,
    status: r.status,
    updatedAt: r.updated_at,
  }));
}
