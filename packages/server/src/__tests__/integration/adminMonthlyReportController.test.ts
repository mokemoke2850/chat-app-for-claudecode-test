/**
 * 月次レポート CSV エクスポートの HTTP レベルテスト（Issue #273）
 *
 * テスト対象: packages/server/src/controllers/adminController.ts に追加する
 *           exportMonthlyReport（仮）ハンドラと
 *           GET /api/admin/reports/monthly?month=YYYY-MM ルート
 * 戦略:
 *   - supertest で HTTP リクエストを発行し、認可・バリデーション・レスポンスヘッダー・
 *     レスポンスボディ（CSV テキスト・BOM）を検証する
 *   - DB は pg-mem を使用
 *   - 既存の /api/admin/audit-logs/export と同じ規約（Content-Type / Content-Disposition / 監査記録）に従う
 */

import { createTestDatabase } from '../__fixtures__/pgTestHelper';

const testDb = createTestDatabase();

jest.mock('../../db/database', () => testDb);

import request from 'supertest';
import { createApp } from '../../app';
import { registerUser } from '../__fixtures__/testHelpers';

const app = createApp();

async function makeAdmin(userId: number): Promise<void> {
  await testDb.execute("UPDATE users SET role = 'admin' WHERE id = $1", [userId]);
}

describe('GET /api/admin/reports/monthly', () => {
  describe('認可', () => {
    it.todo('非ログインは 401 を返す');
    it.todo('一般ユーザー（role=user）は 403 を返す');
    it.todo('admin ユーザーは 200 を返す');
  });

  describe('month パラメータのバリデーション', () => {
    it.todo('month パラメータが未指定の場合は 400 を返す');
    it.todo('month パラメータが YYYY-MM 形式でない場合（例: "2026/01"）は 400 を返す');
    it.todo('month の月部分が範囲外（例: "2026-13"）の場合は 400 を返す');
    it.todo('未来月（現在月より後）を指定した場合は 400 を返す');
    it.todo('正常な YYYY-MM（例: "2026-04"）を指定すると 200 を返す');
  });

  describe('レスポンスヘッダー', () => {
    it.todo('Content-Type が text/csv; charset=utf-8 である');
    it.todo('Content-Disposition が attachment; filename="..." 形式である');
    it.todo('ファイル名に対象月（YYYY-MM）が含まれる（例: workspace-report-2026-04.csv）');
  });

  describe('レスポンスボディ', () => {
    it.todo('レスポンスの先頭に UTF-8 BOM（0xEF 0xBB 0xBF）が付与されている');
    it.todo('CSV にユーザー別投稿数のセクションが含まれる');
    it.todo('CSV にチャンネル別投稿数のセクションが含まれる');
    it.todo('CSV にファイル容量のセクションが含まれる');
    it.todo('対象月外のメッセージは CSV に含まれない');
  });

  describe('監査ログ記録', () => {
    it.todo('エクスポート実行が audit_logs に admin.report.export として記録される');
    it.todo('監査ログの metadata に対象月（month）が含まれる');
  });
});
