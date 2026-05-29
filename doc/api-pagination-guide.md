# API ページング標準仕様ガイド（#375）

一覧・検索系 API のページング方式を統一するための正本ドキュメント。
新しい一覧/検索エンドポイントを追加する際は、本ガイドのいずれかの方式に準拠すること。

## 方針

返却キーはドメイン名（`messages` / `logs` / `events` など）ではなく、**汎用の `items`** に統一する。
これによりフロントの一覧取得ロジック（`use()` + `<Suspense>` / 共通フック）を方式ごとに 1 本化できる。

共通型は `packages/shared/src/types/pagination.ts` に定義する。

| 用途 | 方式 | 型 | 形状 |
|------|------|----|------|
| 時系列・無限スクロール（チャンネル/DM のメッセージタイムライン） | カーソル系 | `CursorPaged<T>` | `{ items, nextCursor, hasMore }` |
| ページャ・総件数表示が必要な一覧（管理画面の監査ログ、検索結果など） | オフセット系 | `OffsetPaged<T>` | `{ items, total, limit, offset }` |

## オフセット系 `OffsetPaged<T>`

```ts
interface OffsetPaged<T> {
  items: T[];
  total: number; // フィルタ適用後の総件数（limit で切られても全件数）
  limit: number; // 実効 limit（サーバ側でクランプ済み）
  offset: number; // 先頭からのスキップ件数
}
```

- クエリパラメータ: `limit`（既定値はエンドポイント定義・上限はサーバでクランプ） / `offset`（既定 0）。
- `limit` / `offset` が数値以外・負数の場合は `400`（`{ error: { code, message } }`）を返す。
- `total` は `limit` で切り詰められても**フィルタ適用後の全件数**を表す。

### 適用済みエンドポイント
- `GET /api/messages/search`
- `GET /api/admin/audit-logs`

### フロント
- 共通フック `useOffsetPagination(fetchPage, filters, { limit })` を使う。
  - `offset` 状態・`nextPage` / `prevPage` / `hasNext` / `hasPrev` / `total` を提供する。
  - `filters` が変わると `offset` を 0 にリセットする。
  - React 19 構成に合わせ、安定化済み `fetchPromise` を返す（`items` は `use(fetchPromise)` で読む）。
- 適用例: `AuditLogView`（Suspense + ページャ）、`SearchPage`（ヒット件数表示に `total` を使用）。

## カーソル系 `CursorPaged<T>`

```ts
interface CursorPaged<T> {
  items: T[]; // 時系列昇順
  nextCursor: string | null; // 次に遡る際に渡す不透明なカーソル。続きが無ければ null
  hasMore: boolean;
}
```

- クエリパラメータ: `limit` / `before`（= 前ページで受け取った `nextCursor`）。
- サーバは `limit + 1` 件取得して `hasMore` を判定し、超過分を切り落とす。
- `nextCursor` は現在表示中の最古メッセージ ID（文字列）。クライアントは値を解釈せず `before` にそのまま渡す。

### 適用済みエンドポイント
- `GET /api/channels/:channelId/messages`

### フロント
- `useMessages` が `items` を取り込み、`nextCursor` / `hasMore` を保持して `loadMore()` で前方（より古いメッセージ）を読み込む。

## 段階移行（追従 Issue）

#375 では代表的な 3 エンドポイント（メッセージ検索 / 監査ログ / チャンネルメッセージ）と共通フックを整備した。
以下は本仕様への追従が未対応のため、別 Issue で段階移行する。

- DM メッセージ（`GET /api/dm/conversations/:id/messages`、カーソル系候補）
- ゲストリンクメッセージ
- スレッド返信一覧
- tags サジェスト（`limit` のみ）
- その他 `{ pages }` / `{ events }` 等のドメイン名一覧
