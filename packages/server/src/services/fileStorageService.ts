import fs from 'fs';
import path from 'path';

const UPLOAD_DIR = path.join(process.cwd(), 'uploads');

export interface SavedFile {
  url: string;
  originalName: string;
  size: number;
}

/**
 * バイナリデータを uploads/ ディレクトリに保存し公開 URL を返す。
 */
export function saveFile(buffer: Buffer, originalName: string, _mimeType: string): SavedFile {
  if (!fs.existsSync(UPLOAD_DIR)) {
    fs.mkdirSync(UPLOAD_DIR, { recursive: true });
  }

  const ext = path.extname(originalName);
  const basename = path.basename(originalName, ext);
  const filename = `${basename}_${Date.now()}${ext}`;
  const filePath = path.join(UPLOAD_DIR, filename);

  fs.writeFileSync(filePath, buffer);

  return {
    url: `/uploads/${filename}`,
    originalName,
    size: buffer.length,
  };
}
