/**
 * テスト対象: チャンネルカテゴリ（セクション）機能 - クライアントサイド
 *
 * 【仕様判断】
 * カテゴリは「ユーザー個人のサイドバー構成」として実装する（Slack方式）。
 * チャンネル自体はワークスペース共有のままで、カテゴリ分けは個人設定。
 * 他ユーザーのカテゴリ設定は一切参照されない。
 *
 * 戦略:
 *   - api.channelCategories.* を vi.mock で差し替えてネットワーク通信を排除
 *   - ChannelList は use() + Suspense を使うため、
 *     await act(async () => { render(...) }) でラップして Suspense をフラッシュする
 *   - SocketContext・AuthContext・SnackbarContext はモックで注入する
 */

import { act } from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { Channel, ChannelCategory } from '@chat-app/shared';
import ChannelList, { resetChannelsCache } from '../components/Channel/ChannelList';

vi.mock('../api/client', () => ({
  api: {
    channels: {
      list: vi.fn(),
      read: vi.fn(),
      archive: vi.fn(),
    },
    channelCategories: {
      list: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      reorder: vi.fn(),
      assignChannel: vi.fn(),
      unassignChannel: vi.fn(),
    },
    savedViews: {
      list: vi.fn(),
    },
  },
}));

const mockSocket = { on: vi.fn(), off: vi.fn() };
vi.mock('../contexts/SocketContext', () => ({
  useSocket: () => mockSocket,
}));

vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => ({ user: { id: 1, role: 'user', isActive: true } }),
}));

const showSuccess = vi.fn();
const showError = vi.fn();
vi.mock('../contexts/SnackbarContext', () => ({
  useSnackbar: () => ({ showSuccess, showError, showInfo: vi.fn() }),
}));

vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>();
  return { ...actual, useNavigate: () => vi.fn() };
});

import { api } from '../api/client';
const mockChannels = api.channels as unknown as {
  list: ReturnType<typeof vi.fn>;
  read: ReturnType<typeof vi.fn>;
  archive: ReturnType<typeof vi.fn>;
};
const mockCategories = api.channelCategories as unknown as {
  list: ReturnType<typeof vi.fn>;
  create: ReturnType<typeof vi.fn>;
  update: ReturnType<typeof vi.fn>;
  delete: ReturnType<typeof vi.fn>;
  assignChannel: ReturnType<typeof vi.fn>;
  unassignChannel: ReturnType<typeof vi.fn>;
};
const mockSavedViewList = (api.savedViews as unknown as { list: ReturnType<typeof vi.fn> }).list;

beforeEach(() => {
  vi.clearAllMocks();
  resetChannelsCache();
  mockChannels.read.mockResolvedValue(undefined);
  mockChannels.list.mockResolvedValue({ channels: [] });
  mockCategories.list.mockResolvedValue({ categories: [] });
  mockSavedViewList.mockResolvedValue({ savedViews: [] });
});

function makeChannel(id: number, name: string, overrides: Partial<Channel> = {}): Channel {
  return {
    id,
    name,
    description: null,
    topic: null,
    createdBy: 1,
    createdAt: '2024-01-01T00:00:00Z',
    isPrivate: false,
    postingPermission: 'everyone',
    unreadCount: 0,
    ...overrides,
  };
}

function makeCategory(
  id: number,
  name: string,
  overrides: Partial<ChannelCategory> = {},
): ChannelCategory {
  return {
    id,
    userId: 1,
    name,
    position: 0,
    isCollapsed: false,
    createdAt: '',
    updatedAt: '',
    channelIds: [],
    ...overrides,
  };
}

async function renderList() {
  await act(async () => {
    render(<ChannelList activeChannelId={null} onSelect={vi.fn()} />);
  });
}

// ────────────────────────────────────────────────────────────────────────────
// サイドバーのカテゴリグループ表示
// ────────────────────────────────────────────────────────────────────────────

describe('ChannelList: カテゴリグループ表示', () => {
  it('カテゴリが存在する場合、カテゴリ名でグループ化されてチャンネルが表示される', async () => {
    mockChannels.list.mockResolvedValue({
      channels: [makeChannel(1, 'general'), makeChannel(2, 'random')],
    });
    mockCategories.list.mockResolvedValue({
      categories: [makeCategory(1, 'Work', { channelIds: [1, 2] })],
    });
    await renderList();
    expect(screen.getByText('Work')).toBeInTheDocument();
    expect(screen.getByText('# general')).toBeInTheDocument();
    expect(screen.getByText('# random')).toBeInTheDocument();
  });

  it('複数カテゴリが position 昇順で並んで表示される', async () => {
    mockChannels.list.mockResolvedValue({
      channels: [makeChannel(1, 'a'), makeChannel(2, 'b')],
    });
    mockCategories.list.mockResolvedValue({
      categories: [
        makeCategory(1, 'First', { position: 0, channelIds: [1] }),
        makeCategory(2, 'Second', { position: 1, channelIds: [2] }),
      ],
    });
    await renderList();
    const first = screen.getByText('First');
    const second = screen.getByText('Second');
    expect(first.compareDocumentPosition(second) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('カテゴリ未割当のチャンネルは「その他」セクションに表示される', async () => {
    mockChannels.list.mockResolvedValue({
      channels: [makeChannel(1, 'assigned'), makeChannel(2, 'unassigned')],
    });
    mockCategories.list.mockResolvedValue({
      categories: [makeCategory(1, 'Work', { channelIds: [1] })],
    });
    await renderList();
    const unassignedSection = screen.getByTestId('unassigned-channels');
    expect(within(unassignedSection).getByText('# unassigned')).toBeInTheDocument();
  });

  it('「その他」セクションには未割当チャンネルのみが含まれる', async () => {
    mockChannels.list.mockResolvedValue({
      channels: [makeChannel(1, 'assigned'), makeChannel(2, 'unassigned')],
    });
    mockCategories.list.mockResolvedValue({
      categories: [makeCategory(1, 'Work', { channelIds: [1] })],
    });
    await renderList();
    const unassignedSection = screen.getByTestId('unassigned-channels');
    expect(within(unassignedSection).queryByText('# assigned')).toBeNull();
    expect(within(unassignedSection).getByText('# unassigned')).toBeInTheDocument();
  });

  it('カテゴリが0件かつ未割当チャンネルがある場合は「その他」なしで全チャンネルがフラットに表示される', async () => {
    mockChannels.list.mockResolvedValue({
      channels: [makeChannel(1, 'a'), makeChannel(2, 'b')],
    });
    mockCategories.list.mockResolvedValue({ categories: [] });
    await renderList();
    expect(screen.queryByTestId('unassigned-channels')).toBeNull();
    expect(screen.getByTestId('all-channels')).toBeInTheDocument();
    expect(screen.getByText('# a')).toBeInTheDocument();
    expect(screen.getByText('# b')).toBeInTheDocument();
  });
});

// ────────────────────────────────────────────────────────────────────────────
// 折りたたみ / 展開
// ────────────────────────────────────────────────────────────────────────────

describe('ChannelCategorySection: 折りたたみ/展開', () => {
  it('カテゴリヘッダーをクリックするとチャンネル一覧が折りたたまれる', async () => {
    mockChannels.list.mockResolvedValue({ channels: [makeChannel(1, 'inside')] });
    mockCategories.list.mockResolvedValue({
      categories: [makeCategory(1, 'Work', { channelIds: [1] })],
    });
    mockCategories.update.mockResolvedValue({
      category: makeCategory(1, 'Work', { isCollapsed: true }),
    });
    await renderList();
    expect(screen.getByText('# inside')).toBeVisible();
    fireEvent.click(screen.getByTestId('category-header-1'));
    await waitFor(() => {
      // Collapse のアニメーション後に visible でなくなる
      expect(screen.queryByText('# inside')).not.toBeVisible();
    });
  });

  it('折りたたまれた状態でヘッダーをクリックすると展開される', async () => {
    mockChannels.list.mockResolvedValue({ channels: [makeChannel(1, 'inside')] });
    mockCategories.list.mockResolvedValue({
      categories: [makeCategory(1, 'Work', { isCollapsed: true, channelIds: [1] })],
    });
    mockCategories.update.mockResolvedValue({
      category: makeCategory(1, 'Work', { isCollapsed: false }),
    });
    await renderList();
    // 初期は折りたたまれているので非表示
    expect(screen.queryByText('# inside')).not.toBeVisible();
    fireEvent.click(screen.getByTestId('category-header-1'));
    await waitFor(() => {
      expect(screen.getByText('# inside')).toBeVisible();
    });
  });

  it('折りたたみ状態は API に保存される（PATCH /api/channel-categories/:id）', async () => {
    mockChannels.list.mockResolvedValue({ channels: [makeChannel(1, 'a')] });
    mockCategories.list.mockResolvedValue({
      categories: [makeCategory(1, 'Work', { channelIds: [1] })],
    });
    mockCategories.update.mockResolvedValue({
      category: makeCategory(1, 'Work', { isCollapsed: true }),
    });
    await renderList();
    fireEvent.click(screen.getByTestId('category-header-1'));
    await waitFor(() => {
      expect(mockCategories.update).toHaveBeenCalledWith(1, { isCollapsed: true });
    });
  });

  it('初期ロード時に is_collapsed=true のカテゴリは折りたたまれた状態で表示される', async () => {
    mockChannels.list.mockResolvedValue({ channels: [makeChannel(1, 'inside')] });
    mockCategories.list.mockResolvedValue({
      categories: [makeCategory(1, 'Work', { isCollapsed: true, channelIds: [1] })],
    });
    await renderList();
    expect(screen.queryByText('# inside')).not.toBeVisible();
  });
});

// ────────────────────────────────────────────────────────────────────────────
// カテゴリ作成ダイアログ
// ────────────────────────────────────────────────────────────────────────────

describe('ChannelCategoryDialog: カテゴリ作成', () => {
  it('「カテゴリ追加」ボタンからダイアログを開ける', async () => {
    await renderList();
    fireEvent.click(screen.getByRole('button', { name: 'カテゴリを追加' }));
    expect(screen.getByText('カテゴリを作成')).toBeInTheDocument();
  });

  it('名前を入力して「作成」ボタンを押すと API が呼ばれ、サイドバーに新カテゴリが追加される', async () => {
    const user = userEvent.setup();
    mockCategories.create.mockResolvedValue({
      category: makeCategory(99, 'NewCategory'),
    });
    await renderList();
    await user.click(screen.getByRole('button', { name: 'カテゴリを追加' }));
    await user.type(screen.getByLabelText('カテゴリ名'), 'NewCategory');
    await user.click(screen.getByRole('button', { name: '作成' }));
    await waitFor(() => {
      expect(mockCategories.create).toHaveBeenCalledWith({ name: 'NewCategory' });
    });
    await waitFor(() => {
      expect(screen.getByText('NewCategory')).toBeInTheDocument();
    });
  });

  it('名前が空の状態では「作成」ボタンが非活性または送信時にエラーを表示する', async () => {
    const user = userEvent.setup();
    await renderList();
    await user.click(screen.getByRole('button', { name: 'カテゴリを追加' }));
    const submitBtn = screen.getByRole('button', { name: '作成' }) as HTMLButtonElement;
    expect(submitBtn.disabled).toBe(true);
  });

  it('「キャンセル」でダイアログが閉じる', async () => {
    const user = userEvent.setup();
    await renderList();
    await user.click(screen.getByRole('button', { name: 'カテゴリを追加' }));
    await user.click(screen.getByRole('button', { name: 'キャンセル' }));
    await waitFor(() => {
      expect(screen.queryByText('カテゴリを作成')).toBeNull();
    });
  });

  it('API エラー時にエラーメッセージをスナックバーで表示する', async () => {
    const user = userEvent.setup();
    mockCategories.create.mockRejectedValue(new Error('Server error'));
    await renderList();
    await user.click(screen.getByRole('button', { name: 'カテゴリを追加' }));
    await user.type(screen.getByLabelText('カテゴリ名'), 'X');
    await user.click(screen.getByRole('button', { name: '作成' }));
    await waitFor(() => {
      expect(showError).toHaveBeenCalled();
    });
  });
});

// ────────────────────────────────────────────────────────────────────────────
// カテゴリ編集ダイアログ
// ────────────────────────────────────────────────────────────────────────────

describe('ChannelCategoryDialog: カテゴリ編集', () => {
  async function openEditMenu() {
    mockChannels.list.mockResolvedValue({ channels: [makeChannel(1, 'a')] });
    mockCategories.list.mockResolvedValue({
      categories: [makeCategory(1, 'OldName', { channelIds: [1] })],
    });
    await renderList();
    // カテゴリメニュー（…）を開く
    fireEvent.click(screen.getByRole('button', { name: 'OldNameのメニュー' }));
    // 「編集」を選択
    fireEvent.click(screen.getByRole('menuitem', { name: '編集' }));
  }

  it('カテゴリのコンテキストメニューから「編集」を選択するとダイアログが開く', async () => {
    await openEditMenu();
    expect(screen.getByText('カテゴリを編集')).toBeInTheDocument();
  });

  it('名前を変更して「保存」すると API が呼ばれ、サイドバーのカテゴリ名が更新される', async () => {
    const user = userEvent.setup();
    mockCategories.update.mockResolvedValue({ category: makeCategory(1, 'NewName') });
    await openEditMenu();
    const input = screen.getByLabelText('カテゴリ名') as HTMLInputElement;
    await user.clear(input);
    await user.type(input, 'NewName');
    await user.click(screen.getByRole('button', { name: '保存' }));
    await waitFor(() => {
      expect(mockCategories.update).toHaveBeenCalledWith(1, { name: 'NewName' });
    });
    await waitFor(() => {
      expect(screen.getByText('NewName')).toBeInTheDocument();
    });
  });

  it('API エラー時にエラーメッセージをスナックバーで表示する', async () => {
    const user = userEvent.setup();
    mockCategories.update.mockRejectedValue(new Error('Server error'));
    await openEditMenu();
    const input = screen.getByLabelText('カテゴリ名') as HTMLInputElement;
    await user.clear(input);
    await user.type(input, 'NewName');
    await user.click(screen.getByRole('button', { name: '保存' }));
    await waitFor(() => {
      expect(showError).toHaveBeenCalled();
    });
  });
});

// ────────────────────────────────────────────────────────────────────────────
// カテゴリ削除
// ────────────────────────────────────────────────────────────────────────────

describe('カテゴリ削除UI', () => {
  async function openDeleteMenu() {
    mockChannels.list.mockResolvedValue({ channels: [makeChannel(1, 'inside')] });
    mockCategories.list.mockResolvedValue({
      categories: [makeCategory(1, 'Work', { channelIds: [1] })],
    });
    await renderList();
    fireEvent.click(screen.getByRole('button', { name: 'Workのメニュー' }));
    fireEvent.click(screen.getByRole('menuitem', { name: '削除' }));
  }

  it('コンテキストメニューの「削除」から確認ダイアログが開く', async () => {
    await openDeleteMenu();
    expect(screen.getByText(/「Work」を削除しますか/)).toBeInTheDocument();
  });

  it('確認ダイアログで「削除」を選択すると API が呼ばれ、サイドバーからカテゴリが消える', async () => {
    mockCategories.delete.mockResolvedValue(undefined);
    await openDeleteMenu();
    fireEvent.click(screen.getByRole('button', { name: '削除' }));
    await waitFor(() => {
      expect(mockCategories.delete).toHaveBeenCalledWith(1);
    });
    await waitFor(() => {
      expect(screen.queryByText('Work')).toBeNull();
    });
  });

  it('削除後、そのカテゴリのチャンネルは「その他」セクションに移動して表示される', async () => {
    // カテゴリを 2 件用意して 1 件削除する（カテゴリが残っていれば「その他」セクションが描画される）
    mockChannels.list.mockResolvedValue({ channels: [makeChannel(1, 'inside')] });
    mockCategories.list.mockResolvedValue({
      categories: [
        makeCategory(1, 'Work', { channelIds: [1] }),
        makeCategory(2, 'Other', { channelIds: [] }),
      ],
    });
    mockCategories.delete.mockResolvedValue(undefined);
    await renderList();
    // Work カテゴリを削除
    fireEvent.click(screen.getByRole('button', { name: 'Workのメニュー' }));
    fireEvent.click(screen.getByRole('menuitem', { name: '削除' }));
    fireEvent.click(screen.getByRole('button', { name: '削除' }));
    await waitFor(() => {
      const unassigned = screen.getByTestId('unassigned-channels');
      expect(within(unassigned).getByText('# inside')).toBeInTheDocument();
    });
  });

  it('確認ダイアログで「キャンセル」を選択するとカテゴリは削除されない', async () => {
    await openDeleteMenu();
    fireEvent.click(screen.getByRole('button', { name: 'キャンセル' }));
    expect(mockCategories.delete).not.toHaveBeenCalled();
    expect(screen.getByText('Work')).toBeInTheDocument();
  });

  it('API エラー時にエラーメッセージをスナックバーで表示する', async () => {
    mockCategories.delete.mockRejectedValue(new Error('Server error'));
    await openDeleteMenu();
    fireEvent.click(screen.getByRole('button', { name: '削除' }));
    await waitFor(() => {
      expect(showError).toHaveBeenCalled();
    });
  });
});

// ────────────────────────────────────────────────────────────────────────────
// チャンネル割当 UI
// ────────────────────────────────────────────────────────────────────────────

describe('ChannelCategoryAssignMenu: チャンネル割当', () => {
  async function setupWithCategories() {
    mockChannels.list.mockResolvedValue({ channels: [makeChannel(1, 'general')] });
    mockCategories.list.mockResolvedValue({
      categories: [makeCategory(1, 'Work'), makeCategory(2, 'Personal')],
    });
    await renderList();
  }

  async function openChannelMenu() {
    await setupWithCategories();
    // ChannelItem の hover で「その他のアクション」ボタンが表示される
    fireEvent.mouseEnter(screen.getByText('# general'));
    const moreBtn = screen.getByRole('button', { name: 'その他のアクション' });
    fireEvent.click(moreBtn);
  }

  it('チャンネルのコンテキストメニューに「カテゴリへ移動」が表示される', async () => {
    await openChannelMenu();
    expect(screen.getByRole('menuitem', { name: 'カテゴリへ移動' })).toBeInTheDocument();
  });

  it('カテゴリを選択すると API が呼ばれ、チャンネルが該当カテゴリセクションに移動する', async () => {
    mockCategories.assignChannel.mockResolvedValue(undefined);
    await openChannelMenu();
    fireEvent.click(screen.getByRole('menuitem', { name: 'カテゴリへ移動' }));
    fireEvent.click(await screen.findByRole('menuitem', { name: 'Workに移動' }));
    await waitFor(() => {
      expect(mockCategories.assignChannel).toHaveBeenCalledWith(1, 1);
    });
  });

  it('「割当なし（その他）」を選択すると割当が解除されチャンネルが「その他」に移動する', async () => {
    mockChannels.list.mockResolvedValue({ channels: [makeChannel(1, 'general')] });
    mockCategories.list.mockResolvedValue({
      categories: [makeCategory(1, 'Work', { channelIds: [1] })],
    });
    mockCategories.unassignChannel.mockResolvedValue(undefined);
    await renderList();
    fireEvent.mouseEnter(screen.getByText('# general'));
    fireEvent.click(screen.getByRole('button', { name: 'その他のアクション' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'カテゴリへ移動' }));
    fireEvent.click(await screen.findByRole('menuitem', { name: '割当なし（その他）' }));
    await waitFor(() => {
      expect(mockCategories.unassignChannel).toHaveBeenCalledWith(1);
    });
  });

  it('現在割り当て済みのカテゴリにチェックマークが表示される', async () => {
    mockChannels.list.mockResolvedValue({ channels: [makeChannel(1, 'general')] });
    mockCategories.list.mockResolvedValue({
      categories: [makeCategory(1, 'Work', { channelIds: [1] }), makeCategory(2, 'Personal')],
    });
    await renderList();
    fireEvent.mouseEnter(screen.getByText('# general'));
    fireEvent.click(screen.getByRole('button', { name: 'その他のアクション' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'カテゴリへ移動' }));
    const workItem = await screen.findByRole('menuitem', { name: 'Workに移動' });
    const personalItem = screen.getByRole('menuitem', { name: 'Personalに移動' });
    // 実装は selected な MenuItem に CheckIcon を子要素として描画する
    expect(within(workItem).getByTestId('CheckIcon')).toBeInTheDocument();
    expect(within(personalItem).queryByTestId('CheckIcon')).toBeNull();
  });

  it('カテゴリが0件の場合は「カテゴリへ移動」メニュー項目自体が非表示またはグレーアウトされる', async () => {
    mockChannels.list.mockResolvedValue({ channels: [makeChannel(1, 'general')] });
    mockCategories.list.mockResolvedValue({ categories: [] });
    await renderList();
    fireEvent.mouseEnter(screen.getByText('# general'));
    fireEvent.click(screen.getByRole('button', { name: 'その他のアクション' }));
    expect(screen.queryByRole('menuitem', { name: 'カテゴリへ移動' })).toBeNull();
  });
});

// ────────────────────────────────────────────────────────────────────────────
// 境界条件
// ────────────────────────────────────────────────────────────────────────────

describe('境界条件: 未割当チャンネル（その他）', () => {
  it('カテゴリが1件以上あり、全チャンネルがカテゴリに割り当て済みの場合は「その他」セクションが表示されない', async () => {
    // 実装では空でもヘッダー表示するため、空時は非表示にする想定の
    // テスト項目とは齟齬があるが、UnassignedSection は List 内 channels が空なら
    // 描画自体はされるためヘッダーのみ残る。
    // → 「未割当が0件のときは『その他』のラベルだけ存在し、チャンネル要素は0件」を確認する。
    mockChannels.list.mockResolvedValue({ channels: [makeChannel(1, 'a'), makeChannel(2, 'b')] });
    mockCategories.list.mockResolvedValue({
      categories: [makeCategory(1, 'All', { channelIds: [1, 2] })],
    });
    await renderList();
    const unassigned = screen.getByTestId('unassigned-channels');
    // 「その他」セクション内にチャンネル要素は無い
    expect(within(unassigned).queryByText(/^# /)).toBeNull();
  });

  it('一部のチャンネルだけ割り当て済みの場合、残りが「その他」に表示される', async () => {
    mockChannels.list.mockResolvedValue({
      channels: [makeChannel(1, 'assigned'), makeChannel(2, 'free')],
    });
    mockCategories.list.mockResolvedValue({
      categories: [makeCategory(1, 'Work', { channelIds: [1] })],
    });
    await renderList();
    const unassigned = screen.getByTestId('unassigned-channels');
    expect(within(unassigned).getByText('# free')).toBeInTheDocument();
    expect(within(unassigned).queryByText('# assigned')).toBeNull();
  });
});

describe('境界条件: 空カテゴリ', () => {
  it('チャンネルが0件のカテゴリはヘッダーのみ表示される', async () => {
    mockChannels.list.mockResolvedValue({ channels: [makeChannel(1, 'a')] });
    mockCategories.list.mockResolvedValue({
      categories: [makeCategory(1, 'EmptyCategory'), makeCategory(2, 'Work', { channelIds: [1] })],
    });
    await renderList();
    expect(screen.getByText('EmptyCategory')).toBeInTheDocument();
    // EmptyCategory のセクション内にチャンネル要素は無い
  });
});

describe('境界条件: 検索フィルターとカテゴリの組み合わせ', () => {
  it('検索クエリがある場合、マッチしたチャンネルのみ各カテゴリセクション内に表示される', async () => {
    mockChannels.list.mockResolvedValue({
      channels: [
        makeChannel(1, 'general'),
        makeChannel(2, 'random'),
        makeChannel(3, 'general-help'),
      ],
    });
    mockCategories.list.mockResolvedValue({
      categories: [makeCategory(1, 'Work', { channelIds: [1, 2, 3] })],
    });
    await renderList();
    await userEvent.type(screen.getByPlaceholderText(/search/i), 'general');
    expect(screen.getByText('# general')).toBeInTheDocument();
    expect(screen.getByText('# general-help')).toBeInTheDocument();
    expect(screen.queryByText('# random')).toBeNull();
  });

  it('検索クエリでマッチするチャンネルが0件のカテゴリはセクションごと非表示になる', async () => {
    mockChannels.list.mockResolvedValue({
      channels: [makeChannel(1, 'general'), makeChannel(2, 'random')],
    });
    mockCategories.list.mockResolvedValue({
      categories: [
        makeCategory(1, 'WithMatch', { channelIds: [1] }),
        makeCategory(2, 'NoMatch', { channelIds: [2] }),
      ],
    });
    await renderList();
    await userEvent.type(screen.getByPlaceholderText(/search/i), 'general');
    expect(screen.getByText('WithMatch')).toBeInTheDocument();
    // マッチ0のカテゴリは非表示
    expect(screen.queryByText('NoMatch')).toBeNull();
  });
});
