# #118 監査ログのエクスポート — 実行計画

- Issue: [#118](https://github.com/mokemoke2850/chat-app-for-claudecode-test/issues/118)
- 難易度: 低
- ブランチ: `feature/audit-log-export/#118`
- **状態**: ✅ 完了（PR [#121](https://github.com/mokemoke2850/chat-app-for-claudecode-test/pull/121) マージ済み）

## 1. ゴール（受入条件）

- 管理者が監査ログを CSV でダウンロードできる
- 日付範囲（from / to）、アクション種別（action_type）でフィルタリング可能
- 既存 `auditLogService.getAuditLogs` のフィルタと同仕様
- CSV カラム: `id, created_at, actor_user_id, actor_username, action_type, target_type, target_id, metadata_json`
- UI: `AuditLogView.tsx` に「CSV エクスポート」ボタンを追加。現在のフィルタ条件を引き継いでダウンロード

## 2. 依存・前提

- 既存機能: `auditLogService`（#85 でマージ済）、`AuditLogView.tsx`、`AdminPage.tsx`
- 他 Issue との衝突: なし。#116 / #117 で新しい `action_type` が追加されてもエクスポート仕様は変わらない

## 3. スキーマ変更

なし。

## 4. shared types 変更

なし（既存 `AuditLog` を CSV に変換するだけ）。

ただし、エクスポート API のクエリパラメータ型を追加しておくと型安全：

```ts
// packages/shared/src/types/auditLog.ts
export interface AuditLogExportQuery {
  from?: string;           // ISO8601
  to?: string;             // ISO8601
  actionType?: string;
  actorUserId?: number;
}
```

## 5. サーバー変更

### 変更ファイル

- `packages/server/src/services/auditLogService.ts`
  - `streamAuditLogsCsv(filter, writer)` を追加（大量レコード対応で Node stream もしくは配列で OK）
- `packages/server/src/controllers/adminController.ts`
  - `exportAuditLogs(req, res, next)` を追加
    - `Content-Type: text/csv; charset=utf-8`
    - `Content-Disposition: attachment; filename="audit-logs-<YYYYMMDD-HHMMSS>.csv"`
    - UTF-8 BOM を先頭に出力（Excel 対応）
    - 既存 `listAuditLogs` のフィルタ整形を再利用
- `packages/server/src/routes/admin.ts`
  - `GET /api/admin/audit-logs/export` を追加（`requireAdmin` ミドルウェア適用）

### CSV 出力の実装

- `csv-stringify` などの外部ライブラリ導入は避け、**自前で RFC 4180 準拠のエスケープ** を実装（カンマ・改行・ダブルクォートのエスケープ）
- metadata は `JSON.stringify` して 1 カラムに格納。改行は含まないので CSV 化は容易

### 監査ログ記録

- **エクスポート自体も監査対象**。`auditLogService.record({ actorUserId, actionType: 'audit.export', metadata: { filter } })` を呼ぶ
- `AuditActionType` に `'audit.export'` を追加

## 6. クライアント変更

### 変更ファイル

- `packages/client/src/components/AuditLogView.tsx`
  - 「CSV エクスポート」ボタンを追加
  - 現在のフィルタ条件から query string を組み立て、`window.open('/api/admin/audit-logs/export?...')` で新規タブダウンロード
  - もしくは `fetch` + `Blob` でダウンロード（Cookie 認証なのでどちらでも可）
- `packages/client/src/api/client.ts`
  - `admin.exportAuditLogs(filter)` は URL 生成のみのヘルパーとして実装

## 7. 実装手順

1. ブランチ作成
2. **テスト項目列挙**
   - server: `__tests__/integration/adminController.test.ts` に「CSV エクスポート」の describe を追記
   - client: `__tests__/AuditLogView.test.tsx` に「エクスポートボタン」テストを追記
3. **ユーザー確認**
4. テスト実装 → 実装
5. 手動確認: CSV を Excel / Numbers で開いて文字化けしないか、metadata が壊れないか
6. `npm run build && npm run test` → PR 作成

## 8. テスト方針

### サーバー

- フィルタなし: 既存全件が CSV で返る
- `from` / `to` で日付範囲が適用される
- `action_type` フィルタで該当ログのみ返る
- カンマ・改行・ダブルクォートを含む metadata が正しくエスケープされる
- UTF-8 BOM が先頭にあり、日本語の actor_username が文字化けしない
- 非管理者は 403
- エクスポート実行が監査ログに `audit.export` として記録される

### クライアント

- 「エクスポート」ボタン押下でダウンロード用 URL が生成される（既存のフィルタ state を反映）
- ダウンロード URL に `from` / `to` / `action_type` が入っている
- （必要なら）ダウンロードイベントの発火確認

## 9. 注意点

- **大量データ対策**: 監査ログは将来的に数万件を超える可能性がある。全件メモリに載せず、`query` を使った cursor 読み出しまたはページング読み出しで書き出す設計を推奨（初回は 10 万件上限 + 警告で簡易対応してもよい。ただし設計の余地を確保）
- `metadata` が `null` の場合は空文字で CSV 出力する
- タイムゾーン: `created_at` は `timestamptz` なので UTC で出力するか、`Asia/Tokyo` に変換するかを決める。**UTC 固定 + 列名で明示** を推奨（`created_at_utc`）

## 10. 見積もり / リスク

- 規模: 小（新規エンドポイント 1 本 + ボタン 1 個）
- リスク: CSV エスケープ不備で Excel が崩れる → ダブルクォート囲み + BOM + 改行統一（\r\n）で RFC 4180 準拠すれば安全
