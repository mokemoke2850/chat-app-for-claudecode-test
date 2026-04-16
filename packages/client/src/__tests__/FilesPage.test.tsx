/**
 * テスト対象: ファイル一覧ページ（FilesPage / FileList）
 * 戦略:
 *   - ネットワーク通信は vi.mock('../api/client') で差し替える
 *   - React 19 の use() + Suspense パターンを考慮し、非同期データ取得を検証する
 *   - ファイルタイプフィルタリング操作をAPIモックを通じて検証する
 */

import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import FilesPage, { resetFilesCache } from '../pages/FilesPage';
import type { ChannelAttachment } from '@chat-app/shared';

const mockNavigate = vi.hoisted(() => vi.fn());
vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>();
  return { ...actual, useNavigate: () => mockNavigate };
});

vi.mock('../api/client', () => ({
  api: {
    channels: {
      getAttachments: vi.fn(),
    },
  },
}));

vi.mock('../contexts/SocketContext', () => ({
  useSocket: () => ({ emit: vi.fn(), on: vi.fn(), off: vi.fn() }),
}));

import { api } from '../api/client';
const mockApi = api as unknown as {
  channels: {
    getAttachments: ReturnType<typeof vi.fn>;
  };
};

const makeAttachment = (overrides: Partial<ChannelAttachment> = {}): ChannelAttachment => ({
  id: 1,
  messageId: 10,
  url: '/uploads/test.png',
  originalName: 'test.png',
  size: 1024,
  mimeType: 'image/png',
  createdAt: '2024-06-01T12:00:00Z',
  uploaderId: 1,
  uploaderName: 'alice',
  ...overrides,
});

async function renderFilesPage(channelId = 1, channelName = 'general') {
  await act(async () => {
    render(
      <MemoryRouter>
        <FilesPage channelId={channelId} channelName={channelName} />
      </MemoryRouter>,
    );
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  resetFilesCache();
});

describe('FilesPage', () => {
  describe('ファイル一覧の表示', () => {
    it('チャンネルの添付ファイル一覧が取得できたとき、ファイル一覧が表示される', async () => {
      mockApi.channels.getAttachments.mockResolvedValue({
        attachments: [makeAttachment({ originalName: 'photo.png' })],
      });
      await renderFilesPage();
      expect(screen.getByText('photo.png')).toBeInTheDocument();
    });

    it('各ファイル項目にファイル名が表示される', async () => {
      mockApi.channels.getAttachments.mockResolvedValue({
        attachments: [makeAttachment({ originalName: 'report.pdf', mimeType: 'application/pdf' })],
      });
      await renderFilesPage();
      expect(screen.getByText('report.pdf')).toBeInTheDocument();
    });

    it('各ファイル項目にアップロード者名が表示される', async () => {
      mockApi.channels.getAttachments.mockResolvedValue({
        attachments: [makeAttachment({ uploaderName: 'bob' })],
      });
      await renderFilesPage();
      expect(screen.getByText('bob')).toBeInTheDocument();
    });

    it('各ファイル項目にアップロード日時が表示される', async () => {
      mockApi.channels.getAttachments.mockResolvedValue({
        attachments: [makeAttachment({ createdAt: '2024-06-01T12:00:00Z' })],
      });
      await renderFilesPage();
      // 日時フォーマット後の文字列が含まれることを確認（年が含まれる）
      const dateText = screen.getByText(/2024/);
      expect(dateText).toBeInTheDocument();
    });

    it('各ファイル項目にファイルサイズが表示される', async () => {
      mockApi.channels.getAttachments.mockResolvedValue({
        attachments: [makeAttachment({ size: 2048 })],
      });
      await renderFilesPage();
      // 2048 bytes = 2.0 KB
      expect(screen.getByText('2.0 KB')).toBeInTheDocument();
    });

    it('ファイルが0件の場合、空状態のメッセージを表示する', async () => {
      mockApi.channels.getAttachments.mockResolvedValue({ attachments: [] });
      await renderFilesPage();
      expect(screen.getByText('ファイルはありません')).toBeInTheDocument();
    });

    it('データ取得中は Suspense のフォールバック（ローディング表示）を表示する', async () => {
      let resolve!: (v: { attachments: ChannelAttachment[] }) => void;
      mockApi.channels.getAttachments.mockReturnValue(
        new Promise((res) => {
          resolve = res;
        }),
      );
      render(
        <MemoryRouter>
          <FilesPage channelId={1} channelName="general" />
        </MemoryRouter>,
      );
      expect(screen.getByRole('progressbar')).toBeInTheDocument();
      await act(async () => {
        resolve({ attachments: [] });
      });
    });
  });

  describe('ファイルタイプフィルタリング', () => {
    it('「画像」フィルターを選択すると画像ファイルのみ表示される', async () => {
      // 初回（all）は空、画像フィルター時に画像ファイルを返す
      mockApi.channels.getAttachments
        .mockResolvedValueOnce({ attachments: [] }) // all
        .mockResolvedValueOnce({
          attachments: [makeAttachment({ originalName: 'photo.png', mimeType: 'image/png' })],
        }); // image

      await renderFilesPage();
      await userEvent.click(screen.getByRole('button', { name: '画像' }));

      await waitFor(() => {
        expect(screen.getByText('photo.png')).toBeInTheDocument();
      });
      expect(mockApi.channels.getAttachments).toHaveBeenCalledWith(1, 'image');
    });

    it('「PDF」フィルターを選択するとPDFファイルのみ表示される', async () => {
      mockApi.channels.getAttachments
        .mockResolvedValueOnce({ attachments: [] }) // all
        .mockResolvedValueOnce({
          attachments: [makeAttachment({ originalName: 'doc.pdf', mimeType: 'application/pdf' })],
        }); // pdf

      await renderFilesPage();
      await userEvent.click(screen.getByRole('button', { name: 'PDF' }));

      await waitFor(() => {
        expect(screen.getByText('doc.pdf')).toBeInTheDocument();
      });
      expect(mockApi.channels.getAttachments).toHaveBeenCalledWith(1, 'pdf');
    });

    it('「その他」フィルターを選択すると画像・PDF以外のファイルのみ表示される', async () => {
      mockApi.channels.getAttachments
        .mockResolvedValueOnce({ attachments: [] }) // all
        .mockResolvedValueOnce({
          attachments: [makeAttachment({ originalName: 'note.txt', mimeType: 'text/plain' })],
        }); // other

      await renderFilesPage();
      await userEvent.click(screen.getByRole('button', { name: 'その他' }));

      await waitFor(() => {
        expect(screen.getByText('note.txt')).toBeInTheDocument();
      });
      expect(mockApi.channels.getAttachments).toHaveBeenCalledWith(1, 'other');
    });

    it('「すべて」フィルターを選択するとすべてのファイルが表示される', async () => {
      const allAttachments = [
        makeAttachment({ id: 1, originalName: 'photo.png', mimeType: 'image/png' }),
        makeAttachment({ id: 2, originalName: 'doc.pdf', mimeType: 'application/pdf' }),
      ];
      mockApi.channels.getAttachments.mockResolvedValue({ attachments: allAttachments });

      await renderFilesPage();

      expect(screen.getByText('photo.png')).toBeInTheDocument();
      expect(screen.getByText('doc.pdf')).toBeInTheDocument();
    });
  });

  describe('ファイル操作', () => {
    it('ダウンロードボタンをクリックするとファイルのダウンロードが開始される', async () => {
      mockApi.channels.getAttachments.mockResolvedValue({
        attachments: [makeAttachment({ url: '/uploads/test.png', originalName: 'test.png' })],
      });
      await renderFilesPage();

      const downloadBtn = screen.getByRole('link', { name: 'ダウンロード' });
      expect(downloadBtn).toHaveAttribute('href', '/uploads/test.png');
      expect(downloadBtn).toHaveAttribute('download', 'test.png');
    });

    it('画像ファイルのプレビューボタンをクリックするとプレビューが表示される', async () => {
      const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null);
      mockApi.channels.getAttachments.mockResolvedValue({
        attachments: [makeAttachment({ url: '/uploads/photo.png', mimeType: 'image/png' })],
      });
      await renderFilesPage();

      await userEvent.click(screen.getByRole('button', { name: 'プレビュー' }));
      expect(openSpy).toHaveBeenCalledWith('/uploads/photo.png', '_blank');
      openSpy.mockRestore();
    });

    it('PDFファイルのプレビューボタンをクリックするとプレビューが表示される', async () => {
      const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null);
      mockApi.channels.getAttachments.mockResolvedValue({
        attachments: [
          makeAttachment({
            url: '/uploads/doc.pdf',
            mimeType: 'application/pdf',
            originalName: 'doc.pdf',
          }),
        ],
      });
      await renderFilesPage();

      await userEvent.click(screen.getByRole('button', { name: 'プレビュー' }));
      expect(openSpy).toHaveBeenCalledWith('/uploads/doc.pdf', '_blank');
      openSpy.mockRestore();
    });
  });
});
