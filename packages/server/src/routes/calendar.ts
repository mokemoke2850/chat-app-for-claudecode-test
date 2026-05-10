// Issue #152 — カレンダー / 予定調整 REST API
// /api/calendar/events 系: イベント CRUD + RSVP（Phase B）
// /api/calendar/polls  系: 日程調整 CRUD + 投票 + 確定（Phase C）

import { Router, Response } from 'express';
import { authenticateToken, AuthenticatedRequest } from '../middleware/auth';
import * as calendarService from '../services/calendarService';
import type { CreateCalendarEventInput, UpdateCalendarEventInput } from '@chat-app/shared';

const router = Router();

function handleError(err: unknown, res: Response): Response {
  const e = err as { statusCode?: number; message?: string };
  const status = typeof e.statusCode === 'number' ? e.statusCode : 500;
  return res.status(status).json({ error: e.message ?? 'Internal server error' });
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

router.get('/events', authenticateToken, async (req, res) => {
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
    return handleError(err, res);
  }
});

router.post('/events', authenticateToken, async (req, res) => {
  const userId = (req as AuthenticatedRequest).userId;
  const body = req.body as Partial<CreateCalendarEventInput>;

  if (
    typeof body.title !== 'string' ||
    typeof body.startsAt !== 'string' ||
    typeof body.endsAt !== 'string'
  ) {
    return res.status(400).json({ error: 'Invalid input' });
  }
  // channelId は number または null のみ受け付け（undefined は不許可）
  if (body.channelId !== null && typeof body.channelId !== 'number') {
    return res.status(400).json({ error: 'Invalid channelId' });
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
    });
    return res.status(201).json({ event });
  } catch (err) {
    return handleError(err, res);
  }
});

router.get('/events/:id', authenticateToken, async (req, res) => {
  const eventId = parseInt(req.params.id, 10);
  if (Number.isNaN(eventId)) return res.status(400).json({ error: 'Invalid id' });
  try {
    const event = await calendarService.getEventById(eventId);
    if (!event) return res.status(404).json({ error: 'Event not found' });
    return res.json({ event });
  } catch (err) {
    return handleError(err, res);
  }
});

router.patch('/events/:id', authenticateToken, async (req, res) => {
  const userId = (req as AuthenticatedRequest).userId;
  const eventId = parseInt(req.params.id, 10);
  if (Number.isNaN(eventId)) return res.status(400).json({ error: 'Invalid id' });

  const body = req.body as UpdateCalendarEventInput;
  try {
    const event = await calendarService.updateEvent(userId, eventId, body);
    return res.json({ event });
  } catch (err) {
    return handleError(err, res);
  }
});

router.delete('/events/:id', authenticateToken, async (req, res) => {
  const userId = (req as AuthenticatedRequest).userId;
  const eventId = parseInt(req.params.id, 10);
  if (Number.isNaN(eventId)) return res.status(400).json({ error: 'Invalid id' });
  try {
    await calendarService.deleteEvent(userId, eventId);
    return res.status(204).send();
  } catch (err) {
    return handleError(err, res);
  }
});

// ===== RSVP =====

router.post('/events/:id/rsvp', authenticateToken, async (req, res) => {
  const userId = (req as AuthenticatedRequest).userId;
  const eventId = parseInt(req.params.id, 10);
  if (Number.isNaN(eventId)) return res.status(400).json({ error: 'Invalid id' });

  const status = (req.body as { status?: unknown }).status;
  if (typeof status !== 'string') {
    return res.status(400).json({ error: 'Invalid status' });
  }
  try {
    const attendee = await calendarService.setRsvp(userId, eventId, status as never);
    return res.json({ attendee });
  } catch (err) {
    return handleError(err, res);
  }
});

// ===== Polls =====

router.get('/polls', authenticateToken, async (req, res) => {
  const channelIdRaw = req.query.channelId;
  if (typeof channelIdRaw !== 'string') {
    return res.status(400).json({ error: 'channelId is required' });
  }
  const channelId = parseInt(channelIdRaw, 10);
  if (Number.isNaN(channelId)) return res.status(400).json({ error: 'Invalid channelId' });
  try {
    const polls = await calendarService.listPollsByChannel(channelId);
    return res.json({ polls });
  } catch (err) {
    return handleError(err, res);
  }
});

router.post('/polls', authenticateToken, async (req, res) => {
  const userId = (req as AuthenticatedRequest).userId;
  const body = req.body as {
    channelId?: unknown;
    title?: unknown;
    deadline?: unknown;
    candidates?: unknown;
  };

  if (typeof body.channelId !== 'number' || typeof body.title !== 'string') {
    return res.status(400).json({ error: 'Invalid input' });
  }
  if (!Array.isArray(body.candidates)) {
    return res.status(400).json({ error: 'candidates must be an array' });
  }
  const candidates = body.candidates as { startsAt?: unknown; endsAt?: unknown }[];
  for (const c of candidates) {
    if (typeof c.startsAt !== 'string' || typeof c.endsAt !== 'string') {
      return res.status(400).json({ error: 'Invalid candidate' });
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
    return handleError(err, res);
  }
});

router.get('/polls/:id', authenticateToken, async (req, res) => {
  const pollId = parseInt(req.params.id, 10);
  if (Number.isNaN(pollId)) return res.status(400).json({ error: 'Invalid id' });
  try {
    const poll = await calendarService.getPollWithVotes(pollId);
    if (!poll) return res.status(404).json({ error: 'Poll not found' });
    return res.json({ poll });
  } catch (err) {
    return handleError(err, res);
  }
});

router.delete('/polls/:id', authenticateToken, async (req, res) => {
  const userId = (req as AuthenticatedRequest).userId;
  const pollId = parseInt(req.params.id, 10);
  if (Number.isNaN(pollId)) return res.status(400).json({ error: 'Invalid id' });
  try {
    await calendarService.deletePoll(userId, pollId);
    return res.status(204).send();
  } catch (err) {
    return handleError(err, res);
  }
});

router.post('/polls/:id/votes', authenticateToken, async (req, res) => {
  const userId = (req as AuthenticatedRequest).userId;
  const pollId = parseInt(req.params.id, 10);
  if (Number.isNaN(pollId)) return res.status(400).json({ error: 'Invalid id' });
  const body = req.body as { votes?: unknown };
  if (!Array.isArray(body.votes)) {
    return res.status(400).json({ error: 'votes must be an array' });
  }
  try {
    const poll = await calendarService.castVote(userId, pollId, body.votes as never);
    return res.json({ poll });
  } catch (err) {
    return handleError(err, res);
  }
});

router.post('/polls/:id/confirm', authenticateToken, async (req, res) => {
  const userId = (req as AuthenticatedRequest).userId;
  const pollId = parseInt(req.params.id, 10);
  if (Number.isNaN(pollId)) return res.status(400).json({ error: 'Invalid id' });
  const candidateId = (req.body as { candidateId?: unknown }).candidateId;
  if (typeof candidateId !== 'number') {
    return res.status(400).json({ error: 'candidateId is required' });
  }
  try {
    const event = await calendarService.confirmPoll(userId, pollId, candidateId);
    return res.json({ event });
  } catch (err) {
    return handleError(err, res);
  }
});

export default router;
