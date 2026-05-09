/**
 * テスト対象: adminService.getStats / adminController.getStats の期間フィルタ（Issue #272）
 * 戦略: pg-mem のインメモリ PostgreSQL 互換 DB を使用し、
 *   - from / to クエリパラメータを受け取ったときに集計範囲が正しく絞り込まれること
 *   - バリデーション（不正な日付・from > to 等）が適切にエラーを返すこと
 * を検証する。
 */

import { describe, it } from '@jest/globals';

describe('adminService.getStats: 期間フィルタ（from / to）', () => {
  describe('メッセージ数の集計範囲', () => {
    it.todo('from / to を指定しない場合は全期間の totalMessages を返す');
    it.todo('from を指定すると from 以降のメッセージのみが totalMessages に含まれる');
    it.todo('to を指定すると to 以前のメッセージのみが totalMessages に含まれる');
    it.todo('from と to の両方を指定すると範囲内のメッセージのみが totalMessages に含まれる');
    it.todo('from と to が同じ日時の場合でもその時点のメッセージが含まれる');
  });

  describe('アクティブユーザー数の集計範囲', () => {
    it.todo(
      'from / to を指定した場合、範囲内に last_login_at があるユーザーだけが activeUsers に含まれる',
    );
    it.todo('from / to の範囲外に last_login_at があるユーザーは activeUsers に含まれない');
  });

  describe('バリデーション', () => {
    it.todo('from に不正な日付文字列を渡すと例外を投げる（またはエラーを返す）');
    it.todo('to に不正な日付文字列を渡すと例外を投げる（またはエラーを返す）');
    it.todo('from が to より後の日時の場合は例外を投げる（またはエラーを返す）');
  });
});

describe('GET /api/admin/stats: 期間フィルタ（from / to クエリパラメータ）', () => {
  describe('正常系', () => {
    it.todo('?from=2024-01-01&to=2024-12-31 を指定すると 200 で集計結果が返る');
    it.todo('from のみ指定した場合でも 200 で集計結果が返る');
    it.todo('to のみ指定した場合でも 200 で集計結果が返る');
    it.todo('?period=24h を指定すると現在時刻から 24 時間前までの集計が返る');
    it.todo('?period=7d を指定すると現在時刻から 7 日前までの集計が返る');
    it.todo('?period=30d を指定すると現在時刻から 30 日前までの集計が返る');
  });

  describe('異常系', () => {
    it.todo('from に不正な日付文字列を渡すと 400 が返る');
    it.todo('to に不正な日付文字列を渡すと 400 が返る');
    it.todo('from が to より後の日時の場合は 400 が返る');
    it.todo('未知の period 値（例: ?period=1y）を指定すると 400 が返る');
    it.todo('非ログインは 401 が返る');
    it.todo('一般ユーザーは 403 が返る');
  });
});
