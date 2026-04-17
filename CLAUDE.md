# プロジェクト開発ルール

エージェントの行動規範・開発フロー・テスト設計・Git ワークフローはすべて [AGENTS.md](AGENTS.md) に記載されている。必ず参照すること。

## DBマイグレーション

スキーマ管理には **Atlas**（宣言モード）を使用する。

- スキーマ定義: `db/schema.hcl`（このファイルを編集してスキーマを変更する）
- Atlas設定: `atlas.hcl`
- 適用コマンド: `atlas schema apply --env local`
- 差分確認: `atlas schema apply --env local --dry-run`

**スキーマを変更するときは必ず `db/schema.hcl` を編集し、`atlas schema apply` で適用する。`database.ts` の `initializeSchema` は新規インストール時の初期化専用であり、マイグレーションには使用しない。**

## フロントエンド開発ルール

フロントエンド（`packages/client`）は **React 19** で開発する。

- データフェッチには `useEffect` + API 呼び出しの組み合わせを使わず、React 19 の `use()` フックを使用する
- `use(promise)` でデータを読み取り、コンポーネントを `<Suspense>` でラップしてローディング状態を管理する
- `use(promise)` に渡す Promise は `useState` または `useMemo` で安定化させ、レンダリングごとに再生成しないこと

## DBテスト設計ガイドライン

バックエンドのテストでは `pg-mem` ベースのインメモリ DB を使用する。

### 基本パターン

```ts
// ⚠️ jest.mock はファイルの最上部（import より前）に記述すること
import { createTestDatabase } from './__fixtures__/pgTestHelper';

const testDb = createTestDatabase();

jest.mock('../../db/database', () => testDb);  // ← import より前に移動される（jest のホイスティング）

// この後に実際の import を書く
import { someService } from '../../services/someService';
```

### フィクスチャセットアップ

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

### ユニットテスト vs 統合テスト

| テスト種別 | 配置場所 | 呼び出し方法 |
|---|---|---|
| ユニットテスト | `src/__tests__/unit/` | サービス関数を直接呼び出す |
| 統合テスト | `src/__tests__/integration/` | `supertest` で HTTP エンドポイントを叩く |
| 機能テスト | `src/__tests__/` | サービス関数を直接呼び出す（機能単位）|

統合テストでは `testHelpers.ts` の `registerUser` / `registerAndGetCookie` / `createChannelReq` を活用してボイラープレートを削減する。

## PRテンプレート

プルリクエストを作成する際は、必ず `.github/PULL_REQUEST_TEMPLATE.md` のテンプレートに従うこと。

- `## 概要` : 変更の目的・背景を簡潔に記載する
- `## 変更内容` : 具体的に何を変更したかを記載する
- `## 影響範囲` : 変更によって影響を受けるファイル・機能・システムを列挙する
- `## 動作確認・テスト結果` : 各チェックボックスを確認し、該当する項目にチェックを入れる
- `## 関連Issue` : `Fixes #番号` の形式で関連するIssueを必ず記載する
- `## チェックリスト` : マージ前に全項目を確認する
