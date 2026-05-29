import type { Config } from 'jest';

const config: Config = {
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  testMatch: ['**/__tests__/**/*.test.ts'],
  // テスト用の環境変数（BCRYPT_ROUNDS, OFFLINE_GRACE_MS 等）を設定する
  setupFiles: ['<rootDir>/jest.setup.ts'],
  transform: {
    '^.+\\.tsx?$': ['ts-jest', {
      tsconfig: {
        paths: { '@chat-app/shared': ['../shared/src/index.ts'] },
      },
    }],
  },
  moduleNameMapper: {
    '^@chat-app/shared$': '<rootDir>/../shared/src/index.ts',
  },
  // pg-mem の Pool は close できない（closeDatabase: noop）ため、テスト完了後に open handle が残り
  // worker が gracefully exit できない。テスト自体は全パスしているので強制終了で問題ない。
  forceExit: true,
  // 並列実行時の CPU 競合でイベントループが一時停滞しても、既定 5000ms では
  // 統合テストが稀にタイムアウトしてフレークするため余裕を持たせる。
  testTimeout: 15000,
};

export default config;
