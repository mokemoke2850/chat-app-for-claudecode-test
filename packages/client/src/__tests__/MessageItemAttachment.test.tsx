/**
 * components/Chat/MessageItem.tsx の添付ファイル表示機能テスト
 *
 * テスト対象: メッセージに添付されたファイルの表示・ダウンロードリンク
 * 戦略:
 *   - Socket.IO は SocketContext をモックして注入する
 *   - RichEditor は jsdom では動作しないためスタブに差し替える
 *   - Message 型に attachments を含む形でダミーデータを構築する
 */

import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Message, User } from '@chat-app/shared';
import MessageItem from '../components/Chat/MessageItem';

vi.mock('../contexts/SocketContext', () => ({
  useSocket: () => ({ emit: vi.fn(), on: vi.fn(), off: vi.fn() }),
}));

vi.mock('../components/Chat/RichEditor', () => ({
  default: ({ onCancel }: { onCancel: () => void }) => (
    <div data-testid="rich-editor">
      <button onClick={onCancel}>Cancel</button>
    </div>
  ),
}));

const dummyUsers: User[] = [
  {
    id: 1,
    username: 'alice',
    email: 'alice@example.com',
    avatarUrl: null,
    displayName: null,
    location: null,
    createdAt: '2024-01-01T00:00:00Z',
    role: 'user',
    isActive: true,
    onboardingCompletedAt: null,
  },
];

function makeMessage(overrides: Partial<Message> = {}): Message {
  return {
    id: 1,
    channelId: 1,
    userId: 1,
    username: 'alice',
    avatarUrl: null,
    content: JSON.stringify({ ops: [{ insert: 'Hello\n' }] }),
    isEdited: false,
    isDeleted: false,
    createdAt: '2024-06-01T12:00:00Z',
    updatedAt: '2024-06-01T12:00:00Z',
    mentions: [],
    attachments: [],
    reactions: [],
    parentMessageId: null,
    rootMessageId: null,
    replyCount: 0,
    quotedMessageId: null,
    quotedMessage: null,
    ...overrides,
  };
}

beforeEach(() => {
  vi.resetAllMocks();
});

describe('MessageItem - 添付ファイル表示', () => {
  describe('ファイル名の表示', () => {
    it('添付ファイルが存在する場合、ファイル名が表示される', () => {
      render(
        <MessageItem
          message={makeMessage({
            attachments: [
              {
                id: 1,
                url: '/uploads/doc.pdf',
                originalName: 'doc.pdf',
                size: 1024,
                mimeType: 'application/pdf',
              },
            ],
          })}
          currentUserId={1}
          users={dummyUsers}
        />,
      );

      expect(screen.getByText('doc.pdf')).toBeInTheDocument();
    });

    it('複数の添付ファイルがある場合、すべてのファイル名が表示される', () => {
      render(
        <MessageItem
          message={makeMessage({
            attachments: [
              {
                id: 1,
                url: '/uploads/a.pdf',
                originalName: 'a.pdf',
                size: 100,
                mimeType: 'application/pdf',
              },
              {
                id: 2,
                url: '/uploads/b.txt',
                originalName: 'b.txt',
                size: 200,
                mimeType: 'text/plain',
              },
            ],
          })}
          currentUserId={1}
          users={dummyUsers}
        />,
      );

      expect(screen.getByText('a.pdf')).toBeInTheDocument();
      expect(screen.getByText('b.txt')).toBeInTheDocument();
    });

    it('添付ファイルがない場合、ファイル領域は表示されない', () => {
      render(
        <MessageItem
          message={makeMessage({ attachments: [] })}
          currentUserId={1}
          users={dummyUsers}
        />,
      );

      expect(screen.queryByTestId('message-attachments')).not.toBeInTheDocument();
    });
  });

  describe('ダウンロードリンク', () => {
    it('ファイル名をクリックするとダウンロードリンクが機能する', async () => {
      render(
        <MessageItem
          message={makeMessage({
            attachments: [
              {
                id: 1,
                url: '/uploads/file.txt',
                originalName: 'file.txt',
                size: 50,
                mimeType: 'text/plain',
              },
            ],
          })}
          currentUserId={1}
          users={dummyUsers}
        />,
      );

      const link = screen.getByRole('link', { name: /file\.txt/i });
      expect(link).toBeInTheDocument();
    });

    it('ダウンロードリンクの href がファイルの URL を指している', () => {
      render(
        <MessageItem
          message={makeMessage({
            attachments: [
              {
                id: 1,
                url: '/uploads/report.pdf',
                originalName: 'report.pdf',
                size: 2048,
                mimeType: 'application/pdf',
              },
            ],
          })}
          currentUserId={1}
          users={dummyUsers}
        />,
      );

      const link = screen.getByRole('link', { name: /report\.pdf/i });
      expect(link).toHaveAttribute('href', '/uploads/report.pdf');
    });

    it('ダウンロードリンクに download 属性が付与されている', () => {
      render(
        <MessageItem
          message={makeMessage({
            attachments: [
              {
                id: 1,
                url: '/uploads/data.csv',
                originalName: 'data.csv',
                size: 512,
                mimeType: 'text/csv',
              },
            ],
          })}
          currentUserId={1}
          users={dummyUsers}
        />,
      );

      const link = screen.getByRole('link', { name: /data\.csv/i });
      expect(link).toHaveAttribute('download');
    });
  });

  describe('ファイルの種類別表示', () => {
    it('画像ファイルはサムネイル表示される', () => {
      render(
        <MessageItem
          message={makeMessage({
            attachments: [
              {
                id: 1,
                url: '/uploads/photo.png',
                originalName: 'photo.png',
                size: 4096,
                mimeType: 'image/png',
              },
            ],
          })}
          currentUserId={1}
          users={dummyUsers}
        />,
      );

      const img = screen.getByRole('img', { name: /photo\.png/i });
      expect(img).toBeInTheDocument();
      expect(img).toHaveAttribute('src', '/uploads/photo.png');
    });

    it('非画像ファイルはアイコン＋ファイル名で表示される', () => {
      render(
        <MessageItem
          message={makeMessage({
            attachments: [
              {
                id: 1,
                url: '/uploads/archive.zip',
                originalName: 'archive.zip',
                size: 8192,
                mimeType: 'application/zip',
              },
            ],
          })}
          currentUserId={1}
          users={dummyUsers}
        />,
      );

      expect(screen.getByText('archive.zip')).toBeInTheDocument();
      expect(screen.queryByRole('img', { name: /archive\.zip/i })).not.toBeInTheDocument();
      expect(screen.getByTestId('file-icon')).toBeInTheDocument();
    });
  });
});
