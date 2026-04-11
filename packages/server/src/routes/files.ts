import { Router } from 'express';
import multer from 'multer';
import { authenticateToken } from '../middleware/auth';
import { saveFile } from '../services/fileStorageService';
import { getDatabase } from '../db/database';
import { createError } from '../middleware/errorHandler';

const router = Router();
const upload = multer({ storage: multer.memoryStorage() });

/**
 * POST /api/files/upload
 * ファイルをアップロードし、メタデータを DB に保存して URL を返す。
 */
router.post('/upload', authenticateToken, upload.single('file'), (req, res, next) => {
  try {
    if (!req.file) {
      throw createError('ファイルが指定されていません', 400);
    }

    const { mimetype, buffer } = req.file;
    // multer/busboy はマルチパートの filename パラメータを latin1 として読み込む。
    // ブラウザは UTF-8 バイト列で送るため latin1→utf8 に変換して元のファイル名を復元する。
    const originalname = Buffer.from(req.file.originalname, 'latin1').toString('utf8');
    const saved = saveFile(buffer, originalname, mimetype);

    const db = getDatabase();
    const result = db
      .prepare(
        'INSERT INTO message_attachments (message_id, url, original_name, size, mime_type) VALUES (NULL, ?, ?, ?, ?)',
      )
      .run(saved.url, saved.originalName, saved.size, mimetype);

    res.json({
      id: result.lastInsertRowid,
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
