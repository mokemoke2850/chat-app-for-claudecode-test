/**
 * テスト対象: MessageActions のパーマリンクコピー機能
 * 戦略:
 *   - 「リンクをコピー」クリック時に `/chat?channel={id}&message={mid}` 形式の URL が
 *     クリップボードに書き込まれることを検証する
 *   - コピー後に「リンクをコピーしました」スナックバーが表示されることを検証する
 *   - URL 形式の変更（ハッシュ形式 → クエリ形式）を確認する
 */

import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import MessageActions from '../components/Chat/MessageActions';
import { makeMessage } from './__fixtures__/messages';

// Socket モック
const mockSocket = { emit: vi.fn(), on: vi.fn(), off: vi.fn() };
vi.mock('../contexts/SocketContext', () => ({
  useSocket: () => mockSocket,
}));

// EmojiPicker モック
vi.mock('../components/Chat/EmojiPicker', () => ({
  default: ({ anchorEl }: { anchorEl: HTMLElement | null }) =>
    anchorEl ? <div data-testid="emoji-picker" /> : null,
}));

// ReminderDialog モック
vi.mock('../components/Reminder/ReminderDialog', () => ({
  default: ({ open }: { open: boolean }) => (open ? <div data-testid="reminder-dialog" /> : null),
}));

// ForwardMessageDialog モック
vi.mock('../components/Chat/ForwardMessageDialog', () => ({
  default: ({ open }: { open: boolean }) => (open ? <div data-testid="forward-dialog" /> : null),
}));

// ReportMessageDialog モック
vi.mock('../components/Chat/ReportMessageDialog', () => ({
  default: ({ open }: { open: boolean }) => (open ? <div data-testid="report-dialog" /> : null),
}));

// CreateTaskDialog モック
vi.mock('../components/Task/CreateTaskDialog', () => ({
  default: ({ open }: { open: boolean }) =>
    open ? <div data-testid="create-task-dialog" /> : null,
}));

// API モック
vi.mock('../api/client', () => ({
  api: {
    bookmarks: {
      add: vi.fn().mockResolvedValue(undefined),
      remove: vi.fn().mockResolvedValue(undefined),
    },
    messages: {
      forward: vi.fn().mockResolvedValue({ message: { id: 99 } }),
    },
  },
}));

// Snackbar モック
const mockShowSuccess = vi.fn();
const mockShowError = vi.fn();
vi.mock('../contexts/SnackbarContext', () => ({
  useSnackbar: () => ({
    showSuccess: mockShowSuccess,
    showError: mockShowError,
    showInfo: vi.fn(),
  }),
}));

/** 3点メニューを開くヘルパー */
async function openMenu() {
  await userEvent.click(screen.getByRole('button', { name: 'その他のアクション' }));
}

beforeEach(() => {
  vi.resetAllMocks();
  Object.defineProperty(window, 'location', {
    value: {
      origin: 'http://localhost',
      pathname: '/chat',
      search: '',
      hash: '',
    },
    writable: true,
    configurable: true,
  });
  Object.assign(navigator, { clipboard: { writeText: vi.fn().mockResolvedValue(undefined) } });
});

describe('MessageActions パーマリンクコピー', () => {
  describe('URL 形式', () => {
    it('「リンクをコピー」クリックで ?channel={channelId}&message={messageId} 形式の URL がクリップボードに書き込まれる', async () => {
      const writeText = vi.fn().mockResolvedValue(undefined);
      Object.assign(navigator, { clipboard: { writeText } });
      const message = makeMessage({ id: 42, channelId: 5 });
      render(<MessageActions message={message} isOwn={false} />);
      await openMenu();
      await userEvent.click(screen.getByRole('menuitem', { name: /リンクをコピー/ }));
      await waitFor(() => {
        expect(writeText).toHaveBeenCalledWith(expect.stringMatching(/\?channel=5&message=42/));
      });
    });

    it('URL に #message- ハッシュフラグメントは含まれない（クエリパラメータのみ）', async () => {
      const writeText = vi.fn().mockResolvedValue(undefined);
      Object.assign(navigator, { clipboard: { writeText } });
      const message = makeMessage({ id: 42, channelId: 5 });
      render(<MessageActions message={message} isOwn={false} />);
      await openMenu();
      await userEvent.click(screen.getByRole('menuitem', { name: /リンクをコピー/ }));
      await waitFor(() => {
        const calledUrl = writeText.mock.calls[0][0] as string;
        expect(calledUrl).not.toContain('#message-');
      });
    });

    it('origin（http://localhost）が URL に含まれる', async () => {
      const writeText = vi.fn().mockResolvedValue(undefined);
      Object.assign(navigator, { clipboard: { writeText } });
      const message = makeMessage({ id: 1, channelId: 1 });
      render(<MessageActions message={message} isOwn={false} />);
      await openMenu();
      await userEvent.click(screen.getByRole('menuitem', { name: /リンクをコピー/ }));
      await waitFor(() => {
        const calledUrl = writeText.mock.calls[0][0] as string;
        expect(calledUrl).toContain('http://localhost');
      });
    });

    it('/chat パスが URL に含まれる', async () => {
      const writeText = vi.fn().mockResolvedValue(undefined);
      Object.assign(navigator, { clipboard: { writeText } });
      const message = makeMessage({ id: 1, channelId: 1 });
      render(<MessageActions message={message} isOwn={false} />);
      await openMenu();
      await userEvent.click(screen.getByRole('menuitem', { name: /リンクをコピー/ }));
      await waitFor(() => {
        const calledUrl = writeText.mock.calls[0][0] as string;
        expect(calledUrl).toContain('/chat');
      });
    });
  });

  describe('スナックバー通知', () => {
    it('「リンクをコピー」クリック後に showSuccess が「リンクをコピーしました」で呼ばれる', async () => {
      const writeText = vi.fn().mockResolvedValue(undefined);
      Object.assign(navigator, { clipboard: { writeText } });
      const message = makeMessage({ id: 1, channelId: 1 });
      render(<MessageActions message={message} isOwn={false} />);
      await openMenu();
      await userEvent.click(screen.getByRole('menuitem', { name: /リンクをコピー/ }));
      await waitFor(() => {
        expect(mockShowSuccess).toHaveBeenCalledWith('リンクをコピーしました');
      });
    });

    it('クリップボード API が失敗したとき showSuccess は呼ばれない', async () => {
      const writeText = vi.fn().mockRejectedValue(new Error('clipboard error'));
      Object.assign(navigator, { clipboard: { writeText } });
      const message = makeMessage({ id: 1, channelId: 1 });
      render(<MessageActions message={message} isOwn={false} />);
      await openMenu();
      await userEvent.click(screen.getByRole('menuitem', { name: /リンクをコピー/ }));
      await waitFor(() => {
        expect(mockShowSuccess).not.toHaveBeenCalled();
      });
    });
  });

  describe('メニューの閉じ動作', () => {
    it('「リンクをコピー」クリック後にメニューが閉じる', async () => {
      const message = makeMessage({ id: 1, channelId: 1 });
      render(<MessageActions message={message} isOwn={false} />);
      await openMenu();
      await userEvent.click(screen.getByRole('menuitem', { name: /リンクをコピー/ }));
      await waitFor(() => {
        expect(screen.queryByRole('menu')).not.toBeInTheDocument();
      });
    });
  });
});
