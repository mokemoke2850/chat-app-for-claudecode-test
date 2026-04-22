/**
 * テスト対象: hooks/useChannelNotifications
 * 責務: 通知設定の一覧取得（Map形式キャッシュ）と設定更新 API 呼び出し
 * 戦略:
 *   - api モジュールを vi.mock で差し替えてネットワーク通信を排除
 *   - renderHook でフックの状態変化を検証する
 */

import { describe, it } from 'vitest';

describe('useChannelNotifications', () => {
  describe('初回データ取得', () => {
    it('マウント時に GET /api/channels/notifications を呼ぶ', () => {
      // TODO
    });

    it('取得したデータが channelId をキーとする Map で返される', () => {
      // TODO
    });

    it('レスポンスが空配列の場合は空の Map を返す', () => {
      // TODO
    });
  });

  describe('setLevel（通知レベルの更新）', () => {
    it('setLevel を呼ぶと PUT /api/channels/:id/notifications が呼ばれる', () => {
      // TODO
    });

    it('setLevel 成功後にローカルのキャッシュ（Map）が更新される', () => {
      // TODO
    });

    it('setLevel が失敗してもキャッシュが変更されない', () => {
      // TODO
    });
  });

  describe('getLevel（個別チャンネルの通知レベル参照）', () => {
    it('設定済みのチャンネルは正しいレベルを返す', () => {
      // TODO
    });

    it('未設定のチャンネルはデフォルト値 "all" を返す', () => {
      // TODO
    });
  });
});
