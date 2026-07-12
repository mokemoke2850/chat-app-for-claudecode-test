import { Router } from 'express';
import * as controller from '../controllers/messageController';
import * as moderationReportController from '../controllers/moderationReportController';
import { authenticateToken, AuthenticatedRequest } from '../middleware/auth';

const router = Router();

/**
 * @swagger
 * /api/messages/search:
 *   get:
 *     summary: 全チャンネルのメッセージを部分一致で検索する
 *     tags: [Messages]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: query
 *         name: q
 *         required: true
 *         schema: { type: string }
 *       - in: query
 *         name: limit
 *         description: 1ページあたりの件数（既定 50・上限 100、#375 オフセット系ページング）
 *         schema: { type: integer, default: 50 }
 *       - in: query
 *         name: offset
 *         description: 先頭からのスキップ件数（既定 0）
 *         schema: { type: integer, default: 0 }
 *     responses:
 *       200:
 *         description: 検索結果（オフセット系ページング { items, total, limit, offset }）
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 items:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Message'
 *                 total: { type: integer }
 *                 limit: { type: integer }
 *                 offset: { type: integer }
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 */
router.get('/search', authenticateToken, controller.searchMessages);
router.get('/:id/context', authenticateToken, controller.getMessageContext);
router.get('/:id/history', authenticateToken, controller.getMessageEditHistory);

/**
 * @swagger
 * /api/messages/{id}/replies:
 *   get:
 *     summary: スレッド返信一覧を取得する
 *     tags: [Messages]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *         description: ルートメッセージID
 *       - in: query
 *         name: limit
 *         description: 1ページあたりの件数（既定 50・上限 100、#386 カーソル系ページング）
 *         schema: { type: integer, default: 50 }
 *       - in: query
 *         name: before
 *         description: 前ページで受け取った nextCursor（より古い返信を読み込む）
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: カーソル系ページング { items, nextCursor, hasMore }（#386）
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 items:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Message'
 *                 nextCursor: { type: string, nullable: true }
 *                 hasMore: { type: boolean }
 */
router.get('/:id/replies', authenticateToken, controller.getReplies);

/**
 * @swagger
 * /api/messages/{id}/forward:
 *   post:
 *     summary: メッセージを別チャンネルへ転送する
 *     tags: [Messages]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *         description: 転送元メッセージID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [targetChannelId]
 *             properties:
 *               targetChannelId:
 *                 type: integer
 *               comment:
 *                 type: string
 *     responses:
 *       201:
 *         description: 転送後のメッセージ
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
router.post('/:id/forward', authenticateToken, controller.forwardMessage);

/**
 * @swagger
 * tags:
 *   name: Messages
 *   description: Message editing and deletion
 */

/**
 * @swagger
 * /api/messages/{id}:
 *   put:
 *     summary: Edit a message (author only)
 *     tags: [Messages]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [content]
 *             properties:
 *               content:
 *                 type: string
 *                 description: TipTap JSON content
 *               mentionedUserIds:
 *                 type: array
 *                 items: { type: integer }
 *     responses:
 *       200:
 *         description: Updated message
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   $ref: '#/components/schemas/Message'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
router.put('/:id', authenticateToken, controller.editMessage);

/**
 * @swagger
 * /api/messages/{id}:
 *   delete:
 *     summary: Soft-delete a message (author only)
 *     tags: [Messages]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       204:
 *         description: Deleted
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
router.delete('/:id', authenticateToken, controller.deleteMessage);

// #116 通報
router.post('/:id/report', authenticateToken, (req, res, next) =>
  moderationReportController.reportMessage(req as unknown as AuthenticatedRequest, res, next),
);

export default router;
