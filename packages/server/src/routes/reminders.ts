import { Router } from 'express';
import { authenticateToken, AuthenticatedRequest } from '../middleware/auth';
import * as reminderService from '../services/reminderService';

const router = Router();

router.post('/', authenticateToken, async (req, res) => {
  const userId = (req as AuthenticatedRequest).userId;
  const { messageId, remindAt } = req.body as { messageId?: number; remindAt?: string };

  if (!messageId || typeof messageId !== 'number') {
    return res.status(400).json({ error: 'messageId is required' });
  }

  if (!remindAt) {
    return res.status(400).json({ error: 'remindAt is required' });
  }

  const remindAtDate = new Date(remindAt);
  if (isNaN(remindAtDate.getTime())) {
    return res.status(400).json({ error: 'remindAt is invalid date' });
  }

  if (remindAtDate <= new Date()) {
    return res.status(400).json({ error: 'remindAt must be a future date' });
  }

  try {
    const reminder = await reminderService.createReminder(userId, messageId, remindAt);
    return res.status(201).json({ reminder });
  } catch (err: unknown) {
    const error = err as Error;
    if (error.message === 'Message not found') {
      return res.status(404).json({ error: error.message });
    }
    return res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/', authenticateToken, async (req, res) => {
  const userId = (req as AuthenticatedRequest).userId;
  try {
    const reminders = await reminderService.getReminders(userId);
    return res.json({ reminders });
  } catch {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

router.delete('/:id', authenticateToken, async (req, res) => {
  const userId = (req as AuthenticatedRequest).userId;
  const reminderId = parseInt(req.params.id, 10);

  if (isNaN(reminderId)) {
    return res.status(400).json({ error: 'Invalid id' });
  }

  try {
    await reminderService.deleteReminder(userId, reminderId);
    return res.status(204).send();
  } catch (err: unknown) {
    const error = err as Error;
    if (error.message === 'Reminder not found') {
      return res.status(404).json({ error: error.message });
    }
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
