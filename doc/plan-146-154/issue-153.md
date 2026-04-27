# Issue #153 — feat: レート制限

> Phase 3 / 並列OK だが **Phase 2 マージ完了後に着手推奨** / 難易度: 低

## 概要

スパム防止のためのメッセージ送信制限。

- 短時間に大量送信されたメッセージを検出してブロック
- ユーザー単位・チャンネル単位での閾値設定
- 制限超過時にユーザーへ警告表示

## 仕様確認事項

- **閾値の管理場所**: ワークスペース全体で 1 つの設定か、チャンネル単位 / ロール単位で個別に設定するか。MVP はワークスペース全体で 1 設定（管理者のみ変更可）が妥当。
- **判定窓**: 「10 秒で 5 件」「1 分で 20 件」のような複数階層を持つか、単一階層で十分か。MVP は単一階層 + 環境変数デフォルトでよい。
- **ストレージ**: Redis などのインメモリ KVS を導入するか、Node プロセスのメモリ Map で済ませるか。**メモリ Map で十分**（既存プロセス構成を変えない）。
- **対象アクション**: 通常メッセージ送信 / DM / 予約送信 / リアクション / メンションのどこまでを対象にするか。MVP はメッセージ送信（通常 + DM）のみ。
- **管理 UI**: 閾値変更画面が必要か。MVP は環境変数 / DB の単一行で十分、UI はあれば便利。
- **超過時の挙動**: HTTP 429 + クライアント側スナックバー表示 + Socket でも同様の挙動。

## 影響範囲

### DB

- 環境変数で十分なら DB 変更不要。
- 管理 UI を作る場合は `db/schema.hcl` に新規テーブル `rate_limit_settings` 追加（ワークスペースグローバル単一行）
  - `id` (常に 1)
  - `messages_per_window integer`
  - `window_seconds integer`
  - `updated_at`

### Server

- `packages/server/src/services/rateLimitService.ts`（**新規**） — メモリ Map で sliding window 管理
- `packages/server/src/middleware/rateLimit.ts`（**新規**） — Express 用ミドルウェア
- 適用箇所:
  - `packages/server/src/routes/messages.ts`（POST）
  - `packages/server/src/routes/dm.ts`（POST）
  - `packages/server/src/routes/scheduledMessages.ts`（POST）
  - `packages/server/src/socket/messageHandler.ts`
  - `packages/server/src/socket/dmHandler.ts`
- 超過時のレスポンス: `429` ステータス + JSON `{ retryAfterSec, limit, windowSec }`

### Client

- `packages/client/src/api/client.ts` — 429 ハンドリングで共通スナックバー呼び出し
- Socket: 送信失敗イベント `error: rate_limit` のリスナで警告表示
- 警告表示は `doc/snackbar-spec.md` に従う

## 並列実行時の競合警戒

- **送信パスの全エンドポイントを横断で触る**ため、Phase 1〜2 でこれらに変更を入れる Issue（#148 の送信成功時下書き削除など）が main にマージされてから着手するのが衝突最小。
- 並列実行する場合は **#149 と同時 OK**（ファイルが完全に分離）。**#152 と同時 OK**（カレンダー新ジョブは送信パスに乗らない）。

## 実装ポイント / 落とし穴

- **クラスタリング/スケールアウト時**: メモリ Map では複数プロセス間で共有できない。将来 Redis 化する想定で、`rateLimitService` インターフェースを抽象化しておく。
- **Socket と HTTP の二重カウント**: 同一ユーザーが Socket と HTTP の両方を使う場合に、合算してカウントする設計にする（user_id + action 種別をキーとして共通カウンタを使う）。
- **管理者の除外**: 管理者は対象外にするか。MVP は対象に含める（運用負荷を増やさない）。
- **エラー判別性**: 超過時のメッセージは「短時間に多くの送信を検出しました。少し時間をおいてください」など、ユーザーに何が起きたか分かる表現に統一。
- **ゲスト閲覧（#149）**: ゲストは投稿不可なので影響なし。だが #149 の「パスワード総当たり対策の制限」は別軸であることに注意（#149 内で個別実装）。

## テスト観点

- ユニット
  - sliding window で N 件目以降がブロックされる
  - 窓を抜けたカウントが除外される
  - 別ユーザーは独立してカウントされる
- 統合
  - HTTP `POST /messages` を高速連投すると 429 が返る
  - Socket で同様に `error: rate_limit` が返る
- フロントエンド
  - 429 受信時にスナックバーが表示される

## ステータス（経過記録）

- 計画作成日: 2026-04-27
- ブランチ: -
- PR: -
- マージ: -
- 備考: -
