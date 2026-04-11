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
