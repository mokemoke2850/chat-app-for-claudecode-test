/**
 * テスト対象: components/Channel/ChannelWikiTab.tsx（チャンネル内Wikiタブ / #355）
 * 戦略:
 *   - api/client をモックして Wiki ページの取得・作成・更新・削除を差し替える
 *   - 2ペイン UI（左:一覧+検索+新規ボタン / 右:詳細・編集・新規フォーム）の
 *     状態遷移とユーザー操作を検証する
 *   - Markdown プレビュー切替・削除確認ダイアログ・楽観ロック競合時のエラー表示も対象
 *   - URLクエリ（wikiPage / newWiki / fromMessage）によるディープリンクも検証
 */

import { render, screen, waitFor, act, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import type { WikiPage, WikiPageSummary } from '@chat-app/shared';

vi.mock('../api/client', () => ({
  api: {
    wikiPages: {
      list: vi.fn(),
      get: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    tags: {
      list: vi.fn().mockResolvedValue({ tags: [] }),
    },
  },
}));

import { api } from '../api/client';
import ChannelWikiTab, { resetWikiPagesCache } from '../components/Channel/ChannelWikiTab';

const mockApi = api as unknown as {
  wikiPages: {
    list: ReturnType<typeof vi.fn>;
    get: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
  };
  tags: { list: ReturnType<typeof vi.fn> };
};

const makeSummary = (overrides: Partial<WikiPageSummary> = {}): WikiPageSummary => ({
  id: 1,
  channelId: 100,
  title: 'タイトル',
  createdBy: 1,
  createdByUsername: 'alice',
  updatedBy: 1,
  updatedByUsername: 'alice',
  createdAt: '2026-05-01T00:00:00Z',
  updatedAt: '2026-05-01T00:00:00Z',
  tags: [],
  ...overrides,
});

const makePage = (overrides: Partial<WikiPage> = {}): WikiPage => ({
  id: 1,
  channelId: 100,
  title: 'タイトル',
  content: '# 見出し\n本文',
  createdBy: 1,
  createdByUsername: 'alice',
  updatedBy: 1,
  updatedByUsername: 'alice',
  createdAt: '2026-05-01T00:00:00Z',
  updatedAt: '2026-05-01T00:00:00Z',
  tags: [],
  ...overrides,
});

function renderTab(props: {
  channelId?: number;
  currentUserId?: number;
  currentUserRole?: 'user' | 'admin';
  channelCreatedBy?: number;
  initialEntries?: string[];
}) {
  const {
    channelId = 100,
    currentUserId = 1,
    currentUserRole = 'user',
    channelCreatedBy = 1,
    initialEntries = ['/?channel=100'],
  } = props;
  return render(
    <MemoryRouter initialEntries={initialEntries}>
      <ChannelWikiTab
        channelId={channelId}
        currentUserId={currentUserId}
        currentUserRole={currentUserRole}
        channelCreatedBy={channelCreatedBy}
      />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  resetWikiPagesCache();
  mockApi.wikiPages.list.mockResolvedValue({ pages: [] });
  mockApi.wikiPages.get.mockResolvedValue({ page: makePage() });
  mockApi.wikiPages.create.mockResolvedValue({ page: makePage() });
  mockApi.wikiPages.update.mockResolvedValue({ page: makePage() });
  mockApi.wikiPages.delete.mockResolvedValue(undefined);
});

describe('ChannelWikiTab（一覧表示）', () => {
  it('マウント時にAPIからチャンネルのWikiページ一覧を取得して表示する', async () => {
    mockApi.wikiPages.list.mockResolvedValueOnce({
      pages: [makeSummary({ id: 1, title: 'はじめに' })],
    });
    renderTab({});
    await waitFor(() => {
      expect(screen.getByText('はじめに')).toBeInTheDocument();
    });
    expect(mockApi.wikiPages.list).toHaveBeenCalledWith(100, undefined);
  });

  it('ページが0件のときは空状態メッセージを表示する', async () => {
    mockApi.wikiPages.list.mockResolvedValueOnce({ pages: [] });
    renderTab({});
    await waitFor(() => {
      expect(screen.getByText(/まだ.*Wiki.*ありません|ページがありません/)).toBeInTheDocument();
    });
  });

  it('一覧の各項目にタイトルと更新日時が表示される', async () => {
    mockApi.wikiPages.list.mockResolvedValueOnce({
      pages: [makeSummary({ id: 1, title: 'A', updatedAt: '2026-05-10T00:00:00Z' })],
    });
    renderTab({});
    await waitFor(() => {
      expect(screen.getByText('A')).toBeInTheDocument();
    });
    // 更新日（年月日のいずれかが表示されている想定）
    expect(screen.getAllByText(/2026/).length).toBeGreaterThan(0);
  });

  it('一覧項目をクリックすると右ペインに詳細が表示される', async () => {
    const user = userEvent.setup();
    mockApi.wikiPages.list.mockResolvedValueOnce({
      pages: [makeSummary({ id: 7, title: 'クリック対象' })],
    });
    mockApi.wikiPages.get.mockResolvedValueOnce({
      page: makePage({ id: 7, title: 'クリック対象', content: '詳細本文' }),
    });
    renderTab({});
    await waitFor(() => screen.getByText('クリック対象'));
    await user.click(screen.getByText('クリック対象'));
    await waitFor(() => {
      expect(screen.getByText(/詳細本文/)).toBeInTheDocument();
    });
  });
});

describe('ChannelWikiTab（検索）', () => {
  it('検索ボックスに文字を入力するとAPIへ q クエリ付きで再取得が走る', async () => {
    const user = userEvent.setup();
    renderTab({});
    await waitFor(() => expect(mockApi.wikiPages.list).toHaveBeenCalled());
    mockApi.wikiPages.list.mockClear();
    mockApi.wikiPages.list.mockResolvedValue({ pages: [] });
    await user.type(screen.getByPlaceholderText(/検索/), 'foo');
    await waitFor(() => {
      expect(mockApi.wikiPages.list).toHaveBeenCalledWith(100, 'foo');
    });
  });

  it('検索クエリをクリアすると全件取得に戻る', async () => {
    const user = userEvent.setup();
    renderTab({});
    await waitFor(() => expect(mockApi.wikiPages.list).toHaveBeenCalled());
    const input = screen.getByPlaceholderText(/検索/) as HTMLInputElement;
    await user.type(input, 'foo');
    await waitFor(() => expect(mockApi.wikiPages.list).toHaveBeenCalledWith(100, 'foo'));
    mockApi.wikiPages.list.mockClear();
    await user.clear(input);
    await waitFor(() => {
      expect(mockApi.wikiPages.list).toHaveBeenCalledWith(100, undefined);
    });
  });
});

describe('ChannelWikiTab（詳細表示）', () => {
  it('選択ページのタイトル・本文（Markdownレンダリング後）が表示される', async () => {
    const user = userEvent.setup();
    mockApi.wikiPages.list.mockResolvedValueOnce({
      pages: [makeSummary({ id: 1, title: 'タイトル' })],
    });
    mockApi.wikiPages.get.mockResolvedValueOnce({
      page: makePage({ id: 1, title: 'タイトル', content: '# 見出しA' }),
    });
    renderTab({});
    await waitFor(() => screen.getByText('タイトル'));
    await user.click(screen.getByText('タイトル'));
    await waitFor(() => {
      // h1 がMarkdownから生成される
      expect(screen.getByRole('heading', { level: 1, name: '見出しA' })).toBeInTheDocument();
    });
  });

  it('作成者・更新者・更新日時が表示される', async () => {
    const user = userEvent.setup();
    mockApi.wikiPages.list.mockResolvedValueOnce({
      pages: [makeSummary({ id: 1 })],
    });
    mockApi.wikiPages.get.mockResolvedValueOnce({
      page: makePage({ createdByUsername: 'alice', updatedByUsername: 'bob' }),
    });
    renderTab({});
    await waitFor(() => screen.getByText('タイトル'));
    await user.click(screen.getByText('タイトル'));
    await waitFor(() => {
      expect(screen.getByText(/alice/)).toBeInTheDocument();
      expect(screen.getByText(/bob/)).toBeInTheDocument();
    });
  });

  it('紐付くタグがチップとして表示される', async () => {
    const user = userEvent.setup();
    mockApi.wikiPages.list.mockResolvedValueOnce({
      pages: [makeSummary({ id: 1 })],
    });
    mockApi.wikiPages.get.mockResolvedValueOnce({
      page: makePage({
        tags: [{ id: 11, name: 'faq', useCount: 0, createdAt: '' }],
      }),
    });
    renderTab({});
    await waitFor(() => screen.getByText('タイトル'));
    await user.click(screen.getByText('タイトル'));
    await waitFor(() => {
      expect(screen.getByText('faq')).toBeInTheDocument();
    });
  });

  it('編集権限がある場合は編集ボタンが表示される', async () => {
    const user = userEvent.setup();
    mockApi.wikiPages.list.mockResolvedValueOnce({
      pages: [makeSummary({ id: 1, createdBy: 1 })],
    });
    mockApi.wikiPages.get.mockResolvedValueOnce({ page: makePage({ createdBy: 1 }) });
    renderTab({ currentUserId: 1, channelCreatedBy: 1 });
    await waitFor(() => screen.getByText('タイトル'));
    await user.click(screen.getByText('タイトル'));
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /編集/ })).toBeInTheDocument();
    });
  });

  it('編集権限がない場合は編集ボタンが非表示', async () => {
    const user = userEvent.setup();
    mockApi.wikiPages.list.mockResolvedValueOnce({
      pages: [makeSummary({ id: 1, createdBy: 99 })],
    });
    mockApi.wikiPages.get.mockResolvedValueOnce({ page: makePage({ createdBy: 99 }) });
    renderTab({ currentUserId: 1, channelCreatedBy: 999 });
    await waitFor(() => screen.getByText('タイトル'));
    await user.click(screen.getByText('タイトル'));
    await waitFor(() => screen.getByText(/詳細|本文|#/));
    expect(screen.queryByRole('button', { name: /編集/ })).not.toBeInTheDocument();
  });

  it('削除権限がある場合は削除ボタンが表示される', async () => {
    const user = userEvent.setup();
    mockApi.wikiPages.list.mockResolvedValueOnce({
      pages: [makeSummary({ id: 1 })],
    });
    mockApi.wikiPages.get.mockResolvedValueOnce({ page: makePage() });
    renderTab({ currentUserId: 1, channelCreatedBy: 1 });
    await waitFor(() => screen.getByText('タイトル'));
    await user.click(screen.getByText('タイトル'));
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /削除/ })).toBeInTheDocument();
    });
  });
});

describe('ChannelWikiTab（新規作成）', () => {
  it('「新規作成」ボタンを押すと右ペインに新規作成フォームが表示される', async () => {
    const user = userEvent.setup();
    renderTab({});
    await waitFor(() => expect(mockApi.wikiPages.list).toHaveBeenCalled());
    await user.click(screen.getByRole('button', { name: /新規作成|新規Wiki/ }));
    expect(screen.getByLabelText(/タイトル/)).toBeInTheDocument();
  });

  it('フォームにタイトル・本文・タグ入力欄がある', async () => {
    const user = userEvent.setup();
    renderTab({});
    await waitFor(() => expect(mockApi.wikiPages.list).toHaveBeenCalled());
    await user.click(screen.getByRole('button', { name: /新規作成|新規Wiki/ }));
    expect(screen.getByLabelText(/タイトル/)).toBeInTheDocument();
    expect(screen.getByLabelText(/本文/)).toBeInTheDocument();
    expect(screen.getByLabelText(/タグ/)).toBeInTheDocument();
  });

  it('本文はテキストエリアとプレビューをタブ切替できる', async () => {
    const user = userEvent.setup();
    renderTab({});
    await waitFor(() => expect(mockApi.wikiPages.list).toHaveBeenCalled());
    await user.click(screen.getByRole('button', { name: /新規作成|新規Wiki/ }));
    expect(screen.getByRole('tab', { name: /編集|テキスト/ })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /プレビュー/ })).toBeInTheDocument();
  });

  it('プレビュータブを開くとMarkdownがレンダリング表示される', async () => {
    const user = userEvent.setup();
    renderTab({});
    await waitFor(() => expect(mockApi.wikiPages.list).toHaveBeenCalled());
    await user.click(screen.getByRole('button', { name: /新規作成|新規Wiki/ }));
    await user.type(screen.getByLabelText(/本文/), '# Hello');
    await user.click(screen.getByRole('tab', { name: /プレビュー/ }));
    expect(screen.getByRole('heading', { level: 1, name: 'Hello' })).toBeInTheDocument();
  });

  it('保存ボタンを押すとAPIに作成リクエストが送られる', async () => {
    const user = userEvent.setup();
    mockApi.wikiPages.create.mockResolvedValueOnce({
      page: makePage({ id: 42, title: '新ページ' }),
    });
    renderTab({});
    await waitFor(() => expect(mockApi.wikiPages.list).toHaveBeenCalled());
    await user.click(screen.getByRole('button', { name: /新規作成|新規Wiki/ }));
    await user.type(screen.getByLabelText(/タイトル/), '新ページ');
    await user.click(screen.getByRole('button', { name: /^保存$/ }));
    await waitFor(() => {
      expect(mockApi.wikiPages.create).toHaveBeenCalledWith(
        100,
        expect.objectContaining({ title: '新ページ' }),
      );
    });
  });

  it('保存成功すると一覧が更新され作成したページが選択状態になる', async () => {
    const user = userEvent.setup();
    mockApi.wikiPages.create.mockResolvedValueOnce({
      page: makePage({ id: 42, title: '新ページ', content: 'created' }),
    });
    renderTab({});
    await waitFor(() => expect(mockApi.wikiPages.list).toHaveBeenCalled());
    await user.click(screen.getByRole('button', { name: /新規作成|新規Wiki/ }));
    await user.type(screen.getByLabelText(/タイトル/), '新ページ');
    await user.click(screen.getByRole('button', { name: /^保存$/ }));
    await waitFor(() => {
      expect(screen.getByText('created')).toBeInTheDocument();
    });
  });

  it('タイトル未入力のまま保存しようとするとバリデーションエラーが表示される', async () => {
    const user = userEvent.setup();
    renderTab({});
    await waitFor(() => expect(mockApi.wikiPages.list).toHaveBeenCalled());
    await user.click(screen.getByRole('button', { name: /新規作成|新規Wiki/ }));
    await user.click(screen.getByRole('button', { name: /^保存$/ }));
    expect(screen.getByText(/タイトルを入力|タイトルは必須/)).toBeInTheDocument();
    expect(mockApi.wikiPages.create).not.toHaveBeenCalled();
  });

  it('キャンセルボタンで新規作成フォームを閉じられる', async () => {
    const user = userEvent.setup();
    renderTab({});
    await waitFor(() => expect(mockApi.wikiPages.list).toHaveBeenCalled());
    await user.click(screen.getByRole('button', { name: /新規作成|新規Wiki/ }));
    await user.click(screen.getByRole('button', { name: /キャンセル/ }));
    expect(screen.queryByLabelText(/タイトル/)).not.toBeInTheDocument();
  });
});

describe('ChannelWikiTab（編集）', () => {
  it('編集ボタンを押すと現在のタイトル・本文・タグでフォームに入る', async () => {
    const user = userEvent.setup();
    mockApi.wikiPages.list.mockResolvedValueOnce({
      pages: [makeSummary({ id: 1, title: '元タイトル' })],
    });
    mockApi.wikiPages.get.mockResolvedValueOnce({
      page: makePage({ id: 1, title: '元タイトル', content: '元本文' }),
    });
    renderTab({ currentUserId: 1, channelCreatedBy: 1 });
    await waitFor(() => screen.getByText('元タイトル'));
    await user.click(screen.getByText('元タイトル'));
    await user.click(await screen.findByRole('button', { name: /編集/ }));
    expect((screen.getByLabelText(/タイトル/) as HTMLInputElement).value).toBe('元タイトル');
  });

  it('保存ボタンを押すとPATCHリクエストが送られる', async () => {
    const user = userEvent.setup();
    mockApi.wikiPages.list.mockResolvedValueOnce({ pages: [makeSummary({ id: 1 })] });
    mockApi.wikiPages.get.mockResolvedValueOnce({ page: makePage({ id: 1, title: 'old' }) });
    mockApi.wikiPages.update.mockResolvedValueOnce({ page: makePage({ id: 1, title: 'new' }) });
    renderTab({ currentUserId: 1, channelCreatedBy: 1 });
    await waitFor(() => screen.getByText('タイトル'));
    await user.click(screen.getByText('タイトル'));
    await user.click(await screen.findByRole('button', { name: /編集/ }));
    const titleInput = screen.getByLabelText(/タイトル/) as HTMLInputElement;
    await user.clear(titleInput);
    await user.type(titleInput, 'new');
    await user.click(screen.getByRole('button', { name: /^保存$/ }));
    await waitFor(() => expect(mockApi.wikiPages.update).toHaveBeenCalled());
  });

  it('保存時にexpectedUpdatedAtを含めて送信する（楽観ロック）', async () => {
    const user = userEvent.setup();
    mockApi.wikiPages.list.mockResolvedValueOnce({ pages: [makeSummary({ id: 1 })] });
    mockApi.wikiPages.get.mockResolvedValueOnce({
      page: makePage({ id: 1, updatedAt: '2026-05-10T00:00:00.000Z' }),
    });
    mockApi.wikiPages.update.mockResolvedValueOnce({ page: makePage({ id: 1 }) });
    renderTab({ currentUserId: 1, channelCreatedBy: 1 });
    await waitFor(() => screen.getByText('タイトル'));
    await user.click(screen.getByText('タイトル'));
    await user.click(await screen.findByRole('button', { name: /編集/ }));
    await user.click(screen.getByRole('button', { name: /^保存$/ }));
    await waitFor(() => {
      expect(mockApi.wikiPages.update).toHaveBeenCalledWith(
        1,
        expect.objectContaining({ expectedUpdatedAt: '2026-05-10T00:00:00.000Z' }),
      );
    });
  });

  it('409レスポンスを受け取ったときに競合メッセージが表示される', async () => {
    const user = userEvent.setup();
    mockApi.wikiPages.list.mockResolvedValueOnce({ pages: [makeSummary({ id: 1 })] });
    mockApi.wikiPages.get.mockResolvedValueOnce({ page: makePage({ id: 1 }) });
    const err = Object.assign(new Error('conflict'), { statusCode: 409 });
    mockApi.wikiPages.update.mockRejectedValueOnce(err);
    renderTab({ currentUserId: 1, channelCreatedBy: 1 });
    await waitFor(() => screen.getByText('タイトル'));
    await user.click(screen.getByText('タイトル'));
    await user.click(await screen.findByRole('button', { name: /編集/ }));
    await user.click(screen.getByRole('button', { name: /^保存$/ }));
    await waitFor(() => {
      expect(screen.getByText(/競合|他の.*更新/)).toBeInTheDocument();
    });
  });

  it('キャンセルボタンで詳細表示に戻る', async () => {
    const user = userEvent.setup();
    mockApi.wikiPages.list.mockResolvedValueOnce({ pages: [makeSummary({ id: 1 })] });
    mockApi.wikiPages.get.mockResolvedValueOnce({ page: makePage({ id: 1 }) });
    renderTab({ currentUserId: 1, channelCreatedBy: 1 });
    await waitFor(() => screen.getByText('タイトル'));
    await user.click(screen.getByText('タイトル'));
    await user.click(await screen.findByRole('button', { name: /編集/ }));
    await user.click(screen.getByRole('button', { name: /キャンセル/ }));
    // 詳細ビュー（編集ボタンが再表示される）
    expect(await screen.findByRole('button', { name: /編集/ })).toBeInTheDocument();
  });
});

describe('ChannelWikiTab（削除）', () => {
  it('削除ボタンを押すと確認ダイアログが開く', async () => {
    const user = userEvent.setup();
    mockApi.wikiPages.list.mockResolvedValueOnce({ pages: [makeSummary({ id: 1 })] });
    mockApi.wikiPages.get.mockResolvedValueOnce({ page: makePage({ id: 1 }) });
    renderTab({ currentUserId: 1, channelCreatedBy: 1 });
    await waitFor(() => screen.getByText('タイトル'));
    await user.click(screen.getByText('タイトル'));
    await user.click(await screen.findByRole('button', { name: /削除/ }));
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('確認ダイアログでキャンセルすると削除されない', async () => {
    const user = userEvent.setup();
    mockApi.wikiPages.list.mockResolvedValueOnce({ pages: [makeSummary({ id: 1 })] });
    mockApi.wikiPages.get.mockResolvedValueOnce({ page: makePage({ id: 1 }) });
    renderTab({ currentUserId: 1, channelCreatedBy: 1 });
    await waitFor(() => screen.getByText('タイトル'));
    await user.click(screen.getByText('タイトル'));
    await user.click(await screen.findByRole('button', { name: /削除/ }));
    const dialog = screen.getByRole('dialog');
    await act(async () => {
      await userEvent.click(within(dialog).getByRole('button', { name: /キャンセル/ }));
    });
    expect(mockApi.wikiPages.delete).not.toHaveBeenCalled();
  });

  it('確認ダイアログで削除確定するとDELETEリクエストが送られる', async () => {
    const user = userEvent.setup();
    mockApi.wikiPages.list.mockResolvedValueOnce({ pages: [makeSummary({ id: 1 })] });
    mockApi.wikiPages.get.mockResolvedValueOnce({ page: makePage({ id: 1 }) });
    renderTab({ currentUserId: 1, channelCreatedBy: 1 });
    await waitFor(() => screen.getByText('タイトル'));
    await user.click(screen.getByText('タイトル'));
    await user.click(await screen.findByRole('button', { name: /削除/ }));
    const dialog = screen.getByRole('dialog');
    await user.click(within(dialog).getByRole('button', { name: /削除する|削除$/ }));
    await waitFor(() => {
      expect(mockApi.wikiPages.delete).toHaveBeenCalledWith(1);
    });
  });

  it('削除成功すると一覧から該当ページが消え右ペインが空状態に戻る', async () => {
    const user = userEvent.setup();
    mockApi.wikiPages.list
      .mockResolvedValueOnce({ pages: [makeSummary({ id: 1, title: 'X' })] })
      .mockResolvedValue({ pages: [] });
    mockApi.wikiPages.get.mockResolvedValueOnce({ page: makePage({ id: 1, title: 'X' }) });
    renderTab({ currentUserId: 1, channelCreatedBy: 1 });
    await waitFor(() => screen.getByText('X'));
    await user.click(screen.getByText('X'));
    await user.click(await screen.findByRole('button', { name: /削除/ }));
    const dialog = screen.getByRole('dialog');
    await user.click(within(dialog).getByRole('button', { name: /削除する|削除$/ }));
    await waitFor(() => {
      expect(screen.queryByText('X')).not.toBeInTheDocument();
    });
  });
});

describe('ChannelWikiTab（URLクエリでの動線）', () => {
  it('?wikiPage=:id 付きで開くと該当ページの詳細が初期表示される', async () => {
    mockApi.wikiPages.list.mockResolvedValueOnce({
      pages: [makeSummary({ id: 5, title: 'preselected' })],
    });
    mockApi.wikiPages.get.mockResolvedValueOnce({
      page: makePage({ id: 5, title: 'preselected', content: 'deep linked' }),
    });
    renderTab({ initialEntries: ['/?channel=100&wikiPage=5'] });
    await waitFor(() => {
      expect(screen.getByText('deep linked')).toBeInTheDocument();
    });
  });

  it('?newWiki=1 付きで開くと新規作成フォームが初期表示される', async () => {
    renderTab({ initialEntries: ['/?channel=100&newWiki=1'] });
    await waitFor(() => {
      expect(screen.getByLabelText(/タイトル/)).toBeInTheDocument();
    });
  });

  it('?newWiki=1&fromMessage=:id 付きで開くと本文に引用形式でメッセージがプリフィルされる', async () => {
    sessionStorage.setItem(
      'wiki.fromMessage.123',
      JSON.stringify({ content: 'メッセージ本文', url: 'http://example/m/123' }),
    );
    renderTab({ initialEntries: ['/?channel=100&newWiki=1&fromMessage=123'] });
    await waitFor(() => {
      const body = screen.getByLabelText(/本文/) as HTMLTextAreaElement;
      expect(body.value).toContain('メッセージ本文');
    });
    sessionStorage.removeItem('wiki.fromMessage.123');
  });
});
