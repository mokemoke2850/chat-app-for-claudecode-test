/**
 * components/Chat/MessageActions.tsx のユニットテスト
 *
 * テスト対象: メッセージに対するアクションボタン群
 * テスト戦略:
 *   - リファクタ後の構成（直置きアイコン4個 + 3点メニュー）を検証する
 *   - 3点メニューは「その他のアクション」ボタンをクリックして開く
 *   - ブックマーク・ピン留めは状態によりラベル/アイコンが変わる
 *   - 編集・削除は自分のメッセージのみ、通報は他人のメッセージのみ表示される
 */

import { describe, it, vi, beforeEach } from 'vitest';

// Socket モック
const mockSocket = { emit: vi.fn(), on: vi.fn(), off: vi.fn() };
vi.mock('../contexts/SocketContext', () => ({
  useSocket: () => mockSocket,
}));

// EmojiPicker モック
vi.mock('../components/Chat/EmojiPicker', () => ({
  default: ({
    anchorEl,
    onSelect,
  }: {
    anchorEl: HTMLElement | null;
    onSelect: (e: string) => void;
  }) =>
    anchorEl ? (
      <div data-testid="emoji-picker">
        <button onClick={() => onSelect('😀')}>emoji</button>
      </div>
    ) : null,
}));

// ReminderDialog モック
vi.mock('../components/Reminder/ReminderDialog', () => ({
  default: ({ open, onClose }: { open: boolean; onClose: () => void }) =>
    open ? (
      <div data-testid="reminder-dialog">
        <button onClick={onClose}>close</button>
      </div>
    ) : null,
}));

// API モック
const mockBookmarksAdd = vi.fn();
const mockBookmarksRemove = vi.fn();
vi.mock('../api/client', () => ({
  api: {
    bookmarks: {
      add: (id: number) => mockBookmarksAdd(id),
      remove: (id: number) => mockBookmarksRemove(id),
    },
    messages: {
      forward: vi.fn().mockResolvedValue({ message: { id: 99 } }),
    },
  },
}));

// ForwardMessageDialog モック（チャンネル一覧を必要とするため簡略化）
vi.mock('../components/Chat/ForwardMessageDialog', () => ({
  default: ({ open, onClose }: { open: boolean; onClose: () => void }) =>
    open ? (
      <div data-testid="forward-dialog">
        <button onClick={onClose}>close-forward</button>
      </div>
    ) : null,
}));

// ReportMessageDialog モック
vi.mock('../components/Chat/ReportMessageDialog', () => ({
  default: ({ open, onClose }: { open: boolean; onClose: () => void }) =>
    open ? (
      <div data-testid="report-dialog">
        <button onClick={onClose}>close-report</button>
      </div>
    ) : null,
}));

beforeEach(() => {
  vi.resetAllMocks();
  mockBookmarksAdd.mockResolvedValue(undefined);
  mockBookmarksRemove.mockResolvedValue(undefined);
});

describe('MessageActions', () => {
  // ----------------------------------------------------------------
  // 直置きアイコン（常時4個）
  // ----------------------------------------------------------------
  describe('直置きアイコン（4個）の表示', () => {
    it('リアクション追加ボタンが表示される', () => {
      // TODO
    });

    it('返信（スレッド）ボタンが表示される', () => {
      // TODO
    });

    it('isOwn=true のとき編集ボタンが直置きで表示される', () => {
      // TODO
    });

    it('isOwn=true のとき削除ボタンが直置きで表示される', () => {
      // TODO
    });

    it('isOwn=false のとき編集ボタンが表示されない', () => {
      // TODO
    });

    it('isOwn=false のとき削除ボタンが表示されない', () => {
      // TODO
    });

    it('3点メニューボタン（その他のアクション）が表示される', () => {
      // TODO
    });

    it('引用返信・転送・ピン留め・ブックマーク等のアイコンが直置きには存在しない', () => {
      // TODO
    });
  });

  // ----------------------------------------------------------------
  // 3点メニューの開閉
  // ----------------------------------------------------------------
  describe('3点メニューの開閉', () => {
    it('初期状態ではメニューが閉じている', () => {
      // TODO
    });

    it('3点メニューボタンをクリックするとメニューが開く', async () => {
      // TODO
    });

    it('メニューを開いた後に項目をクリックするとメニューが閉じる', async () => {
      // TODO
    });

    it('メニューを開いた後にメニュー外をクリックするとメニューが閉じる', async () => {
      // TODO
    });
  });

  // ----------------------------------------------------------------
  // 3点メニュー内の項目（他人のメッセージ）
  // ----------------------------------------------------------------
  describe('3点メニュー内の項目（isOwn=false）', () => {
    it('引用返信の項目が表示される', async () => {
      // TODO
    });

    it('転送の項目が表示される', async () => {
      // TODO
    });

    it('ピン留め（またはピン留め解除）の項目が表示される', async () => {
      // TODO
    });

    it('ブックマーク（またはブックマーク解除）の項目が表示される', async () => {
      // TODO
    });

    it('リマインダー設定の項目が表示される', async () => {
      // TODO
    });

    it('リンクをコピーの項目が表示される', async () => {
      // TODO
    });

    it('タグを編集の項目が表示される', async () => {
      // TODO
    });

    it('通報の項目が表示される', async () => {
      // TODO
    });
  });

  // ----------------------------------------------------------------
  // 3点メニュー内の各アクション動作
  // ----------------------------------------------------------------
  describe('引用返信（メニュー経由）', () => {
    it('メニューの引用返信をクリックすると onQuoteReply が message を引数に呼ばれる', async () => {
      // TODO
    });

    it('引用返信クリック後にメニューが閉じる', async () => {
      // TODO
    });
  });

  describe('転送（メニュー経由）', () => {
    it('メニューの転送をクリックすると ForwardMessageDialog が開く', async () => {
      // TODO
    });

    it('転送クリック後にメニューが閉じる', async () => {
      // TODO
    });
  });

  describe('ピン留め（メニュー経由）', () => {
    it('isPinned=false のとき「ピン留め」ラベルのメニュー項目を表示する', async () => {
      // TODO
    });

    it('isPinned=true のとき「ピン留めを解除」ラベルのメニュー項目を表示する', async () => {
      // TODO
    });

    it('メニューのピン留めをクリックすると onPinMessage が message.id を引数に呼ばれる', async () => {
      // TODO
    });

    it('ピン留めクリック後にメニューが閉じる', async () => {
      // TODO
    });
  });

  describe('ブックマーク（メニュー経由）', () => {
    it('isBookmarked=false のとき「ブックマーク」ラベルのメニュー項目を表示する', async () => {
      // TODO
    });

    it('isBookmarked=true のとき「ブックマーク解除」ラベルのメニュー項目を表示する', async () => {
      // TODO
    });

    it('メニューのブックマークをクリックすると api.bookmarks.add が呼ばれ状態が更新される', async () => {
      // TODO
    });

    it('メニューのブックマーク解除をクリックすると api.bookmarks.remove が呼ばれ状態が更新される', async () => {
      // TODO
    });

    it('ブックマーク API が失敗したとき状態を変更しない', async () => {
      // TODO
    });

    it('ブックマーク変更後に onBookmarkChange コールバックが呼ばれる', async () => {
      // TODO
    });

    it('ブックマーククリック後にメニューが閉じる', async () => {
      // TODO
    });
  });

  describe('リマインダー設定（メニュー経由）', () => {
    it('メニューのリマインダー設定をクリックすると ReminderDialog が開く', async () => {
      // TODO
    });

    it('リマインダー設定クリック後にメニューが閉じる', async () => {
      // TODO
    });
  });

  describe('リンクコピー（メニュー経由）', () => {
    it('メニューのリンクをコピーをクリックすると navigator.clipboard.writeText が #message-{id} と ?channel={channelId} を含む URL で呼ばれる', async () => {
      // TODO
    });

    it('リンクコピークリック後にメニューが閉じる', async () => {
      // TODO
    });
  });

  describe('タグを編集（メニュー経由）', () => {
    it('メニューのタグを編集をクリックすると onEditTags コールバックが呼ばれる', async () => {
      // TODO
    });

    it('タグ編集クリック後にメニューが閉じる', async () => {
      // TODO
    });
  });

  describe('通報（メニュー経由）', () => {
    it('isOwn=false のとき「通報」メニュー項目が表示される', async () => {
      // TODO
    });

    it('isOwn=true のとき「通報」メニュー項目が表示されない', async () => {
      // TODO
    });

    it('メニューの通報をクリックすると ReportMessageDialog が開く', async () => {
      // TODO
    });

    it('通報クリック後にメニューが閉じる', async () => {
      // TODO
    });
  });

  // ----------------------------------------------------------------
  // 直置きアイコンのアクション動作（引き続き直置きのもの）
  // ----------------------------------------------------------------
  describe('リアクション（直置きアイコン）', () => {
    it('リアクション追加ボタンをクリックすると EmojiPicker が表示される', async () => {
      // TODO
    });

    it('EmojiPicker で絵文字を選択すると socket.emit("add_reaction") が呼ばれる', async () => {
      // TODO
    });
  });

  describe('スレッド返信（直置きアイコン）', () => {
    it('返信ボタンをクリックすると onOpenThread が message.id を引数に呼ばれる', async () => {
      // TODO
    });
  });

  describe('編集（直置きアイコン）', () => {
    it('編集ボタンをクリックすると onEdit コールバックが呼ばれる', async () => {
      // TODO
    });
  });

  describe('削除（直置きアイコン）', () => {
    it('削除ボタンをクリックすると socket.emit("delete_message") が呼ばれる', async () => {
      // TODO
    });
  });
});
