/**
 * テスト対象: components/Chat/RichEditor.tsx のドラッグ&ドロップ添付機能
 *
 * 戦略:
 *   - RichEditorFileUpload.test.tsx が既にカバーする「単一ファイルのdrop→uploadFile呼び出し」と
 *     「dragover中のdata-dragover属性」は重複を避けてここでは扱わない
 *   - 本ファイルでは Issue #262 で求められる追加要件に特化してテストする:
 *       1. dragenter イベントでのハイライト開始
 *       2. 複数ファイル同時ドロップで uploadFile が各ファイル分呼ばれること
 *       3. dragleave 後に dragenter で再ハイライトされること（状態のリセット検証）
 *       4. ファイルを含まない dragover（テキスト等）では uploadFile が呼ばれないこと
 *   - react-quill-new は jsdom で動作しないためスタブに差し替える
 *   - API クライアントの files.upload は vi.mock で差し替える
 */

import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { User } from '@chat-app/shared';
import RichEditor from '../components/Chat/RichEditor';

// ─── Quill / API モック ────────────────────────────────────────────────────────
const { mockUpload } = vi.hoisted(() => {
  const mockUpload = vi.fn();
  return { mockUpload };
});

vi.mock('react-quill-new', async () => {
  const React = (await import('react')) as typeof import('react');
  const MockReactQuill = React.forwardRef(
    (_props: Record<string, unknown>, ref: React.Ref<unknown>) => {
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

// ScheduleSendButton / TemplatePicker はドラッグ&ドロップと無関係なためスタブ化
vi.mock('../components/Chat/ScheduleSendButton', async () => {
  const React = (await import('react')) as typeof import('react');
  return {
    default: () => React.createElement('div', { 'data-testid': 'schedule-send-stub' }),
  };
});

vi.mock('../components/Chat/TemplatePicker', async () => {
  const React = (await import('react')) as typeof import('react');
  return {
    default: () => React.createElement('div', { 'data-testid': 'template-picker-stub' }),
  };
});

// ─── テストデータ ──────────────────────────────────────────────────────────────
const dummyUsers: User[] = [];

beforeEach(() => {
  vi.clearAllMocks();
  mockUpload.mockResolvedValue({
    id: 1,
    url: '/uploads/file.txt',
    originalName: 'file.txt',
    size: 5,
  });
});

// ─── テスト項目 ────────────────────────────────────────────────────────────────
describe('RichEditor - ドラッグ&ドロップ添付 (#262)', () => {
  describe('dragenter ハイライト', () => {
    it('dragenter イベントでドロップゾーンの data-dragover が true になる', () => {
      render(<RichEditor users={dummyUsers} onSend={vi.fn()} />);

      const dropZone = screen.getByTestId('file-drop-zone');

      fireEvent.dragEnter(dropZone, { dataTransfer: { files: [] } });

      expect(dropZone).toHaveAttribute('data-dragover', 'true');
    });

    it('dragenter 後に dragleave するとドロップゾーンの data-dragover が消える', () => {
      render(<RichEditor users={dummyUsers} onSend={vi.fn()} />);

      const dropZone = screen.getByTestId('file-drop-zone');

      fireEvent.dragEnter(dropZone, { dataTransfer: { files: [] } });
      expect(dropZone).toHaveAttribute('data-dragover', 'true');

      fireEvent.dragLeave(dropZone);
      expect(dropZone).not.toHaveAttribute('data-dragover', 'true');
    });

    it('dragleave 後に再び dragenter するとドロップゾーンが再ハイライトされる', () => {
      render(<RichEditor users={dummyUsers} onSend={vi.fn()} />);

      const dropZone = screen.getByTestId('file-drop-zone');

      // 1回目: dragenter → dragleave
      fireEvent.dragEnter(dropZone, { dataTransfer: { files: [] } });
      fireEvent.dragLeave(dropZone);
      expect(dropZone).not.toHaveAttribute('data-dragover', 'true');

      // 2回目: 再び dragenter でハイライトされること
      fireEvent.dragEnter(dropZone, { dataTransfer: { files: [] } });
      expect(dropZone).toHaveAttribute('data-dragover', 'true');
    });
  });

  describe('複数ファイル同時ドロップ', () => {
    it('複数ファイルをドロップすると uploadFile がファイルの枚数分呼ばれる', async () => {
      render(<RichEditor users={dummyUsers} onSend={vi.fn()} />);

      const dropZone = screen.getByTestId('file-drop-zone');
      const file1 = new File(['content1'], 'file1.txt', { type: 'text/plain' });
      const file2 = new File(['content2'], 'file2.txt', { type: 'text/plain' });

      mockUpload
        .mockResolvedValueOnce({
          id: 1,
          url: '/uploads/file1.txt',
          originalName: 'file1.txt',
          size: 8,
        })
        .mockResolvedValueOnce({
          id: 2,
          url: '/uploads/file2.txt',
          originalName: 'file2.txt',
          size: 8,
        });

      fireEvent.drop(dropZone, { dataTransfer: { files: [file1, file2] } });

      await waitFor(() => {
        expect(mockUpload).toHaveBeenCalledTimes(2);
      });
      expect(mockUpload).toHaveBeenCalledWith(file1);
      expect(mockUpload).toHaveBeenCalledWith(file2);
    });

    it('複数ファイルをドロップするとすべてのファイル名がプレビューに表示される', async () => {
      render(<RichEditor users={dummyUsers} onSend={vi.fn()} />);

      const dropZone = screen.getByTestId('file-drop-zone');
      const file1 = new File(['content1'], 'alpha.txt', { type: 'text/plain' });
      const file2 = new File(['content2'], 'beta.txt', { type: 'text/plain' });

      mockUpload
        .mockResolvedValueOnce({
          id: 1,
          url: '/uploads/alpha.txt',
          originalName: 'alpha.txt',
          size: 8,
        })
        .mockResolvedValueOnce({
          id: 2,
          url: '/uploads/beta.txt',
          originalName: 'beta.txt',
          size: 8,
        });

      fireEvent.drop(dropZone, { dataTransfer: { files: [file1, file2] } });

      await waitFor(() => {
        expect(screen.getByText('alpha.txt')).toBeInTheDocument();
        expect(screen.getByText('beta.txt')).toBeInTheDocument();
      });
    });

    it('3枚以上のファイルを同時ドロップしてもすべてアップロードされる', async () => {
      render(<RichEditor users={dummyUsers} onSend={vi.fn()} />);

      const dropZone = screen.getByTestId('file-drop-zone');
      const files = [
        new File(['a'], 'a.txt', { type: 'text/plain' }),
        new File(['b'], 'b.txt', { type: 'text/plain' }),
        new File(['c'], 'c.txt', { type: 'text/plain' }),
      ];

      mockUpload
        .mockResolvedValueOnce({ id: 1, url: '/uploads/a.txt', originalName: 'a.txt', size: 1 })
        .mockResolvedValueOnce({ id: 2, url: '/uploads/b.txt', originalName: 'b.txt', size: 1 })
        .mockResolvedValueOnce({ id: 3, url: '/uploads/c.txt', originalName: 'c.txt', size: 1 });

      fireEvent.drop(dropZone, { dataTransfer: { files } });

      await waitFor(() => {
        expect(mockUpload).toHaveBeenCalledTimes(3);
      });
    });
  });

  describe('drop 時の dragOver 状態リセット', () => {
    it('drop イベントが発火した後は data-dragover 属性が消える', () => {
      render(<RichEditor users={dummyUsers} onSend={vi.fn()} />);

      const dropZone = screen.getByTestId('file-drop-zone');
      const file = new File(['content'], 'test.txt', { type: 'text/plain' });

      // dragenter でハイライト開始
      fireEvent.dragEnter(dropZone, { dataTransfer: { files: [file] } });
      expect(dropZone).toHaveAttribute('data-dragover', 'true');

      // drop 後はハイライト解除
      fireEvent.drop(dropZone, { dataTransfer: { files: [file] } });
      expect(dropZone).not.toHaveAttribute('data-dragover', 'true');
    });
  });

  describe('ファイルを含まないドラッグ操作', () => {
    it('DataTransfer にファイルが含まれない drop では uploadFile が呼ばれない', () => {
      render(<RichEditor users={dummyUsers} onSend={vi.fn()} />);

      const dropZone = screen.getByTestId('file-drop-zone');

      fireEvent.drop(dropZone, { dataTransfer: { files: [] } });

      expect(mockUpload).not.toHaveBeenCalled();
    });
  });

  describe('アップロード中の複数ドロップ', () => {
    it('1枚目のアップロード中に2枚目をドロップしてもそれぞれアップロードされる', async () => {
      let resolveFirst!: (v: unknown) => void;
      mockUpload.mockReturnValueOnce(new Promise((r) => (resolveFirst = r))).mockResolvedValueOnce({
        id: 2,
        url: '/uploads/second.txt',
        originalName: 'second.txt',
        size: 6,
      });

      render(<RichEditor users={dummyUsers} onSend={vi.fn()} />);

      const dropZone = screen.getByTestId('file-drop-zone');
      const file1 = new File(['content1'], 'first.txt', { type: 'text/plain' });
      const file2 = new File(['content2'], 'second.txt', { type: 'text/plain' });

      // 1枚目をドロップ（まだ未完了）
      fireEvent.drop(dropZone, { dataTransfer: { files: [file1] } });

      // 2枚目をドロップ
      fireEvent.drop(dropZone, { dataTransfer: { files: [file2] } });

      // 2枚目が呼ばれていること
      await waitFor(() => {
        expect(mockUpload).toHaveBeenCalledTimes(2);
      });

      // 1枚目を完了させる
      resolveFirst({ id: 1, url: '/uploads/first.txt', originalName: 'first.txt', size: 8 });

      await waitFor(() => {
        expect(screen.getByText('second.txt')).toBeInTheDocument();
      });
    });
  });
});
