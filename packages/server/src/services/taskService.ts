import type { PoolClient, QueryResultRow } from 'pg';
import { query, queryOne, execute, withTransaction } from '../db/database';
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
  start_at: string | null;
  due_at: string | null;
  source_message_id: number | null;
  source_channel_id: number | null;
  created_by: number | null;
  position: number;
  is_hidden: boolean;
  parent_task_id: number | null;
  created_at: string;
  updated_at: string;
}

const BASE_SELECT = `
  SELECT
    t.id, t.title, t.description, t.status,
    t.assignee_id, u.username AS assignee_username,
    t.start_at, t.due_at, t.source_message_id,
    COALESCE(t.source_channel_id, m.channel_id) AS source_channel_id,
    t.created_by, t.position, t.is_hidden, t.parent_task_id, t.created_at, t.updated_at
  FROM tasks t
  LEFT JOIN users u ON u.id = t.assignee_id
  LEFT JOIN messages m ON m.id = t.source_message_id
`;

function rowToTask(
  row: TaskRow,
  dependencyIds: number[] = [],
  counts: { total: number; completed: number } = { total: 0, completed: 0 },
): Task {
  const subtaskCount = counts.total;
  const completedSubtaskCount = counts.completed;
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    status: row.status as TaskStatus,
    assigneeId: row.assignee_id,
    assigneeUsername: row.assignee_username,
    startAt: row.start_at,
    dueAt: row.due_at,
    sourceMessageId: row.source_message_id,
    sourceChannelId: row.source_channel_id,
    createdBy: row.created_by,
    position: row.position,
    isHidden: row.is_hidden,
    parentTaskId: row.parent_task_id,
    dependencyIds,
    progress:
      subtaskCount > 0
        ? Math.round((completedSubtaskCount / subtaskCount) * 100)
        : row.status === 'done'
          ? 100
          : 0,
    subtaskCount,
    completedSubtaskCount,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function normalizeDependencyIds(value: number[] | undefined): number[] | undefined {
  if (value === undefined) return undefined;
  if (!Array.isArray(value) || value.some((id) => !Number.isInteger(id) || id <= 0)) {
    throw new Error('Invalid dependency IDs');
  }
  return [...new Set(value)];
}

async function clientQuery<T extends QueryResultRow>(
  client: PoolClient,
  text: string,
  params: unknown[] = [],
): Promise<T[]> {
  return (await client.query<T>(text, params)).rows;
}

async function clientQueryOne<T extends QueryResultRow>(
  client: PoolClient,
  text: string,
  params: unknown[] = [],
): Promise<T | null> {
  return (await client.query<T>(text, params)).rows[0] ?? null;
}

async function assertTaskExists(
  client: PoolClient,
  taskId: number,
  message: string,
): Promise<void> {
  const task = await clientQueryOne<{ id: number }>(client, 'SELECT id FROM tasks WHERE id = $1', [
    taskId,
  ]);
  if (!task) throw new Error(message);
}

async function validateParent(
  client: PoolClient,
  taskId: number | null,
  parentTaskId: number | null,
): Promise<void> {
  if (parentTaskId == null) return;
  await assertTaskExists(client, parentTaskId, 'Parent task not found');
  if (taskId === parentTaskId) throw new Error('Task relationship cycle detected');

  let cursor: number | null = parentTaskId;
  const visited = new Set<number>();
  while (cursor != null && !visited.has(cursor)) {
    if (cursor === taskId) throw new Error('Task relationship cycle detected');
    visited.add(cursor);
    const row: { parent_task_id: number | null } | null = await clientQueryOne<{
      parent_task_id: number | null;
    }>(client, 'SELECT parent_task_id FROM tasks WHERE id = $1', [cursor]);
    cursor = row?.parent_task_id ?? null;
  }
}

async function dependencyReaches(
  client: PoolClient,
  startId: number,
  targetId: number,
): Promise<boolean> {
  const pending = [startId];
  const visited = new Set<number>();
  while (pending.length > 0) {
    const current = pending.pop()!;
    if (current === targetId) return true;
    if (visited.has(current)) continue;
    visited.add(current);
    const rows = await clientQuery<{ depends_on_task_id: number }>(
      client,
      'SELECT depends_on_task_id FROM task_dependencies WHERE task_id = $1',
      [current],
    );
    pending.push(...rows.map((row) => row.depends_on_task_id));
  }
  return false;
}

async function validateDependencies(
  client: PoolClient,
  taskId: number | null,
  dependencyIds: number[],
): Promise<void> {
  for (const dependencyId of dependencyIds) {
    await assertTaskExists(client, dependencyId, 'Dependency task not found');
    if (taskId != null && dependencyId === taskId) {
      throw new Error('Task dependency cycle detected');
    }
    if (taskId != null && (await dependencyReaches(client, dependencyId, taskId))) {
      throw new Error('Task dependency cycle detected');
    }
  }
}

async function dependencyMap(taskIds: number[]): Promise<Map<number, number[]>> {
  const result = new Map<number, number[]>();
  if (taskIds.length === 0) return result;
  const rows = await query<{ task_id: number; depends_on_task_id: number }>(
    'SELECT task_id, depends_on_task_id FROM task_dependencies ORDER BY depends_on_task_id',
  );
  for (const row of rows) {
    if (!taskIds.includes(row.task_id)) continue;
    result.set(row.task_id, [...(result.get(row.task_id) ?? []), row.depends_on_task_id]);
  }
  return result;
}

async function getTask(taskId: number): Promise<Task> {
  const row = await queryOne<TaskRow>(BASE_SELECT + ' WHERE t.id = $1', [taskId]);
  if (!row) throw new Error('Task not found');
  const dependencies = await query<{ depends_on_task_id: number }>(
    'SELECT depends_on_task_id FROM task_dependencies WHERE task_id = $1 ORDER BY depends_on_task_id',
    [taskId],
  );
  const children = await query<{ status: string }>(
    'SELECT status FROM tasks WHERE parent_task_id = $1',
    [taskId],
  );
  return rowToTask(
    row,
    dependencies.map((item) => item.depends_on_task_id),
    {
      total: children.length,
      completed: children.filter((child) => child.status === 'done').length,
    },
  );
}

async function replaceDependencies(
  client: PoolClient,
  taskId: number,
  dependencyIds: number[],
): Promise<void> {
  await client.query('DELETE FROM task_dependencies WHERE task_id = $1', [taskId]);
  for (const dependencyId of dependencyIds) {
    await client.query(
      'INSERT INTO task_dependencies (task_id, depends_on_task_id) VALUES ($1, $2)',
      [taskId, dependencyId],
    );
  }
}

export async function createTask(createdBy: number, input: CreateTaskInput): Promise<Task> {
  const {
    title,
    description,
    assigneeId,
    startAt,
    dueAt,
    sourceMessageId,
    sourceChannelId,
    parentTaskId = null,
  } = input;
  const dependencyIds = normalizeDependencyIds(input.dependencyIds) ?? [];
  if (!title || title.trim() === '') throw new Error('Title is required');
  const taskId = await withTransaction(async (client) => {
    await client.query('SELECT pg_advisory_xact_lock($1)', [396]);
    if (assigneeId != null)
      await assertTaskReference(client, 'users', assigneeId, 'Assignee not found');
    if (sourceMessageId != null)
      await assertTaskReference(client, 'messages', sourceMessageId, 'Source message not found');
    if (sourceChannelId != null)
      await assertTaskReference(client, 'channels', sourceChannelId, 'Source channel not found');
    await validateParent(client, null, parentTaskId);
    await validateDependencies(client, null, dependencyIds);
    const result = await client.query<{ id: number }>(
      `INSERT INTO tasks (title, description, assignee_id, start_at, due_at, source_message_id, source_channel_id, created_by, parent_task_id, position)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 0) RETURNING id`,
      [
        title.trim(),
        description ?? null,
        assigneeId ?? null,
        startAt ?? null,
        dueAt ?? null,
        sourceMessageId ?? null,
        sourceChannelId ?? null,
        createdBy,
        parentTaskId,
      ],
    );
    const id = result.rows[0].id;
    await replaceDependencies(client, id, dependencyIds);
    return id;
  });
  return getTask(taskId);
}

async function assertTaskReference(
  client: PoolClient,
  table: string,
  id: number,
  message: string,
): Promise<void> {
  const allowed = new Set(['users', 'messages', 'channels']);
  if (!allowed.has(table)) throw new Error('Invalid reference table');
  const row = await clientQueryOne<{ id: number }>(
    client,
    `SELECT id FROM ${table} WHERE id = $1`,
    [id],
  );
  if (!row) throw new Error(message);
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
  if (!filters?.includeHidden) conditions.push('t.is_hidden = false');
  if (filters?.status) {
    conditions.push(`t.status = $${idx++}`);
    params.push(filters.status);
  }
  if (filters?.assigneeId != null) {
    conditions.push(`t.assignee_id = $${idx++}`);
    params.push(filters.assigneeId);
  }
  if (filters?.channelId != null) {
    conditions.push(`(t.source_channel_id = $${idx} OR m.channel_id = $${idx})`);
    params.push(filters.channelId);
  }
  const where = conditions.length > 0 ? ` WHERE ${conditions.join(' AND ')}` : '';
  const rows = await query<TaskRow>(
    BASE_SELECT + where + ' ORDER BY t.status, t.position, t.id',
    params,
  );
  const dependencies = await dependencyMap(rows.map((row) => row.id));
  const children = await query<{ parent_task_id: number; status: string }>(
    'SELECT parent_task_id, status FROM tasks WHERE parent_task_id IS NOT NULL',
  );
  const childCounts = new Map<number, { total: number; completed: number }>();
  for (const child of children) {
    const current = childCounts.get(child.parent_task_id) ?? { total: 0, completed: 0 };
    current.total += 1;
    if (child.status === 'done') current.completed += 1;
    childCounts.set(child.parent_task_id, current);
  }
  return rows.map((row) => rowToTask(row, dependencies.get(row.id) ?? [], childCounts.get(row.id)));
}

export async function updateTask(taskId: number, input: UpdateTaskInput): Promise<Task> {
  if (input.status !== undefined && !VALID_STATUSES.includes(input.status)) {
    throw new Error('Invalid status');
  }
  const dependencyIds = normalizeDependencyIds(input.dependencyIds);

  const sets: string[] = [];
  const values: unknown[] = [];
  const add = (column: string, value: unknown) => {
    values.push(value);
    sets.push(`${column} = $${values.length}`);
  };
  if (input.title !== undefined) add('title', input.title);
  if (input.description !== undefined) add('description', input.description);
  if (input.status !== undefined) add('status', input.status);
  if (input.assigneeId !== undefined) add('assignee_id', input.assigneeId);
  if (input.startAt !== undefined) add('start_at', input.startAt);
  if (input.dueAt !== undefined) add('due_at', input.dueAt);
  if (input.isHidden !== undefined) add('is_hidden', input.isHidden);
  if (input.parentTaskId !== undefined) add('parent_task_id', input.parentTaskId);
  sets.push('updated_at = NOW()');

  await withTransaction(async (client) => {
    await client.query('SELECT pg_advisory_xact_lock($1)', [396]);
    await assertTaskExists(client, taskId, 'Task not found');
    if (input.parentTaskId !== undefined) await validateParent(client, taskId, input.parentTaskId);
    if (dependencyIds !== undefined) await validateDependencies(client, taskId, dependencyIds);
    values.push(taskId);
    await client.query(`UPDATE tasks SET ${sets.join(', ')} WHERE id = $${values.length}`, values);
    if (dependencyIds !== undefined) await replaceDependencies(client, taskId, dependencyIds);
  });
  return getTask(taskId);
}

export async function deleteTask(taskId: number): Promise<void> {
  await execute('DELETE FROM tasks WHERE id = $1', [taskId]);
}

export async function updateTaskOrder(items: UpdateTaskOrderItem[]): Promise<void> {
  if (items.length === 0) return;
  for (const item of items) {
    if (!VALID_STATUSES.includes(item.status)) throw new Error('Invalid status');
    if (typeof item.position !== 'number') throw new Error('Invalid position');
  }
  for (const item of items) {
    await execute('UPDATE tasks SET status = $1, position = $2, updated_at = NOW() WHERE id = $3', [
      item.status,
      item.position,
      item.id,
    ]);
  }
}
