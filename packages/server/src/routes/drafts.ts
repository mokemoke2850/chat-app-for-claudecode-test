import { Router } from 'express';
import { authenticateToken, AuthenticatedRequest } from '../middleware/auth';
import * as draftService from '../services/draftService';

const router = Router();

// GET /drafts — 自分の全下書きを取得
router.get('/', authenticateToken, async (req, res) => {
  const userId = (req as AuthenticatedRequest).userId;
  const drafts = await draftService.getDraftsByUser(userId);
  return res.json({ drafts });
});

// PUT /drafts/channels/:channelId — チャンネル下書きを保存
router.put('/channels/:channelId', authenticateToken, async (req, res) => {
  const userId = (req as AuthenticatedRequest).userId;
  const channelId = parseInt(req.params.channelId, 10);

  if (isNaN(channelId)) {
    return res.status(400).json({ error: 'Invalid channelId' });
  }

  const { content } = req.body as { content?: string };
  if (content === undefined) {
    return res.status(400).json({ error: 'content is required' });
  }

  const draft = await draftService.upsertChannelDraft(userId, channelId, content);
  if (draft === null) {
    // 空文字列によって削除された場合
    return res.status(204).send();
  }
  return res.json({ draft });
});

// PUT /drafts/dm/:conversationId — DM下書きを保存
router.put('/dm/:conversationId', authenticateToken, async (req, res) => {
  const userId = (req as AuthenticatedRequest).userId;
  const conversationId = parseInt(req.params.conversationId, 10);

  if (isNaN(conversationId)) {
    return res.status(400).json({ error: 'Invalid conversationId' });
  }

  const { content } = req.body as { content?: string };
  if (content === undefined) {
    return res.status(400).json({ error: 'content is required' });
  }

  const draft = await draftService.upsertDmDraft(userId, conversationId, content);
  if (draft === null) {
    return res.status(204).send();
  }
  return res.json({ draft });
});

// DELETE /drafts/channels/:channelId — チャンネル下書きを明示削除
router.delete('/channels/:channelId', authenticateToken, async (req, res) => {
  const userId = (req as AuthenticatedRequest).userId;
  const channelId = parseInt(req.params.channelId, 10);

  if (isNaN(channelId)) {
    return res.status(400).json({ error: 'Invalid channelId' });
  }

  await draftService.deleteChannelDraft(userId, channelId);
  return res.status(204).send();
});

// DELETE /drafts/dm/:conversationId — DM下書きを明示削除
router.delete('/dm/:conversationId', authenticateToken, async (req, res) => {
  const userId = (req as AuthenticatedRequest).userId;
  const conversationId = parseInt(req.params.conversationId, 10);

  if (isNaN(conversationId)) {
    return res.status(400).json({ error: 'Invalid conversationId' });
  }

  await draftService.deleteDmDraft(userId, conversationId);
  return res.status(204).send();
});

export default router;
