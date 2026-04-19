/**
 * components/Chat/RichEditor.tsx のユニットテスト
 *
 * テスト対象: @メンション候補ウインドウの表示タイミング・絞り込み、絵文字ピッカーの動作
 * 戦略:
 *   - react-quill-new は jsdom で動作しないため forwardRef スタブに差し替える
 *   - Quill インスタンスの on/off/getSelection/getText/insertText を vi.fn() で制御する
 *   - selection-change イベントを手動発火してメンション検出ロジックをトリガーする
 *   - MentionBlot の副作用（Quill.register）もモックで無効化する
 *   - modules.keyboard.bindings の handler を capturedModules 経由で直接呼び出す
 */

import { render, screen, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { User } from '@chat-app/shared';
import RichEditor from '../components/Chat/RichEditor';

// ─── Quill モックの共有ステート（vi.hoisted で vi.mock より前に評価される）────────────
const { mockQuill, eventHandlers, fireQuillEvent, capturedModules } = vi.hoisted(() => {
  type EventHandler = (...args: unknown[]) => unknown;
  const eventHandlers: Record<string, EventHandler[]> = {};
  const capturedModules = { value: null as Record<string, unknown> | null };

  const mockQuill = {
    on: vi.fn((event: string, handler: EventHandler) => {
      eventHandlers[event] = [...(eventHandlers[event] ?? []), handler];
    }),
    off: vi.fn((event: string, handler: EventHandler) => {
      eventHandlers[event] = (eventHandlers[event] ?? []).filter((h) => h !== handler);
    }),
    getSelection: vi.fn(() => null as { index: number; length: number } | null),
    getText: vi.fn(() => ''),
    getContents: vi.fn(() => ({ ops: [] })),
    deleteText: vi.fn(),
    insertEmbed: vi.fn(),
    insertText: vi.fn(),
    setSelection: vi.fn(),
    setText: vi.fn(),
    focus: vi.fn(),
    root: {
      getBoundingClientRect: vi.fn(() => ({
        left: 0,
        top: 0,
        right: 500,
        bottom: 200,
        width: 500,
        height: 200,
        x: 0,
        y: 0,
        toJSON: () => '',
      })),
    },
    getBounds: vi.fn(() => ({ left: 0, top: 0, bottom: 20, right: 10, width: 10, height: 20 })),
  };

  const fireQuillEvent = (event: string, ...args: unknown[]) => {
    (eventHandlers[event] ?? []).forEach((h) => h(...args));
  };

  return { mockQuill, eventHandlers, fireQuillEvent, capturedModules };
});

// react-quill-new スタブ: forwardRef で getEditor() を公開し modules を捕捉する
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

// TemplatePicker は jsdom で fetch が使えないためスタブ化する
vi.mock('../components/Chat/TemplatePicker', async () => {
  const React = (await import('react')) as typeof import('react');
  return {
    default: ({ onSelect, onClose }: { onSelect: (body: string) => void; onClose: () => void }) =>
      React.createElement(
        'div',
        { role: 'dialog', 'aria-label': 'テンプレート選択' },
        React.createElement(
          'button',
          {
            'data-testid': 'template-select-trigger',
            onClick: () => {
              onSelect('テンプレート本文');
              onClose();
            },
          },
          'テンプレートを選択',
        ),
      ),
  };
});

// ─── テストデータ ────────────────────────────────────────────────────────────────────
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
  },
  {
    id: 2,
    username: 'bob',
    email: 'bob@example.com',
    avatarUrl: null,
    displayName: null,
    location: null,
    createdAt: '2024-01-01T00:00:00Z',
    role: 'user',
    isActive: true,
  },
  {
    id: 3,
    username: 'carol',
    email: 'carol@example.com',
    avatarUrl: null,
    displayName: null,
    location: null,
    createdAt: '2024-01-01T00:00:00Z',
    role: 'user',
    isActive: true,
  },
];

beforeEach(() => {
  vi.clearAllMocks();
  // イベントハンドラをリセット
  Object.keys(eventHandlers).forEach((k) => delete eventHandlers[k]);
  capturedModules.value = null;
  // clearAllMocks で実装が消えるため on/off を再設定する
  mockQuill.on.mockImplementation((event: string, handler: (...args: unknown[]) => unknown) => {
    eventHandlers[event] = [...(eventHandlers[event] ?? []), handler];
  });
  mockQuill.off.mockImplementation((event: string, handler: (...args: unknown[]) => unknown) => {
    eventHandlers[event] = (eventHandlers[event] ?? []).filter((h) => h !== handler);
  });
});

/** Quill の選択位置と getText をまとめて設定するヘルパー */
const setupCursor = (textBefore: string) => {
  mockQuill.getSelection.mockReturnValue({ index: textBefore.length, length: 0 });
  mockQuill.getText.mockImplementation((start = 0, len?: number) =>
    len !== undefined ? textBefore.slice(start, start + len) : textBefore,
  );
};

describe('RichEditor', () => {
  describe('@メンション候補ウインドウ', () => {
    it('@を入力した直後（query が空文字）に候補リストが表示される', () => {
      setupCursor('@');

      render(<RichEditor users={dummyUsers} onSend={vi.fn()} />);

      // selection-change を発火して検出ロジックをトリガー
      act(() => {
        fireQuillEvent('selection-change', { index: 1, length: 0 });
      });

      expect(screen.getByText('@alice')).toBeInTheDocument();
      expect(screen.getByText('@bob')).toBeInTheDocument();
      expect(screen.getByText('@carol')).toBeInTheDocument();
    });

    it('@の後に文字を入力すると前方一致するユーザーのみに絞り込まれる', () => {
      setupCursor('@al');

      render(<RichEditor users={dummyUsers} onSend={vi.fn()} />);

      act(() => {
        fireQuillEvent('selection-change', { index: 3, length: 0 });
      });

      expect(screen.getByText('@alice')).toBeInTheDocument();
      expect(screen.queryByText('@bob')).not.toBeInTheDocument();
      expect(screen.queryByText('@carol')).not.toBeInTheDocument();
    });

    it('@の後にスペースを入力すると候補リストが閉じる', () => {
      // まず @ で候補を開く
      setupCursor('@');
      render(<RichEditor users={dummyUsers} onSend={vi.fn()} />);
      act(() => {
        fireQuillEvent('selection-change', { index: 1, length: 0 });
      });
      expect(screen.getByText('@alice')).toBeInTheDocument();

      // @ の後にスペースを入力
      setupCursor('@ ');
      act(() => {
        fireQuillEvent('selection-change', { index: 2, length: 0 });
      });

      expect(screen.queryByText('@alice')).not.toBeInTheDocument();
    });

    it('候補リストが表示されている状態で Escape を押すと閉じる', () => {
      setupCursor('@');
      render(<RichEditor users={dummyUsers} onSend={vi.fn()} />);
      act(() => {
        fireQuillEvent('selection-change', { index: 1, length: 0 });
      });
      expect(screen.getByText('@alice')).toBeInTheDocument();

      // modules.keyboard.bindings.escapeKey.handler を直接呼び出す
      act(() => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const escHandler = (capturedModules.value as any)?.keyboard?.bindings?.escapeKey?.handler;
        escHandler?.();
      });

      expect(screen.queryByText('@alice')).not.toBeInTheDocument();
    });
  });

  describe('テンプレートピッカー（/tpl コマンド）', () => {
    it('/tpl と入力すると TemplatePicker が表示される', () => {
      setupCursor('/tpl');

      render(<RichEditor users={dummyUsers} onSend={vi.fn()} />);

      act(() => {
        fireQuillEvent('selection-change', { index: 4, length: 0 });
      });

      expect(screen.getByRole('dialog', { name: /テンプレート/ })).toBeInTheDocument();
    });

    it('/tpl 以外のスラッシュコマンド（例: /foo）では TemplatePicker が表示されない', () => {
      setupCursor('/foo');

      render(<RichEditor users={dummyUsers} onSend={vi.fn()} />);

      act(() => {
        fireQuillEvent('selection-change', { index: 4, length: 0 });
      });

      expect(screen.queryByRole('dialog', { name: /テンプレート/ })).not.toBeInTheDocument();
    });

    it('テンプレートを選択すると insertText が呼ばれ TemplatePicker が閉じる', async () => {
      setupCursor('/tpl');
      mockQuill.getSelection.mockReturnValue({ index: 4, length: 0 });

      render(<RichEditor users={dummyUsers} onSend={vi.fn()} />);

      act(() => {
        fireQuillEvent('selection-change', { index: 4, length: 0 });
      });

      // TemplatePicker の onSelect を直接呼び出してテンプレートを選択
      const picker = screen.getByRole('dialog', { name: /テンプレート/ });
      expect(picker).toBeInTheDocument();

      // onSelect コールバックを取得して呼び出す（TemplatePicker のプロパティ経由）
      const selectButton = screen.getByTestId('template-select-trigger');
      await userEvent.click(selectButton);

      expect(mockQuill.insertText).toHaveBeenCalled();
      expect(screen.queryByRole('dialog', { name: /テンプレート/ })).not.toBeInTheDocument();
    });

    it('Escape キーで TemplatePicker を閉じることができる', () => {
      setupCursor('/tpl');

      render(<RichEditor users={dummyUsers} onSend={vi.fn()} />);

      act(() => {
        fireQuillEvent('selection-change', { index: 4, length: 0 });
      });

      expect(screen.getByRole('dialog', { name: /テンプレート/ })).toBeInTheDocument();

      act(() => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const escHandler = (capturedModules.value as any)?.keyboard?.bindings?.escapeKey?.handler;
        escHandler?.();
      });

      expect(screen.queryByRole('dialog', { name: /テンプレート/ })).not.toBeInTheDocument();
    });

    it('/tpl の入力を削除すると TemplatePicker が閉じる', () => {
      setupCursor('/tpl');

      render(<RichEditor users={dummyUsers} onSend={vi.fn()} />);

      act(() => {
        fireQuillEvent('selection-change', { index: 4, length: 0 });
      });

      expect(screen.getByRole('dialog', { name: /テンプレート/ })).toBeInTheDocument();

      // /tpl を削除して空文字に
      setupCursor('');
      act(() => {
        fireQuillEvent('selection-change', { index: 0, length: 0 });
      });

      expect(screen.queryByRole('dialog', { name: /テンプレート/ })).not.toBeInTheDocument();
    });
  });

  describe('絵文字ピッカー', () => {
    it('絵文字ボタンが DOM 上に存在する', () => {
      render(<RichEditor users={dummyUsers} onSend={vi.fn()} />);

      expect(screen.getByRole('button', { name: '絵文字を挿入' })).toBeInTheDocument();
    });

    it('絵文字ボタンをクリックするとピッカーが表示される', async () => {
      render(<RichEditor users={dummyUsers} onSend={vi.fn()} />);

      await userEvent.click(screen.getByRole('button', { name: '絵文字を挿入' }));

      // ピッカー内の絵文字が表示されていること（先頭の 😀 で確認）
      expect(screen.getByText('😀')).toBeInTheDocument();
    });

    it('ピッカーから絵文字を選択すると insertText が呼ばれる', async () => {
      mockQuill.getSelection.mockReturnValue({ index: 0, length: 0 });

      render(<RichEditor users={dummyUsers} onSend={vi.fn()} />);
      await userEvent.click(screen.getByRole('button', { name: '絵文字を挿入' }));
      await userEvent.click(screen.getByText('😀'));

      expect(mockQuill.insertText).toHaveBeenCalledWith(0, '😀', 'user');
    });

    it('ピッカー外をクリックするとピッカーが閉じる', async () => {
      render(<RichEditor users={dummyUsers} onSend={vi.fn()} />);
      await userEvent.click(screen.getByRole('button', { name: '絵文字を挿入' }));
      expect(screen.getByText('😀')).toBeInTheDocument();

      // ClickAwayListener のトリガー: ピッカー外（document.body）をクリック
      await userEvent.click(document.body);

      expect(screen.queryByText('😀')).not.toBeInTheDocument();
    });
  });
});
