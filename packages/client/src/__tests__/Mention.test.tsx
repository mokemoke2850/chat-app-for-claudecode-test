/**
 * メンション機能の表示・ラウンドトリップに関するユニットテスト（#250）
 *
 * テスト対象:
 *   - components/Chat/MentionBlot.ts          — Quill embed の生成
 *   - components/Chat/RichEditor.tsx          — メンション挿入時の delta 構築
 *   - utils/renderMessageContent.tsx          — 保存された delta から DOM への描画
 *
 * 戦略:
 *   - メンション挿入から送信までのラウンドトリップ（エディタで挿入→保存→表示）で
 *     チップ直後に余分な「@」が出ないことを保証する
 *   - 画面表示の余分な「@」除去ロジックの単体検証は renderMessageContent.test.tsx 側で網羅する
 *   - ここでは「複数ファイルにまたがる結合動作」のみを扱う
 *
 * 関連 Issue: #250 メンションチップ後に余分な「@」文字が残る
 */

import { render, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { User } from '@chat-app/shared';
import RichEditor from '../components/Chat/RichEditor';
import { renderMessageContent } from '../utils/renderMessageContent';

// ─── Quill モックの共有ステート ────────────────────────────────────────────────────
const { mockQuill, eventHandlers, fireQuillEvent, capturedModules } = vi.hoisted(() => {
  type EventHandler = (...args: unknown[]) => unknown;
  const eventHandlers: Record<string, EventHandler[]> = {};
  const capturedModules = { value: null as Record<string, unknown> | null };

  // 仮想的な Quill ドキュメントを保持: ops / text を簡易シミュレーションする
  // insertEmbed / insertText / deleteText の挙動を簡素化して呼び出しの確認に用いる
  const state = {
    ops: [] as Array<{ insert: string | { mention: { id: number; value: string } } }>,
  };

  const computeText = (): string => {
    // mention embed は @username で文字列化（実 Quill と同じ振る舞いを近似）
    return state.ops
      .map((op) => {
        if (typeof op.insert === 'string') return op.insert;
        if ('mention' in op.insert) return `@${op.insert.mention.value}`;
        return '';
      })
      .join('');
  };

  const mockQuill = {
    on: vi.fn((event: string, handler: EventHandler) => {
      eventHandlers[event] = [...(eventHandlers[event] ?? []), handler];
    }),
    off: vi.fn((event: string, handler: EventHandler) => {
      eventHandlers[event] = (eventHandlers[event] ?? []).filter((h) => h !== handler);
    }),
    getSelection: vi.fn(() => null as { index: number; length: number } | null),
    getText: vi.fn((start = 0, len?: number) => {
      const text = computeText();
      return len !== undefined ? text.slice(start, start + len) : text;
    }),
    getContents: vi.fn(() => ({ ops: state.ops })),
    deleteText: vi.fn((index: number, length: number) => {
      // 簡易実装: 文字列 op に対してのみ削除する（テスト範囲では十分）
      let pos = 0;
      for (let i = 0; i < state.ops.length; i++) {
        const op = state.ops[i];
        if (typeof op.insert === 'string') {
          const opLen = op.insert.length;
          if (pos + opLen > index) {
            const localStart = Math.max(0, index - pos);
            const localEnd = Math.min(opLen, index + length - pos);
            const newText = op.insert.slice(0, localStart) + op.insert.slice(localEnd);
            if (newText === '') {
              state.ops.splice(i, 1);
              i--;
            } else {
              state.ops[i] = { insert: newText };
            }
            length -= localEnd - localStart;
            if (length <= 0) break;
          }
          pos += opLen;
        } else {
          pos += 1; // embed は 1 文字扱い
        }
      }
    }),
    insertEmbed: vi.fn((_index: number, _type: string, data: { id: number; value: string }) => {
      // 単純化: 末尾もしくは特定位置に embed op を追加
      // 本テスト用途では「@query を delete した後、その位置に embed insert」される想定
      // ops に直接 push する近似実装
      state.ops.push({ insert: { mention: { id: data.id, value: data.value } } });
    }),
    insertText: vi.fn((_index: number, text: string) => {
      // 末尾に追加する近似実装
      state.ops.push({ insert: text });
    }),
    setSelection: vi.fn(),
    setText: vi.fn(() => {
      state.ops = [];
    }),
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
    __state: state,
  };

  const fireQuillEvent = (event: string, ...args: unknown[]) => {
    (eventHandlers[event] ?? []).forEach((h) => h(...args));
  };

  return { mockQuill, eventHandlers, fireQuillEvent, capturedModules };
});

vi.mock('react-quill-new', async () => {
  const React = (await import('react')) as typeof import('react');
  const MockReactQuill = React.forwardRef(
    (props: Record<string, unknown>, ref: React.Ref<unknown>) => {
      capturedModules.value = props.modules as Record<string, unknown>;
      React.useImperativeHandle(ref, () => ({ getEditor: () => mockQuill }), []);
      return React.createElement('div', {
        'data-testid': 'quill-editor',
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
    default: () => React.createElement('div'),
  };
});
vi.mock('../components/Chat/TemplatePicker', async () => {
  const React = (await import('react')) as typeof import('react');
  return {
    default: () => React.createElement('div'),
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
    onboardingCompletedAt: null,
  },
];

beforeEach(() => {
  vi.clearAllMocks();
  Object.keys(eventHandlers).forEach((k) => delete eventHandlers[k]);
  capturedModules.value = null;
  mockQuill.__state.ops = [];
  mockQuill.on.mockImplementation((event: string, handler: (...args: unknown[]) => unknown) => {
    eventHandlers[event] = [...(eventHandlers[event] ?? []), handler];
  });
  mockQuill.off.mockImplementation((event: string, handler: (...args: unknown[]) => unknown) => {
    eventHandlers[event] = (eventHandlers[event] ?? []).filter((h) => h !== handler);
  });
});

/**
 * 「@<query>」が入力された状態を作り、selection-change を発火して mentionState を更新する
 */
const triggerMentionDetect = (atIndex: number, query: string) => {
  const text = `@${query}`;
  // ops を直接組み立てて getText / getSelection を整合させる
  mockQuill.__state.ops = text.length > 0 ? [{ insert: text }] : [];
  mockQuill.getSelection.mockReturnValue({ index: atIndex + 1 + query.length, length: 0 });
  act(() => {
    fireQuillEvent('selection-change', { index: atIndex + 1 + query.length, length: 0 });
  });
};

const findInsertMention = () => {
  // capturedModules から sendOnEnter 等にアクセスできるが、insertMention は MentionDropdown 経由で呼ばれる
  // ここでは MentionDropdown の onSelect を直接トリガーするため、Enter 時の挙動を再現する
  const modules = capturedModules.value as {
    keyboard: {
      bindings: { sendOnEnter: { handler: () => boolean } };
    };
  } | null;
  return modules?.keyboard.bindings.sendOnEnter.handler;
};

describe('メンション機能のラウンドトリップ（#250）', () => {
  describe('エディタでメンションを挿入してから送信した場合', () => {
    it('onSend に渡される delta は mention embed の直後に半角スペース 1 文字のみ含む（@ は含まない）', () => {
      const onSend = vi.fn();
      render(<RichEditor users={dummyUsers} onSend={onSend} />);

      // ユーザーが @al を入力 → mention 候補を選択する操作の代替として、
      // 候補表示後に Enter を押す = sendOnEnter handler が走り、insertMention が呼ばれる
      triggerMentionDetect(0, 'al');
      const sendOnEnter = findInsertMention();
      // Enter で alice が確定（insertMention 経由）
      act(() => {
        sendOnEnter?.();
      });

      // insertEmbed が「mention」型で呼ばれていること
      expect(mockQuill.insertEmbed).toHaveBeenCalledWith(
        0,
        'mention',
        { id: 1, value: 'alice' },
        'user',
      );
      // insertText が半角スペース 1 文字のみで呼ばれていること（「 」は @ を含まない）
      expect(mockQuill.insertText).toHaveBeenCalledWith(1, ' ', 'user');
      // 「@」を続けて入れる呼び出しは存在しない
      const insertTextCalls = mockQuill.insertText.mock.calls;
      const containsAtInsert = insertTextCalls.some(
        (call) => typeof call[1] === 'string' && (call[1] as string).includes('@'),
      );
      expect(containsAtInsert).toBe(false);
    });

    it('onSend に渡される delta を表示しても「@username」チップ直後に余分な「@」が出ない', () => {
      // Quill が getContents で返す ops を直接構築して renderMessageContent に流す
      // 上記の挿入経路で得られる典型的な delta を再現する
      const delta = JSON.stringify({
        ops: [{ insert: { mention: { id: 1, value: 'alice' } } }, { insert: ' \n' }],
      });
      const { container } = render(<div>{renderMessageContent(delta)}</div>);
      expect(container.textContent).toContain('@alice');
      expect(container.textContent).not.toMatch(/@alice\s+@/);
    });
  });

  describe('連続でメンションを挿入した場合', () => {
    it('@user1 と @user2 を続けて挿入したとき、各チップ直後に余分な「@」が出ない', () => {
      // レガシーデータで余分な @ が混入したパターン: チップ間とチップ後ろにも「 @ 」が残っている
      const delta = JSON.stringify({
        ops: [
          { insert: { mention: { id: 1, value: 'alice' } } },
          { insert: ' @ ' },
          { insert: { mention: { id: 2, value: 'bob' } } },
          { insert: ' @ hello\n' },
        ],
      });
      const { container } = render(<div>{renderMessageContent(delta)}</div>);
      // 期待: チップ直後の余分な @ がいずれも吸収され、最終的に「@alice @bob hello」になる
      expect(container.textContent).toBe('@alice @bob hello');
      expect(container.textContent).toContain('@alice');
      expect(container.textContent).toContain('@bob');
      expect(container.textContent).toContain('hello');
    });
  });

  describe('レガシーデータ（既存 DB に保存済みの delta）の表示', () => {
    it('mention embed の直後に「 @ 」テキストが含まれている既存 delta を表示しても余分な @ が出ない', () => {
      const delta = JSON.stringify({
        ops: [
          { insert: { mention: { id: 1, value: 'e2e_alice' } } },
          { insert: ' @ hello mention test\n' },
        ],
      });
      const { container } = render(<div>{renderMessageContent(delta)}</div>);
      expect(container.textContent).not.toMatch(/@e2e_alice\s+@/);
      expect(container.textContent).toContain('@e2e_alice');
      expect(container.textContent).toContain('hello mention test');
    });

    it('mention embed の直後に「@」のみが含まれている既存 delta を表示しても余分な @ が出ない', () => {
      const delta = JSON.stringify({
        ops: [{ insert: { mention: { id: 1, value: 'alice' } } }, { insert: '@ hello\n' }],
      });
      const { container } = render(<div>{renderMessageContent(delta)}</div>);
      expect(container.textContent).not.toMatch(/@alice\s*@/);
      expect(container.textContent).toContain('@alice');
      expect(container.textContent).toContain('hello');
    });
  });
});
