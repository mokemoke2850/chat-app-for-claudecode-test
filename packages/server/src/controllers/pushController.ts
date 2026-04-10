import { Request, Response, NextFunction } from 'express';
import * as pushService from '../services/pushService';
import { AuthenticatedRequest } from '../middleware/auth';

export function getVapidKey(_req: Request, res: Response): void {
  res.json({ publicKey: pushService.getVapidPublicKey() });
}

export function subscribe(req: Request, res: Response, next: NextFunction): void {
  try {
    const sub = req.body as pushService.PushSubscriptionInput;
    if (!sub?.endpoint || !sub?.keys?.p256dh || !sub?.keys?.auth) {
      res.status(400).json({ error: 'Invalid push subscription' });
      return;
    }
    pushService.saveSubscription((req as AuthenticatedRequest).userId, sub);
    res.status(201).json({ message: 'Subscribed' });
  } catch (err) { next(err); }
}

export function unsubscribe(req: Request, res: Response, next: NextFunction): void {
  try {
    const { endpoint } = req.body as { endpoint?: string };
    if (!endpoint) { res.status(400).json({ error: 'endpoint is required' }); return; }
    pushService.removeSubscription((req as AuthenticatedRequest).userId, endpoint);
    res.status(204).send();
  } catch (err) { next(err); }
}
