import { getDatabase } from '../db/database';

export interface ChannelAttachment {
  id: number;
  messageId: number | null;
  url: string;
  originalName: string;
  size: number;
  mimeType: string;
  createdAt: string;
  uploaderId: number | null;
  uploaderName: string;
}

interface AttachmentRow {
  id: number;
  message_id: number | null;
  url: string;
  original_name: string;
  size: number;
  mime_type: string;
  created_at: string;
  uploader_id: number | null;
  uploader_name: string | null;
}

function rowToChannelAttachment(row: AttachmentRow): ChannelAttachment {
  return {
    id: row.id,
    messageId: row.message_id,
    url: row.url,
    originalName: row.original_name,
    size: row.size,
    mimeType: row.mime_type,
    createdAt: row.created_at,
    uploaderId: row.uploader_id,
    uploaderName: row.uploader_name ?? '不明なユーザー',
  };
}

/**
 * チャンネルの添付ファイル一覧を取得する。
 * mimeTypeFilter: 'image' | 'pdf' | 'other' | undefined
 *   - 'image'  : image/* にマッチするファイルのみ
 *   - 'pdf'    : application/pdf のみ
 *   - 'other'  : 画像・PDF 以外のファイルのみ
 *   - undefined: すべてのファイル
 */
export function getChannelAttachments(
  channelId: number,
  mimeTypeFilter?: 'image' | 'pdf' | 'other',
): ChannelAttachment[] {
  const db = getDatabase();

  let filterClause = '';
  if (mimeTypeFilter === 'image') {
    filterClause = "AND ma.mime_type LIKE 'image/%'";
  } else if (mimeTypeFilter === 'pdf') {
    filterClause = "AND ma.mime_type = 'application/pdf'";
  } else if (mimeTypeFilter === 'other') {
    filterClause = "AND ma.mime_type NOT LIKE 'image/%' AND ma.mime_type != 'application/pdf'";
  }

  const sql = `
    SELECT
      ma.id,
      ma.message_id,
      ma.url,
      ma.original_name,
      ma.size,
      ma.mime_type,
      ma.created_at,
      m.user_id AS uploader_id,
      u.username AS uploader_name
    FROM message_attachments ma
    INNER JOIN messages m ON m.id = ma.message_id
    INNER JOIN channels c ON c.id = m.channel_id
    LEFT JOIN users u ON u.id = m.user_id
    WHERE c.id = ?
      AND m.is_deleted = 0
      ${filterClause}
    ORDER BY ma.created_at DESC
  `;

  const rows = db.prepare(sql).all(channelId) as AttachmentRow[];
  return rows.map(rowToChannelAttachment);
}
