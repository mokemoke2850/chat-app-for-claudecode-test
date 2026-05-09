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
    it.todo('クリップボードに画像がある場合、paste イベントでアップロード API が呼ばれる');

    it.todo('複数の画像を同時に貼り付けたとき、すべての画像がアップロードされる');

    it.todo('アップロード完了後に画像ファイル名がプレビューとして表示される');

    it.todo('アップロード中はローディングインジケーターが表示される');

    it.todo('画像ペースト時に preventDefault が呼ばれてデフォルト動作が抑制される');
  });

  describe('非画像ペースト', () => {
    it.todo('クリップボードにテキストのみがある場合、アップロード API は呼ばれない');

    it.todo('クリップボードに image/* 以外のファイルがある場合、アップロード API は呼ばれない');

    it.todo('テキストと画像が混在する場合、画像のみアップロードされテキストはデフォルト動作になる');
  });

  describe('異常系', () => {
    it.todo('画像アップロード失敗時にエラーメッセージが表示される');

    it.todo('disabled 状態のとき、画像をペーストしてもアップロード API が呼ばれない');
  });

  describe('UI確認', () => {
    it('エディタ領域が存在する', () => {
      render(<RichEditor users={dummyUsers} onSend={vi.fn()} />);
      expect(screen.getByTestId('quill-editor')).toBeInTheDocument();
    });
  });
});
