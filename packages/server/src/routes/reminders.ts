import { Router } from 'express';
import { createError } from '../middleware/errorHandler';
import { authenticateToken, AuthenticatedRequest } from '../middleware/auth';
import * as reminderService from '../services/reminderService';

const router = Router();

router.post('/', authenticateToken, async (req, res, next) => {
  const userId = (req as AuthenticatedRequest).userId;
  const { messageId, remindAt } = req.body as { messageId?: number; remindAt?: string };

  if (!messageId || typeof messageId !== 'number') {
    return next(createError('messageId is required', 400));
  }

  if (!remindAt) {
    return next(createError('remindAt is required', 400));
  }

  const remindAtDate = new Date(remindAt);
  if (isNaN(remindAtDate.getTime())) {
    return next(createError('remindAt is invalid date', 400));
  }

  if (remindAtDate <= new Date()) {
    return next(createError('remindAt must be a future date', 400));
  }

  try {
    const reminder = await reminderService.createReminder(userId, messageId, remindAt);
    return res.status(201).json({ reminder });
  } catch (err: unknown) {
    const error = err as Error;
    if (error.message === 'Message not found') {
      return next(createError(error.message, 404));
    }
    return next(createError('Internal server error', 500));
  }
});

router.get('/', authenticateToken, async (req, res, next) => {
  const userId = (req as AuthenticatedRequest).userId;
  try {
    const reminders = await reminderService.getReminders(userId);
    return res.json({ reminders });
  } catch {
    return next(createError('Internal server error', 500));
  }
});

router.delete('/:id', authenticateToken, async (req, res, next) => {
  const userId = (req as AuthenticatedRequest).userId;
  const reminderId = parseInt(req.params.id, 10);

  if (isNaN(reminderId)) {
    return next(createError('Invalid id', 400));
  }

  try {
    await reminderService.deleteReminder(userId, reminderId);
    return res.status(204).send();
  } catch (err: unknown) {
    const error = err as Error;
    if (error.message === 'Reminder not found') {
      return next(createError(error.message, 404));
    }
    return next(createError('Internal server error', 500));
  }
});

export default router;
