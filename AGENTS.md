# エージェント開発規約

この文書は Codex / Claude Code 共通の開発規約である。
ツール固有の skill や command に同じ規約を複製せず、共通ルールはこのファイルを正本にする。

## PR 作成前チェックリスト

PR を作成する前に **必ず以下をすべて通過させること**。一つでも失敗している場合は PR を作成しない。

```
1. 型チェック・ビルド確認: npm run build
2. テスト全通過確認:      npm run test
3. 未実装テスト残存確認:   it.todo / 空ボディの it が残っていないこと
                          （it.skip は別 issue を参照していれば許容）
4. AI レビュー確認:       テスト設計レビューが APPROVED であること
                          （高リスク変更は実装レビューも APPROVED）
5. 画面動作確認:          画面影響があれば Playwright 確認済みであること
                          （画面影響がなければ N/A の根拠を記録）
```

失敗した場合はエラーを修正してから再実行する。

---

## 機能開発フロー（TDD）

**新規機能・既存機能への修正・機能追加のいずれの場合も**、以下の順番を必ず守る。

```
1. Issue・仕様・既存実装の調査
2. テスト観点テンプレートによるテスト設計
3. it.todo によるテストスケルトン作成
4. 独立 AI によるテスト設計レビュー
5. APPROVED まで修正・再レビュー
6. テストコード実装
7. プログラム実装
8. テスト・ビルド確認
9. 高リスク変更の独立 AI 実装レビュー
10. Playwright による画面動作確認
11. PR 作成
```

テスト観点とレビュー結果の書式は [doc/ai-review-tdd-guide.md](doc/ai-review-tdd-guide.md) を正本とする。

### 各ステップの詳細

**1. Issue・仕様・既存実装の調査**
- Issue の受け入れ条件、関連する `doc/`、既存実装、既存テストを確認する
- 変更対象、影響範囲、既存仕様との整合を明らかにする
- 資料から一意に決められないプロダクト判断がある場合だけユーザーへ確認する

**2-3. テスト観点整理・テストスケルトン作成**
- `doc/ai-review-tdd-guide.md` のテスト観点テンプレートで Keep / Prune とテスト粒度を整理する
- `describe` のネスト構造と `it.todo('日本語の項目名')` で各項目を記載する
- 具体的なテストロジック（アサーション等）は書かない
- テストは日本語で書き、生きたドキュメントとして機能させる
- **`it` の空ボディや `// TODO` コメントだけで残すのは禁止**
  - pass 扱いになり実装忘れの原因になる（過去事例 #177 / #180）
  - `it.todo('...')` を使うことで未実装件数がテスト出力に "todo" として明示される
- **チャット上で項目を列挙するのではなく、テストファイルに直接書く**

**4-5. 独立 AI によるテスト設計レビューと再レビュー**
- 作成担当とは別コンテキストの AI が、Issue、仕様、既存実装、既存テスト、テストスケルトンをレビューする
- `doc/ai-review-tdd-guide.md` のレビュー観点を使い、`APPROVED` または `CHANGES_REQUESTED` で判定する
- `CHANGES_REQUESTED` の場合は修正し、同じレビュアーへ再レビューを依頼する
- **`APPROVED` になるまでテストロジック（アサーション）は一切書かない**
- レビュー結果は PR 本文に記録する

**6. テストコード実装**
- AI レビューで承認された項目のみ実装する
- `it.todo('...')` を `it('...', () => { /* アサーション */ })` に書き換える形で進める
- 機能が未実装で当面アサーションを書けない項目は `it.skip('...', () => {})` に変更し、別 issue を作って参照コメントを残す（todo のまま放置しない）

**7. プログラム実装**
- テストコードが定義した仕様に合わせてプログラムを実装する
- テストが通ることを目標にする（テストを変更して通すのは原則禁止）

**8. テスト・ビルド確認**
- エラーが出た場合は「既存実装」「テストコード」のどちらが誤りかを調査する
- Issue と仕様から判断できる場合は正本に合わせて修正し、判断できない場合だけユーザーへ確認する

**9. 高リスク変更の独立 AI 実装レビュー**
- DB マイグレーション、認証・認可、削除・外部書き込み、機密情報を扱う変更では必須とする
- 作成担当とは別コンテキストの AI が実装差分、テスト、関連仕様を確認する
- Blocking 指摘を解消し、再レビューで `APPROVED` になるまで次へ進まない

**10. Playwright による画面動作確認**
- 画面に影響する変更は [doc/browser-e2e-guide.md](doc/browser-e2e-guide.md) に従って実画面を確認する
- テスト設計レビューで決めたユーザーフロー、主要なエラー表示、画面遷移を確認する
- コンソールエラーと失敗したネットワークリクエストも確認し、結果を PR 本文に記録する
- 画面に影響しない変更のみ、根拠を記録して `N/A` にできる

**11. PR 作成**
- PR 前チェックリストをすべて通過してから `.github/PULL_REQUEST_TEMPLATE.md` を埋める
- AI レビュー結果、テスト結果、Playwright 確認結果または `N/A` の根拠を記録する
- テスト項目確認専用の Draft PR は作らない

**既存テストを修正した場合の報告義務**
- 既存のテストファイルを一行でも変更した場合は、作業完了報告に必ず修正内容を含める
- 「なぜ変更が必要だったか（仕様変更 or バグ修正 or テスト自体の誤り）」を明記する
- 既存テストのアサーションを弱める・削除する場合は根拠を明記し、独立 AI レビューを通す

---

## テスト設計方針

### バックエンド（packages/server）
- テストフレームワーク: Jest
- DB: `pg-mem` のインメモリ PostgreSQL 互換 DB を使用（詳細は [doc/db-test-guide.md](doc/db-test-guide.md) 参照）
- ユニットテスト: `src/__tests__/unit/*.test.ts`（サービス層を直接呼び出して検証）
- 統合テスト: `src/__tests__/integration/*.test.ts`（supertest で HTTP エンドポイントを検証）
- その他: `src/__tests__/*.test.ts`（機能単位でサービスを検証する中間粒度テスト）

### フロントエンド（packages/client）
- テストフレームワーク: Vitest + @testing-library/react
- ネットワーク通信: `vi.mock('../api/client')` で差し替える
- Socket.IO: イベントハンドラを保持するモックオブジェクトを手動で組み立てて注入する
- jsdom で動作しないコンポーネント（Quill 等）はスタブに差し替える
- テストは `src/__tests__/*.test.tsx` に配置する
- **テストファイル名はテスト対象のソースファイル名に合わせる**
  - 新機能を既存コンポーネントに追加する場合は、新規ファイルを作らず既存のテストファイルに追記する
  - 例: QuoteReply機能を `MessageItem.tsx` に追加 → `QuoteReply.test.tsx` ではなく `MessageItem.test.tsx` に追記
  - 例: ピン留め機能を `ChannelList.tsx` に追加 → `PinChannel.test.tsx` ではなく `ChannelList.test.tsx` に追記
  - 対象ソースファイルが複数にまたがる場合のみ、機能名のファイル（例: `useMessages.test.tsx`）を作成してよい

### 共通
- テストの説明文はすべて日本語で書く
- 各テストファイルの冒頭にファイルレベルのコメントを付与する（テスト対象・戦略を記載）
- 正常系・境界条件・エラーケースを網羅する

### テストケース取捨選択の基準（コンテキスト節約）

**書く（Keep）**
- 複雑な計算・条件分岐・データ整合性などのビジネスロジック
- 画面から確認困難なエッジケース（異常系、境界値、Socket イベント処理）
- 複数コンポーネントをまたぐ統合的な振る舞い

**書かない（Prune）**
- 「画面を見ればわかる」UI の微細な状態変化（ボタンの活性/非活性、スタイル確認、aria 属性のみ）
- 単純な「フィールドに入力できる」「要素が表示される」レベルの確認
- ライブラリ自体の動作を検証しているだけのテスト

### モックデータの管理
- 複数テストファイルで共用するフィクスチャは `src/__tests__/__fixtures__/` に配置する
- フロント（`packages/client/src/__tests__/__fixtures__/`）の主要ファクトリ:
  - `users.ts` — `makeUser()` ファクトリ / ダミーユーザー配列 `dummyUsers`
  - `messages.ts` — `makeMessage()` ファクトリ
  - `channels.ts` — `makeChannel()` / `makeChannelMessage()` ファクトリ
  - `dm.ts` — `makeConversation()` / `makeDmMessage()`
  - `tasks.ts` — `makeTask()`、`events.ts` — `makeEvent()`、`wikiPages.ts` — `makeWikiPage()` / `makeWikiPageSummary()`
  - `search.ts` — `makeSearchResult()`、`reminders.ts` — `makeReminder()`、`savedViews.ts` — `makeSavedView()`、`threads.ts` — `makeThread()`
- サーバー（`packages/server/src/__tests__/__fixtures__/`）:
  - `testHelpers.ts` — `registerUser()` / `createChannelReq()` / `insertMessage()` / `makeAdmin()` 等の HTTP・シードヘルパー
  - `pgTestHelper.ts` — pg-mem テスト DB
- 全ファクトリは `make*(overrides)` 形式に統一する（位置引数が必要な局所ラッパーは共通ファクトリへ委譲する）
- テストファイル内に 20 行を超えるインラインのモックオブジェクトを定義しない。既存のエンティティは上記ファクトリを再利用する

---

## Git ワークフロー

### DB マイグレーション

DB スキーマ変更は [doc/db-migration-guide.md](doc/db-migration-guide.md) に従う。
`db/schema.hcl` を正とし、`initializeSchema` をマイグレーション用途に使わない。

### ブランチ戦略
- `main` ブランチへの直接コミットは禁止
- 機能追加: `feature/{機能名}/#{issue番号}` 例: `feature/user-profile/#42`
- バグ修正: `fix/{修正内容}/#{issue番号}` 例: `fix/avatar-display/#43`
- リファクタリング: `refactor/{対象}/#{issue番号}` 例: `refactor/auth-service/#44`
- chore/docs: `chore/{内容}/#{issue番号}` 例: `chore/prompt-optimization/#87`

### コミット規約
- プレフィックスを付けて日本語で書く
- `feat:` 新機能, `fix:` バグ修正, `refactor:` リファクタ, `test:` テスト, `docs:` ドキュメント, `chore:` 雑務
- 例: `feat: ユーザープロフィール設定機能を追加`

### PR テンプレート

プルリクエストを作成する際は `.github/PULL_REQUEST_TEMPLATE.md` の全セクションを必ず埋める。

---

## 作業フロー（全体）

1. 機能開発着手時に `feature/xxx/#yyy` ブランチを作成して切り替える（xxx: 機能名, yyy: issue 番号）
2. AI レビュー付き TDD フロー（調査 → テスト項目 → AI レビュー → テスト実装 → プログラム実装 → 検証）で開発する
3. **PR 作成前チェックリスト**（`npm run build` + `npm run test`）をすべて通過させる
4. チェック通過後にコミット＆プッシュしてプルリクエストを作成する
5. **PR の承認・マージはユーザーが実施する**（Claude は実行しない）
6. マージが必要な場合はユーザーに依頼して作業を一時中断する

---

## 作業完了報告フォーマット

作業が完了したら、必ず以下のフォーマットで報告する。

```
## 作業完了

### 実施内容
- （変更した内容を箇条書きで列挙）

### テスト結果
- ビルド: 成功 / 失敗
- テスト: 成功（XX件） / 失敗（詳細）

### AIレビュー結果
- テスト設計レビュー: APPROVED / CHANGES_REQUESTED
- 実装レビュー: APPROVED / N/A（高リスク変更なし）

### Playwright確認
- 結果: 成功 / 失敗 / N/A（理由）
- 確認内容: （操作手順、コンソール・ネットワーク確認）

### 既存テストの変更（該当する場合）
| ファイル | 変更箇所 | 変更理由 |
|---|---|---|
| path/to/test.ts | 変更内容の概要 | 仕様変更 / バグ修正 / テスト誤り |

※ 既存テストを変更していない場合はこのセクションを省略する

### 次のアクション
- （ユーザーに依頼が必要な事項、またはなし）
```

---

## 共通仕様書

プロジェクトの共通 UI/UX 仕様は `doc/` フォルダに配置する。新機能の実装前に必ず参照し、既存仕様に準拠すること。

| ファイル | 内容 |
|---|---|
| [doc/agent-docs-guide.md](doc/agent-docs-guide.md) | Codex / Claude Code 共通のドキュメント構成・正本ルール |
| [doc/db-migration-guide.md](doc/db-migration-guide.md) | DB スキーマ変更と Atlas 宣言モードの運用ルール |
| [doc/db-test-guide.md](doc/db-test-guide.md) | バックエンド DB テスト設計ガイドライン |
| [doc/react19-suspense-guide.md](doc/react19-suspense-guide.md) | React 19 `use()` / `<Suspense>` 実装・テストガイド |
| [doc/browser-e2e-guide.md](doc/browser-e2e-guide.md) | ブラウザ実機確認の共通手順 |
| [doc/ai-review-tdd-guide.md](doc/ai-review-tdd-guide.md) | AI レビュー付き TDD のテスト観点・レビュー観点テンプレート |
| [doc/parallel-dev-guide.md](doc/parallel-dev-guide.md) | 複数 Issue / worktree 並列開発の判断基準 |
| [doc/snackbar-spec.md](doc/snackbar-spec.md) | スナックバー通知の共通仕様（表示位置・自動消去・API 使用方法） |
