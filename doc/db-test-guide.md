# DBテスト設計ガイドライン

バックエンドのテストでは `pg-mem` ベースのインメモリ PostgreSQL 互換 DB を使用する。

## 基本パターン（推奨: 共有インスタンス）

```ts
import { getSharedTestDatabase, resetTestData } from './__fixtures__/pgTestHelper';

const testDb = getSharedTestDatabase(); // シングルトン。スキーマ作成は初回のみ

jest.mock('../../db/database', () => testDb);

import { someService } from '../../services/someService';

beforeEach(async () => {
  await resetTestData(testDb); // テーブルデータのみクリア（スキーマは保持）
  // フィクスチャが必要な場合はここで INSERT
});
```

`createTestDatabase()` はテストファイルごとにスキーマ作成SQLを実行するため低速。
新規テストファイルでは必ず `getSharedTestDatabase()` + `beforeEach(resetTestData)` を使うこと。

## フィクスチャセットアップ

外部キー制約があるため、テストデータを直接 INSERT する。

```ts
let userId: number;
let channelId: number;

beforeEach(async () => {
  await resetTestData(testDb);

  const ru = await testDb.execute(
    "INSERT INTO users (username, email, password_hash) VALUES ($1, $2, $3) RETURNING id",
    ['testuser', 'test@example.com', 'hash'],
  );
  userId = ru.rows[0].id as number;

  const rc = await testDb.execute(
    "INSERT INTO channels (name, created_by) VALUES ($1, $2) RETURNING id",
    ['test-channel', userId],
  );
  channelId = rc.rows[0].id as number;
});
```

## ユニットテスト vs 統合テスト

| テスト種別 | 配置場所 | 呼び出し方法 |
|---|---|---|
| ユニットテスト | `src/__tests__/unit/` | サービス関数を直接呼び出す |
| 統合テスト | `src/__tests__/integration/` | `supertest` で HTTP エンドポイントを叩く |
| 機能テスト | `src/__tests__/` | サービス関数を直接呼び出す（機能単位） |

統合テストでは `testHelpers.ts` の `registerUser` / `registerAndGetCookie` / `createChannelReq` を活用してボイラープレートを削減する。

## 統合テストで書かないこと

統合テスト（HTTP層）はHTTP契約のみを検証する。ビジネスロジックはユニットテストで担保済みのため重複させない。

**書く**: ステータスコード（200/201/204/401）、レスポンスのフィールド存在確認
**書かない**: ユニットテストで検証済みのビジネスロジック（プライベートチャンネルのフィルタリング、メンバー自動追加の確認など）

```ts
// ❌ 重複: unit/channel.test.ts でカバー済み
it('プライベートチャンネルは非メンバーに返らない', ...);

// ✅ HTTP契約のみ検証
it('認証なしで401を返す', ...);
it('is_private=true で201とisPrivate=trueが返る', ...);
```

## 削除すべきテスト

- **移行完了後のマイグレーションテスト**: PostgreSQL移行確認などの一時的なテストは目的完了後に削除する
- **テストインフラのテスト**: `pgTestHelper` 自体を検証するテストは不要。ヘルパーの動作は、それを使う全テストが通ることで暗黙に保証される
- **外部ライブラリの動作検証**: pg-mem の SQL 方言が動くかなど、ライブラリの機能を確認するテストは書かない
