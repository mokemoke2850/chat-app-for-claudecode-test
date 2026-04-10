import { Router, Request, Response, NextFunction } from 'express';
import * as controller from '../controllers/pushController';
import { authenticateToken, AuthenticatedRequest } from '../middleware/auth';
import { sendPushToUser } from '../services/pushService';

const router = Router();

/**
 * @swagger
 * tags:
 *   name: Push
 *   description: Web Push notification subscriptions
 */

/**
 * @swagger
 * /api/push/vapid-key:
 *   get:
 *     summary: Get VAPID public key for push subscription
 *     tags: [Push]
 *     responses:
 *       200:
 *         description: VAPID public key
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 publicKey: { type: string }
 */
router.get('/vapid-key', controller.getVapidKey);

/**
 * @swagger
 * /api/push/subscribe:
 *   post:
 *     summary: Subscribe to push notifications
 *     tags: [Push]
 *     security:
 *       - cookieAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [endpoint, keys]
 *             properties:
 *               endpoint: { type: string }
 *               keys:
 *                 type: object
 *                 properties:
 *                   p256dh: { type: string }
 *                   auth: { type: string }
 *     responses:
 *       201:
 *         description: Subscribed
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 */
router.post('/subscribe', authenticateToken, controller.subscribe);

/**
 * @swagger
 * /api/push/unsubscribe:
 *   delete:
 *     summary: Unsubscribe from push notifications
 *     tags: [Push]
 *     security:
 *       - cookieAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [endpoint]
 *             properties:
 *               endpoint: { type: string }
 *     responses:
 *       204:
 *         description: Unsubscribed
 */
router.delete('/unsubscribe', authenticateToken, controller.unsubscribe);

/**
 * @swagger
 * /api/push/test:
 *   post:
 *     summary: Send a test push notification to yourself
 *     tags: [Push]
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: Test notification sent
 *       404:
 *         description: No subscription found
 */
router.post('/test', authenticateToken, (req: Request, res: Response, next: NextFunction) => {
  const { userId } = req as AuthenticatedRequest;
  sendPushToUser(userId, {
    title: 'Test notification',
    body: 'Push notifications are working!',
    url: '/',
  })
    .then(() => res.json({ message: 'Test push sent' }))
    .catch(next);
});

export default router;
