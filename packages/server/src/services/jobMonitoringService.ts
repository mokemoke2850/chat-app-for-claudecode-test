import { execute, query } from '../db/database';

export type JobKey = 'scheduledMessages' | 'messageReminders' | 'calendarReminders';
export type JobRunStatus = 'success' | 'failure';

const JOBS: Array<{ key: JobKey; label: string; intervalMs: number }> = [
  { key: 'scheduledMessages', label: '予約送信', intervalMs: 30_000 },
  { key: 'messageReminders', label: 'メッセージリマインダー', intervalMs: 30_000 },
  { key: 'calendarReminders', label: 'カレンダーリマインダー', intervalMs: 30_000 },
];

interface JobMonitoringRow {
  job_key: JobKey;
  last_run_at: string | Date;
  success_count: number | string;
  failure_count: number | string;
  last_error: string | null;
  last_failure_at: string | Date | null;
}

export interface JobMonitoringStatus {
  key: JobKey;
  label: string;
  intervalMs: number;
  status: 'normal' | 'warning';
  lastRunAt: string | null;
  nextRunAt: string | null;
  successCount: number;
  failureCount: number;
  lastFailure: { message: string; at: string } | null;
}

export async function recordJobRun(
  key: JobKey,
  status: JobRunStatus,
  error: string | null = null,
  ranAt: Date = new Date(),
): Promise<void> {
  const successIncrement = status === 'success' ? 1 : 0;
  const failureIncrement = status === 'failure' ? 1 : 0;
  const timestamp = ranAt.toISOString();
  await execute(
    `INSERT INTO job_monitoring
       (job_key, last_run_at, success_count, failure_count, last_error, last_failure_at)
     VALUES ($1, $2, $3, $4, $5, $6)
     ON CONFLICT (job_key) DO UPDATE SET
       last_run_at = EXCLUDED.last_run_at,
       success_count = job_monitoring.success_count + EXCLUDED.success_count,
       failure_count = job_monitoring.failure_count + EXCLUDED.failure_count,
       last_error = CASE WHEN EXCLUDED.failure_count = 1 THEN EXCLUDED.last_error ELSE job_monitoring.last_error END,
       last_failure_at = CASE WHEN EXCLUDED.failure_count = 1 THEN EXCLUDED.last_failure_at ELSE job_monitoring.last_failure_at END`,
    [key, timestamp, successIncrement, failureIncrement, status === 'failure' ? error : null,
      status === 'failure' ? timestamp : null],
  );
}

export async function getJobMonitoringStatuses(now: Date = new Date()): Promise<JobMonitoringStatus[]> {
  const rows = await query<JobMonitoringRow>(
    `SELECT job_key, last_run_at, success_count, failure_count, last_error, last_failure_at
       FROM job_monitoring`,
  );
  const byKey = new Map(rows.map((row) => [row.job_key, row]));
  return JOBS.map((job) => {
    const row = byKey.get(job.key);
    const lastRunAt = row ? new Date(row.last_run_at) : null;
    const stale = lastRunAt === null || now.getTime() - lastRunAt.getTime() > job.intervalMs * 3;
    return {
      ...job,
      status: stale ? 'warning' : 'normal',
      lastRunAt: lastRunAt?.toISOString() ?? null,
      nextRunAt: lastRunAt ? new Date(lastRunAt.getTime() + job.intervalMs).toISOString() : null,
      successCount: Number(row?.success_count ?? 0),
      failureCount: Number(row?.failure_count ?? 0),
      lastFailure: row?.last_error && row.last_failure_at
        ? { message: row.last_error, at: new Date(row.last_failure_at).toISOString() }
        : null,
    };
  });
}
