import fs from 'fs';
import path from 'path';

const UPLOAD_DIR = path.join(process.cwd(), 'uploads');

/**
 * アバター画像を保存し公開 URL を返す。
 * - base64 データ URL の場合: ファイルに変換して uploads/ に保存し /uploads/{filename} を返す
 * - 通常の URL の場合: そのまま返す
 */
export function saveAvatar(userId: number, avatarUrl: string): string {
  if (!avatarUrl.startsWith('data:')) {
    return avatarUrl;
  }

  // data:image/png;base64,xxxx 形式を解析
  const match = avatarUrl.match(/^data:image\/(\w+);base64,(.+)$/);
  if (!match) return avatarUrl;

  const [, ext, base64Data] = match;
  const filename = `avatar_${userId}_${Date.now()}.${ext}`;
  const filePath = path.join(UPLOAD_DIR, filename);

  if (!fs.existsSync(UPLOAD_DIR)) {
    fs.mkdirSync(UPLOAD_DIR, { recursive: true });
  }

  fs.writeFileSync(filePath, Buffer.from(base64Data, 'base64'));

  return `/uploads/${filename}`;
}
