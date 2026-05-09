/**
 * テスト対象: packages/client/src/components/Chat/RichEditor.tsx のプレビュー切替機能
 * 戦略:
 *   - react-quill-new は jsdom で動作しないため forwardRef スタブに差し替える
 *   - Quill インスタンスの on/off/getText/getContents を vi.fn() で制御する
 *   - プレビューモード切替ボタンのクリックでエディタ/プレビューの表示切替を検証する
 *   - renderMessageContent を流用したプレビュー描画結果を DOM で確認する
 *   - delta 形式（JSON.stringify）の入力を前提としてプレビュー内容を検証する
 */

import { render, screen, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { User } from '@chat-app/shared';
import RichEditor from '../components/Chat/RichEditor';

// ─── Quill モックの共有ステート ───────────────────────────────────────────────
const { mockQuill } = vi.hoisted(() => {
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

  return { mockQuill };
});

vi.mock('react-quill-new', async () => {
  const React = (await import('react')) as typeof import('react');
  const MockReactQuill = React.forwardRef(
    (props: Record<string, unknown>, ref: React.Ref<unknown>) => {
      React.useImperativeHandle(ref, () => ({ getEditor: () => mockQuill }), []);
      return React.createElement('div', {
        'data-testid': 'quill-editor',
        'data-placeholder': props.placeholder as string | undefined,
        'data-readonly': String(props.readOnly ?? false),
      });
    },
  );
  MockReactQuill.displayName = 'MockReactQuill';
  return { default: MockReactQuill };
});

vi.mock('react-quill-new/dist/quill.snow.css', () => ({}));
vi.mock('../components/Chat/MentionBlot', () => ({}));

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

function renderEditor(overrides: Partial<Parameters<typeof RichEditor>[0]> = {}) {
  const onSend = vi.fn();
  render(<RichEditor users={dummyUsers} onSend={onSend} {...overrides} />);
  return { onSend };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockQuill.on.mockImplementation(() => {});
  mockQuill.off.mockImplementation(() => {});
  mockQuill.getText.mockReturnValue('hello');
  mockQuill.getContents.mockReturnValue({ ops: [{ insert: 'hello\n' }] });
});

describe('RichEditor プレビュー切替機能 (#263)', () => {
  describe('プレビュートグルボタンの存在', () => {
    it('ツールバーに「プレビュー」トグルボタンが表示される', () => {
      renderEditor();
      expect(screen.getByRole('button', { name: /プレビュー/i })).toBeInTheDocument();
    });

    it('ボタンにアクセシブルなラベル（aria-label）が設定されている', () => {
      renderEditor();
      const btn = screen.getByRole('button', { name: /プレビュー/i });
      expect(btn).toHaveAttribute('aria-label');
    });
  });

  describe('編集モード → プレビューモードの切替', () => {
    it('プレビューボタンをクリックするとエディタが非表示になる', async () => {
      const user = userEvent.setup();
      renderEditor();
      const editor = screen.getByTestId('quill-editor');
      expect(editor).toBeVisible();

      await act(async () => {
        await user.click(screen.getByRole('button', { name: /プレビュー/i }));
      });

      expect(screen.queryByTestId('quill-editor')).not.toBeVisible();
    });

    it('プレビューボタンをクリックするとプレビューエリアが表示される', async () => {
      const user = userEvent.setup();
      renderEditor();

      await act(async () => {
        await user.click(screen.getByRole('button', { name: /プレビュー/i }));
      });

      expect(screen.getByTestId('message-preview-area')).toBeVisible();
    });

    it('プレビューエリアにエディタの内容がレンダリングされる', async () => {
      const user = userEvent.setup();
      mockQuill.getContents.mockReturnValue({ ops: [{ insert: 'hello\n' }] });
      renderEditor();

      await act(async () => {
        await user.click(screen.getByRole('button', { name: /プレビュー/i }));
      });

      const previewArea = screen.getByTestId('message-preview-area');
      expect(previewArea.textContent).toContain('hello');
    });

    it('プレビューモード中はボタンのラベルが「編集」または「プレビュー中」に変わる', async () => {
      const user = userEvent.setup();
      renderEditor();

      await act(async () => {
        await user.click(screen.getByRole('button', { name: /プレビュー/i }));
      });

      // プレビューモード中は aria-label が変化する
      const btn = screen.getByRole('button', { name: /編集|プレビュー中/i });
      expect(btn).toBeInTheDocument();
    });
  });

  describe('プレビューモード → 編集モードの切替', () => {
    it('プレビューモード中にトグルを再クリックするとエディタが再表示される', async () => {
      const user = userEvent.setup();
      renderEditor();

      await act(async () => {
        await user.click(screen.getByRole('button', { name: /プレビュー/i }));
      });
      await act(async () => {
        await user.click(screen.getByRole('button', { name: /編集|プレビュー中/i }));
      });

      expect(screen.getByTestId('quill-editor')).toBeVisible();
    });

    it('プレビューモードを解除するとプレビューエリアが非表示になる', async () => {
      const user = userEvent.setup();
      renderEditor();

      await act(async () => {
        await user.click(screen.getByRole('button', { name: /プレビュー/i }));
      });
      await act(async () => {
        await user.click(screen.getByRole('button', { name: /編集|プレビュー中/i }));
      });

      expect(screen.queryByTestId('message-preview-area')).not.toBeVisible();
    });

    it('編集に戻った後もエディタの内容は保持されている', async () => {
      const user = userEvent.setup();
      mockQuill.getContents.mockReturnValue({ ops: [{ insert: 'hello\n' }] });
      renderEditor();

      // プレビューへ
      await act(async () => {
        await user.click(screen.getByRole('button', { name: /プレビュー/i }));
      });
      // 編集に戻る
      await act(async () => {
        await user.click(screen.getByRole('button', { name: /編集|プレビュー中/i }));
      });

      // エディタが再表示され、setText が呼ばれていないこと（内容をクリアしていない）
      expect(mockQuill.setText).not.toHaveBeenCalled();
      expect(screen.getByTestId('quill-editor')).toBeVisible();
    });
  });

  describe('プレビュー中の送信ボタン', () => {
    it('プレビューモード中も送信ボタンが有効（クリック可能）である', async () => {
      const user = userEvent.setup();
      renderEditor();

      await act(async () => {
        await user.click(screen.getByRole('button', { name: /プレビュー/i }));
      });

      const sendBtn = screen.getByRole('button', { name: /送信/i });
      expect(sendBtn).not.toBeDisabled();
    });

    it('プレビューモード中に送信すると onSend が呼ばれる', async () => {
      const user = userEvent.setup();
      mockQuill.getText.mockReturnValue('hello');
      mockQuill.getContents.mockReturnValue({ ops: [{ insert: 'hello\n' }] });
      const { onSend } = renderEditor();

      await act(async () => {
        await user.click(screen.getByRole('button', { name: /プレビュー/i }));
      });
      await act(async () => {
        await user.click(screen.getByRole('button', { name: /送信/i }));
      });

      expect(onSend).toHaveBeenCalledTimes(1);
    });
  });

  describe('renderMessageContent によるプレビュー描画', () => {
    it('delta 形式の内容がプレビューエリアに正しくレンダリングされる', async () => {
      const user = userEvent.setup();
      mockQuill.getContents.mockReturnValue({ ops: [{ insert: 'テストメッセージ\n' }] });
      renderEditor();

      await act(async () => {
        await user.click(screen.getByRole('button', { name: /プレビュー/i }));
      });

      const previewArea = screen.getByTestId('message-preview-area');
      expect(previewArea.textContent).toContain('テストメッセージ');
    });

    it('太字・イタリックなどのインライン書式がプレビューに反映される', async () => {
      const user = userEvent.setup();
      mockQuill.getContents.mockReturnValue({
        ops: [
          { insert: 'bold text', attributes: { bold: true } } as { insert: string },
          { insert: '\n' },
        ],
      });
      renderEditor();

      await act(async () => {
        await user.click(screen.getByRole('button', { name: /プレビュー/i }));
      });

      const previewArea = screen.getByTestId('message-preview-area');
      // 太字タグが存在することを確認
      const strong = previewArea.querySelector('strong');
      expect(strong).toBeInTheDocument();
      expect(strong?.textContent).toBe('bold text');
    });

    it('エディタが空の状態でプレビューに切り替えてもエラーが発生しない', async () => {
      const user = userEvent.setup();
      mockQuill.getText.mockReturnValue('');
      mockQuill.getContents.mockReturnValue({ ops: [] });
      renderEditor();

      // エラーが投げられないことを確認
      await expect(
        act(async () => {
          await user.click(screen.getByRole('button', { name: /プレビュー/i }));
        }),
      ).resolves.not.toThrow();

      expect(screen.getByTestId('message-preview-area')).toBeInTheDocument();
    });
  });
});
