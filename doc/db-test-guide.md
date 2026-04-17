# DBテスト設計ガイドライン

バックエンドのテストでは `pg-mem` ベースのインメモリ PostgreSQL 互換 DB を使用する。

## 基本パターン

```ts
// ⚠️ jest.mock はファイルの最上部（import より前）に記述すること
import { createTestDatabase } from './__fixtures__/pgTestHelper';

const testDb = createTestDatabase();

jest.mock('../../db/database', () => testDb);  // ← jest のホイスティングにより import より前に移動される

// この後に実際の import を書く
import { someService } from '../../services/someService';
```

## フィクスチャセットアップ

外部キー制約があるため、`beforeAll` でテストデータを直接 INSERT する。

```ts
let userId: number;
let channelId: number;

beforeAll(async () => {
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
