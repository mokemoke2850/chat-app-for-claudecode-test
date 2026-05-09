/**
 * テスト対象: 受信箱タブの未読／既読フィルタトグル機能
 *
 * 対象ファイル:
 *   - packages/client/src/pages/InboxPage.tsx （トグルスイッチ UI・localStorage 永続化）
 *   - packages/client/src/components/Inbox/MentionsList.tsx （unreadOnly prop）
 *   - packages/client/src/components/Inbox/ThreadsList.tsx  （unreadOnly prop）
 *   - packages/client/src/components/Inbox/RemindersList.tsx（unreadOnly prop）
 *   - packages/client/src/components/Inbox/DraftsList.tsx   （unreadOnly prop）
 *
 * 戦略:
 *   - InboxPage のトグル UI は MemoryRouter + vi.mock で Suspense を切り離して検証する
 *   - localStorage の読み書きは vi.spyOn(Storage.prototype, ...) で検証する
 *   - 各 List コンポーネントの unreadOnly prop は各コンポーネント専用テストファイルに追記して検証する
 *     （MentionsList.test.tsx / ThreadsList.test.tsx / RemindersList.test.tsx / DraftsList.test.tsx）
 *   - このファイルでは InboxPage のトグル UI・localStorage 永続化・API 連携のみ検証する
 */

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import React from 'react';
import InboxPage from '../pages/InboxPage';

// ------ InboxPage テスト用モック ------

vi.mock('../components/Layout/AppLayout', () => ({
  default: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="app-layout-stub">{children}</div>
  ),
}));

vi.mock('../components/Channel/ChannelList', () => ({
  default: () => <div data-testid="channel-list-stub" />,
}));

vi.mock('../components/Layout/SidebarDmList', () => ({
  default: () => <div data-testid="sidebar-dm-list-stub" />,
}));

vi.mock('../components/Inbox/SummaryCards', () => ({
  default: () => <div data-testid="summary-cards-stub" />,
}));

vi.mock('../components/Inbox/RemindersList', () => ({
  default: ({ unreadOnly }: { unreadOnly?: boolean }) => (
    <div data-testid="reminders-list-stub" data-unread-only={String(unreadOnly ?? false)} />
  ),
}));

vi.mock('../components/Inbox/DraftsList', () => ({
  default: ({ unreadOnly }: { unreadOnly?: boolean }) => (
    <div data-testid="drafts-list-stub" data-unread-only={String(unreadOnly ?? false)} />
  ),
}));

vi.mock('../components/Inbox/MentionsList', () => ({
  default: ({ unreadOnly }: { unreadOnly?: boolean }) => (
    <div data-testid="mentions-list-stub" data-unread-only={String(unreadOnly ?? false)} />
  ),
}));

vi.mock('../components/Inbox/ThreadsList', () => ({
  default: ({ unreadOnly }: { unreadOnly?: boolean }) => (
    <div data-testid="threads-list-stub" data-unread-only={String(unreadOnly ?? false)} />
  ),
}));

const mockAuthValue = vi.hoisted(() => ({
  user: { id: 1, username: 'alice', email: 'alice@example.com', role: 'user' },
}));
vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => mockAuthValue,
}));

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
    reminders: { list: mockRemindersList, delete: vi.fn() },
    drafts: { getAll: mockDraftsGetAll },
    messages: { search: mockMessagesSearch },
    threads: { listSubscribed: mockThreadsListSubscribed },
  },
}));

beforeEach(() => {
  mockChannelsList.mockResolvedValue({ channels: [] });
  mockCalendarEventsList.mockResolvedValue({ events: [] });
  mockTasksList.mockResolvedValue({ tasks: [] });
  mockRemindersList.mockResolvedValue({ reminders: [] });
  mockDraftsGetAll.mockResolvedValue({ drafts: [] });
  mockMessagesSearch.mockResolvedValue({ messages: [] });
  mockThreadsListSubscribed.mockResolvedValue({ threads: [] });
  localStorage.clear();
});

afterEach(() => {
  localStorage.clear();
  vi.restoreAllMocks();
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

// ------ InboxPage トグルスイッチのテスト ------

describe('受信箱 未読フィルタトグル - InboxPage', () => {
  describe('トグルスイッチの表示', () => {
    it('メンションタブを開くとタブヘッダー右側にトグルスイッチが表示される', async () => {
      renderInbox('/?tab=mentions');
      expect(await screen.findByRole('checkbox', { name: /未読のみ/ })).toBeInTheDocument();
    });

    it('スレッドタブを開くとタブヘッダー右側にトグルスイッチが表示される', async () => {
      renderInbox('/?tab=threads');
      expect(await screen.findByRole('checkbox', { name: /未読のみ/ })).toBeInTheDocument();
    });

    it('リマインダータブを開くとタブヘッダー右側にトグルスイッチが表示される', async () => {
      renderInbox('/?tab=reminders');
      expect(await screen.findByRole('checkbox', { name: /未読のみ/ })).toBeInTheDocument();
    });

    it('下書きタブを開くとタブヘッダー右側にトグルスイッチが表示される', async () => {
      renderInbox('/?tab=drafts');
      expect(await screen.findByRole('checkbox', { name: /未読のみ/ })).toBeInTheDocument();
    });

    it('すべてタブを開くとタブヘッダー右側にトグルスイッチが表示される', async () => {
      renderInbox('/?tab=all');
      expect(await screen.findByRole('checkbox', { name: /未読のみ/ })).toBeInTheDocument();
    });
  });

  describe('トグルスイッチの初期状態', () => {
    it('localStorage に値がない場合は「未読のみ」がデフォルト状態（チェック済み）になる', async () => {
      renderInbox('/');
      const toggle = await screen.findByRole('checkbox', { name: /未読のみ/ });
      expect(toggle).toBeChecked();
    });

    it('localStorage に unreadOnly=false が保存されている場合は「全件」状態（未チェック）で開く', async () => {
      localStorage.setItem('inbox:unreadOnly', 'false');
      renderInbox('/');
      const toggle = await screen.findByRole('checkbox', { name: /未読のみ/ });
      expect(toggle).not.toBeChecked();
    });

    it('localStorage に unreadOnly=true が保存されている場合は「未読のみ」状態（チェック済み）で開く', async () => {
      localStorage.setItem('inbox:unreadOnly', 'true');
      renderInbox('/');
      const toggle = await screen.findByRole('checkbox', { name: /未読のみ/ });
      expect(toggle).toBeChecked();
    });
  });

  describe('トグルスイッチの操作', () => {
    it('「未読のみ」→「全件」に切り替えると localStorage に false が保存される', async () => {
      renderInbox('/');
      const toggle = await screen.findByRole('checkbox', { name: /未読のみ/ });
      // デフォルトは true (チェック済み)
      await userEvent.click(toggle);
      expect(localStorage.getItem('inbox:unreadOnly')).toBe('false');
    });

    it('「全件」→「未読のみ」に切り替えると localStorage に true が保存される', async () => {
      localStorage.setItem('inbox:unreadOnly', 'false');
      renderInbox('/');
      const toggle = await screen.findByRole('checkbox', { name: /未読のみ/ });
      await userEvent.click(toggle);
      expect(localStorage.getItem('inbox:unreadOnly')).toBe('true');
    });

    it('タブを切り替えてもトグルの状態が維持される', async () => {
      localStorage.setItem('inbox:unreadOnly', 'false');
      renderInbox('/');
      // 「全件」状態で開く
      const toggle = await screen.findByRole('checkbox', { name: /未読のみ/ });
      expect(toggle).not.toBeChecked();

      // スレッドタブに切り替え
      await userEvent.click(screen.getByRole('tab', { name: 'スレッド' }));
      // トグル状態が維持されている
      expect(screen.getByRole('checkbox', { name: /未読のみ/ })).not.toBeChecked();
    });
  });

  describe('フィルタ状態と API 呼び出しの連携', () => {
    it('unreadOnly=true のときメンションタブで api.messages.search が unreadOnly:true で呼ばれる', async () => {
      localStorage.setItem('inbox:unreadOnly', 'true');
      renderInbox('/?tab=mentions');
      await screen.findByRole('checkbox', { name: /未読のみ/ });
      expect(mockMessagesSearch).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ unreadOnly: true }),
      );
    });

    it('unreadOnly=false のときメンションタブで api.messages.search が unreadOnly:false で呼ばれる', async () => {
      localStorage.setItem('inbox:unreadOnly', 'false');
      renderInbox('/?tab=mentions');
      await screen.findByRole('checkbox', { name: /未読のみ/ });
      expect(mockMessagesSearch).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ unreadOnly: false }),
      );
    });

    it('スレッドタブで api.threads.listSubscribed が呼ばれ、unreadOnly フィルタはクライアント側（ThreadsList）で処理される', async () => {
      localStorage.setItem('inbox:unreadOnly', 'true');
      renderInbox('/?tab=threads');
      await screen.findByRole('checkbox', { name: /未読のみ/ });
      expect(mockThreadsListSubscribed).toHaveBeenCalled();
    });

    it('unreadOnly=true のときスレッドタブの threads-list-stub に unreadOnly:true が渡される', async () => {
      localStorage.setItem('inbox:unreadOnly', 'true');
      renderInbox('/?tab=threads');
      await screen.findByRole('checkbox', { name: /未読のみ/ });
      // モックコンポーネントが data-unread-only="true" を持つことを確認
      const stub = await screen.findByTestId('threads-list-stub');
      expect(stub).toHaveAttribute('data-unread-only', 'true');
    });

    it('unreadOnly=false のときスレッドタブの threads-list-stub に unreadOnly:false が渡される', async () => {
      localStorage.setItem('inbox:unreadOnly', 'false');
      renderInbox('/?tab=threads');
      await screen.findByRole('checkbox', { name: /未読のみ/ });
      const stub = await screen.findByTestId('threads-list-stub');
      expect(stub).toHaveAttribute('data-unread-only', 'false');
    });
  });
});
