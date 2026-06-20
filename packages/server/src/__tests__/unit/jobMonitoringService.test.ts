/**
 * テスト対象: services/jobMonitoringService.ts
 * 戦略: pg-mem 上のジョブ監視スナップショットをサービス層から更新・取得し、
 *       成功/失敗集計と停止警告の境界条件を検証する。
 */

import { getSharedTestDatabase, resetTestData } from '../__fixtures__/pgTestHelper';

const testDb = getSharedTestDatabase();
jest.mock('../../db/database', () => testDb);

import { getJobMonitoringStatuses, recordJobRun } from '../../services/jobMonitoringService';

beforeEach(async () => {
  await resetTestData(testDb);
});

describe('jobMonitoringService: 実行結果の記録', () => {
  it('成功した実行の最終時刻と成功回数を更新する', async () => {
    const ranAt = new Date('2030-01-01T00:00:00.000Z');
    await recordJobRun('scheduledMessages', 'success', null, ranAt);
    await recordJobRun('scheduledMessages', 'success', null, ranAt);
    const status = (await getJobMonitoringStatuses(ranAt))[0];
    expect(status).toEqual(expect.objectContaining({ lastRunAt: ranAt.toISOString(), successCount: 2, failureCount: 0 }));
  });

  it('失敗した実行の失敗回数・直近エラー・失敗時刻を更新する', async () => {
    const ranAt = new Date('2030-01-01T00:00:00.000Z');
    await recordJobRun('scheduledMessages', 'failure', 'boom', ranAt);
    const status = (await getJobMonitoringStatuses(ranAt))[0];
    expect(status).toEqual(expect.objectContaining({ successCount: 0, failureCount: 1,
      lastFailure: { message: 'boom', at: ranAt.toISOString() } }));
  });

  it('失敗後に成功しても直近の失敗内容を保持する', async () => {
    const failedAt = new Date('2030-01-01T00:00:00.000Z');
    await recordJobRun('scheduledMessages', 'failure', 'boom', failedAt);
    await recordJobRun('scheduledMessages', 'success', null, new Date('2030-01-01T00:00:30.000Z'));
    const status = (await getJobMonitoringStatuses(new Date('2030-01-01T00:00:30.000Z')))[0];
    expect(status.lastFailure).toEqual({ message: 'boom', at: failedAt.toISOString() });
  });
});

describe('jobMonitoringService: 管理画面向け一覧', () => {
  it('未実行のジョブを含む全ジョブを一覧で返す', async () => {
    expect((await getJobMonitoringStatuses()).map((job) => job.key)).toEqual([
      'scheduledMessages', 'messageReminders', 'calendarReminders',
    ]);
  });

  it('未実行のジョブは日時とエラーを null、成功失敗回数を 0 として返す', async () => {
    expect((await getJobMonitoringStatuses())[0]).toEqual(expect.objectContaining({
      status: 'warning', lastRunAt: null, nextRunAt: null, successCount: 0, failureCount: 0, lastFailure: null,
    }));
  });

  it('最終実行時刻から次回実行予定を算出する', async () => {
    const ranAt = new Date('2030-01-01T00:00:00.000Z');
    await recordJobRun('scheduledMessages', 'success', null, ranAt);
    expect((await getJobMonitoringStatuses(ranAt))[0].nextRunAt).toBe('2030-01-01T00:00:30.000Z');
  });

  it('最終実行から実行間隔の3倍を超えたジョブを警告状態にする', async () => {
    const ranAt = new Date('2030-01-01T00:00:00.000Z');
    await recordJobRun('scheduledMessages', 'success', null, ranAt);
    expect((await getJobMonitoringStatuses(new Date(ranAt.getTime() + 90_001)))[0].status).toBe('warning');
  });

  it('最終実行から実行間隔の3倍と同値のジョブを正常状態にする', async () => {
    const ranAt = new Date('2030-01-01T00:00:00.000Z');
    await recordJobRun('scheduledMessages', 'success', null, ranAt);
    expect((await getJobMonitoringStatuses(new Date(ranAt.getTime() + 90_000)))[0].status).toBe('normal');
  });
});
