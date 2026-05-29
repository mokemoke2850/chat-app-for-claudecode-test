import { Request, Response, NextFunction } from 'express';
import { createError } from '../middleware/errorHandler';
import * as pushService from '../services/pushService';
import { AuthenticatedRequest } from '../middleware/auth';

export function getVapidKey(_req: Request, res: Response): void {
  res.json({ publicKey: pushService.getVapidPublicKey() });
}

export async function subscribe(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const sub = req.body as pushService.PushSubscriptionInput;
    if (!sub?.endpoint || !sub?.keys?.p256dh || !sub?.keys?.auth) {
      next(createError('Invalid push subscription', 400));
      return;
    }
    await pushService.saveSubscription((req as AuthenticatedRequest).userId, sub);
    res.status(201).json({ message: 'Subscribed' });
  } catch (err) { next(err); }
}

export async function unsubscribe(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { endpoint } = req.body as { endpoint?: string };
    if (!endpoint) { next(createError('endpoint is required', 400)); return; }
    await pushService.removeSubscription((req as AuthenticatedRequest).userId, endpoint);
    res.status(204).send();
  } catch (err) { next(err); }
}
