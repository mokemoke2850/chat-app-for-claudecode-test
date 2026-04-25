import { Router } from 'express';
import * as controller from '../controllers/channelController';
import * as messageController from '../controllers/messageController';
import * as attachmentsController from '../controllers/channelAttachmentsController';
import * as pinChannelController from '../controllers/pinChannelController';
import * as categoryController from '../controllers/categoryController';
import * as notificationController from '../controllers/channelNotificationController';
import { authenticateToken } from '../middleware/auth';

const router = Router();

/**
 * @swagger
 * tags:
 *   name: Channels
 *   description: Chat channel management
 */

/**
 * @swagger
 * /api/channels:
 *   get:
 *     summary: List all channels
 *     tags: [Channels]
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: Array of channels
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 channels:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Channel'
 */
router.get('/', authenticateToken, controller.getChannels);

// アーカイブチャンネル（/api/channels/:id より前に定義する必要がある）
router.get('/archived', authenticateToken, controller.getArchivedChannels);

// 通知設定（/api/channels/:id より前に定義する必要がある）
router.get('/notifications', authenticateToken, notificationController.getNotifications);

// ピン留めチャンネル（/api/channels/:id より前に定義する必要がある）
router.get('/pinned', authenticateToken, pinChannelController.getPinnedChannels);
router.post('/:id/pin', authenticateToken, pinChannelController.pinChannel);
router.delete('/:id/pin', authenticateToken, pinChannelController.unpinChannel);

/**
 * @swagger
 * /api/channels:
 *   post:
 *     summary: Create a new channel
 *     tags: [Channels]
 *     security:
 *       - cookieAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name]
 *             properties:
 *               name: { type: string, example: general }
 *               description: { type: string }
 *     responses:
 *       201:
 *         description: Channel created
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 channel:
 *                   $ref: '#/components/schemas/Channel'
 *       409:
 *         $ref: '#/components/responses/Conflict'
 */
router.post('/', authenticateToken, controller.createChannel);

/**
 * @swagger
 * /api/channels/{id}:
 *   get:
 *     summary: Get a channel by ID
 *     tags: [Channels]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: Channel object
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
router.get('/:id', authenticateToken, controller.getChannel);

/**
 * @swagger
 * /api/channels/{id}:
 *   delete:
 *     summary: Delete a channel (creator only)
 *     tags: [Channels]
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
router.delete('/:id', authenticateToken, controller.deleteChannel);

/**
 * @swagger
 * /api/channels/{id}/join:
 *   post:
 *     summary: Join a channel
 *     tags: [Channels]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       204:
 *         description: Joined
 */
router.post('/:id/join', authenticateToken, controller.joinChannel);
router.post('/:id/read', authenticateToken, controller.markAsRead);
router.patch('/:id/archive', authenticateToken, controller.archiveChannel);
router.delete('/:id/archive', authenticateToken, controller.unarchiveChannel);
router.patch('/:id/topic', authenticateToken, controller.updateTopic);
router.get('/:id/members', authenticateToken, controller.getMembers);
router.post('/:id/members', authenticateToken, controller.addMember);
router.delete('/:id/members/:userId', authenticateToken, controller.removeMember);

/**
 * @swagger
 * /api/channels/{channelId}/messages:
 *   get:
 *     summary: Get messages for a channel
 *     tags: [Channels]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: channelId
 *         required: true
 *         schema: { type: integer }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 50 }
 *       - in: query
 *         name: before
 *         description: Load messages before this message ID (cursor-based pagination)
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: Array of messages
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 messages:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Message'
 */
router.get('/:channelId/messages', authenticateToken, messageController.getMessages);
router.post('/:channelId/messages', authenticateToken, messageController.createMessage);

/**
 * @swagger
 * /api/channels/{id}/attachments:
 *   get:
 *     summary: チャンネルの添付ファイル一覧を取得する
 *     tags: [Channels]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *       - in: query
 *         name: type
 *         description: ファイルタイプフィルター（image / pdf / other）
 *         schema: { type: string, enum: [image, pdf, other] }
 *     responses:
 *       200:
 *         description: 添付ファイル一覧
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
router.get('/:id/attachments', authenticateToken, attachmentsController.getChannelAttachments);

// チャンネルのカテゴリ割当: POST /api/channels/:channelId/category
router.post('/:channelId/category', authenticateToken, categoryController.assignChannelToCategory);

// 通知レベル更新: PUT /api/channels/:id/notifications
router.put('/:id/notifications', authenticateToken, notificationController.setNotificationLevel);

export default router;
