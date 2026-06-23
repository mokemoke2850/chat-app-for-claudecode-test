/**
 * テスト対象: components/Task/TaskGanttChart.tsx（簡易ガントチャート）
 * 戦略:
 *   - 期限があるタスクの期間バーと依存関係ラベルを検証する
 *   - 期限なし・空状態など、画面だけでは見落としやすい境界条件を検証する
 *   - 期限クイック編集は callback payload とキャンセル挙動を検証し、API 更新は親ページで検証する
 */

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, it, expect, vi } from 'vitest';
import TaskGanttChart from '../components/Task/TaskGanttChart';
import { makeTask } from './__fixtures__/tasks';

const originalGetBoundingClientRect = Element.prototype.getBoundingClientRect;

function expectIsoDate(value: string | null | undefined, expectedDate: string) {
  expect(value).toBeTruthy();
  expectLocalDate(new Date(value!), expectedDate);
}

function mockTimelineRect(testId = 'gantt-timeline-1') {
  Element.prototype.getBoundingClientRect = function () {
    if ((this as HTMLElement).dataset.testid === testId) {
      return {
        x: 100,
        y: 0,
        left: 100,
        top: 0,
        right: 1100,
        bottom: 60,
        width: 1000,
        height: 60,
        toJSON: () => ({}),
      };
    }
    return originalGetBoundingClientRect.call(this);
  };
}

function timelineRange() {
  const axis = screen.getByTestId('gantt-date-axis');
  return {
    start: new Date(Number(axis.dataset.timelineStart)),
    end: new Date(Number(axis.dataset.timelineEnd)),
  };
}

function expectLocalDate(value: Date, expectedDate: string) {
  const yyyy = value.getFullYear();
  const mm = String(value.getMonth() + 1).padStart(2, '0');
  const dd = String(value.getDate()).padStart(2, '0');
  expect(`${yyyy}-${mm}-${dd}`).toBe(expectedDate);
}

function expectTimelineDate(value: Date, expectedDate: string) {
  expectLocalDate(value, expectedDate);
}

describe('TaskGanttChart', () => {
  afterEach(() => {
    vi.useRealTimers();
    Element.prototype.getBoundingClientRect = originalGetBoundingClientRect;
  });

  describe('日付軸付きガントUI', () => {
    describe('表示範囲ページネーション', () => {
      it('日表示では1ヶ月分だけを表示し、次へ/前へで1ヶ月ずつ移動できる', async () => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date('2026-06-15T12:00:00+09:00'));
        render(
          <TaskGanttChart
            tasks={[
              makeTask({
                id: 1,
                createdAt: '2026-06-01T00:00:00Z',
                dueAt: '2026-06-10T00:00:00Z',
              }),
            ]}
          />,
        );

        expectTimelineDate(timelineRange().start, '2026-06-01');
        expectTimelineDate(timelineRange().end, '2026-07-01');
        expect(screen.getByTestId('gantt-grid')).toHaveAttribute('data-grid-count', '30');

        fireEvent.click(screen.getByRole('button', { name: '次の表示範囲へ' }));
        expectTimelineDate(timelineRange().start, '2026-07-01');
        expectTimelineDate(timelineRange().end, '2026-08-01');
        expect(screen.getByTestId('gantt-grid')).toHaveAttribute('data-grid-count', '31');

        fireEvent.click(screen.getByRole('button', { name: '前の表示範囲へ' }));
        expectTimelineDate(timelineRange().start, '2026-06-01');
        expectTimelineDate(timelineRange().end, '2026-07-01');
      });

      it('週表示では3ヶ月分だけを表示し、次へ/前へで3ヶ月ずつ移動できる', async () => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date('2026-06-15T12:00:00+09:00'));
        render(
          <TaskGanttChart
            tasks={[
              makeTask({
                id: 1,
                createdAt: '2026-06-01T00:00:00Z',
                dueAt: '2026-06-10T00:00:00Z',
              }),
            ]}
          />,
        );

        fireEvent.click(screen.getByRole('button', { name: '週' }));
        expectTimelineDate(timelineRange().start, '2026-06-01');
        expectTimelineDate(timelineRange().end, '2026-09-01');
        expect(screen.getByTestId('gantt-grid')).toHaveAttribute('data-grid-count', '14');

        fireEvent.click(screen.getByRole('button', { name: '次の表示範囲へ' }));
        expectTimelineDate(timelineRange().start, '2026-09-01');
        expectTimelineDate(timelineRange().end, '2026-12-01');

        fireEvent.click(screen.getByRole('button', { name: '前の表示範囲へ' }));
        expectTimelineDate(timelineRange().start, '2026-06-01');
        expectTimelineDate(timelineRange().end, '2026-09-01');
      });

      it('月表示では2年分だけを表示し、次へ/前へで2年ずつ移動できる', async () => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date('2026-06-15T12:00:00+09:00'));
        render(
          <TaskGanttChart
            tasks={[
              makeTask({
                id: 1,
                createdAt: '2026-06-01T00:00:00Z',
                dueAt: '2026-06-10T00:00:00Z',
              }),
            ]}
          />,
        );

        fireEvent.click(screen.getByRole('button', { name: '月' }));
        expectTimelineDate(timelineRange().start, '2026-06-01');
        expectTimelineDate(timelineRange().end, '2028-06-01');
        expect(screen.getByTestId('gantt-grid')).toHaveAttribute('data-grid-count', '24');

        fireEvent.click(screen.getByRole('button', { name: '次の表示範囲へ' }));
        expectTimelineDate(timelineRange().start, '2028-06-01');
        expectTimelineDate(timelineRange().end, '2030-06-01');

        fireEvent.click(screen.getByRole('button', { name: '前の表示範囲へ' }));
        expectTimelineDate(timelineRange().start, '2026-06-01');
        expectTimelineDate(timelineRange().end, '2028-06-01');
      });

      it('今日へ戻る操作で現在日を含む表示範囲へ戻せる', async () => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date('2026-06-15T12:00:00+09:00'));
        render(
          <TaskGanttChart
            tasks={[
              makeTask({
                id: 1,
                createdAt: '2026-06-01T00:00:00Z',
                dueAt: '2026-06-10T00:00:00Z',
              }),
            ]}
          />,
        );

        fireEvent.click(screen.getByRole('button', { name: '次の表示範囲へ' }));
        expectTimelineDate(timelineRange().start, '2026-07-01');

        fireEvent.click(screen.getByRole('button', { name: '今日へ戻る' }));
        expectTimelineDate(timelineRange().start, '2026-06-01');
        expectTimelineDate(timelineRange().end, '2026-07-01');
        expect(screen.getByTestId('gantt-today-line')).toHaveAttribute('aria-label', '今日');
      });

      it('表示範囲に一部でも重なるタスクだけを描画し、範囲外タスクは非表示にする', () => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date('2026-06-15T12:00:00+09:00'));
        render(
          <TaskGanttChart
            tasks={[
              makeTask({
                id: 1,
                title: '範囲開始前から入る',
                startAt: '2026-05-25T00:00:00Z',
                dueAt: '2026-06-05T00:00:00Z',
              }),
              makeTask({
                id: 2,
                title: '範囲内から終了後へ出る',
                startAt: '2026-06-28T00:00:00Z',
                dueAt: '2026-07-05T00:00:00Z',
              }),
              makeTask({
                id: 3,
                title: '範囲全体をまたぐ',
                startAt: '2026-05-01T00:00:00Z',
                dueAt: '2026-08-01T00:00:00Z',
              }),
              makeTask({
                id: 4,
                title: '完全に前',
                startAt: '2026-05-01T00:00:00Z',
                dueAt: '2026-05-20T00:00:00Z',
              }),
              makeTask({
                id: 5,
                title: '完全に後',
                startAt: '2026-07-01T00:00:00Z',
                dueAt: '2026-07-10T00:00:00Z',
              }),
            ]}
          />,
        );

        expect(screen.getByText('範囲開始前から入る')).toBeInTheDocument();
        expect(screen.getByText('範囲内から終了後へ出る')).toBeInTheDocument();
        expect(screen.getByText('範囲全体をまたぐ')).toBeInTheDocument();
        expect(screen.queryByText('完全に前')).not.toBeInTheDocument();
        expect(screen.queryByText('完全に後')).not.toBeInTheDocument();
      });
    });

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
      expect(screen.getByTestId('gantt-grid')).toHaveAttribute('data-grid-count', '30');
      expect(screen.getAllByTestId(/^gantt-grid-line-/)).toHaveLength(30);
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

      fireEvent.click(screen.getByRole('button', { name: '週' }));
      expect(screen.getByTestId('task-gantt-chart')).toHaveAttribute('data-scale', 'week');
      expect(Number(screen.getByTestId('gantt-grid').dataset.gridCount)).toBeLessThan(dayGridCount);
      expect(screen.getByTestId('gantt-date-axis')).toHaveTextContent('週');

      fireEvent.click(screen.getByRole('button', { name: '月' }));
      expect(screen.getByTestId('task-gantt-chart')).toHaveAttribute('data-scale', 'month');
      expect(screen.getByTestId('gantt-date-axis')).toHaveTextContent('2026/6');
      expect(screen.getByTestId('gantt-date-axis')).toHaveTextContent('2026/7');
      expect(screen.getByTestId('gantt-bar-1').dataset.widthPercent).not.toBe(dayWidth);
    });
  });

  describe('期限クイック編集', () => {
    it('行クリックで期限編集ポップオーバーを開き、Enterで変更した期限を保存する', async () => {
      const onDueAtChange = vi.fn();
      render(
        <TaskGanttChart
          tasks={[
            makeTask({ id: 1, createdAt: '2026-06-01T00:00:00Z', dueAt: '2026-06-05T00:00:00Z' }),
          ]}
          onDueAtChange={onDueAtChange}
        />,
      );

      await userEvent.click(screen.getByTestId('gantt-row-1'));
      const input = screen.getByLabelText('期限を編集', { selector: 'input' });
      await userEvent.clear(input);
      await userEvent.type(input, '2026-06-08T09:30');
      fireEvent.keyDown(input, { key: 'Enter' });

      await waitFor(() => expect(onDueAtChange).toHaveBeenCalledTimes(1));
      expect(onDueAtChange).toHaveBeenCalledWith(
        expect.objectContaining({ id: 1 }),
        expect.any(String),
      );
      expectIsoDate(onDueAtChange.mock.calls[0][1], '2026-06-08');
    });

    it('編集アイコンで期限編集ポップオーバーを開き、Blurで変更した期限を保存する', async () => {
      const onDueAtChange = vi.fn();
      render(
        <TaskGanttChart
          tasks={[
            makeTask({ id: 1, createdAt: '2026-06-01T00:00:00Z', dueAt: '2026-06-05T00:00:00Z' }),
          ]}
          onDueAtChange={onDueAtChange}
        />,
      );

      await userEvent.click(screen.getByRole('button', { name: '期限を編集' }));
      const input = screen.getByLabelText('期限を編集', { selector: 'input' });
      await userEvent.clear(input);
      await userEvent.type(input, '2026-06-09T10:15');
      fireEvent.blur(input);

      await waitFor(() => expect(onDueAtChange).toHaveBeenCalledTimes(1));
      expectIsoDate(onDueAtChange.mock.calls[0][1], '2026-06-09');
    });

    it('期限編集ポップオーバーでEscapeを押すと変更を保存せず閉じる', async () => {
      const onDueAtChange = vi.fn();
      render(
        <TaskGanttChart
          tasks={[
            makeTask({ id: 1, createdAt: '2026-06-01T00:00:00Z', dueAt: '2026-06-05T00:00:00Z' }),
          ]}
          onDueAtChange={onDueAtChange}
        />,
      );

      await userEvent.click(screen.getByTestId('gantt-row-1'));
      const input = screen.getByLabelText('期限を編集', { selector: 'input' });
      await userEvent.clear(input);
      await userEvent.type(input, '2026-06-09T10:15');
      fireEvent.keyDown(input, { key: 'Escape' });

      expect(onDueAtChange).not.toHaveBeenCalled();
      await waitFor(() =>
        expect(
          screen.queryByLabelText('期限を編集', { selector: 'input' }),
        ).not.toBeInTheDocument(),
      );
    });

    it('期限なしにする操作でdueAtにnullを渡す', async () => {
      const onDueAtChange = vi.fn();
      render(
        <TaskGanttChart
          tasks={[
            makeTask({ id: 1, createdAt: '2026-06-01T00:00:00Z', dueAt: '2026-06-05T00:00:00Z' }),
          ]}
          onDueAtChange={onDueAtChange}
        />,
      );

      await userEvent.click(screen.getByRole('button', { name: '期限を編集' }));
      await userEvent.click(screen.getByRole('button', { name: '期限なしにする' }));

      expect(onDueAtChange).toHaveBeenCalledWith(expect.objectContaining({ id: 1 }), null);
    });

    it('右端の期限ハンドルを開始日より左へドラッグしても開始位置は変えず、期限だけを開始日に丸めて保存する', async () => {
      const onDueAtChange = vi.fn();
      const onStartAtChange = vi.fn();
      render(
        <TaskGanttChart
          tasks={[
            makeTask({
              id: 1,
              createdAt: '2026-06-01T00:00:00Z',
              startAt: '2026-06-10T00:00:00Z',
              dueAt: '2026-06-20T00:00:00Z',
            }),
          ]}
          onDueAtChange={onDueAtChange}
          onStartAtChange={onStartAtChange}
        />,
      );
      mockTimelineRect();
      const startPercentBefore = screen.getByTestId('gantt-bar-1').dataset.startPercent;

      fireEvent.pointerDown(screen.getByRole('button', { name: '期限をドラッグして変更' }), {
        clientX: 1100,
        pointerId: 1,
      });
      fireEvent.pointerMove(window, { clientX: -400, pointerId: 1 });
      expect(screen.getByTestId('gantt-bar-1').dataset.startPercent).toBe(startPercentBefore);
      fireEvent.pointerUp(window, { clientX: -400, pointerId: 1 });

      await waitFor(() => expect(onDueAtChange).toHaveBeenCalledTimes(1));
      expectIsoDate(onDueAtChange.mock.calls[0][1], '2026-06-10');
      expect(onStartAtChange).not.toHaveBeenCalled();
    });

    it('左端の開始日ハンドルをドラッグすると開始日だけを日単位にスナップして保存する', async () => {
      const onDueAtChange = vi.fn();
      const onStartAtChange = vi.fn();
      render(
        <TaskGanttChart
          tasks={[
            makeTask({
              id: 1,
              createdAt: '2026-06-01T00:00:00Z',
              startAt: '2026-06-10T00:00:00Z',
              dueAt: '2026-06-20T00:00:00Z',
            }),
          ]}
          onDueAtChange={onDueAtChange}
          onStartAtChange={onStartAtChange}
        />,
      );
      mockTimelineRect();

      fireEvent.pointerDown(screen.getByRole('button', { name: '開始日をドラッグして変更' }), {
        clientX: 100,
        pointerId: 1,
      });
      fireEvent.pointerMove(window, { clientX: 570, pointerId: 1 });
      fireEvent.pointerUp(window, { clientX: 570, pointerId: 1 });

      await waitFor(() => expect(onStartAtChange).toHaveBeenCalledTimes(1));
      expectIsoDate(onStartAtChange.mock.calls[0][1], '2026-06-15');
      expect(onDueAtChange).not.toHaveBeenCalled();
    });

    it('左端の開始日ハンドルを期限日より右へドラッグすると開始日を期限日に丸めて保存する', async () => {
      const onStartAtChange = vi.fn();
      render(
        <TaskGanttChart
          tasks={[
            makeTask({
              id: 1,
              createdAt: '2026-06-01T00:00:00Z',
              startAt: '2026-06-10T00:00:00Z',
              dueAt: '2026-06-20T00:00:00Z',
            }),
          ]}
          onStartAtChange={onStartAtChange}
        />,
      );
      mockTimelineRect();

      fireEvent.pointerDown(screen.getByRole('button', { name: '開始日をドラッグして変更' }), {
        clientX: 100,
        pointerId: 1,
      });
      fireEvent.pointerMove(window, { clientX: 2000, pointerId: 1 });
      fireEvent.pointerUp(window, { clientX: 2000, pointerId: 1 });

      await waitFor(() => expect(onStartAtChange).toHaveBeenCalledTimes(1));
      expectIsoDate(onStartAtChange.mock.calls[0][1], '2026-06-20');
    });
  });

  it('startAtがあるタスクはcreatedAtではなくstartAtから期限日までを期間バーとして描画する', () => {
    render(
      <TaskGanttChart
        tasks={[
          makeTask({ id: 1, createdAt: '2026-06-01T00:00:00Z', dueAt: '2026-06-05T00:00:00Z' }),
          makeTask({
            id: 2,
            createdAt: '2026-06-01T00:00:00Z',
            startAt: '2026-06-10T00:00:00Z',
            dueAt: '2026-06-20T00:00:00Z',
          }),
        ]}
      />,
    );

    expect(screen.getByTestId('gantt-period-label-2')).toHaveTextContent('2026/6/10 — 2026/6/20');
    expect(Number(screen.getByTestId('gantt-bar-2').dataset.startPercent)).toBeGreaterThan(
      Number(screen.getByTestId('gantt-bar-1').dataset.startPercent),
    );
  });

  it('startAtがないタスクは作成日から期限日までを期間バーとして描画する', () => {
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
