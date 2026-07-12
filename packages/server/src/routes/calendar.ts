// Issue #152 — カレンダー / 予定調整 REST API
// /api/calendar/events 系: イベント CRUD + RSVP（Phase B）
// /api/calendar/polls  系: 日程調整 CRUD + 投票 + 確定（Phase C）

import { Router, NextFunction, Response } from 'express';
import { createError } from '../middleware/errorHandler';
import { authenticateToken, AuthenticatedRequest } from '../middleware/auth';
import * as calendarService from '../services/calendarService';
import { generateICalendar } from '../services/icalendarService';
import type {
  CreateCalendarEventInput,
  RecurrenceEditScope,
  UpdateCalendarEventInput,
} from '@chat-app/shared';

const VALID_EDIT_SCOPES: readonly RecurrenceEditScope[] = ['one', 'following', 'all'];

const router = Router();

function handleError(err: unknown, next: NextFunction): void {
  const e = err as { statusCode?: number; message?: string };
  const status = typeof e.statusCode === 'number' ? e.statusCode : 500;
  next(createError(e.message ?? 'Internal server error', status));
}

function parseChannelIdsParam(raw: unknown): number[] | undefined {
  if (raw === undefined) return undefined;
  if (typeof raw !== 'string') return undefined;
  if (raw === '') return [];
  const ids = raw
    .split(',')
    .map((s) => parseInt(s.trim(), 10))
    .filter((n) => !Number.isNaN(n));
  return ids;
}

function defaultMonthRange(): { from: string; to: string } {
  const now = new Date();
  const from = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0));
  const to = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0, 23, 59, 59));
  return { from: from.toISOString(), to: to.toISOString() };
}

// ===== Events =====

function sendCalendar(res: Response, content: string, filename: string) {
  res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  return res.status(200).send(content);
}

router.get('/events/export.ics', authenticateToken, async (req, res, next) => {
  const userId = (req as AuthenticatedRequest).userId;
  const from = typeof req.query.from === 'string' ? req.query.from : '';
  const to = typeof req.query.to === 'string' ? req.query.to : '';
  const channelIds = parseChannelIdsParam(req.query.channelIds);
  if (Number.isNaN(Date.parse(from)) || Number.isNaN(Date.parse(to)) || Date.parse(from) > Date.parse(to)) return next(createError('Invalid range', 400));
  try {
    const events = await calendarService.listExportableEvents(userId, { from, to, channelIds });
    return sendCalendar(res, generateICalendar({ events }), `calendar-${new Date(from).toISOString().slice(0, 10)}.ics`);
  } catch (err) { return handleError(err, next); }
});

router.get('/events/:id/export.ics', authenticateToken, async (req, res, next) => {
  const userId = (req as AuthenticatedRequest).userId;
  const eventId = parseInt(req.params.id, 10);
  if (Number.isNaN(eventId)) return next(createError('Invalid id', 400));
  try {
    const event = await calendarService.getExportableEvent(userId, eventId);
    if (!event) return next(createError('Event not found', 404));
    return sendCalendar(res, generateICalendar({ events: [event] }), `calendar-event-${event.id}.ics`);
  } catch (err) { return handleError(err, next); }
});

router.get('/events', authenticateToken, async (req, res, next) => {
  const fromQ = typeof req.query.from === 'string' ? req.query.from : undefined;
  const toQ = typeof req.query.to === 'string' ? req.query.to : undefined;
  const channelIds = parseChannelIdsParam(req.query.channelIds);

  const { from: defFrom, to: defTo } = defaultMonthRange();
  const from = fromQ ?? defFrom;
  const to = toQ ?? defTo;

  try {
    const events = await calendarService.listEventsInRange({ from, to, channelIds });
    return res.json({ events });
  } catch (err) {
    return handleError(err, next);
  }
});

router.post('/events', authenticateToken, async (req, res, next) => {
  const userId = (req as AuthenticatedRequest).userId;
  const body = req.body as Partial<CreateCalendarEventInput>;

  if (
    typeof body.title !== 'string' ||
    typeof body.startsAt !== 'string' ||
    typeof body.endsAt !== 'string'
  ) {
    return next(createError('Invalid input', 400));
  }
  // channelId は number または null のみ受け付け（undefined は不許可）
  if (body.channelId !== null && typeof body.channelId !== 'number') {
    return next(createError('Invalid channelId', 400));
  }

  try {
    const event = await calendarService.createEvent(userId, {
      channelId: body.channelId,
      title: body.title,
      description: body.description ?? null,
      location: body.location ?? null,
      meetingUrl: body.meetingUrl ?? null,
      startsAt: body.startsAt,
      endsAt: body.endsAt,
      attendeeUserIds: body.attendeeUserIds,
      reminderOffsetMinutes: body.reminderOffsetMinutes ?? null,
      recurrence: body.recurrence ?? null,
    });
    return res.status(201).json({ event });
  } catch (err) {
    return handleError(err, next);
  }
});

router.get('/events/:id', authenticateToken, async (req, res, next) => {
  const eventId = parseInt(req.params.id, 10);
  if (Number.isNaN(eventId)) return next(createError('Invalid id', 400));
  try {
    const event = await calendarService.getEventById(eventId);
    if (!event) return next(createError('Event not found', 404));
    return res.json({ event });
  } catch (err) {
    return handleError(err, next);
  }
});

router.patch('/events/:id', authenticateToken, async (req, res, next) => {
  const userId = (req as AuthenticatedRequest).userId;
  const eventId = parseInt(req.params.id, 10);
  if (Number.isNaN(eventId)) return next(createError('Invalid id', 400));

  const body = req.body as UpdateCalendarEventInput;
  if (body.scope !== undefined && !VALID_EDIT_SCOPES.includes(body.scope)) {
    return next(createError('Invalid scope', 400));
  }
  try {
    const event = await calendarService.updateEvent(userId, eventId, body);
    return res.json({ event });
  } catch (err) {
    return handleError(err, next);
  }
});

router.delete('/events/:id', authenticateToken, async (req, res, next) => {
  const userId = (req as AuthenticatedRequest).userId;
  const eventId = parseInt(req.params.id, 10);
  if (Number.isNaN(eventId)) return next(createError('Invalid id', 400));
  const scopeRaw = req.query.scope;
  let scope: RecurrenceEditScope | undefined;
  if (typeof scopeRaw === 'string') {
    if (!VALID_EDIT_SCOPES.includes(scopeRaw as RecurrenceEditScope)) {
      return next(createError('Invalid scope', 400));
    }
    scope = scopeRaw as RecurrenceEditScope;
  }
  try {
    await calendarService.deleteEvent(userId, eventId, { scope });
    return res.status(204).send();
  } catch (err) {
    return handleError(err, next);
  }
});

// ===== RSVP =====

router.post('/events/:id/rsvp', authenticateToken, async (req, res, next) => {
  const userId = (req as AuthenticatedRequest).userId;
  const eventId = parseInt(req.params.id, 10);
  if (Number.isNaN(eventId)) return next(createError('Invalid id', 400));

  const status = (req.body as { status?: unknown }).status;
  if (typeof status !== 'string') {
    return next(createError('Invalid status', 400));
  }
  try {
    const attendee = await calendarService.setRsvp(userId, eventId, status as never);
    return res.json({ attendee });
  } catch (err) {
    return handleError(err, next);
  }
});

// ===== Polls =====

router.get('/polls', authenticateToken, async (req, res, next) => {
  const channelIdRaw = req.query.channelId;
  if (typeof channelIdRaw !== 'string') {
    return next(createError('channelId is required', 400));
  }
  const channelId = parseInt(channelIdRaw, 10);
  if (Number.isNaN(channelId)) return next(createError('Invalid channelId', 400));
  try {
    const polls = await calendarService.listPollsByChannel(channelId);
    return res.json({ polls });
  } catch (err) {
    return handleError(err, next);
  }
});

router.post('/polls', authenticateToken, async (req, res, next) => {
  const userId = (req as AuthenticatedRequest).userId;
  const body = req.body as {
    channelId?: unknown;
    title?: unknown;
    deadline?: unknown;
    candidates?: unknown;
  };

  if (typeof body.channelId !== 'number' || typeof body.title !== 'string') {
    return next(createError('Invalid input', 400));
  }
  if (!Array.isArray(body.candidates)) {
    return next(createError('candidates must be an array', 400));
  }
  const candidates = body.candidates as { startsAt?: unknown; endsAt?: unknown }[];
  for (const c of candidates) {
    if (typeof c.startsAt !== 'string' || typeof c.endsAt !== 'string') {
      return next(createError('Invalid candidate', 400));
    }
  }

  try {
    const poll = await calendarService.createPoll(userId, {
      channelId: body.channelId,
      title: body.title,
      deadline: typeof body.deadline === 'string' ? body.deadline : null,
      candidates: candidates as { startsAt: string; endsAt: string }[],
    });
    return res.status(201).json({ poll });
  } catch (err) {
    return handleError(err, next);
  }
});

router.get('/polls/:id', authenticateToken, async (req, res, next) => {
  const pollId = parseInt(req.params.id, 10);
  if (Number.isNaN(pollId)) return next(createError('Invalid id', 400));
  try {
    const poll = await calendarService.getPollWithVotes(pollId);
    if (!poll) return next(createError('Poll not found', 404));
    return res.json({ poll });
  } catch (err) {
    return handleError(err, next);
  }
});

router.delete('/polls/:id', authenticateToken, async (req, res, next) => {
  const userId = (req as AuthenticatedRequest).userId;
  const pollId = parseInt(req.params.id, 10);
  if (Number.isNaN(pollId)) return next(createError('Invalid id', 400));
  try {
    await calendarService.deletePoll(userId, pollId);
    return res.status(204).send();
  } catch (err) {
    return handleError(err, next);
  }
});

router.post('/polls/:id/votes', authenticateToken, async (req, res, next) => {
  const userId = (req as AuthenticatedRequest).userId;
  const pollId = parseInt(req.params.id, 10);
  if (Number.isNaN(pollId)) return next(createError('Invalid id', 400));
  const body = req.body as { votes?: unknown };
  if (!Array.isArray(body.votes)) {
    return next(createError('votes must be an array', 400));
  }
  try {
    const poll = await calendarService.castVote(userId, pollId, body.votes as never);
    return res.json({ poll });
  } catch (err) {
    return handleError(err, next);
  }
});

router.post('/polls/:id/confirm', authenticateToken, async (req, res, next) => {
  const userId = (req as AuthenticatedRequest).userId;
  const pollId = parseInt(req.params.id, 10);
  if (Number.isNaN(pollId)) return next(createError('Invalid id', 400));
  const candidateId = (req.body as { candidateId?: unknown }).candidateId;
  if (typeof candidateId !== 'number') {
    return next(createError('candidateId is required', 400));
  }
  try {
    const event = await calendarService.confirmPoll(userId, pollId, candidateId);
    return res.json({ event });
  } catch (err) {
    return handleError(err, next);
  }
});

export default router;
