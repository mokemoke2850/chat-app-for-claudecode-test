/**
 * テスト対象: services/icalendarService.ts — RFC 5545 iCalendar 生成（Issue #419）
 *
 * 戦略:
 *  - DB や HTTP から独立した文字列生成として、必須プロパティ・エスケープ・改行を検証する
 *  - 繰り返し予定は展開済みの子予定ではなく RRULE を持つ一系列として検証する
 */

import type { CalendarEvent } from '@chat-app/shared';
import { generateICalendar } from '../services/icalendarService';

function makeEvent(overrides: Partial<CalendarEvent> = {}): CalendarEvent {
  return {
    id: 42, channelId: null, title: '定例会議', description: '議題', location: '会議室A',
    meetingUrl: 'https://meet.example.com/abc', startsAt: '2030-06-01T10:00:00.000Z',
    endsAt: '2030-06-01T11:00:00.000Z', organizerId: 7,
    createdAt: '2030-05-01T00:00:00.000Z', updatedAt: '2030-05-02T00:00:00.000Z',
    attendees: [], reminderOffsetMinutes: null, recurrenceRule: null, recurrenceInterval: 1,
    recurrenceDaysOfWeek: null, recurrenceEndDate: null, recurrenceCount: null,
    recurrenceMasterId: null, ...overrides,
  };
}

const generate = (events: CalendarEvent[]) =>
  generateICalendar({ events, generatedAt: new Date('2030-05-03T04:05:06.000Z') });

describe('iCalendar 生成', () => {
  it('VCALENDAR の VERSION・PRODID・CALSCALE と VEVENT の安定した UID・DTSTAMP を含む完全なカレンダーを出力する', () => {
    const first = generate([makeEvent()]);
    const second = generate([makeEvent()]);
    expect(first).toContain('BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:-//Chat App//Calendar Export//JA\r\nCALSCALE:GREGORIAN\r\n');
    expect(first).toContain('UID:calendar-event-42@chat-app\r\nDTSTAMP:20300503T040506Z\r\n');
    expect(first).toMatch(/BEGIN:VEVENT\r\n[\s\S]*END:VEVENT\r\nEND:VCALENDAR\r\n$/);
    expect(second).toContain('UID:calendar-event-42@chat-app');
    expect(generate([makeEvent({ id: 43 })])).toContain('UID:calendar-event-43@chat-app');
  });

  it('単一予定のタイトル・UTC Z 表現の開始終了日時・説明・場所・会議リンクの URL を VEVENT として出力する', () => {
    const ics = generate([makeEvent()]);
    expect(ics).toContain('DTSTART:20300601T100000Z\r\nDTEND:20300601T110000Z\r\n');
    expect(ics).toContain('SUMMARY:定例会議\r\nDESCRIPTION:議題\r\nLOCATION:会議室A\r\nURL:https://meet.example.com/abc\r\n');
  });

  it('改行・カンマ・セミコロン・バックスラッシュを RFC 5545 に従ってエスケープし CRLF で出力する', () => {
    const ics = generate([makeEvent({ title: 'A,B;C\\D\nE', description: '一行\r\n二行' })]);
    expect(ics).toContain('SUMMARY:A\\,B\\;C\\\\D\\nE\r\n');
    expect(ics).toContain('DESCRIPTION:一行\\n二行\r\n');
    expect(ics.replace(/\r\n/g, '')).not.toContain('\n');
  });

  it('長いコンテンツ行を UTF-8 の途中で壊さず 75 octet 以下に折り返す', () => {
    const ics = generate([makeEvent({ title: '予定'.repeat(50) })]);
    const physicalLines = ics.split('\r\n').filter(Boolean);
    expect(physicalLines.every((line) => Buffer.byteLength(line, 'utf8') <= 75)).toBe(true);
    const unfolded = ics.replace(/\r\n[ \t]/g, '');
    expect(unfolded).toContain(`SUMMARY:${'予定'.repeat(50)}\r\n`);
  });

  it('DAILY・WEEKLY・MONTHLY・YEARLY を RRULE の各 FREQ として出力する', () => {
    for (const recurrenceRule of ['DAILY', 'WEEKLY', 'MONTHLY', 'YEARLY'] as const) {
      expect(generate([makeEvent({ recurrenceRule, recurrenceCount: 2 })])).toContain(`RRULE:FREQ=${recurrenceRule}`);
    }
  });

  it('毎週の曜日・間隔・回数を RRULE の BYDAY・INTERVAL・COUNT として出力し UNTIL を併記しない', () => {
    const line = generate([makeEvent({ recurrenceRule: 'WEEKLY', recurrenceInterval: 2, recurrenceDaysOfWeek: [1, 3], recurrenceCount: 5 })])
      .split('\r\n').find((value) => value.startsWith('RRULE:'));
    expect(line).toBe('RRULE:FREQ=WEEKLY;INTERVAL=2;BYDAY=MO,WE;COUNT=5');
    expect(line).not.toContain('UNTIL');
  });

  it('終了日を持つ繰り返し予定を RRULE の UTC UNTIL として出力し COUNT を併記しない', () => {
    const line = generate([makeEvent({ recurrenceRule: 'DAILY', recurrenceEndDate: '2030-06-05T23:59:59.000Z' })])
      .split('\r\n').find((value) => value.startsWith('RRULE:'));
    expect(line).toBe('RRULE:FREQ=DAILY;INTERVAL=1;UNTIL=20300605T235959Z');
    expect(line).not.toContain('COUNT');
  });

  it('同じ繰り返し系列の展開済み予定を重複する VEVENT として出力しない', () => {
    const master = makeEvent({ recurrenceRule: 'DAILY', recurrenceCount: 2 });
    const child = makeEvent({ id: 43, startsAt: '2030-06-02T10:00:00.000Z', endsAt: '2030-06-02T11:00:00.000Z', recurrenceMasterId: 42 });
    expect(generate([master, child]).match(/BEGIN:VEVENT/g)).toHaveLength(1);
  });
});
