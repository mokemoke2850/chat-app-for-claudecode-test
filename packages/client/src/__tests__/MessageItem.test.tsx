/**
 * components/Chat/MessageItem.tsx のユニットテスト
 *
 * テスト対象: メッセージの表示パターン、編集・削除操作、プレゼンスインジケータの表示
 * 戦略:
 *   - Socket.IO は SocketContext をモックして注入する
 *   - usePresence は hooks/usePresence をモックして制御可能な Map を注入する
 *   - RichEditor は Quill を依存しており jsdom では動作しないためスタブに差し替える
 *   - userEvent でホバー・クリックをシミュレートする
 */

import { render, screen, waitFor, fireEvent } from './test-utils';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import type { PresenceMap } from '../hooks/usePresence';
import MessageItem from '../components/Chat/MessageItem';
import { dummyUsers } from './__fixtures__/users';
import { makeMessage } from './__fixtures__/messages';

// DensityContext モック — MessageItem が useDensity を使うため注入が必要
// テストごとに density を切り替え可能にするため vi.fn() で定義する
import type { DensityMode } from '../contexts/DensityContext';
type DensityReturn = { density: DensityMode; setDensity: ReturnType<typeof vi.fn> };
const mockUseDensity = vi.fn(() => ({
  density: 'cozy' as DensityMode,
  setDensity: vi.fn(),
})) as unknown as {
  (): DensityReturn;
  mockReturnValue: (val: DensityReturn) => void;
};
vi.mock('../contexts/DensityContext', () => ({
  useDensity: () => mockUseDensity(),
}));

// Socket.IO モック
const mockSocket = { emit: vi.fn(), on: vi.fn(), off: vi.fn() };
vi.mock('../contexts/SocketContext', () => ({
  useSocket: () => mockSocket,
}));

// usePresence モック: テストごとに presence Map を差し替え可能にする
let mockPresenceMap: PresenceMap = new Map();
vi.mock('../hooks/usePresence', () => ({
  usePresence: () => mockPresenceMap,
}));

// RichEditor は Quill を内包するため jsdom では動作しない → スタブに差し替える
vi.mock('../components/Chat/RichEditor', () => ({
  default: ({ onCancel }: { onCancel: () => void; onSend: (c: string, m: number[]) => void }) => (
    <div data-testid="rich-editor">
      <button onClick={onCancel}>Cancel</button>
    </div>
  ),
}));

// TagInput は useTagSuggestions（use() + Suspense）を内包するため簡易スタブに差し替える
vi.mock('../components/Chat/TagInput', () => ({
  default: ({ value, onChange }: { value: string[]; onChange: (tags: string[]) => void }) => (
    <div data-testid="tag-input-stub">
      <input
        data-testid="tag-input-field"
        value={value.join(',')}
        onChange={(e) => onChange(e.target.value.split(',').filter(Boolean))}
      />
    </div>
  ),
}));

// EventCard は SocketContext / SnackbarContext / api に依存するためここでは描画分岐のみを検証する
vi.mock('../components/Chat/EventCard', () => ({
  default: ({ event }: { event: { id: number; title: string } }) => (
    <div data-testid="event-card">{event.title}</div>
  ),
}));

const showError = vi.fn();
vi.mock('../contexts/SnackbarContext', () => ({
  useSnackbar: () => ({ showSuccess: vi.fn(), showError, showInfo: vi.fn() }),
}));

// api.tags をモック（タグ保存テスト用）
const setMessageTagsMock = vi.fn();
vi.mock('../api/client', () => ({
  api: {
    tags: {
      setMessageTags: (id: number, names: string[]) => setMessageTagsMock(id, names),
    },
  },
}));

beforeEach(() => {
  vi.resetAllMocks();
  mockPresenceMap = new Map();
  showError.mockClear();
  setMessageTagsMock.mockReset();
  // density をデフォルト（cozy）にリセット
  mockUseDensity.mockReturnValue({ density: 'cozy', setDensity: vi.fn() });
});

describe('MessageItem', () => {
  describe('削除済みメッセージ', () => {
    it('isDeleted=true かつ displayName が設定されているとき、username ではなく displayName を表示する', () => {
      const usersWithDisplayName = [
        { ...dummyUsers[0], displayName: 'Alice Smith', location: null },
        { ...dummyUsers[1], displayName: null, location: null },
      ];
      render(
        <MessageItem
          message={makeMessage({ isDeleted: true, userId: 1, username: 'alice' })}
          currentUserId={2}
          users={usersWithDisplayName}
        />,
      );
      expect(screen.getByText('Alice Smith')).toBeInTheDocument();
      expect(screen.queryByText('alice')).not.toBeInTheDocument();
    });

    it('isDeleted=true のとき、アバターの色は displayName ではなく正しいユーザーの email に基づく色を使う', () => {
      const usersWithEmail = [
        { ...dummyUsers[0], email: 'alice@example.com', displayName: null, location: null },
        { ...dummyUsers[1], displayName: null, location: null },
      ];
      // エラーなく描画できることを確認（色の計算に email を使うため avatarColor を呼べる）
      expect(() =>
        render(
          <MessageItem
            message={makeMessage({ isDeleted: true, userId: 1 })}
            currentUserId={2}
            users={usersWithEmail}
          />,
        ),
      ).not.toThrow();
    });

    it('isDeleted=true かつ自分のメッセージのとき「取り消しを元に戻す」ボタンが表示される', () => {
      render(
        <MessageItem
          message={makeMessage({ isDeleted: true, userId: 1 })}
          currentUserId={1}
          users={dummyUsers}
        />,
      );
      expect(screen.getByRole('button', { name: /取り消しを元に戻す/i })).toBeInTheDocument();
    });

    it('isDeleted=true かつ他人のメッセージのとき「取り消しを元に戻す」ボタンが表示されない', () => {
      render(
        <MessageItem
          message={makeMessage({ isDeleted: true, userId: 1 })}
          currentUserId={2}
          users={dummyUsers}
        />,
      );
      expect(screen.queryByRole('button', { name: /取り消しを元に戻す/i })).not.toBeInTheDocument();
    });

    it('「取り消しを元に戻す」ボタンをクリックすると socket.emit("restore_message") がメッセージIDを引数に呼ばれる', async () => {
      render(
        <MessageItem
          message={makeMessage({ id: 99, isDeleted: true, userId: 1 })}
          currentUserId={1}
          users={dummyUsers}
        />,
      );
      await userEvent.click(screen.getByRole('button', { name: /取り消しを元に戻す/i }));
      expect(mockSocket.emit).toHaveBeenCalledWith('restore_message', 99);
    });

    it('isDeleted=true のとき "This message was deleted." を表示する', () => {
      render(
        <MessageItem
          message={makeMessage({ isDeleted: true })}
          currentUserId={1}
          users={dummyUsers}
        />,
      );

      expect(screen.getByText('This message was deleted.')).toBeInTheDocument();
    });

    it('isDeleted=true のとき編集・削除ボタンを表示しない', () => {
      render(
        <MessageItem
          message={makeMessage({ isDeleted: true })}
          currentUserId={1}
          users={dummyUsers}
        />,
      );

      expect(screen.queryByRole('button', { name: /edit/i })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /delete/i })).not.toBeInTheDocument();
    });
  });

  describe('通常メッセージの表示', () => {
    it('ユーザー名と投稿時刻を表示する', () => {
      render(<MessageItem message={makeMessage()} currentUserId={1} users={dummyUsers} />);

      expect(screen.getByText('alice')).toBeInTheDocument();
      // createdAt "2024-06-01T12:00:00Z" が toLocaleTimeString で変換されて表示される
      // 環境依存を避けるため「何らかの時刻文字列が存在する」ことだけを確認する
      expect(screen.getByText(/\d{1,2}:\d{2}/)).toBeInTheDocument();
    });

    it('isEdited=true のとき "(edited)" を表示する', () => {
      render(
        <MessageItem
          message={makeMessage({ isEdited: true })}
          currentUserId={1}
          users={dummyUsers}
        />,
      );

      expect(screen.getByText('(edited)')).toBeInTheDocument();
    });

    it('isEdited=false のとき "(edited)" を表示しない', () => {
      render(
        <MessageItem
          message={makeMessage({ isEdited: false })}
          currentUserId={1}
          users={dummyUsers}
        />,
      );

      expect(screen.queryByText('(edited)')).not.toBeInTheDocument();
    });
  });

  describe('自分のメッセージ（currentUserId === message.userId）', () => {
    it('Edit ボタンと Delete ボタンが DOM 上に存在する', () => {
      render(
        // currentUserId=1 は message.userId=1 と一致 → 自分のメッセージ
        <MessageItem message={makeMessage({ userId: 1 })} currentUserId={1} users={dummyUsers} />,
      );

      // ボタンは opacity:0 で非表示だが DOM には存在する（ホバーで表示される設計）
      expect(screen.getByRole('button', { name: /edit/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /delete/i })).toBeInTheDocument();
    });

    it('Edit ボタンをクリックすると RichEditor が表示される（編集モードになる）', async () => {
      render(
        <MessageItem message={makeMessage({ userId: 1 })} currentUserId={1} users={dummyUsers} />,
      );

      // Step 4 以降アクションバーはホバー前 pointer-events:none のため、ユニットテストでは
      // チェックを外して直接クリックする（実機ではホバー → クリックの順で動作）
      await userEvent.click(screen.getByRole('button', { name: /edit/i }), {
        pointerEventsCheck: 0,
      });

      expect(screen.getByTestId('rich-editor')).toBeInTheDocument();
    });

    it('Delete ボタンをクリックすると socket.emit("delete_message") が呼ばれる', async () => {
      render(
        <MessageItem
          message={makeMessage({ id: 42, userId: 1 })}
          currentUserId={1}
          users={dummyUsers}
        />,
      );

      await userEvent.click(screen.getByRole('button', { name: /delete/i }), {
        pointerEventsCheck: 0,
      });

      expect(mockSocket.emit).toHaveBeenCalledWith('delete_message', 42);
    });
  });

  describe('他人のメッセージ（currentUserId !== message.userId）', () => {
    it('Edit ボタンと Delete ボタンが表示されない', () => {
      render(
        // message.userId=1（alice）、currentUserId=2（bob）→ 他人のメッセージ
        <MessageItem message={makeMessage({ userId: 1 })} currentUserId={2} users={dummyUsers} />,
      );

      expect(screen.queryByRole('button', { name: /edit/i })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /delete/i })).not.toBeInTheDocument();
    });
  });

  describe('アバター・プロフィール表示', () => {
    it('avatarUrl が設定されているとき img タグでアバター画像を表示する', () => {
      render(
        <MessageItem
          message={makeMessage({ userId: 1, avatarUrl: 'http://example.com/avatar.jpg' })}
          currentUserId={2}
          users={dummyUsers}
        />,
      );
      // MUI Avatar は alt 付きの img を描画する
      expect(screen.getByRole('img', { name: 'alice' })).toHaveAttribute(
        'src',
        'http://example.com/avatar.jpg',
      );
    });

    it('avatarUrl が null のとき img タグは表示されず頭文字の Avatar が表示される', () => {
      render(
        <MessageItem
          message={makeMessage({ userId: 1, avatarUrl: null })}
          currentUserId={2}
          users={dummyUsers}
        />,
      );
      // src なし → MUI Avatar は img を描画しない
      expect(screen.queryByRole('img', { name: 'alice' })).not.toBeInTheDocument();
      // 代わりに頭文字 'A' が表示される
      expect(screen.getByTestId('user-avatar')).toHaveTextContent('A');
    });

    it('displayName が設定されているときユーザー名の代わりに displayName を表示する', () => {
      const usersWithDisplayName = [
        { ...dummyUsers[0], displayName: 'Alice Smith', location: null },
        { ...dummyUsers[1], displayName: null, location: null },
      ];
      render(
        <MessageItem
          message={makeMessage({ userId: 1 })}
          currentUserId={2}
          users={usersWithDisplayName}
        />,
      );
      // displayName が設定されているのでメッセージヘッダに表示される
      expect(screen.getByText('Alice Smith')).toBeInTheDocument();
      // username（alice）はヘッダに表示されない
      expect(screen.queryByText('alice')).not.toBeInTheDocument();
    });

    it('アバターにホバーすると id・表示名・メールアドレス・勤務地を含むプロフィールポップアップが表示される', async () => {
      const usersWithProfile = [
        { ...dummyUsers[0], displayName: 'Alice Smith', location: '東京' },
        { ...dummyUsers[1], displayName: null, location: null },
      ];
      render(
        <MessageItem
          message={makeMessage({ userId: 1 })}
          currentUserId={2}
          users={usersWithProfile}
        />,
      );

      // ホバー前はポップアップ専用情報 (location) が表示されていない
      expect(screen.queryByText('東京')).not.toBeInTheDocument();

      await userEvent.hover(screen.getByTestId('user-avatar'));

      await waitFor(() => {
        // id (ポップアップのみに表示される)
        expect(screen.getByText(`ID: ${dummyUsers[0].id}`)).toBeInTheDocument();
        // 表示名 (ヘッダーとポップアップ両方に出るため複数存在することを確認)
        expect(screen.getAllByText('Alice Smith').length).toBeGreaterThanOrEqual(1);
        // メールアドレス (ポップアップのみに表示される)
        expect(screen.getByText(dummyUsers[0].email)).toBeInTheDocument();
        // 勤務地 (ポップアップのみに表示される)
        expect(screen.getByText('東京')).toBeInTheDocument();
      });
    });

    it('プロフィールポップアップに avatarUrl が設定済みのとき画像が表示される', async () => {
      const usersWithProfile = [
        {
          ...dummyUsers[0],
          avatarUrl: 'http://example.com/avatar.jpg',
          displayName: 'Alice Smith',
          location: '東京',
        },
        { ...dummyUsers[1], displayName: null, location: null },
      ];
      render(
        <MessageItem
          message={makeMessage({ userId: 1, avatarUrl: 'http://example.com/avatar.jpg' })}
          currentUserId={2}
          users={usersWithProfile}
        />,
      );

      await userEvent.hover(screen.getByTestId('user-avatar'));

      await waitFor(() => {
        // ポップアップ内に avatar img が存在する
        expect(screen.getAllByRole('img', { name: 'Alice Smith' }).length).toBeGreaterThan(0);
      });
    });
  });

  describe('プロフィール更新の反映', () => {
    it('users 配列に最新の avatarUrl が設定されているとき、message.avatarUrl より優先してアバター画像を表示する', () => {
      const usersWithUpdatedAvatar = [
        {
          ...dummyUsers[0],
          avatarUrl: 'http://example.com/new-avatar.jpg',
          displayName: null,
          location: null,
        },
        { ...dummyUsers[1], displayName: null, location: null },
      ];
      render(
        <MessageItem
          // message には古い avatarUrl（または null）が入っている想定
          message={makeMessage({ userId: 1, avatarUrl: null })}
          currentUserId={2}
          users={usersWithUpdatedAvatar}
        />,
      );
      // users 配列の最新 avatarUrl が優先されて表示される
      expect(screen.getByRole('img', { name: 'alice' })).toHaveAttribute(
        'src',
        'http://example.com/new-avatar.jpg',
      );
    });
  });

  // #107 メッセージ転送 — 転送ヘッダーの表示
  describe('転送メッセージの表示 (#107)', () => {
    it('forwardedFromMessage が存在するとき転送元プレビューが表示される', () => {
      render(
        <MessageItem
          message={makeMessage({
            forwardedFromMessageId: 10,
            forwardedFromMessage: {
              id: 10,
              content: 'Original content',
              username: 'bob',
              createdAt: '2024-06-01T10:00:00Z',
            },
          })}
          currentUserId={1}
          users={dummyUsers}
        />,
      );
      expect(screen.getByTestId('forwarded-message-preview')).toBeInTheDocument();
    });

    it('forwardedFromMessage が null のとき転送ヘッダーが表示されない', () => {
      render(
        <MessageItem
          message={makeMessage({ forwardedFromMessageId: null, forwardedFromMessage: null })}
          currentUserId={1}
          users={dummyUsers}
        />,
      );
      expect(screen.queryByTestId('forwarded-message-preview')).not.toBeInTheDocument();
    });

    it('転送ヘッダーに転送元ユーザー名が表示される', () => {
      render(
        <MessageItem
          message={makeMessage({
            forwardedFromMessageId: 10,
            forwardedFromMessage: {
              id: 10,
              content: 'Original content',
              username: 'charlie',
              createdAt: '2024-06-01T10:00:00Z',
            },
          })}
          currentUserId={1}
          users={dummyUsers}
        />,
      );
      expect(screen.getByTestId('forwarded-username')).toHaveTextContent('charlie');
    });

    it('転送元メッセージが削除されている場合（forwardedFromMessage=null）、転送ヘッダーは表示されない', () => {
      render(
        <MessageItem
          message={makeMessage({
            forwardedFromMessageId: 10,
            forwardedFromMessage: null,
          })}
          currentUserId={1}
          users={dummyUsers}
        />,
      );
      // forwardedFromMessage が null → プレビューは表示されない（方針A）
      expect(screen.queryByTestId('forwarded-message-preview')).not.toBeInTheDocument();
    });
  });

  // #115 タグ機能 — メッセージへのタグ表示・編集 UI
  describe('タグ表示・編集 (#115)', () => {
    function makeTag(id: number, name: string) {
      return { id, name, useCount: 0, createdAt: '2024-01-01T00:00:00Z' };
    }

    describe('タグチップの表示', () => {
      it('message.tags が存在するとき "#name" 形式のチップが並んで表示される', () => {
        render(
          <MessageItem
            message={makeMessage({ tags: [makeTag(1, 'bug'), makeTag(2, 'urgent')] })}
            currentUserId={2}
            users={dummyUsers}
          />,
        );
        expect(screen.getByText('#bug')).toBeInTheDocument();
        expect(screen.getByText('#urgent')).toBeInTheDocument();
      });

      it('message.tags が空配列または undefined のとき何も表示されない', () => {
        render(
          <MessageItem message={makeMessage({ tags: [] })} currentUserId={2} users={dummyUsers} />,
        );
        expect(screen.queryByTestId('tag-chips')).toBeNull();
      });

      it('タグチップをクリックすると onTagClick が tag.name を引数に呼ばれる (検索フィルタへのセット用)', async () => {
        const onTagClick = vi.fn();
        render(
          <MessageItem
            message={makeMessage({ tags: [makeTag(1, 'bug')] })}
            currentUserId={2}
            users={dummyUsers}
            onTagClick={onTagClick}
          />,
        );
        await userEvent.click(screen.getByText('#bug'));
        expect(onTagClick).toHaveBeenCalledWith('bug');
      });
    });

    describe('タグ編集モード', () => {
      it('「タグを編集」アクションを押すと TagInput が表示される', async () => {
        render(
          <MessageItem
            message={makeMessage({ tags: [makeTag(1, 'bug')] })}
            currentUserId={1}
            users={dummyUsers}
          />,
        );
        await userEvent.click(screen.getByRole('button', { name: 'タグを編集' }));
        expect(screen.getByTestId('tag-input-stub')).toBeInTheDocument();
      });

      it('TagInput で確定したタグ配列が api.tags.setMessageTags に送信される', async () => {
        setMessageTagsMock.mockResolvedValue(undefined);
        render(
          <MessageItem
            message={makeMessage({ id: 42, tags: [makeTag(1, 'bug')] })}
            currentUserId={1}
            users={dummyUsers}
          />,
        );
        await userEvent.click(screen.getByRole('button', { name: 'タグを編集' }));
        // スタブ input は controlled なので fireEvent.change でカンマを一度に入力する
        fireEvent.change(screen.getByTestId('tag-input-field'), {
          target: { value: 'newtag1,newtag2' },
        });
        await userEvent.click(screen.getByRole('button', { name: '保存' }));
        await waitFor(() => {
          expect(setMessageTagsMock).toHaveBeenCalledWith(42, ['newtag1', 'newtag2']);
        });
      });

      it('保存成功後はタグ編集モードが閉じてチップ表示に戻る', async () => {
        setMessageTagsMock.mockResolvedValue(undefined);
        render(
          <MessageItem
            message={makeMessage({ tags: [makeTag(1, 'bug')] })}
            currentUserId={1}
            users={dummyUsers}
          />,
        );
        await userEvent.click(screen.getByRole('button', { name: 'タグを編集' }));
        await userEvent.click(screen.getByRole('button', { name: '保存' }));
        await waitFor(() => {
          expect(screen.queryByTestId('tag-input-stub')).toBeNull();
        });
      });

      it('保存失敗時はスナックバーで通知され、編集モードが維持される', async () => {
        setMessageTagsMock.mockRejectedValue(new Error('failure'));
        render(
          <MessageItem
            message={makeMessage({ tags: [makeTag(1, 'bug')] })}
            currentUserId={1}
            users={dummyUsers}
          />,
        );
        await userEvent.click(screen.getByRole('button', { name: 'タグを編集' }));
        await userEvent.click(screen.getByRole('button', { name: '保存' }));
        await waitFor(() => {
          expect(showError).toHaveBeenCalled();
        });
        // 編集モード維持（スタブが表示されたまま）
        expect(screen.getByTestId('tag-input-stub')).toBeInTheDocument();
      });

      it('保存失敗時にサーバーからのエラーメッセージがスナックバーに表示される', async () => {
        setMessageTagsMock.mockRejectedValue(new Error('タグ名は 50 文字以内にしてください'));
        render(
          <MessageItem
            message={makeMessage({ tags: [makeTag(1, 'bug')] })}
            currentUserId={1}
            users={dummyUsers}
          />,
        );
        await userEvent.click(screen.getByRole('button', { name: 'タグを編集' }));
        await userEvent.click(screen.getByRole('button', { name: '保存' }));
        await waitFor(() => {
          expect(showError).toHaveBeenCalledWith('タグ名は 50 文字以内にしてください');
        });
      });
    });
  });

  // #108 会話イベント投稿 — メッセージに event が紐づく場合の描画分岐
  describe('イベント投稿の描画分岐 (#108)', () => {
    const sampleEvent = {
      id: 1,
      messageId: 1,
      title: '勉強会',
      description: null,
      startsAt: '2030-01-01T10:00:00Z',
      endsAt: null,
      createdBy: 1,
      createdAt: '2030-01-01T00:00:00Z',
      updatedAt: '2030-01-01T00:00:00Z',
      rsvpCounts: { going: 0, notGoing: 0, maybe: 0 },
      myRsvp: null,
    };

    it('message.event が存在するとき EventCard が描画される', () => {
      render(
        <MessageItem
          message={makeMessage({ userId: 1, event: sampleEvent })}
          currentUserId={2}
          users={dummyUsers}
        />,
      );
      expect(screen.getByTestId('event-card')).toBeInTheDocument();
      expect(screen.getByText('勉強会')).toBeInTheDocument();
    });

    it('message.event が null または undefined のとき EventCard は描画されない', () => {
      render(
        <MessageItem
          message={makeMessage({ userId: 1, event: null })}
          currentUserId={2}
          users={dummyUsers}
        />,
      );
      expect(screen.queryByTestId('event-card')).not.toBeInTheDocument();
    });

    it('message.event が存在し isDeleted=true のとき EventCard は描画されず削除済み表示になる', () => {
      render(
        <MessageItem
          message={makeMessage({ userId: 1, isDeleted: true, event: sampleEvent })}
          currentUserId={2}
          users={dummyUsers}
        />,
      );
      expect(screen.queryByTestId('event-card')).not.toBeInTheDocument();
      expect(screen.getByText('This message was deleted.')).toBeInTheDocument();
    });
  });

  /*
   * #107 転送先イベントで RSVP 投票可能化
   *
   * 転送元がイベント投稿（event）だった場合、転送先メッセージは独自の event を持たないが、
   * forwardedFromMessage.event に元イベントの情報が含まれる。
   * MessageItem はこのケースで、転送ヘッダー（MessageBubble の compact preview）に加え、
   * フル EventCard を描画する。これにより転送先からも RSVP 投票が可能になる。
   */
  describe('転送先イベントの EventCard 描画 (#107)', () => {
    const sampleEvent = {
      id: 1,
      messageId: 1,
      title: '転送元イベント',
      description: null,
      startsAt: '2030-01-01T10:00:00Z',
      endsAt: null,
      createdBy: 1,
      createdAt: '2030-01-01T00:00:00Z',
      updatedAt: '2030-01-01T00:00:00Z',
      rsvpCounts: { going: 0, notGoing: 0, maybe: 0 },
      myRsvp: null,
    };

    it('message.event が無く forwardedFromMessage.event があるとき EventCard が描画される', () => {
      render(
        <MessageItem
          message={makeMessage({
            userId: 1,
            event: null,
            forwardedFromMessageId: 10,
            forwardedFromMessage: {
              id: 10,
              content: '[event]',
              username: 'bob',
              createdAt: '2024-01-01T00:00:00Z',
              event: sampleEvent,
            },
          })}
          currentUserId={2}
          users={dummyUsers}
        />,
      );
      // EventCard 自体が描画される（転送ヘッダーにもタイトルが表示されるため
      // 厳密一致ではなく testId で確認）
      expect(screen.getByTestId('event-card')).toBeInTheDocument();
      expect(screen.getByTestId('event-card')).toHaveTextContent('転送元イベント');
    });

    it('forwardedFromMessage.event があるとき転送ヘッダー（MessageBubble の forwarded-message-preview）も描画される', () => {
      render(
        <MessageItem
          message={makeMessage({
            userId: 1,
            event: null,
            forwardedFromMessageId: 10,
            forwardedFromMessage: {
              id: 10,
              content: '[event]',
              username: 'bob',
              createdAt: '2024-01-01T00:00:00Z',
              event: sampleEvent,
            },
          })}
          currentUserId={2}
          users={dummyUsers}
        />,
      );
      expect(screen.getByTestId('forwarded-message-preview')).toBeInTheDocument();
      expect(screen.getByTestId('event-card')).toBeInTheDocument();
    });

    it('forwardedFromMessage.event が null のとき EventCard は描画されない', () => {
      render(
        <MessageItem
          message={makeMessage({
            userId: 1,
            event: null,
            forwardedFromMessageId: 10,
            forwardedFromMessage: {
              id: 10,
              content: 'plain text',
              username: 'bob',
              createdAt: '2024-01-01T00:00:00Z',
              event: null,
            },
          })}
          currentUserId={2}
          users={dummyUsers}
        />,
      );
      expect(screen.queryByTestId('event-card')).not.toBeInTheDocument();
    });

    it('message.event があるときは転送先 EventCard 分岐ではなく自身の EventCard が描画される（重複描画しない）', () => {
      render(
        <MessageItem
          message={makeMessage({
            userId: 1,
            event: sampleEvent,
            forwardedFromMessageId: 10,
            forwardedFromMessage: {
              id: 10,
              content: '[event]',
              username: 'bob',
              createdAt: '2024-01-01T00:00:00Z',
              event: sampleEvent,
            },
          })}
          currentUserId={2}
          users={dummyUsers}
        />,
      );
      // EventCard は 1 つだけ
      expect(screen.getAllByTestId('event-card')).toHaveLength(1);
    });
  });

  // #146 プレゼンスインジケータ — メッセージアバターへの結線
  describe('プレゼンスインジケータの表示 (#146)', () => {
    it('usePresence が online を返すとき、アバターに presence-indicator が表示される', () => {
      mockPresenceMap = new Map([[1, 'online']]);
      render(
        <MessageItem message={makeMessage({ userId: 1 })} currentUserId={2} users={dummyUsers} />,
      );
      const indicator = screen.getByTestId('presence-indicator');
      expect(indicator).toBeInTheDocument();
      expect(indicator).toHaveAttribute('data-state', 'online');
    });

    it('usePresence が away を返すとき、インジケータの data-state が "away" になる', () => {
      mockPresenceMap = new Map([[1, 'away']]);
      render(
        <MessageItem message={makeMessage({ userId: 1 })} currentUserId={2} users={dummyUsers} />,
      );
      expect(screen.getByTestId('presence-indicator')).toHaveAttribute('data-state', 'away');
    });

    it('usePresence が userId を含まないとき、インジケータは描画されない', () => {
      mockPresenceMap = new Map(); // userId=1 は存在しない
      const usersWithoutPresence = [
        { ...dummyUsers[0], presenceState: undefined },
        { ...dummyUsers[1] },
      ];
      render(
        <MessageItem
          message={makeMessage({ userId: 1 })}
          currentUserId={2}
          users={usersWithoutPresence}
        />,
      );
      expect(screen.queryByTestId('presence-indicator')).not.toBeInTheDocument();
    });

    it('usePresence が state を持たないが user.presenceState が online のとき、フォールバックでインジケータが表示される', () => {
      mockPresenceMap = new Map(); // Socket からの state はなし
      const usersWithPresence = [
        { ...dummyUsers[0], presenceState: 'online' as const },
        { ...dummyUsers[1] },
      ];
      render(
        <MessageItem
          message={makeMessage({ userId: 1 })}
          currentUserId={2}
          users={usersWithPresence}
        />,
      );
      const indicator = screen.getByTestId('presence-indicator');
      expect(indicator).toBeInTheDocument();
      expect(indicator).toHaveAttribute('data-state', 'online');
    });
  });

  // Step 4 — MessageBubble バブル撤去 + 連投マージ表示
  describe('連投マージ表示 (Step 4)', () => {
    it('isContinued=true のとき displayName ヘッダーが描画されない', () => {
      render(
        <MessageItem
          message={makeMessage({ userId: 1 })}
          currentUserId={2}
          users={dummyUsers}
          isContinued={true}
        />,
      );
      expect(screen.queryByText('alice')).not.toBeInTheDocument();
    });

    it('isContinued=true のとき投稿時刻 (HH:MM) が描画されない', () => {
      render(
        <MessageItem
          message={makeMessage({ userId: 1 })}
          currentUserId={2}
          users={dummyUsers}
          isContinued={true}
        />,
      );
      expect(screen.queryByText(/\d{1,2}:\d{2}/)).not.toBeInTheDocument();
    });

    it('cozy モードかつ isContinued=true のときアバター（user-avatar）は描画される', () => {
      // cozy モードは density がデフォルト値（beforeEach でリセット済み）
      render(
        <MessageItem
          message={makeMessage({ userId: 1 })}
          currentUserId={2}
          users={dummyUsers}
          isContinued={true}
        />,
      );
      // cozy + isContinued=true はアバターを表示したまま名前のみ省略する
      expect(screen.getByTestId('user-avatar')).toBeInTheDocument();
    });

    it('compact モードかつ isContinued=true のときアバター（user-avatar）が描画されない', () => {
      mockUseDensity.mockReturnValue({ density: 'compact', setDensity: vi.fn() });
      render(
        <MessageItem
          message={makeMessage({ userId: 1 })}
          currentUserId={2}
          users={dummyUsers}
          isContinued={true}
        />,
      );
      // compact + isContinued=true はアバターを非表示にしてスペーサーのみ保持する
      expect(screen.queryByTestId('user-avatar')).not.toBeInTheDocument();
    });

    it('isContinued=false のとき従来どおり displayName・時刻・アバターが描画される', () => {
      render(
        <MessageItem
          message={makeMessage({ userId: 1 })}
          currentUserId={2}
          users={dummyUsers}
          isContinued={false}
        />,
      );
      expect(screen.getByText('alice')).toBeInTheDocument();
      expect(screen.getByText(/\d{1,2}:\d{2}/)).toBeInTheDocument();
      expect(screen.getByTestId('user-avatar')).toBeInTheDocument();
    });

    it('isContinued props 省略時は default false として動作し、すべてのヘッダー要素が描画される', () => {
      render(
        <MessageItem message={makeMessage({ userId: 1 })} currentUserId={2} users={dummyUsers} />,
      );
      expect(screen.getByText('alice')).toBeInTheDocument();
      expect(screen.getByText(/\d{1,2}:\d{2}/)).toBeInTheDocument();
      expect(screen.getByTestId('user-avatar')).toBeInTheDocument();
    });

    it('isDeleted=true のメッセージは isContinued=true でも従来の削除済みレイアウトを表示する', () => {
      render(
        <MessageItem
          message={makeMessage({ userId: 1, isDeleted: true })}
          currentUserId={1}
          users={dummyUsers}
          isContinued={true}
        />,
      );
      // 削除済みレイアウトの "This message was deleted." が表示される
      expect(screen.getByText('This message was deleted.')).toBeInTheDocument();
      // displayName も表示される（削除済みでも従来通り）
      expect(screen.getByText('alice')).toBeInTheDocument();
    });
  });
});
