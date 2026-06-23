/**
 * テスト対象: components/Task/TaskGanttChart.tsx（簡易ガントチャート）
 * 戦略:
 *   - 期限があるタスクの期間バーと依存関係ラベルを検証する
 *   - 期限なし・空状態など、画面だけでは見落としやすい境界条件を検証する
 */

import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import TaskGanttChart from '../components/Task/TaskGanttChart';
import { makeTask } from './__fixtures__/tasks';

describe('TaskGanttChart', () => {
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
