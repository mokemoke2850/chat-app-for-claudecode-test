import type { Config } from 'jest';

const config: Config = {
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  testMatch: ['**/__tests__/**/*.test.ts'],
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
};

export default config;
