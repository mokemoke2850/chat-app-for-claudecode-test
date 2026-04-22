import { query, queryOne, execute } from '../db/database';
import type {
  MessageTemplate,
  CreateMessageTemplateInput,
  UpdateMessageTemplateInput,
} from '@chat-app/shared';

const MAX_TITLE_LENGTH = 100;

interface TemplateRow {
  id: number;
  user_id: number;
  title: string;
  body: string;
  position: number;
  created_at: Date | string;
  updated_at: Date | string;
}

function toIsoString(val: unknown): string {
  if (val instanceof Date) return val.toISOString();
  return String(val);
}

function rowToTemplate(row: TemplateRow): MessageTemplate {
  return {
    id: row.id,
    userId: row.user_id,
    title: row.title,
    body: row.body,
    position: row.position,
    createdAt: toIsoString(row.created_at),
    updatedAt: toIsoString(row.updated_at),
  };
}

function validateTitle(title: string): void {
  if (!title || title.trim() === '') {
    throw new Error('Title is required');
  }
  if (title.trim().length > MAX_TITLE_LENGTH) {
    throw new Error(`Title must be ${MAX_TITLE_LENGTH} characters or less`);
  }
}

function validateBody(body: string): void {
  if (!body || body.trim() === '') {
    throw new Error('Body is required');
  }
}

/**
 * ユーザーのテンプレート一覧を position 昇順で返す
 */
export async function listTemplates(userId: number): Promise<MessageTemplate[]> {
  const rows = await query<TemplateRow>(
    `SELECT id, user_id, title, body, position, created_at, updated_at
     FROM message_templates
     WHERE user_id = $1
     ORDER BY position ASC, id ASC`,
    [userId],
  );
  return rows.map(rowToTemplate);
}

/**
 * テンプレートを作成する
 */
export async function createTemplate(
  userId: number,
  input: CreateMessageTemplateInput,
): Promise<MessageTemplate> {
  validateTitle(input.title);
  validateBody(input.body);

  // 末尾の position を算出
  const maxRow = await queryOne<{ max: number | null }>(
    'SELECT MAX(position) as max FROM message_templates WHERE user_id = $1',
    [userId],
  );
  const position = (maxRow?.max ?? -1) + 1;

  const result = await queryOne<TemplateRow>(
    `INSERT INTO message_templates (user_id, title, body, position)
     VALUES ($1, $2, $3, $4)
     RETURNING id, user_id, title, body, position, created_at, updated_at`,
    [userId, input.title.trim(), input.body.trim(), position],
  );

  return rowToTemplate(result!);
}

/**
 * テンプレートを更新する
 */
export async function updateTemplate(
  userId: number,
  templateId: number,
  input: UpdateMessageTemplateInput,
): Promise<MessageTemplate> {
  const existing = await queryOne<TemplateRow>(
    'SELECT id, user_id, title, body, position, created_at, updated_at FROM message_templates WHERE id = $1',
    [templateId],
  );

  if (!existing) {
    throw new Error('Template not found');
  }
  if (existing.user_id !== userId) {
    throw new Error('Template not found');
  }

  const newTitle = input.title !== undefined ? input.title.trim() : existing.title;
  const newBody = input.body !== undefined ? input.body.trim() : existing.body;
  const newPosition = input.position !== undefined ? input.position : existing.position;

  if (input.title !== undefined) {
    validateTitle(newTitle);
  }
  if (input.body !== undefined) {
    validateBody(newBody);
  }

  const result = await queryOne<TemplateRow>(
    `UPDATE message_templates
     SET title = $1, body = $2, position = $3, updated_at = NOW()
     WHERE id = $4
     RETURNING id, user_id, title, body, position, created_at, updated_at`,
    [newTitle, newBody, newPosition, templateId],
  );

  return rowToTemplate(result!);
}

/**
 * テンプレートを削除する
 */
export async function removeTemplate(userId: number, templateId: number): Promise<void> {
  const existing = await queryOne<{ id: number; user_id: number }>(
    'SELECT id, user_id FROM message_templates WHERE id = $1',
    [templateId],
  );

  if (!existing) {
    throw new Error('Template not found');
  }
  if (existing.user_id !== userId) {
    throw new Error('Template not found');
  }

  await execute('DELETE FROM message_templates WHERE id = $1', [templateId]);
}

/**
 * テンプレートの並び順を一括更新する
 */
export async function reorderTemplates(userId: number, orderedIds: number[]): Promise<void> {
  if (!Array.isArray(orderedIds) || orderedIds.length === 0) {
    throw new Error('Invalid orderedIds');
  }

  // ユーザーのテンプレート一覧を取得してバリデーション
  const userTemplates = await query<{ id: number }>(
    'SELECT id FROM message_templates WHERE user_id = $1',
    [userId],
  );
  const userTemplateIds = new Set(userTemplates.map((r) => r.id));

  for (const id of orderedIds) {
    if (!userTemplateIds.has(id)) {
      throw new Error('Invalid orderedIds: contains unknown or other user template');
    }
  }

  // 一括更新
  for (let i = 0; i < orderedIds.length; i++) {
    await execute(
      'UPDATE message_templates SET position = $1, updated_at = NOW() WHERE id = $2 AND user_id = $3',
      [i, orderedIds[i], userId],
    );
  }
}
