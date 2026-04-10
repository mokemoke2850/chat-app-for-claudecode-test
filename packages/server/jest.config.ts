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
};

export default config;
