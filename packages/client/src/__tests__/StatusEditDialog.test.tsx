/**
 * テスト対象: components/User/StatusEditDialog.tsx（新規）
 *
 * 戦略:
 *   - api.users.updateStatus を vi.mock で差し替える
 *   - 絵文字選択・テキスト入力・有効期限プルダウンの各操作を検証する
 *   - 仕様: 絵文字のみ / テキストのみ / 両方空でクリア のケースを網羅する
 */

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, vi, expect, beforeEach } from 'vitest';

vi.mock('../api/client', () => ({
  api: {
    users: {
      updateStatus: vi.fn(),
    },
  },
}));

import { api } from '../api/client';
const mockUpdateStatus = api.users.updateStatus as ReturnType<typeof vi.fn>;

describe('StatusEditDialog', () => {
  beforeEach(() => {
    mockUpdateStatus.mockResolvedValue({});
  });

  describe('ダイアログの表示', () => {
    it('open=true のときダイアログが表示される', () => {
      // TODO
    });

    it('open=false のときダイアログが表示されない', () => {
      // TODO
    });

    it('既存ステータスがある場合、絵文字とテキストが初期値として表示される', () => {
      // TODO
    });
  });

  describe('絵文字選択', () => {
    it('絵文字ボタンをクリックすると絵文字ピッカーが開く', async () => {
      // TODO
    });

    it('絵文字ピッカーで絵文字を選択すると入力欄に反映される', async () => {
      // TODO
    });

    it('選択済みの絵文字をクリアできる', async () => {
      // TODO
    });
  });

  describe('テキスト入力', () => {
    it('ステータステキストを入力できる', async () => {
      // TODO
    });

    it('テキストが空でも保存できる（絵文字のみ設定）', async () => {
      // TODO
    });
  });

  describe('有効期限プルダウン', () => {
    it('有効期限のプリセット（期限なし・1時間後・今日中・明日まで・1週間）が選択できる', async () => {
      // TODO
    });

    it('「期限なし」を選択すると expires_at に null が渡される', async () => {
      // TODO
    });

    it('「1時間後」を選択すると現在時刻から1時間後の UTC 日時が渡される', async () => {
      // TODO
    });

    it('「今日中」を選択するとクライアントのローカルタイムゾーンの 23:59:59 UTC が渡される', async () => {
      // TODO
    });
  });

  describe('保存処理', () => {
    it('絵文字とテキストと期限を入力して「保存」すると api.users.updateStatus が呼ばれる', async () => {
      // TODO
    });

    it('絵文字のみ入力して「保存」するとステータスが設定される', async () => {
      // TODO
    });

    it('テキストのみ入力して「保存」するとステータスが設定される', async () => {
      // TODO
    });

    it('絵文字もテキストも空で「保存」するとステータスがクリアされる（emoji=null, text=null）', async () => {
      // TODO
    });

    it('保存成功後に onClose が呼ばれる', async () => {
      // TODO
    });

    it('保存に失敗するとエラーメッセージが表示される', async () => {
      // TODO
    });
  });

  describe('キャンセル処理', () => {
    it('「キャンセル」ボタンをクリックすると onClose が呼ばれる', async () => {
      // TODO
    });
  });
});
