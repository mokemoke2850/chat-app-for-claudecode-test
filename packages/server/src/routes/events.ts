// #108 会話イベント投稿 — REST API
// POST /api/events                 イベント作成
// PATCH /api/events/:id            タイトル / 日時 / 説明の更新
// DELETE /api/events/:id           削除
// POST /api/events/:id/rsvp        参加可否登録・更新
// GET /api/events/:id/rsvps        参加者一覧

import { Router, Response } from 'express';
import { authenticateToken, AuthenticatedRequest } from '../middleware/auth';
import * as eventService from '../services/eventService';
import * as messageService from '../services/messageService';
import { getSocketServer } from '../socket';
import type { CreateEventInput, RsvpStatus, UpdateEventInput } from '@chat-app/shared';

const router = Router();

function handleError(err: unknown, res: Response): Response {
  const e = err as { statusCode?: number; message?: string };
  const status = typeof e.statusCode === 'number' ? e.statusCode : 500;
  return res.status(status).json({ error: e.message ?? 'Internal server error' });
}

router.post('/', authenticateToken, async (req, res) => {
  const userId = (req as AuthenticatedRequest).userId;
  const body = req.body as Partial<CreateEventInput>;

  if (
    typeof body.channelId !== 'number' ||
    typeof body.title !== 'string' ||
    typeof body.startsAt !== 'string'
  ) {
    return res.status(400).json({ error: 'Invalid input' });
  }

  try {
    const event = await eventService.create(userId, {
      channelId: body.channelId,
      title: body.title,
      description: body.description,
      startsAt: body.startsAt,
      endsAt: body.endsAt,
    });

    // Socket 配信: 通常メッセージと同様に new_message を全チャンネル参加者へ送信
    const io = getSocketServer();
    if (io) {
      const message = await messageService.getMessageById(event.messageId);
      if (message) {
        io.to(`channel:${body.channelId}`).emit('new_message', message);
      }
    }

    return res.status(201).json({ event });
  } catch (err) {
    return handleError(err, res);
  }
});

router.patch('/:id', authenticateToken, async (req, res) => {
  const userId = (req as AuthenticatedRequest).userId;
  const eventId = parseInt(req.params.id, 10);
  if (isNaN(eventId)) return res.status(400).json({ error: 'Invalid id' });

  const body = req.body as UpdateEventInput;
  try {
    const event = await eventService.update(userId, eventId, body);
    return res.json({ event });
  } catch (err) {
    return handleError(err, res);
  }
});

router.delete('/:id', authenticateToken, async (req, res) => {
  const userId = (req as AuthenticatedRequest).userId;
  const eventId = parseInt(req.params.id, 10);
  if (isNaN(eventId)) return res.status(400).json({ error: 'Invalid id' });

  try {
    await eventService.deleteEvent(userId, eventId);
    return res.status(204).send();
  } catch (err) {
    return handleError(err, res);
  }
});

router.post('/:id/rsvp', authenticateToken, async (req, res) => {
  const userId = (req as AuthenticatedRequest).userId;
  const eventId = parseInt(req.params.id, 10);
  if (isNaN(eventId)) return res.status(400).json({ error: 'Invalid id' });

  const status = (req.body as { status?: RsvpStatus }).status;
  if (!status) return res.status(400).json({ error: 'status is required' });

  try {
    const result = await eventService.setRsvp(userId, eventId, status);

    // Socket 配信: チャンネル参加者全員に集計更新を通知
    const io = getSocketServer();
    if (io) {
      io.to(`channel:${result.channelId}`).emit('event:rsvp_updated', {
        eventId: result.event.id,
        messageId: result.messageId,
        channelId: result.channelId,
        rsvpCounts: result.event.rsvpCounts,
      });
    }

    return res.json({ event: result.event });
  } catch (err) {
    return handleError(err, res);
  }
});

router.get('/:id/rsvps', authenticateToken, async (req, res) => {
  const eventId = parseInt(req.params.id, 10);
  if (isNaN(eventId)) return res.status(400).json({ error: 'Invalid id' });

  try {
    const users = await eventService.getRsvpUsers(eventId);
    return res.json({ users });
  } catch (err) {
    return handleError(err, res);
  }
});

export default router;
