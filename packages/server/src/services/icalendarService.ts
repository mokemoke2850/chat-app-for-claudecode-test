import type { CalendarEvent } from '@chat-app/shared';

export interface GenerateICalendarOptions {
  events: CalendarEvent[];
  generatedAt?: Date;
}

const WEEKDAYS = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'];

function utc(value: string | Date): string {
  return new Date(value).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
}

function escapeText(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/\r?\n/g, '\\n').replace(/,/g, '\\,').replace(/;/g, '\\;');
}

function foldLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let limit = 75;
  for (const char of line) {
    if (Buffer.byteLength(current + char, 'utf8') > limit) {
      result.push(current);
      current = ` ${char}`;
      limit = 75;
    } else {
      current += char;
    }
  }
  result.push(current);
  return result;
}

function recurrenceLine(event: CalendarEvent): string | null {
  if (!event.recurrenceRule) return null;
  const parts = [`FREQ=${event.recurrenceRule}`, `INTERVAL=${event.recurrenceInterval || 1}`];
  if (event.recurrenceRule === 'WEEKLY' && event.recurrenceDaysOfWeek?.length) {
    parts.push(`BYDAY=${event.recurrenceDaysOfWeek.map((day) => WEEKDAYS[day]).join(',')}`);
  }
  if (event.recurrenceCount !== null) parts.push(`COUNT=${event.recurrenceCount}`);
  else if (event.recurrenceEndDate) parts.push(`UNTIL=${utc(event.recurrenceEndDate)}`);
  return `RRULE:${parts.join(';')}`;
}

export function generateICalendar(options: GenerateICalendarOptions): string {
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Chat App//Calendar Export//JA', 'CALSCALE:GREGORIAN'];
  const emittedIds = new Set<number>();
  for (const event of options.events) {
    if (event.recurrenceMasterId !== null || emittedIds.has(event.id)) continue;
    emittedIds.add(event.id);
    lines.push('BEGIN:VEVENT', `UID:calendar-event-${event.id}@chat-app`, `DTSTAMP:${utc(options.generatedAt ?? new Date())}`,
      `DTSTART:${utc(event.startsAt)}`, `DTEND:${utc(event.endsAt)}`, `SUMMARY:${escapeText(event.title)}`);
    if (event.description) lines.push(`DESCRIPTION:${escapeText(event.description)}`);
    if (event.location) lines.push(`LOCATION:${escapeText(event.location)}`);
    if (event.meetingUrl) lines.push(`URL:${event.meetingUrl}`);
    const rrule = recurrenceLine(event);
    if (rrule) lines.push(rrule);
    lines.push('END:VEVENT');
  }
  lines.push('END:VCALENDAR');
  return `${lines.flatMap(foldLine).join('\r\n')}\r\n`;
}
