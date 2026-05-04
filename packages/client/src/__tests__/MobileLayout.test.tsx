/**
 * テスト対象: モバイル幅 (max-width: 767px) でのレイアウト分岐
 *   - DMPage (packages/client/src/pages/DMPage.tsx)
 *   - TaskBoardPage (packages/client/src/pages/TaskBoardPage.tsx)
 *   - CalendarPage (packages/client/src/pages/CalendarPage.tsx)
 *   - ChannelFilterPanel (packages/client/src/components/Calendar/ChannelFilterPanel.tsx)
 *   - DmConversationList (packages/client/src/components/DM/DmConversationList.tsx)
 *
 * 戦略:
 *   - window.matchMedia をモックして isMobile フラグの ON/OFF を制御する
 *   - "レイアウト分岐ロジック" "条件付きレンダリング" "遷移挙動" を検証する
 *   - スタイル値そのものや aria 属性だけのテストは書かない(AGENTS.md 方針)
 *   - api/client・SocketContext はスタブ化して対象コンポーネントに集中する
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import type { DmConversationWithDetails } from '@chat-app/shared';

// ---------------------------------------------------------------------------
// window.matchMedia モック (モバイル/デスクトップ切り替え用)
// ---------------------------------------------------------------------------

function setMobile(v: boolean) {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    configurable: true,
    value: vi.fn((query: string) => ({
      matches: v && query.includes('max-width: 767px'),
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
}

// ---------------------------------------------------------------------------
// 共通スタブ
// ---------------------------------------------------------------------------

vi.mock('../contexts/SocketContext', () => ({
  useSocket: () => null,
}));

vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 1, username: 'alice', displayName: null, avatarUrl: null, role: 'user' },
    logout: vi.fn(),
    updateUser: vi.fn(),
  }),
}));

vi.mock('../contexts/SnackbarContext', () => ({
  useSnackbar: () => ({ showError: vi.fn(), showSuccess: vi.fn() }),
}));

vi.mock('../contexts/ThemeContext', () => ({
  useTheme: () => ({ mode: 'light', toggleTheme: vi.fn() }),
}));

const mockNavigate = vi.hoisted(() => vi.fn());
vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>();
  return { ...actual, useNavigate: () => mockNavigate };
});

vi.mock('../components/Channel/ChannelList', () => ({
  default: () => <div data-testid="channel-list-stub" />,
}));

vi.mock('../components/Layout/SidebarDmList', () => ({
  default: () => <div data-testid="sidebar-dm-list-stub" />,
}));

vi.mock('../components/Layout/MobileBottomNav', () => ({
  default: () => <nav data-testid="mobile-bottom-nav" />,
}));

vi.mock('../components/Layout/Rail', () => ({
  default: () => <div data-testid="rail-stub" />,
}));

vi.mock('../components/Layout/SidebarFooter', () => ({
  default: () => <div data-testid="sidebar-footer-stub" />,
}));

vi.mock('../hooks/usePushNotifications', () => ({
  usePushNotifications: () => ({
    supported: false,
    subscribed: false,
    loading: false,
    error: null,
    subscribe: vi.fn(),
    unsubscribe: vi.fn(),
  }),
}));

// ---------------------------------------------------------------------------
// DM 関連スタブ
// ---------------------------------------------------------------------------

const makeConv = (id = 1): DmConversationWithDetails => ({
  id,
  userAId: 1,
  userBId: 2,
  createdAt: '2024-01-01T00:00:00Z',
  updatedAt: '2024-01-01T00:00:00Z',
  otherUser: { id: 2, username: 'bob', displayName: null, avatarUrl: null },
  unreadCount: 0,
  lastMessage: null,
});

vi.mock('../components/DM/MessageArea', () => ({
  default: () => <div data-testid="message-area-stub" />,
}));

vi.mock('../components/DM/NewDmDialog', () => ({
  default: () => null,
}));

vi.mock('../hooks/usePresence', () => ({
  usePresence: () => new Map(),
}));

vi.mock('../hooks/useDmConversationsSocket', () => ({
  useDmConversationsSocket: () => undefined,
}));

// ---------------------------------------------------------------------------
// Task 関連スタブ
// ---------------------------------------------------------------------------

vi.mock('@dnd-kit/core', () => ({
  DndContext: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  closestCorners: vi.fn(),
  PointerSensor: class {},
  useSensor: vi.fn(() => ({})),
  useSensors: vi.fn((...args: unknown[]) => args),
  useDroppable: vi.fn(() => ({ setNodeRef: vi.fn(), isOver: false })),
}));

vi.mock('@dnd-kit/sortable', () => ({
  SortableContext: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  verticalListSortingStrategy: vi.fn(),
  useSortable: () => ({
    attributes: {},
    listeners: {},
    setNodeRef: vi.fn(),
    transform: null,
    transition: null,
    isDragging: false,
  }),
  arrayMove: vi.fn(),
}));

vi.mock('@dnd-kit/utilities', () => ({
  CSS: { Transform: { toString: vi.fn(() => '') } },
}));

vi.mock('../components/Task/CreateTaskDialog', () => ({
  default: () => null,
}));

vi.mock('../components/Task/EditTaskDialog', () => ({
  default: () => null,
}));

// ---------------------------------------------------------------------------
// Calendar 関連スタブ
// ---------------------------------------------------------------------------

vi.mock('../components/Calendar/CalendarHeader', () => ({
  CalendarHeader: () => <div data-testid="calendar-header-stub" />,
}));

vi.mock('../components/Calendar/MonthView', () => ({
  MonthView: () => <div data-testid="month-view-stub" />,
}));

vi.mock('../components/Calendar/WeekView', () => ({
  WeekView: () => <div data-testid="week-view-stub" />,
}));

vi.mock('../components/Calendar/AgendaView', () => ({
  AgendaView: () => <div data-testid="agenda-view-stub" />,
}));

vi.mock('../components/Calendar/EventDetailDrawer', () => ({
  EventDetailDrawer: () => null,
}));

vi.mock('../components/Calendar/EventDialog', () => ({
  EventDialog: () => null,
}));

vi.mock('../components/Calendar/PollListDrawer', () => ({
  PollListDrawer: () => null,
}));

// ---------------------------------------------------------------------------
// api/client モック
// ---------------------------------------------------------------------------

vi.mock('../api/client', () => ({
  api: {
    dm: {
      listConversations: vi.fn().mockResolvedValue({ conversations: [] }),
      getMessages: vi.fn().mockResolvedValue({ messages: [] }),
      markAsRead: vi.fn().mockResolvedValue(undefined),
      createConversation: vi.fn(),
    },
    auth: {
      users: vi.fn().mockResolvedValue({ users: [] }),
    },
    tasks: {
      list: vi.fn().mockResolvedValue({ tasks: [] }),
      update: vi.fn(),
      delete: vi.fn(),
      updateOrder: vi.fn(),
    },
    channels: {
      list: vi.fn().mockResolvedValue({ channels: [] }),
    },
    messages: {
      search: vi.fn().mockResolvedValue({ messages: [] }),
    },
    calendar: {
      events: {
        list: vi.fn().mockResolvedValue({ events: [] }),
      },
    },
  },
}));

// ---------------------------------------------------------------------------
// インポート (vi.mock の後に必ず記述)
// ---------------------------------------------------------------------------

import { api } from '../api/client';
import DMPage, { resetDmConversationsCache } from '../pages/DMPage';
import TaskBoardPage from '../pages/TaskBoardPage';
import CalendarPage from '../pages/CalendarPage';
import DmConversationList from '../components/DM/DmConversationList';
import { ChannelFilterPanel } from '../components/Calendar/ChannelFilterPanel';

const mockDmApi = api.dm as unknown as {
  listConversations: ReturnType<typeof vi.fn>;
  getMessages: ReturnType<typeof vi.fn>;
  markAsRead: ReturnType<typeof vi.fn>;
};

// ---------------------------------------------------------------------------
// beforeEach
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.clearAllMocks();
  resetDmConversationsCache();
  setMobile(false);
  mockDmApi.listConversations.mockResolvedValue({ conversations: [] });
  mockDmApi.getMessages.mockResolvedValue({ messages: [] });
  mockDmApi.markAsRead.mockResolvedValue(undefined);
  (api.tasks.list as ReturnType<typeof vi.fn>).mockResolvedValue({ tasks: [] });
  (api.channels.list as ReturnType<typeof vi.fn>).mockResolvedValue({ channels: [] });
  (api.auth.users as ReturnType<typeof vi.fn>).mockResolvedValue({ users: [] });
  (api.calendar.events.list as ReturnType<typeof vi.fn>).mockResolvedValue({ events: [] });
  localStorage.clear();
});

// ===========================================================================
// DM画面 モバイルレイアウト
// ===========================================================================

describe('DMPage: モバイルレイアウト', () => {
  async function renderDMPage(isMobile = false) {
    setMobile(isMobile);
    await act(async () => {
      render(
        <MemoryRouter>
          <DMPage
            users={[{ id: 1, username: 'alice', displayName: null, avatarUrl: null }] as never}
          />
        </MemoryRouter>,
      );
    });
  }

  describe('デスクトップ時の基本動作 (モバイル分岐のベースライン確認)', () => {
    it('デスクトップ幅では会話一覧と右ペインが横並びで表示される', async () => {
      mockDmApi.listConversations.mockResolvedValue({ conversations: [makeConv()] });
      await renderDMPage(false);
      // 「ダイレクトメッセージ」はページヘッダーと DmConversationList 内部の2箇所に存在する
      expect(screen.getAllByText('ダイレクトメッセージ').length).toBeGreaterThanOrEqual(1);
      expect(screen.getByText('bob')).toBeInTheDocument();
      expect(screen.getByText('会話を選択してください')).toBeInTheDocument();
    });
  });

  describe('モバイル時: 一覧 → 会話の階層ナビゲーション', () => {
    it('モバイル幅かつ会話未選択時は会話一覧だけが表示され、メッセージエリアは非表示になる', async () => {
      mockDmApi.listConversations.mockResolvedValue({ conversations: [makeConv()] });
      await renderDMPage(true);
      expect(screen.getByText('bob')).toBeInTheDocument();
      expect(screen.queryByText('会話を選択してください')).not.toBeInTheDocument();
    });

    it('モバイル幅で会話をタップするとメッセージエリアが表示され、一覧は非表示になる', async () => {
      mockDmApi.listConversations.mockResolvedValue({ conversations: [makeConv()] });
      await renderDMPage(true);
      await userEvent.click(screen.getByText('bob'));
      await waitFor(() => {
        expect(screen.getByTestId('message-area-stub')).toBeInTheDocument();
      });
      // 会話選択後は DmConversationList ごと DOM から消える
      expect(screen.queryByTestId('dm-conversation-list')).not.toBeInTheDocument();
    });

    it('モバイル幅のメッセージ表示中に戻るボタンを押すと一覧に戻る', async () => {
      mockDmApi.listConversations.mockResolvedValue({ conversations: [makeConv()] });
      await renderDMPage(true);
      await userEvent.click(screen.getByText('bob'));
      await waitFor(() => {
        expect(screen.getByTestId('message-area-stub')).toBeInTheDocument();
      });
      await userEvent.click(screen.getByRole('button', { name: '一覧に戻る' }));
      await waitFor(() => {
        expect(screen.getByText('bob')).toBeInTheDocument();
      });
      expect(screen.queryByTestId('message-area-stub')).not.toBeInTheDocument();
    });
  });

  describe('DmConversationList: モバイル時の幅制御', () => {
    it('モバイル幅では DmConversationList が fullWidth 表示になる', () => {
      render(
        <MemoryRouter>
          <DmConversationList
            conversations={[makeConv()]}
            activeConvId={null}
            currentUserId={1}
            isMobile={true}
            onSelectConversation={vi.fn()}
            onNewDm={vi.fn()}
            onConversationsChange={vi.fn()}
          />
        </MemoryRouter>,
      );
      const listBox = screen.getByTestId('dm-conversation-list');
      expect(listBox).toHaveStyle({ width: '100%' });
    });

    it('デスクトップ幅では DmConversationList が固定幅 (280px) で表示される', () => {
      render(
        <MemoryRouter>
          <DmConversationList
            conversations={[makeConv()]}
            activeConvId={null}
            currentUserId={1}
            isMobile={false}
            onSelectConversation={vi.fn()}
            onNewDm={vi.fn()}
            onConversationsChange={vi.fn()}
          />
        </MemoryRouter>,
      );
      const listBox = screen.getByTestId('dm-conversation-list');
      expect(listBox).toHaveStyle({ width: '280px' });
    });
  });
});

// ===========================================================================
// タスク画面 モバイルレイアウト
// ===========================================================================

describe('TaskBoardPage: モバイルレイアウト', () => {
  async function renderTaskPage(isMobile = false) {
    setMobile(isMobile);
    await act(async () => {
      render(
        <MemoryRouter>
          <TaskBoardPage />
        </MemoryRouter>,
      );
    });
  }

  describe('ツールバーのレスポンシブ対応', () => {
    it('モバイル幅ではツールバーが縦方向にスタックして表示される', async () => {
      await renderTaskPage(true);
      const toolbar = screen.getByTestId('task-toolbar');
      expect(toolbar).toHaveStyle({ flexDirection: 'column' });
    });

    it('モバイル幅ではチャンネル絞り込みセレクトが全幅で表示される', async () => {
      await renderTaskPage(true);
      const filterForm = screen.getByTestId('task-channel-filter');
      expect(filterForm).toHaveStyle({ width: '100%' });
    });

    it('デスクトップ幅ではツールバーが横一列で表示される', async () => {
      await renderTaskPage(false);
      const toolbar = screen.getByTestId('task-toolbar');
      expect(toolbar).toHaveStyle({ flexDirection: 'row' });
    });
  });

  describe('カンバン列の横スクロール', () => {
    it('モバイル幅でもカンバン列コンテナが overflowX: auto でスクロール可能になっている', async () => {
      await renderTaskPage(true);
      const kanbanContainer = screen.getByTestId('kanban-container');
      expect(kanbanContainer).toHaveStyle({ overflowX: 'auto' });
    });

    it('カンバン列は minWidth が確保されており、モバイル幅でも潰れない', async () => {
      await renderTaskPage(true);
      const columns = screen.getAllByTestId(/^column-/);
      expect(columns.length).toBeGreaterThan(0);
      for (const col of columns) {
        const style = window.getComputedStyle(col);
        const minWidth = parseInt(style.minWidth || '0', 10);
        expect(minWidth).toBeGreaterThanOrEqual(260);
      }
    });
  });
});

// ===========================================================================
// カレンダー画面 モバイルレイアウト
// ===========================================================================

describe('CalendarPage: モバイルレイアウト', () => {
  async function renderCalendarPage(isMobile = false) {
    setMobile(isMobile);
    let result!: ReturnType<typeof render>;
    await act(async () => {
      result = render(
        <MemoryRouter>
          <CalendarPage />
        </MemoryRouter>,
      );
    });
    return result;
  }

  describe('ChannelFilterPanel の表示制御', () => {
    it('モバイル幅では ChannelFilterPanel が通常の左ペイン列に表示されない', async () => {
      await renderCalendarPage(true);
      expect(screen.queryByTestId('channel-filter-panel')).not.toBeInTheDocument();
    });

    it('モバイル幅でフィルターボタンをタップすると ChannelFilterPanel が Drawer として開く', async () => {
      await renderCalendarPage(true);
      const filterBtn = screen.getByRole('button', { name: /フィルター/ });
      await userEvent.click(filterBtn);
      await waitFor(() => {
        expect(screen.getByTestId('channel-filter-panel')).toBeInTheDocument();
      });
    });

    it('モバイル幅で Drawer を閉じると ChannelFilterPanel が非表示になる', async () => {
      await renderCalendarPage(true);
      const filterBtn = screen.getByRole('button', { name: /フィルター/ });
      await userEvent.click(filterBtn);
      await waitFor(() => {
        expect(screen.getByTestId('channel-filter-panel')).toBeInTheDocument();
      });
      const closeBtn = screen.getByRole('button', { name: '閉じる' });
      await userEvent.click(closeBtn);
      await waitFor(() => {
        expect(screen.queryByTestId('channel-filter-panel')).not.toBeInTheDocument();
      });
    });

    it('デスクトップ幅では ChannelFilterPanel が左ペインとして通常表示される', async () => {
      await renderCalendarPage(false);
      expect(screen.getByTestId('channel-filter-panel')).toBeInTheDocument();
    });
  });

  describe('カレンダーグリッドの幅確保', () => {
    it('モバイル幅では CalendarContent のメインエリアが全幅 (100%) で表示される', async () => {
      await renderCalendarPage(true);
      expect(screen.getByTestId('month-view-stub')).toBeInTheDocument();
      const calendarMain = screen.getByTestId('calendar-main-area');
      expect(calendarMain).toHaveStyle({ width: '100%' });
    });
  });
});

// ===========================================================================
// ChannelFilterPanel: 単体テスト
// ===========================================================================

describe('ChannelFilterPanel', () => {
  const baseProps = {
    channels: [],
    channelColors: new Map<number, string>(),
    channelFilter: new Set<number>(),
    onToggleChannel: vi.fn(),
    events: [],
    today: new Date('2024-01-15'),
    onEventClick: vi.fn(),
  };

  it('isDrawer=true のとき幅制限なしで表示される (Drawer 内用レイアウト)', () => {
    render(
      <MemoryRouter>
        <ChannelFilterPanel {...baseProps} isDrawer={true} />
      </MemoryRouter>,
    );
    const panel = screen.getByTestId('channel-filter-panel');
    expect(panel).not.toHaveStyle({ width: '220px' });
  });

  it('isDrawer=false または省略時は従来の 220px 幅の左ペインとして表示される', () => {
    render(
      <MemoryRouter>
        <ChannelFilterPanel {...baseProps} isDrawer={false} />
      </MemoryRouter>,
    );
    const panel = screen.getByTestId('channel-filter-panel');
    expect(panel).toHaveStyle({ width: '220px' });
  });
});
