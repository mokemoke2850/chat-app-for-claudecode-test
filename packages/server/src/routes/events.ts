// #108 会話イベント投稿 — REST API
// POST /api/events                 イベント作成
// PATCH /api/events/:id            タイトル / 日時 / 説明の更新
// DELETE /api/events/:id           削除
// POST /api/events/:id/rsvp        参加可否登録・更新
// GET /api/events/:id/rsvps        参加者一覧

import { Router, NextFunction } from 'express';
import { createError } from '../middleware/errorHandler';
import { authenticateToken, AuthenticatedRequest } from '../middleware/auth';
import * as eventService from '../services/eventService';
import * as messageService from '../services/messageService';
import { getSocketServer } from '../socket';
import type { CreateEventInput, RsvpStatus, UpdateEventInput } from '@chat-app/shared';

const router = Router();

function handleError(err: unknown, next: NextFunction): void {
  const e = err as { statusCode?: number; message?: string };
  const status = typeof e.statusCode === 'number' ? e.statusCode : 500;
  next(createError(e.message ?? 'Internal server error', status));
}

router.post('/', authenticateToken, async (req, res, next) => {
  const userId = (req as AuthenticatedRequest).userId;
  const body = req.body as Partial<CreateEventInput>;

  if (
    typeof body.channelId !== 'number' ||
    typeof body.title !== 'string' ||
    typeof body.startsAt !== 'string'
  ) {
    return next(createError('Invalid input', 400));
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
    return handleError(err, next);
  }
});

router.patch('/:id', authenticateToken, async (req, res, next) => {
  const userId = (req as AuthenticatedRequest).userId;
  const eventId = parseInt(req.params.id, 10);
  if (isNaN(eventId)) return next(createError('Invalid id', 400));

  const body = req.body as UpdateEventInput;
  try {
    const event = await eventService.update(userId, eventId, body);
    return res.json({ event });
  } catch (err) {
    return handleError(err, next);
  }
});

router.delete('/:id', authenticateToken, async (req, res, next) => {
  const userId = (req as AuthenticatedRequest).userId;
  const eventId = parseInt(req.params.id, 10);
  if (isNaN(eventId)) return next(createError('Invalid id', 400));

  try {
    await eventService.deleteEvent(userId, eventId);
    return res.status(204).send();
  } catch (err) {
    return handleError(err, next);
  }
});

router.post('/:id/rsvp', authenticateToken, async (req, res, next) => {
  const userId = (req as AuthenticatedRequest).userId;
  const eventId = parseInt(req.params.id, 10);
  if (isNaN(eventId)) return next(createError('Invalid id', 400));

  const status = (req.body as { status?: RsvpStatus }).status;
  if (!status) return next(createError('status is required', 400));

  try {
    const result = await eventService.setRsvp(userId, eventId, status);

    // Socket 配信: 元チャンネル参加者と event-id ルーム購読者の双方へ集計更新を通知
    // event-id ルームは #107 転送先で RSVP 投票するクライアントが購読しており、
    // 転送先チャンネルが元チャンネルと異なる場合でも集計更新を受信できる。
    const io = getSocketServer();
    if (io) {
      const payload = {
        eventId: result.event.id,
        messageId: result.messageId,
        channelId: result.channelId,
        rsvpCounts: result.event.rsvpCounts,
      };
      io.to(`channel:${result.channelId}`).emit('event:rsvp_updated', payload);
      io.to(`event:${result.event.id}`).emit('event:rsvp_updated', payload);
    }

    return res.json({ event: result.event });
  } catch (err) {
    return handleError(err, next);
  }
});

router.get('/:id/rsvps', authenticateToken, async (req, res, next) => {
  const eventId = parseInt(req.params.id, 10);
  if (isNaN(eventId)) return next(createError('Invalid id', 400));

  try {
    const users = await eventService.getRsvpUsers(eventId);
    return res.json({ users });
  } catch (err) {
    return handleError(err, next);
  }
});

export default router;
