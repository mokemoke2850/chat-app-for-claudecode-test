/**
 * テスト対象: 下書き保存機能 (#148)
 *   - RichEditor.tsx: デバウンス保存・チャンネル切替後の本文復元
 *   - ChannelItem.tsx: 下書き存在時の識別表示
 * 戦略:
 *   - RichEditor のテストは既存の Quill モックパターンを踏襲する
 *   - api/client はモックで差し替えて API 呼び出しを検証する
 *   - ChannelItem の下書き表示はプロップ経由で制御して検証する
 *   - 複数テストファイルで重複する concerns を避けるため、
 *     RichEditor.test.tsx / ChannelItem.test.tsx には追記せずここで統合的に検証する
 */

import { render, screen, act, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Channel } from '@chat-app/shared';

// ─── api/client のモック ─────────────────────────────────────────────────────
vi.mock('../api/client', () => ({
  default: {
    drafts: {
      getAll: vi.fn().mockResolvedValue([]),
      upsertChannel: vi.fn().mockResolvedValue({}),
      upsertDm: vi.fn().mockResolvedValue({}),
      deleteChannel: vi.fn().mockResolvedValue({}),
      deleteDm: vi.fn().mockResolvedValue({}),
    },
  },
}));

// ─── Quill モックの共有ステート ────────────────────────────────────────────────
const { mockQuill, eventHandlers, fireQuillEvent } = vi.hoisted(() => {
  type EventHandler = (...args: unknown[]) => unknown;
  const eventHandlers: Record<string, EventHandler[]> = {};

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

  return { mockQuill, eventHandlers, fireQuillEvent };
});

vi.mock('react-quill-new', async () => {
  const React = (await import('react')) as typeof import('react');
  const MockReactQuill = React.forwardRef(
    (props: Record<string, unknown>, ref: React.Ref<unknown>) => {
      React.useImperativeHandle(ref, () => ({ getEditor: () => mockQuill }), []);
      return React.createElement('div', {
        'data-testid': 'quill-editor',
        'data-placeholder': props.placeholder as string | undefined,
      });
    },
  );
  MockReactQuill.displayName = 'MockReactQuill';
  return { default: MockReactQuill };
});

vi.mock('react-quill-new/dist/quill.snow.css', () => ({}));
vi.mock('../components/Chat/MentionBlot', () => ({}));
vi.mock('../components/Chat/TemplatePicker', async () => {
  const React = (await import('react')) as typeof import('react');
  return { default: () => React.createElement('div') };
});

// ─── テスト対象コンポーネントのインポート ────────────────────────────────────
import RichEditor from '../components/Chat/RichEditor';
import ChannelItem from '../components/Channel/ChannelItem';

const makeChannel = (overrides: Partial<Channel> = {}): Channel => ({
  id: 1,
  name: 'general',
  description: null,
  topic: null,
  createdBy: 1,
  createdAt: '2024-01-01T00:00:00Z',
  isPrivate: false,
  postingPermission: 'everyone',
  unreadCount: 0,
  ...overrides,
});

const defaultChannelItemProps = {
  isActive: false,
  isPinned: false,
  isHovered: false,
  onMouseEnter: vi.fn(),
  onMouseLeave: vi.fn(),
  onClick: vi.fn(),
  onPin: vi.fn(),
  onUnpin: vi.fn(),
  onOpenMembersDialog: vi.fn(),
};

beforeEach(() => {
  vi.clearAllMocks();
  Object.keys(eventHandlers).forEach((k) => delete eventHandlers[k]);
  mockQuill.on.mockImplementation((event: string, handler: (...args: unknown[]) => unknown) => {
    eventHandlers[event] = [...(eventHandlers[event] ?? []), handler];
  });
  mockQuill.off.mockImplementation((event: string, handler: (...args: unknown[]) => unknown) => {
    eventHandlers[event] = (eventHandlers[event] ?? []).filter((h) => h !== handler);
  });
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

// ─────────────────────────────────────────────────────────
// RichEditor: デバウンス保存
// ─────────────────────────────────────────────────────────

describe('RichEditor: 下書きデバウンス保存', () => {
  describe('チャンネル下書きの自動保存', () => {
    it('テキスト入力後 1〜2 秒経過すると draft API が呼ばれる', async () => {
      // TODO
    });

    it('デバウンス待機中に複数回入力しても API 呼び出しは 1 回だけになる', async () => {
      // TODO
    });

    it('channelId が渡されていないと draft API は呼ばれない', async () => {
      // TODO
    });
  });

  describe('空文字列による下書き削除', () => {
    it('入力をすべて消してデバウンス後に削除 API が呼ばれる', async () => {
      // TODO
    });
  });

  describe('送信後の下書きクリア', () => {
    it('onSend が呼ばれると下書き削除 API が呼ばれる', async () => {
      // TODO
    });
  });
});

// ─────────────────────────────────────────────────────────
// RichEditor: 初期値・チャンネル切替後の復元
// ─────────────────────────────────────────────────────────

describe('RichEditor: 下書き復元', () => {
  it('initialContent が渡されるとエディタに初期値がセットされる', async () => {
    // TODO
  });

  it('channelId が変わると initialContent がリセットされる（前のチャンネルの下書きが残らない）', async () => {
    // TODO
  });
});

// ─────────────────────────────────────────────────────────
// ChannelItem: 下書き存在時の識別表示
// ─────────────────────────────────────────────────────────

describe('ChannelItem: 下書き識別表示', () => {
  it('hasDraft=true のとき下書きインジケーターが表示される', async () => {
    // TODO
  });

  it('hasDraft=false（未指定）のとき下書きインジケーターは表示されない', async () => {
    // TODO
  });

  it('下書きインジケーターは未読バッジと共存できる', async () => {
    // TODO
  });
});
