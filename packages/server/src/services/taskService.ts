import { query, queryOne, execute } from '../db/database';
import type {
  Task,
  CreateTaskInput,
  UpdateTaskInput,
  UpdateTaskOrderItem,
  TaskStatus,
} from '@chat-app/shared';

const VALID_STATUSES: TaskStatus[] = ['todo', 'in_progress', 'done'];

interface TaskRow {
  id: number;
  title: string;
  description: string | null;
  status: string;
  assignee_id: number | null;
  assignee_username: string | null;
  due_at: string | null;
  source_message_id: number | null;
  source_channel_id: number | null;
  created_by: number | null;
  position: number;
  is_hidden: boolean;
  created_at: string;
  updated_at: string;
}

function rowToTask(row: TaskRow): Task {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    status: row.status as TaskStatus,
    assigneeId: row.assignee_id,
    assigneeUsername: row.assignee_username,
    dueAt: row.due_at,
    sourceMessageId: row.source_message_id,
    sourceChannelId: row.source_channel_id,
    createdBy: row.created_by,
    position: row.position,
    isHidden: row.is_hidden,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

const BASE_SELECT = `
  SELECT
    t.id, t.title, t.description, t.status,
    t.assignee_id, u.username AS assignee_username,
    t.due_at, t.source_message_id,
    COALESCE(t.source_channel_id, m.channel_id) AS source_channel_id,
    t.created_by, t.position, t.is_hidden, t.created_at, t.updated_at
  FROM tasks t
  LEFT JOIN users u ON u.id = t.assignee_id
  LEFT JOIN messages m ON m.id = t.source_message_id
`;

export async function createTask(createdBy: number, input: CreateTaskInput): Promise<Task> {
  const { title, description, assigneeId, dueAt, sourceMessageId, sourceChannelId } = input;

  if (!title || title.trim() === '') {
    throw new Error('Title is required');
  }

  // validate assignee exists
  if (assigneeId != null) {
    const user = await queryOne<{ id: number }>('SELECT id FROM users WHERE id = $1', [assigneeId]);
    if (!user) {
      throw new Error('Assignee not found');
    }
  }

  // validate source_message exists
  if (sourceMessageId != null) {
    const msg = await queryOne<{ id: number }>('SELECT id FROM messages WHERE id = $1', [
      sourceMessageId,
    ]);
    if (!msg) {
      throw new Error('Source message not found');
    }
  }

  // validate source_channel exists
  if (sourceChannelId != null) {
    const ch = await queryOne<{ id: number }>('SELECT id FROM channels WHERE id = $1', [
      sourceChannelId,
    ]);
    if (!ch) {
      throw new Error('Source channel not found');
    }
  }

  const result = await queryOne<{ id: number }>(
    `INSERT INTO tasks (title, description, assignee_id, due_at, source_message_id, source_channel_id, created_by, position)
     VALUES ($1, $2, $3, $4, $5, $6, $7, 0)
     RETURNING id`,
    [
      title.trim(),
      description ?? null,
      assigneeId ?? null,
      dueAt ?? null,
      sourceMessageId ?? null,
      sourceChannelId ?? null,
      createdBy,
    ],
  );

  const row = await queryOne<TaskRow>(BASE_SELECT + ' WHERE t.id = $1', [result!.id]);

  return rowToTask(row!);
}

export async function getTasks(filters?: {
  status?: string;
  assigneeId?: number;
  channelId?: number;
  includeHidden?: boolean;
}): Promise<Task[]> {
  const conditions: string[] = [];
  const params: unknown[] = [];
  let idx = 1;

  // デフォルトは非表示を除外
  if (!filters?.includeHidden) {
    conditions.push(`t.is_hidden = false`);
  }

  if (filters?.status) {
    conditions.push(`t.status = $${idx++}`);
    params.push(filters.status);
  }

  if (filters?.assigneeId != null) {
    conditions.push(`t.assignee_id = $${idx++}`);
    params.push(filters.assigneeId);
  }

  if (filters?.channelId != null) {
    // source_channel_id カラム直接参照（DB保存値）と source_message のチャンネル（JOIN経由）の両方を拾う
    conditions.push(`(t.source_channel_id = $${idx} OR m.channel_id = $${idx})`);
    params.push(filters.channelId);
    idx++;
  }

  const where = conditions.length > 0 ? ' WHERE ' + conditions.join(' AND ') : '';
  const sql = BASE_SELECT + where + ' ORDER BY t.status, t.position, t.id';

  const rows = await query<TaskRow>(sql, params);
  return rows.map(rowToTask);
}

export async function updateTask(taskId: number, input: UpdateTaskInput): Promise<Task> {
  const existing = await queryOne<{ id: number }>('SELECT id FROM tasks WHERE id = $1', [taskId]);
  if (!existing) {
    throw new Error('Task not found');
  }

  if (input.status !== undefined && !VALID_STATUSES.includes(input.status)) {
    throw new Error('Invalid status');
  }

  const sets: string[] = [];
  const params: unknown[] = [];
  let idx = 1;

  if (input.title !== undefined) {
    sets.push(`title = $${idx++}`);
    params.push(input.title);
  }
  if (input.description !== undefined) {
    sets.push(`description = $${idx++}`);
    params.push(input.description);
  }
  if (input.status !== undefined) {
    sets.push(`status = $${idx++}`);
    params.push(input.status);
  }
  if (input.assigneeId !== undefined) {
    sets.push(`assignee_id = $${idx++}`);
    params.push(input.assigneeId);
  }
  if (input.dueAt !== undefined) {
    sets.push(`due_at = $${idx++}`);
    params.push(input.dueAt);
  }
  if (input.isHidden !== undefined) {
    sets.push(`is_hidden = $${idx++}`);
    params.push(input.isHidden);
  }

  sets.push(`updated_at = NOW()`);
  params.push(taskId);

  await execute(`UPDATE tasks SET ${sets.join(', ')} WHERE id = $${idx}`, params);

  const row = await queryOne<TaskRow>(BASE_SELECT + ' WHERE t.id = $1', [taskId]);
  return rowToTask(row!);
}

export async function deleteTask(taskId: number): Promise<void> {
  await execute('DELETE FROM tasks WHERE id = $1', [taskId]);
}

export async function updateTaskOrder(items: UpdateTaskOrderItem[]): Promise<void> {
  if (items.length === 0) return;

  for (const item of items) {
    if (!VALID_STATUSES.includes(item.status)) {
      throw new Error('Invalid status');
    }
    if (typeof item.position !== 'number') {
      throw new Error('Invalid position');
    }
  }

  // 各タスクのステータスと position を更新
  for (const item of items) {
    await execute('UPDATE tasks SET status = $1, position = $2, updated_at = NOW() WHERE id = $3', [
      item.status,
      item.position,
      item.id,
    ]);
  }
}
