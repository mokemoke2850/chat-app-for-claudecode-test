export type TaskStatus = 'todo' | 'in_progress' | 'done';

export interface Task {
  id: number;
  title: string;
  description: string | null;
  status: TaskStatus;
  assigneeId: number | null;
  assigneeUsername?: string | null;
  dueAt: string | null;
  sourceMessageId: number | null;
  sourceChannelId: number | null;
  createdBy: number | null;
  position: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreateTaskInput {
  title: string;
  description?: string;
  assigneeId?: number | null;
  dueAt?: string | null;
  sourceMessageId?: number | null;
  sourceChannelId?: number | null;
}

export interface UpdateTaskInput {
  title?: string;
  description?: string | null;
  status?: TaskStatus;
  assigneeId?: number | null;
  dueAt?: string | null;
}

export interface UpdateTaskOrderItem {
  id: number;
  status: TaskStatus;
  position: number;
}

export interface TaskListResponse {
  tasks: Task[];
}

export interface TaskResponse {
  task: Task;
}
