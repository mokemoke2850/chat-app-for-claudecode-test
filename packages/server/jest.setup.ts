// テスト実行時の環境変数設定（高速化用）
// production 値のままだとテスト時間が極端に長くなるため、テスト時のみ短縮値を使う

// bcrypt のソルトラウンド数
// production: 12 (約 200-300ms/hash) → test: 4 (約 5-10ms/hash)
process.env.BCRYPT_ROUNDS = process.env.BCRYPT_ROUNDS ?? '4';

// presence サービスのオフライン猶予時間
// production: 8000ms → test: 1500ms（オフライン化テストで実時間待機を短縮）
// 1500ms 未満にすると presenceService.test.ts の `OFFLINE_GRACE_MS - 1000` が負数になり失敗するため
process.env.OFFLINE_GRACE_MS = process.env.OFFLINE_GRACE_MS ?? '1500';
