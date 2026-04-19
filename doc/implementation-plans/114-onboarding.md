# #114 ワークスペース初回オンボーディング — 実行計画

- Issue: [#114](https://github.com/mokemoke2850/chat-app-for-claudecode-test/issues/114)
- 難易度: 低
- ブランチ: `feature/onboarding/#114`

## 1. ゴール（受入条件）

- 初回ログイン（`users.onboarding_completed_at IS NULL`）を検出してウェルカムモーダルを表示する
- ステップ形式（3〜4 ステップ）で基本操作を案内
  1. ようこそ画面（製品の簡単な説明）
  2. おすすめチャンネル一覧 → 「このチャンネルに参加」ボタン（複数選択可）
  3. メッセージ送信のガイド（スクリーンショットまたは動画）
  4. チャンネル切替のガイド
- 「スキップ」「完了」いずれでも `onboarding_completed_at` が NOW() に更新され、次回以降は出ない
- 管理者がおすすめチャンネルを設定できる（Admin 画面にチェックボックス `is_recommended`）

## 2. 依存・前提

- 既存機能: `AuthContext.tsx`（ユーザー情報保持）、`channels` API
- 他 Issue との衝突: なし（#112 招待リンクとは独立だが、将来的に「招待経由の初回」と統合してもよい）

## 3. スキーマ変更（`db/schema.hcl`）

```hcl
# users テーブルにカラム追加
column "onboarding_completed_at" {
  null    = true
  type    = timestamptz
  comment = "オンボーディング完了日時（NULL = 未完了）"
}

# channels テーブルにカラム追加
column "is_recommended" {
  null    = false
  type    = boolean
  default = false
  comment = "おすすめチャンネル（初回オンボーディング対象）"
}
```

## 4. shared types 変更

- `packages/shared/src/types/user.ts` の `User` に `onboardingCompletedAt: string | null` を追加
- `packages/shared/src/types/channel.ts` の `Channel` に `isRecommended: boolean` を追加

## 5. サーバー変更

### 変更ファイル
- `packages/server/src/services/authService.ts` — `me` レスポンス / ログインレスポンスに `onboardingCompletedAt` を含める
- `packages/server/src/services/channelService.ts` — `isRecommended` を select 対象に含める
- `packages/server/src/routes/auth.ts` — `POST /api/auth/onboarding/complete` を追加（認証済みユーザーのみ。`onboarding_completed_at = NOW()` を UPDATE）
- `packages/server/src/services/adminService.ts` / `routes/admin.ts` — `PATCH /api/admin/channels/:id/recommend` で `is_recommended` をトグル

### 監査ログ
- `auth.onboarding.complete` を `AuditActionType` に追加（任意）
- `admin.channel.recommend` / `admin.channel.unrecommend` を追加

## 6. クライアント変更

### 新規ファイル
- `packages/client/src/components/Onboarding/WelcomeModal.tsx` — 4 ステップのダイアログ（MUI Stepper を想定）
- `packages/client/src/components/Onboarding/RecommendedChannelList.tsx`

### 変更ファイル
- `packages/client/src/App.tsx`（または `ChatPage.tsx`）
  - 認証後に `user.onboardingCompletedAt === null` を検知して `WelcomeModal` を表示
- `packages/client/src/pages/AdminPage.tsx`
  - チャンネル管理タブに「おすすめにする／解除する」ボタン
- `packages/client/src/api/client.ts`
  - `auth.completeOnboarding()`
  - `admin.setChannelRecommended(channelId, value)`

## 7. 実装手順

1. ブランチ作成
2. `db/schema.hcl` 編集 → `atlas schema apply`
3. shared types 更新（型の破壊変更なので依存コード全体をビルドしてエラー潰す）
4. **テスト項目列挙**
   - server: `__tests__/onboarding.test.ts`、既存 `authController.test.ts` / `adminController.test.ts` に追記
   - client: 新規 `WelcomeModal.test.tsx`、`AuthContext.test.tsx` / `AdminPage.test.tsx` に追記
5. **ユーザー確認**
6. テスト実装 → 実装 → build + test
7. PR 作成

## 8. テスト方針

### サーバー
- `POST /api/auth/onboarding/complete` が認証必須、呼び出すと `onboarding_completed_at` が埋まる
- `me` API のレスポンスが新フィールドを含む
- `is_recommended` フラグが channels select に含まれる
- 管理者のみ推奨設定を変更できる（403 の確認）

### クライアント
- `user.onboardingCompletedAt === null` のときにモーダルが自動表示される
- 「スキップ」「完了」どちらでも API が呼ばれる
- 推奨チャンネル参加ボタンで `channels.join` が呼ばれる
- 2 回目のログインではモーダルが出ない

## 9. 注意点

- モーダル表示中に `use(promise)` で取得したデータを `useMemo` で固定する（再レンダーでモーダルが再 mount されると進捗が消える）
- 「スキップ」後に再表示させたい場合はプロフィールページから「オンボーディングをやり直す」リンクで `PATCH /api/auth/profile` などで `onboarding_completed_at = NULL` に戻す運用も可（任意）
- Stepper の `activeStep` はローカル state でよい

## 10. 見積もり / リスク

- 規模: 小〜中（モーダル UI + API 2 本）
- リスク: `AuthContext` 変更が他コンポーネントに波及する可能性。型追加のみなので実害は小さい
