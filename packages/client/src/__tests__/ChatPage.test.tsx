/**
 * pages/ChatPage.tsx のユニットテスト
 *
 * テスト対象: URL クエリパラメータ ?channel=X によるチャンネル初期選択
 * 戦略:
 *   - 子コンポーネント（AppLayout, ChannelList, MessageList, RichEditor）はすべてスタブ化
 *   - useMessages / useSocket もモックで差し替える
 *   - window.location.search を設定してマウント時の activeChannelId を検証する
 *   - ChannelList に渡される activeChannelId prop を vi.fn() の呼び出し履歴で確認する
 */

import { render, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import ChatPage from '../pages/ChatPage';

// ChannelList は activeChannelId を受け取るスタブ — 呼び出し引数を後で検証する
const MockChannelList = vi.hoisted(() => vi.fn(() => null));

vi.mock('../components/Channel/ChannelList', () => ({ default: MockChannelList }));

// sidebar と children を両方レンダリングする AppLayout スタブ
vi.mock('../components/Layout/AppLayout', async () => {
  const React = (await import('react')) as typeof import('react');
  return {
    default: ({ sidebar, children }: { sidebar: React.ReactNode; children: React.ReactNode }) =>
      React.createElement(React.Fragment, null, sidebar, children),
  };
});

vi.mock('../components/Chat/MessageList', () => ({ default: () => null }));
vi.mock('../components/Chat/RichEditor', () => ({ default: () => null }));

vi.mock('../hooks/useMessages', () => ({
  useMessages: () => ({ messages: [], loading: false, loadMore: vi.fn() }),
}));
vi.mock('../contexts/SocketContext', () => ({ useSocket: () => null }));

beforeEach(() => {
  vi.clearAllMocks();
  MockChannelList.mockImplementation(() => null);
  // location をデフォルト（クエリなし）にリセット
  Object.defineProperty(window, 'location', {
    value: { search: '', hash: '', pathname: '/', origin: 'http://localhost' },
    writable: true,
    configurable: true,
  });
});

describe('ChatPage', () => {
  describe('URL からのチャンネル初期選択', () => {
    it('?channel=X が URL に含まれるとき、マウント時にそのチャンネルが activeChannelId として選択される', async () => {
      Object.defineProperty(window, 'location', {
        value: { search: '?channel=5', hash: '', pathname: '/', origin: 'http://localhost' },
        writable: true,
        configurable: true,
      });

      render(<ChatPage users={[]} />);

      // useEffect 後の再レンダリングで ChannelList に activeChannelId=5 が渡されること
      await waitFor(() => {
        expect(MockChannelList).toHaveBeenLastCalledWith(
          expect.objectContaining({ activeChannelId: 5 }),
          expect.anything(),
        );
      });
    });

    it('?channel が URL に含まれないとき、activeChannelId は null のまま', () => {
      // window.location.search は beforeEach で '' にリセット済み
      render(<ChatPage users={[]} />);

      expect(MockChannelList).toHaveBeenLastCalledWith(
        expect.objectContaining({ activeChannelId: null }),
        expect.anything(),
      );
    });
  });
});
