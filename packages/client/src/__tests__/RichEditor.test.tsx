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

// react-quill-new スタブ: forwardRef で getEditor() を公開し modules / placeholder / readOnly を捕捉する
vi.mock('react-quill-new', async () => {
  const React = (await import('react')) as typeof import('react');
  const MockReactQuill = React.forwardRef(
    (props: Record<string, unknown>, ref: React.Ref<unknown>) => {
      capturedModules.value = props.modules as Record<string, unknown>;
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

// ScheduleSendButton は内部で api.scheduledMessages.create を呼ぶためスタブに差し替える
vi.mock('../components/Chat/ScheduleSendButton', async () => {
  const React = (await import('react')) as typeof import('react');
  return {
    default: ({ channelId, onScheduled }: { channelId: number; onScheduled?: () => void }) =>
      React.createElement(
        'button',
        {
          'data-testid': 'schedule-send-stub',
          'data-channel-id': String(channelId),
          onClick: () => onScheduled?.(),
        },
        'スケジュール（スタブ）',
      ),
  };
});

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
    onboardingCompletedAt: null,
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

  // #110 予約送信
  describe('予約送信ボタン統合', () => {
    it('送信ボタン横に ScheduleSendButton が表示される', () => {
      render(<RichEditor users={dummyUsers} onSend={vi.fn()} channelId={5} onSchedule={vi.fn()} />);
      const stub = screen.getByTestId('schedule-send-stub');
      expect(stub).toBeInTheDocument();
      expect(stub).toHaveAttribute('data-channel-id', '5');
    });

    // 仕様の精緻化（#191）: 旧「onSchedule(datetime, content)」は実装が引数なしで呼ぶため
    // 「onSchedule が引数なしで呼ばれ、onSend は呼ばれない」に変更
    it('ScheduleSendButton から予約を確定すると onSchedule が呼ばれ（引数なし）、onSend は呼ばれない', async () => {
      const onSend = vi.fn();
      const onSchedule = vi.fn();
      render(
        <RichEditor users={dummyUsers} onSend={onSend} channelId={5} onSchedule={onSchedule} />,
      );
      await userEvent.click(screen.getByTestId('schedule-send-stub'));
      expect(onSchedule).toHaveBeenCalledWith();
      expect(onSend).not.toHaveBeenCalled();
    });

    it('予約確定後にエディタの内容がクリアされる（onSchedule 後のクリア処理）', async () => {
      render(<RichEditor users={dummyUsers} onSend={vi.fn()} channelId={5} onSchedule={vi.fn()} />);
      await userEvent.click(screen.getByTestId('schedule-send-stub'));
      expect(mockQuill.setText).toHaveBeenCalledWith('');
    });

    // 仕様の精緻化（#191）: 旧「onSchedule が未指定のとき非表示」は実装が channelId で制御するため
    // 「channelId 未指定のとき予約ボタンが非表示」に変更
    it('channelId が未指定のときは予約ボタン自体が非表示', () => {
      render(<RichEditor users={dummyUsers} onSend={vi.fn()} onSchedule={vi.fn()} />);
      expect(screen.queryByTestId('schedule-send-stub')).toBeNull();
    });
  });

  // #108 イベント作成スラッシュコマンド
  describe('イベント作成コマンド（/event）(#108)', () => {
    it('/event と入力すると onSlashEvent が呼ばれる', () => {
      const onSlashEvent = vi.fn();
      setupCursor('/event');

      render(<RichEditor users={dummyUsers} onSend={vi.fn()} onSlashEvent={onSlashEvent} />);

      act(() => {
        fireQuillEvent('selection-change', { index: 6, length: 0 });
      });

      expect(onSlashEvent).toHaveBeenCalledTimes(1);
    });

    it('/event 検知後にエディタの /event テキストが削除される', () => {
      setupCursor('/event');

      render(<RichEditor users={dummyUsers} onSend={vi.fn()} onSlashEvent={vi.fn()} />);

      act(() => {
        fireQuillEvent('selection-change', { index: 6, length: 0 });
      });

      // deleteText が /event の開始位置（0）から 6 文字分呼ばれる
      expect(mockQuill.deleteText).toHaveBeenCalledWith(0, 6, 'user');
    });

    it('/event 以外のスラッシュコマンド（例: /foo）では onSlashEvent が呼ばれない', () => {
      const onSlashEvent = vi.fn();
      setupCursor('/foo');

      render(<RichEditor users={dummyUsers} onSend={vi.fn()} onSlashEvent={onSlashEvent} />);

      act(() => {
        fireQuillEvent('selection-change', { index: 4, length: 0 });
      });

      expect(onSlashEvent).not.toHaveBeenCalled();
    });

    it('onSlashEvent が未指定でも /event 入力時にエラーが発生しない', () => {
      setupCursor('/event');

      render(<RichEditor users={dummyUsers} onSend={vi.fn()} />);

      expect(() => {
        act(() => {
          fireQuillEvent('selection-change', { index: 6, length: 0 });
        });
      }).not.toThrow();
    });

    it('disabled=false のプレースホルダーに /event の説明が含まれる', () => {
      render(<RichEditor users={dummyUsers} onSend={vi.fn()} />);

      const editor = screen.getByTestId('quill-editor');
      expect(editor.getAttribute('data-placeholder')).toMatch(/\/event/);
    });
  });

  // #113 投稿権限制御チャンネル — disabled 状態のメッセージ表示
  describe('投稿権限による無効化 (#113)', () => {
    it('disabled=true のとき、入力欄のプレースホルダが「このチャンネルには投稿できません」になる', () => {
      render(<RichEditor users={dummyUsers} onSend={vi.fn()} disabled={true} />);

      const editor = screen.getByTestId('quill-editor');
      expect(editor.getAttribute('data-placeholder')).toBe('このチャンネルには投稿できません');
      expect(editor.getAttribute('data-readonly')).toBe('true');
    });

    it('disabled=true のとき、Enter キー押下で onSend が呼ばれない', () => {
      const onSend = vi.fn();
      setupCursor('hello');
      render(<RichEditor users={dummyUsers} onSend={onSend} disabled={true} />);

      // sendOnEnter ハンドラを直接呼び出す
      const modules = capturedModules.value as {
        keyboard: { bindings: { sendOnEnter: { handler: () => boolean } } };
      } | null;
      modules?.keyboard.bindings.sendOnEnter.handler();

      expect(onSend).not.toHaveBeenCalled();
    });

    it('disabled=false（未指定）のときはプレースホルダが通常文言で readOnly=false', () => {
      render(<RichEditor users={dummyUsers} onSend={vi.fn()} />);

      const editor = screen.getByTestId('quill-editor');
      expect(editor.getAttribute('data-placeholder')).toMatch(/メッセージを入力/);
      expect(editor.getAttribute('data-readonly')).toBe('false');
    });
  });

  // #322 送信ボタンの明示化
  describe('送信ボタン (#322)', () => {
    it('送信ボタンが「送信」ラベルと共に表示される', () => {
      render(<RichEditor users={dummyUsers} onSend={vi.fn()} />);
      expect(screen.getByRole('button', { name: '送信' })).toBeInTheDocument();
    });

    it('入力が空のとき送信ボタンが無効化される', () => {
      mockQuill.getText.mockReturnValue('');
      render(<RichEditor users={dummyUsers} onSend={vi.fn()} />);
      expect(screen.getByRole('button', { name: '送信' })).toBeDisabled();
    });

    it('入力に内容があるとき送信ボタンが有効化される', () => {
      render(<RichEditor users={dummyUsers} onSend={vi.fn()} />);
      // テキスト変更を発火して currentContent を更新する
      mockQuill.getText.mockReturnValue('こんにちは');
      act(() => {
        fireQuillEvent('text-change');
      });
      expect(screen.getByRole('button', { name: '送信' })).not.toBeDisabled();
    });

    it('送信ボタンをクリックすると onSend が呼ばれる', async () => {
      const onSend = vi.fn();
      mockQuill.getText.mockReturnValue('こんにちは');
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      mockQuill.getContents.mockReturnValue({ ops: [{ insert: 'こんにちは\n' }] } as any);
      render(<RichEditor users={dummyUsers} onSend={onSend} />);
      // テキスト変更を発火して currentContent を更新する
      act(() => {
        fireQuillEvent('text-change');
      });
      await userEvent.click(screen.getByRole('button', { name: '送信' }));
      expect(onSend).toHaveBeenCalled();
    });

    it('入力が空の状態で送信ボタンをクリックしても onSend が呼ばれない', async () => {
      const onSend = vi.fn();
      mockQuill.getText.mockReturnValue('');
      render(<RichEditor users={dummyUsers} onSend={onSend} />);
      const sendButton = screen.getByRole('button', { name: '送信' });
      // disabled 状態なのでクリックしても呼ばれない
      expect(sendButton).toBeDisabled();
      // disabled ボタンは pointer-events: none のため skipPointerEventsCheck で強制クリック
      await userEvent.click(sendButton, { pointerEventsCheck: 0 });
      expect(onSend).not.toHaveBeenCalled();
    });
  });

  // #323 ツールバーのグループ見出し／ツールチップ強化
  describe('ツールバー ツールチップ・グループ化 (#323)', () => {
    // カスタムツールバーでは各ボタンに aria-label を付与する。
    // MUI Tooltip の title はホバー時にのみ DOM に現れるため、
    // aria-label でボタンの存在とラベルを検証する。
    describe('ツールチップの存在（aria-label で確認）', () => {
      it('太字ボタンにツールチップ「太字 (Cmd+B)」が設定されている', () => {
        render(<RichEditor users={dummyUsers} onSend={vi.fn()} />);
        expect(screen.getByRole('button', { name: '太字 (Cmd+B)' })).toBeInTheDocument();
      });

      it('斜体ボタンにツールチップ「斜体 (Cmd+I)」が設定されている', () => {
        render(<RichEditor users={dummyUsers} onSend={vi.fn()} />);
        expect(screen.getByRole('button', { name: '斜体 (Cmd+I)' })).toBeInTheDocument();
      });

      it('下線ボタンにツールチップ「下線 (Cmd+U)」が設定されている', () => {
        render(<RichEditor users={dummyUsers} onSend={vi.fn()} />);
        expect(screen.getByRole('button', { name: '下線 (Cmd+U)' })).toBeInTheDocument();
      });

      it('取り消し線ボタンにツールチップ「取り消し線」が設定されている', () => {
        render(<RichEditor users={dummyUsers} onSend={vi.fn()} />);
        expect(screen.getByRole('button', { name: '取り消し線' })).toBeInTheDocument();
      });

      it('コードブロックボタンにツールチップ「コードブロック」が設定されている', () => {
        render(<RichEditor users={dummyUsers} onSend={vi.fn()} />);
        expect(screen.getByRole('button', { name: 'コードブロック' })).toBeInTheDocument();
      });

      it('番号付きリストボタンにツールチップ「番号付きリスト」が設定されている', () => {
        render(<RichEditor users={dummyUsers} onSend={vi.fn()} />);
        expect(screen.getByRole('button', { name: '番号付きリスト' })).toBeInTheDocument();
      });

      it('箇条書きリストボタンにツールチップ「箇条書きリスト」が設定されている', () => {
        render(<RichEditor users={dummyUsers} onSend={vi.fn()} />);
        expect(screen.getByRole('button', { name: '箇条書きリスト' })).toBeInTheDocument();
      });

      it('画像挿入ボタンにツールチップ「画像を挿入」が設定されている', () => {
        render(<RichEditor users={dummyUsers} onSend={vi.fn()} />);
        expect(screen.getByRole('button', { name: '画像を挿入' })).toBeInTheDocument();
      });

      it('整形解除ボタンにツールチップ「整形を解除」が設定されている', () => {
        render(<RichEditor users={dummyUsers} onSend={vi.fn()} />);
        expect(screen.getByRole('button', { name: '整形を解除' })).toBeInTheDocument();
      });
    });

    describe('グループ区切り', () => {
      it('書式グループ（太字・斜体・下線・取り消し線）と挿入グループの間にセパレータが存在する', () => {
        render(<RichEditor users={dummyUsers} onSend={vi.fn()} />);
        // data-testid="toolbar-separator" が複数存在する
        const separators = screen.getAllByTestId('toolbar-separator');
        expect(separators.length).toBeGreaterThanOrEqual(2);
      });

      it('挿入グループ（コードブロック・リスト・画像）と整形解除グループの間にセパレータが存在する', () => {
        render(<RichEditor users={dummyUsers} onSend={vi.fn()} />);
        // 書式 | 挿入 | 整形解除 の3グループ間に最低2つのセパレータがある
        const separators = screen.getAllByTestId('toolbar-separator');
        expect(separators.length).toBeGreaterThanOrEqual(2);
      });
    });
  });
});
