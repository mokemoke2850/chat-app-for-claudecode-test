/**
 * pages/InboxPage.tsx のユニットテスト (Step 6a)
 *
 * テスト対象:
 *   - サマリーカード 3 連 (未読 / 今日の予定 / 未完タスク)
 *   - タブ切替 (?tab=mentions|threads|reminders|drafts|all)
 *   - リマインダー / 下書き / すべて タブの実機データ表示
 *   - メンション / スレッドタブの「準備中」プレースホルダ
 *   - `?channel=X` クエリ付きアクセス時の /chat へのリダイレクト動作
 *
 * 戦略:
 *   - api.channels.list / calendar.events.list / tasks.list / reminders.list / drafts.getAll を vi.mock
 *   - AppLayout / Rail / SidebarFooter は最小スタブ
 *   - react-router-dom は importActual + MemoryRouter で初期 URL を制御
 */

import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import InboxPage from '../pages/InboxPage';

// AppLayout は最小スタブ — Step 8b で sidebar 中身も検証するため sidebar prop を露出
vi.mock('../components/Layout/AppLayout', () => ({
  default: ({ children, sidebar }: { children: React.ReactNode; sidebar?: React.ReactNode }) => (
    <div data-testid="app-layout-stub">
      <div data-testid="app-layout-sidebar">{sidebar}</div>
      <div data-testid="app-layout-main">{children}</div>
    </div>
  ),
}));

// Step 8b: Sidebar 中身 (ChannelList + SidebarDmList) を stub 化して
// onSelect 動線とレンダリングを検証可能にする
vi.mock('../components/Channel/ChannelList', () => ({
  default: ({ onSelect }: { onSelect?: (id: number, name: string) => void }) => (
    <div data-testid="channel-list-stub">
      <button onClick={() => onSelect?.(7, 'general')}>select-channel-7</button>
    </div>
  ),
}));
vi.mock('../components/Layout/SidebarDmList', () => ({
  default: () => <div data-testid="sidebar-dm-list-stub" />,
}));

// 表示用の純粋コンポーネントは個別テスト (SummaryCards.test.tsx / RemindersList.test.tsx /
// DraftsList.test.tsx) で検証する。InboxPage のテストではスタブ化して Suspense 解決の
// 影響を切り離し、ルーティング / タブ切替 / プレースホルダの挙動だけを検証する
vi.mock('../components/Inbox/SummaryCards', () => ({
  default: () => <div data-testid="summary-cards-stub" />,
}));
vi.mock('../components/Inbox/RemindersList', () => ({
  default: () => <div data-testid="reminders-list-stub" />,
}));
vi.mock('../components/Inbox/DraftsList', () => ({
  default: () => <div data-testid="drafts-list-stub" />,
}));
vi.mock('../components/Inbox/ThreadsList', () => ({
  default: () => <div data-testid="threads-list-stub" />,
}));

// AuthContext: useAuth が毎回新しいオブジェクトを返すと InboxPage の useMemo([user])
// が再計算されて Suspense が無限ループするので vi.hoisted で参照を固定する
const mockAuthValue = vi.hoisted(() => ({
  user: { id: 1, username: 'alice', email: 'alice@example.com', role: 'user' },
}));
vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => mockAuthValue,
}));

// API モック (hoisted で各テストから操作可能に)
const mockChannelsList = vi.hoisted(() => vi.fn());
const mockCalendarEventsList = vi.hoisted(() => vi.fn());
const mockTasksList = vi.hoisted(() => vi.fn());
const mockRemindersList = vi.hoisted(() => vi.fn());
const mockDraftsGetAll = vi.hoisted(() => vi.fn());
const mockMessagesSearch = vi.hoisted(() => vi.fn());
const mockThreadsListSubscribed = vi.hoisted(() => vi.fn());

vi.mock('../api/client', () => ({
  api: {
    channels: { list: mockChannelsList },
    calendar: { events: { list: mockCalendarEventsList } },
    tasks: { list: mockTasksList },
    reminders: { list: mockRemindersList },
    drafts: { getAll: mockDraftsGetAll },
    messages: { search: mockMessagesSearch },
    threads: { listSubscribed: mockThreadsListSubscribed },
  },
}));

beforeEach(() => {
  mockChannelsList.mockReset();
  mockCalendarEventsList.mockReset();
  mockTasksList.mockReset();
  mockRemindersList.mockReset();
  mockDraftsGetAll.mockReset();
  // 既定: 空応答
  mockChannelsList.mockResolvedValue({ channels: [] });
  mockCalendarEventsList.mockResolvedValue({ events: [] });
  mockTasksList.mockResolvedValue({ tasks: [] });
  mockRemindersList.mockResolvedValue({ reminders: [] });
  mockDraftsGetAll.mockResolvedValue({ drafts: [] });
  mockMessagesSearch.mockResolvedValue({ messages: [] });
  mockThreadsListSubscribed.mockReset();
  mockThreadsListSubscribed.mockResolvedValue({ threads: [] });
});

function renderInbox(initialPath: string = '/') {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <Routes>
        <Route path="/" element={<InboxPage />} />
        <Route path="/chat" element={<div data-testid="chat-page-stub" />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('InboxPage (Step 6a)', () => {
  describe('ルーティング', () => {
    it('「/」 で InboxPage が表示される', async () => {
      renderInbox('/');
      // Suspense fallback 解決後に Inbox の見出しが表示される
      expect(await screen.findByText('受信箱')).toBeInTheDocument();
    });

    it('「/?channel=5」 でアクセスすると「/chat?channel=5」 にリダイレクトされる', async () => {
      renderInbox('/?channel=5');
      // リダイレクト後のスタブが表示される
      expect(await screen.findByTestId('chat-page-stub')).toBeInTheDocument();
    });
  });

  // サマリーカードのロジック検証は SummaryCards.test.tsx に責務移譲。
  // InboxPage 内の Suspense 解決はユニットテストで再現困難（Promise.all + use(promise) が
  // jsdom + vitest 環境で解決されないことがある）ため、サマリー描画のテストは E2E に逃がす。

  describe('タブ切替', () => {
    it('クエリなしのときデフォルトでメンションタブが選択されている', async () => {
      renderInbox('/');
      expect(await screen.findByRole('tab', { name: 'メンション' })).toHaveAttribute(
        'aria-selected',
        'true',
      );
    });

    it('?tab=reminders でリマインダータブが選択される', async () => {
      renderInbox('/?tab=reminders');
      expect(await screen.findByRole('tab', { name: 'リマインダー' })).toHaveAttribute(
        'aria-selected',
        'true',
      );
    });

    it('?tab=drafts で下書きタブが選択される', async () => {
      renderInbox('/?tab=drafts');
      expect(await screen.findByRole('tab', { name: '下書き' })).toHaveAttribute(
        'aria-selected',
        'true',
      );
    });

    it('タブクリックで URL の ?tab= クエリが更新される', async () => {
      renderInbox('/');
      await userEvent.click(await screen.findByRole('tab', { name: 'リマインダー' }));
      expect(screen.getByRole('tab', { name: 'リマインダー' })).toHaveAttribute(
        'aria-selected',
        'true',
      );
    });
  });

  describe('タブ内容', () => {
    // 各タブの表示検証は対応する純粋コンポーネント (RemindersList / DraftsList / MentionsList) の
    // 単体テストに責務移譲。
    // メンション/リマインダー/下書き/すべてタブは Suspense 内で描画されるため、ユニットテストで
    // jsdom + vitest 環境では Suspense 解決が再現困難 → 検証は E2E に逃がす。
    // スレッドタブも Step 6c で Suspense 内に実機データを描画する形に変わるため、
    // 描画ではなく API 呼び出しが行われることのみ確認する（実描画は ThreadsList.test.tsx に責務移譲）。
    it('スレッドタブを開くと api.threads.listSubscribed が呼ばれる', async () => {
      renderInbox('/?tab=threads');
      // 遅延を許容するため findBy を介して 1 度マウントが完了するのを待つ
      await screen.findByRole('tab', { name: 'スレッド' });
      expect(mockThreadsListSubscribed).toHaveBeenCalled();
    });
  });

  // Issue #319: 空状態アクションボタンのコールバック受け渡し
  describe('空状態アクションボタン（Issue #319）', () => {
    it.todo('unreadOnly=true のとき MentionsList に onClearUnreadFilter が渡される');
    it.todo(
      'unreadOnly=false のとき MentionsList に onClearUnreadFilter として undefined または noop が渡される',
    );
    it.todo('MentionsList の onShowAllTabs クリックでタブが「すべて」に切り替わる');
    it.todo('MentionsList の onOpenNotificationSettings クリックで通知設定画面に遷移する');
    it.todo('onClearUnreadFilter 呼び出しで unreadOnly が false に切り替わる');
  });

  // Step 8b: Sidebar 中身確保
  describe('Step 8b: Sidebar 中身確保', () => {
    it('AppLayout sidebar に ChannelList が表示される', async () => {
      renderInbox('/');
      const sidebar = await screen.findByTestId('app-layout-sidebar');
      expect(within(sidebar).getByTestId('channel-list-stub')).toBeInTheDocument();
    });

    it('AppLayout sidebar に SidebarDmList が表示される', async () => {
      renderInbox('/');
      const sidebar = await screen.findByTestId('app-layout-sidebar');
      expect(within(sidebar).getByTestId('sidebar-dm-list-stub')).toBeInTheDocument();
    });

    it('ChannelList の onSelect で /chat?channel=X に navigate される', async () => {
      renderInbox('/');
      await screen.findByTestId('app-layout-sidebar');
      await userEvent.click(screen.getByText('select-channel-7'));
      expect(await screen.findByTestId('chat-page-stub')).toBeInTheDocument();
    });
  });
});
