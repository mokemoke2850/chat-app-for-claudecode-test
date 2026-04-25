import { Router } from 'express';
import * as controller from '../controllers/messageController';
import { authenticateToken } from '../middleware/auth';

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
 *     responses:
 *       200:
 *         description: 検索結果メッセージ一覧
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 */
router.get('/search', authenticateToken, controller.searchMessages);

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
 *     responses:
 *       200:
 *         description: 返信メッセージ一覧
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

export default router;
