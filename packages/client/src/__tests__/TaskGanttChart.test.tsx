/**
 * テスト対象: components/Task/TaskGanttChart.tsx（簡易ガントチャート）
 * 戦略:
 *   - 期限があるタスクの期間バーと依存関係ラベルを検証する
 *   - 期限なし・空状態など、画面だけでは見落としやすい境界条件を検証する
 */

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, it, expect, vi } from 'vitest';
import TaskGanttChart from '../components/Task/TaskGanttChart';
import { makeTask } from './__fixtures__/tasks';

describe('TaskGanttChart', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  describe('日付軸付きガントUI', () => {
    it('ガント表示に日付ヘッダーと対応する縦グリッドを表示する', () => {
      render(
        <TaskGanttChart
          tasks={[
            makeTask({ id: 1, createdAt: '2026-06-01T00:00:00Z', dueAt: '2026-06-03T00:00:00Z' }),
          ]}
        />,
      );

      expect(screen.getByTestId('gantt-date-axis')).toHaveTextContent('6/1');
      expect(screen.getByTestId('gantt-date-axis')).toHaveTextContent('6/2');
      expect(screen.getByTestId('gantt-date-axis')).toHaveTextContent('6/3');
      expect(screen.getByTestId('gantt-grid')).toHaveAttribute('data-grid-count', '3');
      expect(screen.getAllByTestId(/^gantt-grid-line-/)).toHaveLength(3);
    });

    it('タスク名列と時間軸列を分け、各バーを日付ヘッダーと同じ横軸に配置する', () => {
      render(
        <TaskGanttChart
          tasks={[
            makeTask({ id: 1, createdAt: '2026-06-01T00:00:00Z', dueAt: '2026-06-02T00:00:00Z' }),
            makeTask({ id: 2, createdAt: '2026-06-03T00:00:00Z', dueAt: '2026-06-04T00:00:00Z' }),
          ]}
        />,
      );

      expect(screen.getByTestId('gantt-task-column-header')).toHaveTextContent('タスク');
      expect(screen.getByTestId('gantt-timeline-column-header')).toHaveTextContent('期間');
      expect(screen.getByTestId('gantt-row-1')).toHaveAttribute('data-layout', 'task-and-timeline');
      expect(screen.getByTestId('gantt-bar-1').dataset.timelineStart).toBe(
        screen.getByTestId('gantt-date-axis').dataset.timelineStart,
      );
      expect(Number(screen.getByTestId('gantt-bar-2').dataset.startPercent)).toBeGreaterThan(
        Number(screen.getByTestId('gantt-bar-1').dataset.startPercent),
      );
    });

    it('各タスクの期間ラベルをバー上または近傍に表示する', () => {
      render(
        <TaskGanttChart
          tasks={[
            makeTask({
              id: 1,
              createdAt: '2026-06-01T00:00:00Z',
              dueAt: '2026-06-05T00:00:00Z',
            }),
          ]}
        />,
      );

      expect(screen.getByTestId('gantt-period-label-1')).toHaveTextContent('2026/6/1 — 2026/6/5');
    });

    it('今日が表示範囲内にある場合だけ今日線を表示する', () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2026-06-03T12:00:00+09:00'));
      const tasks = [
        makeTask({ id: 1, createdAt: '2026-06-01T00:00:00Z', dueAt: '2026-06-05T00:00:00Z' }),
      ];

      const { rerender } = render(<TaskGanttChart tasks={tasks} />);
      expect(screen.getByTestId('gantt-today-line')).toHaveAttribute('aria-label', '今日');

      vi.setSystemTime(new Date('2026-07-01T12:00:00+09:00'));
      rerender(<TaskGanttChart tasks={tasks} />);
      expect(screen.queryByTestId('gantt-today-line')).not.toBeInTheDocument();
    });

    it('日・週・月の表示粒度を切り替えられる', async () => {
      render(
        <TaskGanttChart
          tasks={[
            makeTask({ id: 1, createdAt: '2026-06-01T00:00:00Z', dueAt: '2026-07-10T00:00:00Z' }),
          ]}
        />,
      );

      expect(screen.getByTestId('task-gantt-chart')).toHaveAttribute('data-scale', 'day');
      const dayGridCount = Number(screen.getByTestId('gantt-grid').dataset.gridCount);
      const dayWidth = screen.getByTestId('gantt-bar-1').dataset.widthPercent;

      await userEvent.click(screen.getByRole('button', { name: '週' }));
      expect(screen.getByTestId('task-gantt-chart')).toHaveAttribute('data-scale', 'week');
      expect(Number(screen.getByTestId('gantt-grid').dataset.gridCount)).toBeLessThan(dayGridCount);
      expect(screen.getByTestId('gantt-date-axis')).toHaveTextContent('週');

      await userEvent.click(screen.getByRole('button', { name: '月' }));
      expect(screen.getByTestId('task-gantt-chart')).toHaveAttribute('data-scale', 'month');
      expect(screen.getByTestId('gantt-date-axis')).toHaveTextContent('2026/6');
      expect(screen.getByTestId('gantt-date-axis')).toHaveTextContent('2026/7');
      expect(screen.getByTestId('gantt-bar-1').dataset.widthPercent).not.toBe(dayWidth);
    });
  });

  it('作成日から期限日までを期間バーとして描画する', () => {
    render(
      <TaskGanttChart
        tasks={[
          makeTask({ id: 1, createdAt: '2026-06-01T00:00:00Z', dueAt: '2026-06-05T00:00:00Z' }),
        ]}
      />,
    );
    expect(Number(screen.getByTestId('gantt-bar-1').dataset.widthPercent)).toBeGreaterThan(0);
  });

  it('作成日と期限が異なるタスクを時間軸上の異なる位置と長さで描画する', () => {
    render(
      <TaskGanttChart
        tasks={[
          makeTask({ id: 1, createdAt: '2026-06-01T00:00:00Z', dueAt: '2026-06-10T00:00:00Z' }),
          makeTask({ id: 2, createdAt: '2026-06-05T00:00:00Z', dueAt: '2026-06-06T00:00:00Z' }),
        ]}
      />,
    );
    expect(screen.getByTestId('gantt-bar-1').dataset.widthPercent).not.toBe(
      screen.getByTestId('gantt-bar-2').dataset.widthPercent,
    );
    expect(screen.getByTestId('gantt-bar-1').dataset.startPercent).not.toBe(
      screen.getByTestId('gantt-bar-2').dataset.startPercent,
    );
  });

  it('複数の先行タスク名を対応する依存先タスクに表示する', () => {
    render(
      <TaskGanttChart
        tasks={[
          makeTask({ id: 1, title: '先行A' }),
          makeTask({ id: 2, title: '先行B' }),
          makeTask({ id: 3, title: '後続', dependencyIds: [1, 2], dueAt: '2026-06-10T00:00:00Z' }),
        ]}
      />,
    );
    expect(screen.getByTestId('gantt-row-3')).toHaveTextContent('先行: 先行A、先行B');
  });

  it('期限がないタスクはガント対象外として件数を案内する', () => {
    render(
      <TaskGanttChart
        tasks={[
          makeTask({ id: 1, dueAt: '2026-06-10T00:00:00Z' }),
          makeTask({ id: 2, dueAt: null }),
        ]}
      />,
    );
    expect(screen.getByText('期限なし: 1件')).toBeInTheDocument();
    expect(screen.queryByTestId('gantt-row-2')).not.toBeInTheDocument();
  });

  it('期限があるタスクがない場合は空状態を表示する', () => {
    render(<TaskGanttChart tasks={[makeTask({ dueAt: null })]} />);
    expect(screen.getByText('期限が設定されたタスクはありません')).toBeInTheDocument();
  });

  it('同日の期間でも幅を確保して描画する', () => {
    render(
      <TaskGanttChart
        tasks={[
          makeTask({ id: 1, createdAt: '2026-06-10T01:00:00Z', dueAt: '2026-06-10T20:00:00Z' }),
        ]}
      />,
    );
    expect(Number(screen.getByTestId('gantt-bar-1').dataset.widthPercent)).toBeGreaterThan(0);
  });
});
