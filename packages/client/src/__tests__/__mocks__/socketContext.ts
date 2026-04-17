/**
 * SocketContext (useSocket) の共通モック定義
 *
 * 使い方:
 *   import { createSocketMock } from './__mocks__/socketContext';
 *
 *   const mockSocket = createSocketMock();
 *   vi.mock('../contexts/SocketContext', () => ({
 *     useSocket: () => mockSocket,
 *   }));
 *
 * ChatPage のように null を返すパターンは以下のように定義する:
 *   vi.mock('../contexts/SocketContext', () => ({
 *     useSocket: () => null,
 *   }));
 */

import { vi } from 'vitest';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyFn = (...args: any[]) => any;

export interface SocketMock {
  emit: ReturnType<typeof vi.fn<AnyFn>>;
  on: ReturnType<typeof vi.fn<AnyFn>>;
  off: ReturnType<typeof vi.fn<AnyFn>>;
}

/** useSocket() が返すオブジェクトのモックを作成する */
export function createSocketMock(): SocketMock {
  return {
    emit: vi.fn<AnyFn>(),
    on: vi.fn<AnyFn>(),
    off: vi.fn<AnyFn>(),
  };
}
