/**
 * components/Chat/RichEditor.tsx のファイルアップロード機能テスト
 *
 * テスト対象: ファイル選択ボタン・ドラッグ&ドロップによるファイル添付、添付プレビュー表示
 * 戦略:
 *   - react-quill-new は jsdom で動作しないため forwardRef スタブに差し替える
 *   - API クライアントの files.upload を vi.mock で差し替え、即時 resolve させる
 *   - userEvent.upload() でファイル選択をシミュレートする
 *   - ドラッグ&ドロップは fireEvent.dragOver / fireEvent.drop で発火する
 *   - modules.keyboard.bindings の handler を capturedModules 経由で直接呼び出す
 */

import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { User } from '@chat-app/shared';
import RichEditor from '../components/Chat/RichEditor';

// ─── Quill モックの共有ステート ───────────────────────────────────────────────
const { mockQuill, capturedModules, mockUpload } = vi.hoisted(() => {
  const capturedModules = { value: null as Record<string, unknown> | null };

  const mockQuill = {
    on: vi.fn(),
    off: vi.fn(),
    getSelection: vi.fn(() => ({ index: 0, length: 0 })),
    getText: vi.fn(() => 'hello'),
    getContents: vi.fn(() => ({ ops: [{ insert: 'hello\n' }] })),
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

  return { mockQuill, capturedModules, mockUpload };
});

vi.mock('react-quill-new', async () => {
  const React = (await import('react')) as typeof import('react');
  const MockReactQuill = React.forwardRef(
    (props: Record<string, unknown>, ref: React.Ref<unknown>) => {
      capturedModules.value = props.modules as Record<string, unknown>;
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
  },
}));

const dummyUsers: User[] = [];

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

describe('RichEditor - ファイルアップロード', () => {
  describe('ファイル選択ボタン', () => {
    it('ファイル選択ボタンが表示される', () => {
      render(<RichEditor users={dummyUsers} onSend={vi.fn()} />);

      expect(screen.getByRole('button', { name: /ファイルを添付/i })).toBeInTheDocument();
    });

    it('ファイル選択ボタンをクリックするとファイルピッカーが開く', async () => {
      render(<RichEditor users={dummyUsers} onSend={vi.fn()} />);

      const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
      const clickSpy = vi.spyOn(fileInput, 'click');

      await userEvent.click(screen.getByRole('button', { name: /ファイルを添付/i }));

      expect(clickSpy).toHaveBeenCalledTimes(1);
    });

    it('ファイルを選択するとアップロード API が呼ばれる', async () => {
      render(<RichEditor users={dummyUsers} onSend={vi.fn()} />);

      const file = new File(['hello'], 'test.txt', { type: 'text/plain' });
      const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;

      await userEvent.upload(fileInput, file);

      await waitFor(() => {
        expect(mockUpload).toHaveBeenCalledTimes(1);
        expect(mockUpload).toHaveBeenCalledWith(file);
      });
    });

    it('アップロード中はローディング状態を表示する', async () => {
      let resolve!: (v: unknown) => void;
      mockUpload.mockReturnValue(new Promise((r) => (resolve = r)));

      render(<RichEditor users={dummyUsers} onSend={vi.fn()} />);

      const file = new File(['hello'], 'loading.txt', { type: 'text/plain' });
      const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;

      act(() => {
        fireEvent.change(fileInput, { target: { files: [file] } });
      });

      await waitFor(() => {
        expect(screen.getByRole('progressbar')).toBeInTheDocument();
      });

      resolve({ url: '/uploads/loading.txt', originalName: 'loading.txt', size: 5 });
    });

    it('アップロード完了後にファイル名がプレビューとして表示される', async () => {
      render(<RichEditor users={dummyUsers} onSend={vi.fn()} />);

      const file = new File(['hello'], 'test.txt', { type: 'text/plain' });
      const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;

      await userEvent.upload(fileInput, file);

      await waitFor(() => {
        expect(screen.getByText('test.txt')).toBeInTheDocument();
      });
    });

    it('プレビューの削除ボタンをクリックすると添付ファイルが除去される', async () => {
      render(<RichEditor users={dummyUsers} onSend={vi.fn()} />);

      const file = new File(['hello'], 'remove.txt', { type: 'text/plain' });
      const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
      await userEvent.upload(fileInput, file);
      await waitFor(() => expect(screen.getByText('remove.txt')).toBeInTheDocument());

      await userEvent.click(screen.getByRole('button', { name: /remove\.txt を削除/i }));

      expect(screen.queryByText('remove.txt')).not.toBeInTheDocument();
    });
  });

  describe('ドラッグ&ドロップ', () => {
    it('エディタ領域にファイルをドロップするとアップロード API が呼ばれる', async () => {
      render(<RichEditor users={dummyUsers} onSend={vi.fn()} />);

      const dropZone = screen.getByTestId('file-drop-zone');
      const file = new File(['content'], 'dropped.txt', { type: 'text/plain' });

      fireEvent.dragOver(dropZone, { dataTransfer: { files: [file] } });
      fireEvent.drop(dropZone, { dataTransfer: { files: [file] } });

      await waitFor(() => {
        expect(mockUpload).toHaveBeenCalledWith(file);
      });
    });

    it('ドラッグオーバー中にドロップゾーンのスタイルが変化する', () => {
      render(<RichEditor users={dummyUsers} onSend={vi.fn()} />);

      const dropZone = screen.getByTestId('file-drop-zone');

      fireEvent.dragOver(dropZone, { dataTransfer: { files: [] } });

      expect(dropZone).toHaveAttribute('data-dragover', 'true');

      fireEvent.dragLeave(dropZone);

      expect(dropZone).not.toHaveAttribute('data-dragover', 'true');
    });

    it('ドロップ後にファイル名がプレビューとして表示される', async () => {
      render(<RichEditor users={dummyUsers} onSend={vi.fn()} />);

      const dropZone = screen.getByTestId('file-drop-zone');
      const file = new File(['data'], 'dropped.pdf', { type: 'application/pdf' });

      mockUpload.mockResolvedValue({
        url: '/uploads/dropped.pdf',
        originalName: 'dropped.pdf',
        size: 4,
      });

      fireEvent.drop(dropZone, { dataTransfer: { files: [file] } });

      await waitFor(() => {
        expect(screen.getByText('dropped.pdf')).toBeInTheDocument();
      });
    });
  });

  describe('メッセージ送信との連携', () => {
    it('送信時に attachmentIds が onSend コールバックに渡される', async () => {
      mockUpload.mockResolvedValue({
        url: '/uploads/file.txt',
        originalName: 'file.txt',
        size: 5,
        id: 42,
      });
      const onSend = vi.fn();

      render(<RichEditor users={dummyUsers} onSend={onSend} />);

      const file = new File(['hello'], 'file.txt', { type: 'text/plain' });
      const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
      await userEvent.upload(fileInput, file);
      await waitFor(() => expect(screen.getByText('file.txt')).toBeInTheDocument());

      // Enter キーで送信
      const modules = capturedModules.value as {
        keyboard: { bindings: { sendOnEnter: { handler: () => boolean } } };
      };
      act(() => {
        modules.keyboard.bindings.sendOnEnter.handler();
      });

      expect(onSend).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(Array),
        expect.arrayContaining([42]),
      );
    });

    it('送信後に添付ファイルのプレビューがクリアされる', async () => {
      render(<RichEditor users={dummyUsers} onSend={vi.fn()} />);

      const file = new File(['hello'], 'clear.txt', { type: 'text/plain' });
      const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
      await userEvent.upload(fileInput, file);
      await waitFor(() => expect(screen.getByText('clear.txt')).toBeInTheDocument());

      const modules = capturedModules.value as {
        keyboard: { bindings: { sendOnEnter: { handler: () => boolean } } };
      };
      act(() => {
        modules.keyboard.bindings.sendOnEnter.handler();
      });

      await waitFor(() => {
        expect(screen.queryByText('clear.txt')).not.toBeInTheDocument();
      });
    });

    it('テキストなし・添付ファイルのみの場合も送信できる', async () => {
      mockUpload.mockResolvedValue({
        url: '/uploads/only.txt',
        originalName: 'only.txt',
        size: 3,
        id: 99,
      });
      mockQuill.getText.mockReturnValue(''); // テキストなし
      const onSend = vi.fn();

      render(<RichEditor users={dummyUsers} onSend={onSend} />);

      const file = new File(['hi'], 'only.txt', { type: 'text/plain' });
      const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
      await userEvent.upload(fileInput, file);
      await waitFor(() => expect(screen.getByText('only.txt')).toBeInTheDocument());

      const modules = capturedModules.value as {
        keyboard: { bindings: { sendOnEnter: { handler: () => boolean } } };
      };
      act(() => {
        modules.keyboard.bindings.sendOnEnter.handler();
      });

      expect(onSend).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(Array),
        expect.arrayContaining([99]),
      );
    });
  });

  describe('異常系', () => {
    it('アップロード失敗時にエラーメッセージを表示する', async () => {
      mockUpload.mockRejectedValue(new Error('Upload failed'));

      render(<RichEditor users={dummyUsers} onSend={vi.fn()} />);

      const file = new File(['hello'], 'error.txt', { type: 'text/plain' });
      const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;

      await userEvent.upload(fileInput, file);

      await waitFor(() => {
        expect(screen.getByText(/アップロードに失敗しました/)).toBeInTheDocument();
      });
    });
  });
});
