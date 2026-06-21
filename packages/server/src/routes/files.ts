import { Router } from 'express';
import multer from 'multer';
import { authenticateToken, AuthenticatedRequest } from '../middleware/auth';
import { saveFile } from '../services/fileStorageService';
import { checkExtension } from '../services/moderationService';
import { isMaintenanceRestricted } from '../services/adminService';
import { execute } from '../db/database';
import { createError } from '../middleware/errorHandler';

const router = Router();
const upload = multer({ storage: multer.memoryStorage() });

/**
 * POST /api/files/upload
 * ファイルをアップロードし、メタデータを DB に保存して URL を返す。
 */
router.post('/upload', authenticateToken, upload.single('file'), async (req, res, next) => {
  try {
    if (await isMaintenanceRestricted('upload')) {
      throw createError('メンテナンス中のためアップロードできません', 503, {
        code: 'MAINTENANCE_MODE',
      });
    }

    if (!req.file) {
      throw createError('ファイルが指定されていません', 400);
    }

    const { mimetype, buffer } = req.file;
    const originalname = Buffer.from(req.file.originalname, 'latin1').toString('utf8');

    // #117 拡張子ブロックリスト判定
    if (await checkExtension(originalname)) {
      throw createError('禁止された拡張子はアップロードできません', 400);
    }

    const saved = saveFile(buffer, originalname, mimetype);

    const result = await execute(
      'INSERT INTO message_attachments (message_id, url, original_name, size, mime_type, uploaded_by) VALUES (NULL, $1, $2, $3, $4, $5) RETURNING id',
      [saved.url, saved.originalName, saved.size, mimetype, (req as AuthenticatedRequest).userId],
    );

    res.json({
      id: result.rows[0].id,
      url: saved.url,
      originalName: saved.originalName,
      size: saved.size,
      mimeType: mimetype,
    });
  } catch (err) {
    next(err);
  }
});

export default router;
