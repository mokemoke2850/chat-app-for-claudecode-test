import type { CalendarEvent } from '@chat-app/shared';

/**
 * テスト共通フィクスチャ: CalendarEvent ファクトリ
 * startsAt のみ指定すれば endsAt は +1 時間で補完される（overrides で上書き可）。
 */
export function makeEvent(overrides: Partial<CalendarEvent> = {}): CalendarEvent {
  const startsAt = overrides.startsAt ?? '2026-05-01T10:00:00Z';
  const endsAt =
    overrides.endsAt ?? new Date(new Date(startsAt).getTime() + 60 * 60 * 1000).toISOString();
  return {
    id: 1,
    channelId: 1,
    title: 'イベント',
    description: null,
    location: null,
    meetingUrl: null,
    startsAt,
    endsAt,
    organizerId: 1,
    createdAt: '2026-04-30T00:00:00Z',
    updatedAt: '2026-04-30T00:00:00Z',
    attendees: [],
    reminderOffsetMinutes: null,
    recurrenceRule: null,
    recurrenceInterval: 1,
    recurrenceDaysOfWeek: null,
    recurrenceEndDate: null,
    recurrenceCount: null,
    recurrenceMasterId: null,
    ...overrides,
  };
}
