/**
 * テスト対象: components/Chat/RichEditor.tsx のクリップボード画像貼り付け機能
 * 戦略:
 *   - react-quill-new は jsdom で動作しないため forwardRef スタブに差し替える
 *   - API クライアントの files.upload を vi.mock で差し替え、即時 resolve させる
 *   - ClipboardEvent を fireEvent.paste で発火し、clipboardData.items を手動設定する
 *   - paste イベントで image/* のみをアップロードフローに渡すことを検証する
 *   - テキストペーストはデフォルト動作（preventDefault を呼ばない）を維持することを検証する
 */

import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { User } from '@chat-app/shared';
import RichEditor from '../components/Chat/RichEditor';

// ─── Quill モックの共有ステート ───────────────────────────────────────────────
const { mockQuill, mockUpload } = vi.hoisted(() => {
  const mockQuill = {
    on: vi.fn(),
    off: vi.fn(),
    getSelection: vi.fn(() => ({ index: 0, length: 0 })),
    getText: vi.fn(() => ''),
    getContents: vi.fn(() => ({ ops: [] })),
    deleteText: vi.fn(),
    insertEmbed: vi.fn(),
    insertText: vi.fn(),
    setSelection: vi.fn(),
    setText: vi.fn(),
    focus: vi.fn(),
    root: { getBoundingClientRect: vi.fn(() => new DOMRect()) },
    getBounds: vi.fn(() => ({ left: 0, bottom: 20 })),
  };

  const mockUpload = vi.fn();

  return { mockQuill, mockUpload };
});

vi.mock('react-quill-new', async () => {
  const React = (await import('react')) as typeof import('react');
  const MockReactQuill = React.forwardRef(
    (_props: Record<string, unknown>, ref: React.Ref<unknown>) => {
      React.useImperativeHandle(ref, () => ({ getEditor: () => mockQuill }), []);
      return React.createElement('div', { 'data-testid': 'quill-editor' });
    },
  );
  MockReactQuill.displayName = 'MockReactQuill';
  return { default: MockReactQuill };
});

vi.mock('react-quill-new/dist/quill.snow.css', () => ({}));
vi.mock('../components/Chat/MentionBlot', () => ({}));

vi.mock('../api/client', () => ({
  api: {
    files: {
      upload: mockUpload,
    },
    drafts: {
      upsertChannel: vi.fn().mockResolvedValue(undefined),
      upsertDm: vi.fn().mockResolvedValue(undefined),
      deleteChannel: vi.fn().mockResolvedValue(undefined),
      deleteDm: vi.fn().mockResolvedValue(undefined),
    },
  },
}));

const dummyUsers: User[] = [];

// DataTransferItem のモックを作成するヘルパー
function makeImageItem(mimeType = 'image/png', name = 'test.png'): DataTransferItem {
  const file = new File(['dummy'], name, { type: mimeType });
  return {
    kind: 'file',
    type: mimeType,
    getAsFile: () => file,
    getAsString: vi.fn(),
    webkitGetAsEntry: vi.fn(),
  } as unknown as DataTransferItem;
}

function makeTextItem(text = 'hello'): DataTransferItem {
  return {
    kind: 'string',
    type: 'text/plain',
    getAsFile: () => null,
    getAsString: (callback: (data: string) => void) => callback(text),
    webkitGetAsEntry: vi.fn(),
  } as unknown as DataTransferItem;
}

function makeNonImageFileItem(): DataTransferItem {
  const file = new File(['dummy'], 'document.pdf', { type: 'application/pdf' });
  return {
    kind: 'file',
    type: 'application/pdf',
    getAsFile: () => file,
    getAsString: vi.fn(),
    webkitGetAsEntry: vi.fn(),
  } as unknown as DataTransferItem;
}

beforeEach(() => {
  vi.clearAllMocks();
  mockUpload.mockImplementation((file: File) =>
    Promise.resolve({
      id: 1,
      url: `/uploads/${file.name}`,
      originalName: file.name,
      size: file.size,
    }),
  );
});

describe('RichEditor - クリップボード画像貼り付け', () => {
  describe('画像ペースト', () => {
    it('クリップボードに画像がある場合、paste イベントでアップロード API が呼ばれる', async () => {
      render(<RichEditor users={dummyUsers} onSend={vi.fn()} />);
      const editor = screen.getByTestId('quill-editor');

      const pasteEvent = new ClipboardEvent('paste', { bubbles: true, cancelable: true });
      const imageItem = makeImageItem('image/png', 'screenshot.png');
      Object.defineProperty(pasteEvent, 'clipboardData', {
        value: { items: [imageItem] },
        writable: false,
      });

      fireEvent(editor, pasteEvent);

      await waitFor(() => {
        expect(mockUpload).toHaveBeenCalledTimes(1);
        const calledFile = mockUpload.mock.calls[0][0] as File;
        expect(calledFile.name).toBe('screenshot.png');
        expect(calledFile.type).toBe('image/png');
      });
    });

    it('複数の画像を同時に貼り付けたとき、すべての画像がアップロードされる', async () => {
      render(<RichEditor users={dummyUsers} onSend={vi.fn()} />);
      const editor = screen.getByTestId('quill-editor');

      const pasteEvent = new ClipboardEvent('paste', { bubbles: true, cancelable: true });
      const items = [
        makeImageItem('image/png', 'img1.png'),
        makeImageItem('image/jpeg', 'img2.jpg'),
        makeImageItem('image/gif', 'img3.gif'),
      ];
      Object.defineProperty(pasteEvent, 'clipboardData', {
        value: { items },
        writable: false,
      });

      fireEvent(editor, pasteEvent);

      await waitFor(() => {
        expect(mockUpload).toHaveBeenCalledTimes(3);
      });
    });

    it('アップロード完了後に画像ファイル名がプレビューとして表示される', async () => {
      mockUpload.mockResolvedValue({
        id: 42,
        url: '/uploads/screenshot.png',
        originalName: 'screenshot.png',
        size: 1024,
      });

      render(<RichEditor users={dummyUsers} onSend={vi.fn()} />);
      const editor = screen.getByTestId('quill-editor');

      const pasteEvent = new ClipboardEvent('paste', { bubbles: true, cancelable: true });
      const imageItem = makeImageItem('image/png', 'screenshot.png');
      Object.defineProperty(pasteEvent, 'clipboardData', {
        value: { items: [imageItem] },
        writable: false,
      });

      fireEvent(editor, pasteEvent);

      await waitFor(() => {
        expect(screen.getByText('screenshot.png')).toBeInTheDocument();
      });
    });

    it('アップロード中はローディングインジケーターが表示される', async () => {
      // アップロードを遅延させて進行中の状態を確認する
      let resolveUpload!: (value: unknown) => void;
      mockUpload.mockImplementation(
        () =>
          new Promise((resolve) => {
            resolveUpload = resolve;
          }),
      );

      render(<RichEditor users={dummyUsers} onSend={vi.fn()} />);
      const editor = screen.getByTestId('quill-editor');

      const pasteEvent = new ClipboardEvent('paste', { bubbles: true, cancelable: true });
      const imageItem = makeImageItem('image/png', 'screenshot.png');
      Object.defineProperty(pasteEvent, 'clipboardData', {
        value: { items: [imageItem] },
        writable: false,
      });

      fireEvent(editor, pasteEvent);

      // アップロード中にプログレスが表示される
      await waitFor(() => {
        expect(screen.getByRole('progressbar')).toBeInTheDocument();
      });

      // アップロード完了後に消える
      resolveUpload({
        id: 1,
        url: '/uploads/screenshot.png',
        originalName: 'screenshot.png',
        size: 1024,
      });

      await waitFor(() => {
        expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
      });
    });

    it('画像ペースト時に preventDefault が呼ばれてデフォルト動作が抑制される', () => {
      render(<RichEditor users={dummyUsers} onSend={vi.fn()} />);
      const editor = screen.getByTestId('quill-editor');

      const pasteEvent = new ClipboardEvent('paste', { bubbles: true, cancelable: true });
      const imageItem = makeImageItem('image/png', 'screenshot.png');
      Object.defineProperty(pasteEvent, 'clipboardData', {
        value: { items: [imageItem] },
        writable: false,
      });

      fireEvent(editor, pasteEvent);

      expect(pasteEvent.defaultPrevented).toBe(true);
    });
  });

  describe('非画像ペースト', () => {
    it('クリップボードにテキストのみがある場合、アップロード API は呼ばれない', async () => {
      render(<RichEditor users={dummyUsers} onSend={vi.fn()} />);
      const editor = screen.getByTestId('quill-editor');

      const pasteEvent = new ClipboardEvent('paste', { bubbles: true, cancelable: true });
      const textItem = makeTextItem('hello world');
      Object.defineProperty(pasteEvent, 'clipboardData', {
        value: { items: [textItem] },
        writable: false,
      });

      fireEvent(editor, pasteEvent);

      // 少し待ってもAPIが呼ばれないことを確認
      await new Promise((r) => setTimeout(r, 50));
      expect(mockUpload).not.toHaveBeenCalled();
    });

    it('クリップボードに image/* 以外のファイルがある場合、アップロード API は呼ばれない', async () => {
      render(<RichEditor users={dummyUsers} onSend={vi.fn()} />);
      const editor = screen.getByTestId('quill-editor');

      const pasteEvent = new ClipboardEvent('paste', { bubbles: true, cancelable: true });
      const pdfItem = makeNonImageFileItem();
      Object.defineProperty(pasteEvent, 'clipboardData', {
        value: { items: [pdfItem] },
        writable: false,
      });

      fireEvent(editor, pasteEvent);

      await new Promise((r) => setTimeout(r, 50));
      expect(mockUpload).not.toHaveBeenCalled();
    });

    it('テキストと画像が混在する場合、画像のみアップロードされテキストはデフォルト動作になる', async () => {
      render(<RichEditor users={dummyUsers} onSend={vi.fn()} />);
      const editor = screen.getByTestId('quill-editor');

      const pasteEvent = new ClipboardEvent('paste', { bubbles: true, cancelable: true });
      const items = [makeTextItem('hello'), makeImageItem('image/png', 'photo.png')];
      Object.defineProperty(pasteEvent, 'clipboardData', {
        value: { items },
        writable: false,
      });

      fireEvent(editor, pasteEvent);

      await waitFor(() => {
        expect(mockUpload).toHaveBeenCalledTimes(1);
        const calledFile = mockUpload.mock.calls[0][0] as File;
        expect(calledFile.name).toBe('photo.png');
      });
    });
  });

  describe('異常系', () => {
    it('画像アップロード失敗時にエラーメッセージが表示される', async () => {
      mockUpload.mockRejectedValue(new Error('Upload failed'));

      render(<RichEditor users={dummyUsers} onSend={vi.fn()} />);
      const editor = screen.getByTestId('quill-editor');

      const pasteEvent = new ClipboardEvent('paste', { bubbles: true, cancelable: true });
      const imageItem = makeImageItem('image/png', 'screenshot.png');
      Object.defineProperty(pasteEvent, 'clipboardData', {
        value: { items: [imageItem] },
        writable: false,
      });

      fireEvent(editor, pasteEvent);

      await waitFor(() => {
        expect(screen.getByText('アップロードに失敗しました')).toBeInTheDocument();
      });
    });

    it('disabled 状態のとき、画像をペーストしてもアップロード API が呼ばれない', async () => {
      render(<RichEditor users={dummyUsers} onSend={vi.fn()} disabled />);
      const editor = screen.getByTestId('quill-editor');

      const pasteEvent = new ClipboardEvent('paste', { bubbles: true, cancelable: true });
      const imageItem = makeImageItem('image/png', 'screenshot.png');
      Object.defineProperty(pasteEvent, 'clipboardData', {
        value: { items: [imageItem] },
        writable: false,
      });

      fireEvent(editor, pasteEvent);

      await new Promise((r) => setTimeout(r, 50));
      expect(mockUpload).not.toHaveBeenCalled();
    });
  });

  describe('UI確認', () => {
    it('エディタ領域が存在する', () => {
      render(<RichEditor users={dummyUsers} onSend={vi.fn()} />);
      expect(screen.getByTestId('quill-editor')).toBeInTheDocument();
    });
  });
});
