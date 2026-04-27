/**
 * テスト対象: ChannelItem コンポーネント
 * 戦略:
 *   - ホバー時に表示される UI（ドラッグハンドル・3点メニュートグル）を検証する
 *   - 3点メニューを開いてから各 MenuItem をクリックし、対応するコールバック・サブメニュー・ダイアログが起動することを確認する
 *   - 表示条件（isPrivate / canArchive / allCategories）ごとのメニュー項目出し分けを検証する
 *   - 既存のバッジ表示・チャンネル名表示・ミュート状態は引き続き検証する
 */

import { describe, it, vi, beforeEach } from 'vitest';
import userEvent from '@testing-library/user-event';
import type { Channel } from '@chat-app/shared';
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

const makeCategory = (id: number, name: string) => ({
  id,
  name,
  channelIds: [],
  isCollapsed: false,
  position: id - 1,
  userId: 1,
  createdAt: '2024-01-01T00:00:00Z',
  updatedAt: '2024-01-01T00:00:00Z',
});

const defaultProps = {
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
});

// ─────────────────────────────────────────────────────────
// 既存テスト（チャンネル名・バッジ・ミュート状態）
// ─────────────────────────────────────────────────────────

describe('ChannelItem', () => {
  describe('チャンネル名表示', () => {
    it('"# チャンネル名" 形式で表示される', () => {
      // TODO
    });

    it('active なチャンネルが selected 状態になる', () => {
      // TODO
    });
  });

  describe('プライベートチャンネル', () => {
    it('isPrivate=true のとき鍵アイコンが表示される', () => {
      // TODO
    });

    it('isPrivate=false のとき鍵アイコンが表示されない', () => {
      // TODO
    });
  });

  describe('未読バッジ', () => {
    it('unreadCount > 0 かつ mentionCount === 0 のとき未読数バッジが表示される', () => {
      // TODO
    });

    it('unreadCount === 0 のときバッジは表示されない', () => {
      // TODO
    });

    it('unreadCount が 10 以上のとき「9+」と表示される', () => {
      // TODO
    });

    it('unreadCount > 0 のときチャンネル名が太字表示される', () => {
      // TODO
    });
  });

  describe('メンションバッジ', () => {
    it('mentionCount > 0 のときメンションバッジが表示される', () => {
      // TODO
    });

    it('mentionCount が 10 以上のとき「9+」と表示される', () => {
      // TODO
    });

    it('mentionCount > 0 のとき未読数バッジは表示されない', () => {
      // TODO
    });
  });

  describe('ミュート状態の表示', () => {
    it('通知レベルが "muted" のときチャンネル名がグレーで表示される', () => {
      // TODO
    });

    it('通知レベルが "muted" のとき未読バッジが非表示になる', () => {
      // TODO
    });

    it('通知レベルが "muted" のときメンションバッジが非表示になる', () => {
      // TODO
    });
  });

  describe('チャンネル選択', () => {
    it('クリックすると onClick が呼ばれる', () => {
      // TODO
    });
  });

  // ─────────────────────────────────────────────────────────
  // 3点メニュー: ホバー時の表示制御
  // ─────────────────────────────────────────────────────────

  describe('ホバー時の UI 表示', () => {
    it('ホバー前は3点メニュートグルボタンが表示されない', () => {
      // TODO
    });

    it('ホバー時にドラッグハンドルが表示される（disableDrag=false）', () => {
      // TODO
    });

    it('ホバー時に3点メニュートグルボタン（aria-label="その他のアクション"）が表示される', () => {
      // TODO
    });

    it('disableDrag=true のときドラッグハンドルはホバーしても表示されない', () => {
      // TODO
    });
  });

  // ─────────────────────────────────────────────────────────
  // 3点メニュー: メニュー項目の出し分け
  // ─────────────────────────────────────────────────────────

  describe('3点メニューの項目出し分け', () => {
    describe('通常チャンネル（isPrivate=false）', () => {
      it('allCategories が空でないとき「カテゴリへ移動」が表示される', () => {
        // TODO
      });

      it('allCategories が空（または未指定）のとき「カテゴリへ移動」が表示されない', () => {
        // TODO
      });

      it('「通知レベル」が表示される', () => {
        // TODO
      });

      it('「メンバー管理」は表示されない', () => {
        // TODO
      });

      it('canArchive=true のとき「アーカイブ」が表示される', () => {
        // TODO
      });

      it('canArchive=false のとき「アーカイブ」が表示されない', () => {
        // TODO
      });

      it('isPinned=false のとき「ピン留め」が表示される', () => {
        // TODO
      });

      it('isPinned=true のとき「ピン留めを解除」が表示される', () => {
        // TODO
      });
    });

    describe('プライベートチャンネル（isPrivate=true）', () => {
      it('「メンバー管理」が表示される', () => {
        // TODO
      });

      it('「カテゴリへ移動」「通知レベル」「アーカイブ」「ピン留め」も表示される', () => {
        // TODO
      });
    });
  });

  // ─────────────────────────────────────────────────────────
  // 3点メニュー: 各メニュー項目のアクション
  // ─────────────────────────────────────────────────────────

  describe('3点メニュー: カテゴリ移動サブメニュー', () => {
    it('「カテゴリへ移動」をクリックするとサブメニューにカテゴリ一覧が表示される', () => {
      // TODO
    });

    it('サブメニューに「割当なし（その他）」が表示される', () => {
      // TODO
    });

    it('カテゴリ項目を選択すると onAssignChannel が呼ばれる', () => {
      // TODO
    });

    it('「割当なし（その他）」を選択すると onAssignChannel(id, null) が呼ばれる', () => {
      // TODO
    });

    it('現在割り当て済みのカテゴリにはチェックマークが表示される', () => {
      // TODO
    });

    it('カテゴリを選択するとメニューが閉じる', () => {
      // TODO
    });
  });

  describe('3点メニュー: 通知レベルサブメニュー', () => {
    it('「通知レベル」をクリックするとサブメニューに選択肢が表示される', () => {
      // TODO
    });

    it('サブメニューに「すべての通知」「メンションのみ」「ミュート」が表示される', () => {
      // TODO
    });

    it('現在の通知レベルにチェックマークが表示される', () => {
      // TODO
    });

    it('通知レベルを選択すると onChangeNotificationLevel が呼ばれる', () => {
      // TODO
    });

    it('通知レベルを選択するとメニューが閉じる', () => {
      // TODO
    });
  });

  describe('3点メニュー: メンバー管理', () => {
    it('「メンバー管理」をクリックすると onOpenMembersDialog が呼ばれる', () => {
      // TODO
    });

    it('「メンバー管理」をクリックするとメニューが閉じる', () => {
      // TODO
    });
  });

  describe('3点メニュー: アーカイブ', () => {
    it('「アーカイブ」をクリックすると確認ダイアログが開く', () => {
      // TODO
    });

    it('確認ダイアログでアーカイブを確定すると onArchive が呼ばれる', () => {
      // TODO
    });

    it('確認ダイアログでキャンセルすると onArchive は呼ばれない', () => {
      // TODO
    });

    it('「アーカイブ」をクリックするとメニューが閉じる', () => {
      // TODO
    });
  });

  describe('3点メニュー: ピン留め / ピン留め解除', () => {
    it('「ピン留め」をクリックすると onPin が呼ばれる', () => {
      // TODO
    });

    it('「ピン留めを解除」をクリックすると onUnpin が呼ばれる', () => {
      // TODO
    });

    it('ピン留め操作後にメニューが閉じる', () => {
      // TODO
    });
  });

  // ─────────────────────────────────────────────────────────
  // バッジ右マージン（ホバー時レイアウト調整）
  // ─────────────────────────────────────────────────────────

  describe('バッジ右マージン調整', () => {
    it('ホバー時のみバッジに mr スタイルが適用される（アイコンとの重なりを回避）', () => {
      // TODO
    });

    it('非ホバー時はバッジの mr は 0 になる', () => {
      // TODO
    });
  });
});
