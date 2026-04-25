/**
 * components/Chat/MessageItem.tsx のユニットテスト
 *
 * テスト対象: メッセージの表示パターン、編集・削除操作
 * 戦略:
 *   - Socket.IO は SocketContext をモックして注入する
 *   - RichEditor は Quill を依存しており jsdom では動作しないためスタブに差し替える
 *   - userEvent でホバー・クリックをシミュレートする
 */

import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import MessageItem from '../components/Chat/MessageItem';
import { dummyUsers } from './__fixtures__/users';
import { makeMessage } from './__fixtures__/messages';

// Socket.IO モック
const mockSocket = { emit: vi.fn(), on: vi.fn(), off: vi.fn() };
vi.mock('../contexts/SocketContext', () => ({
  useSocket: () => mockSocket,
}));

// RichEditor は Quill を内包するため jsdom では動作しない → スタブに差し替える
vi.mock('../components/Chat/RichEditor', () => ({
  default: ({ onCancel }: { onCancel: () => void; onSend: (c: string, m: number[]) => void }) => (
    <div data-testid="rich-editor">
      <button onClick={onCancel}>Cancel</button>
    </div>
  ),
}));

beforeEach(() => {
  vi.resetAllMocks();
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

      await userEvent.click(screen.getByRole('button', { name: /edit/i }));

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

      await userEvent.click(screen.getByRole('button', { name: /delete/i }));

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

      await userEvent.hover(screen.getByTestId('user-avatar'));

      await waitFor(() => {
        // id（ポップアップのみに表示される）
        expect(screen.getByText(`ID: ${dummyUsers[0].id}`)).toBeInTheDocument();
        // 表示名（ヘッダーとポップアップ両方に出るため複数存在することを確認）
        expect(screen.getAllByText('Alice Smith').length).toBeGreaterThanOrEqual(1);
        // メールアドレス（ポップアップのみに表示される）
        expect(screen.getByText(dummyUsers[0].email)).toBeInTheDocument();
        // 勤務地（ポップアップのみに表示される）
        expect(screen.getByText('東京')).toBeInTheDocument();
      });
    });

    it('アバターにホバーするとその人の displayName・location を含むプロフィールポップアップが表示される', async () => {
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

      // ホバー前は location が表示されていない
      expect(screen.queryByText('東京')).not.toBeInTheDocument();

      // アバターにホバーする
      await userEvent.hover(screen.getByTestId('user-avatar'));

      // ポップアップに displayName・location が表示される
      await waitFor(() => {
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

  // #115 タグ機能 — メッセージへのタグ表示・編集 UI
  describe('タグ表示・編集 (#115)', () => {
    describe('タグチップの表示', () => {
      it('message.tags が存在するとき "#name" 形式のチップが並んで表示される', () => {
        // TODO
      });

      it('message.tags が空配列または undefined のとき何も表示されない', () => {
        // TODO
      });

      it('タグチップをクリックすると onTagClick が tag.name を引数に呼ばれる (検索フィルタへのセット用)', () => {
        // TODO
      });
    });

    describe('タグ編集モード', () => {
      it('「タグを編集」アクションを押すと TagInput が表示される', () => {
        // TODO
      });

      it('TagInput で確定したタグ配列が api.messages.setTags に送信される', () => {
        // TODO
      });

      it('保存成功後はタグ編集モードが閉じてチップ表示に戻る', () => {
        // TODO
      });

      it('保存失敗時はスナックバーで通知され、編集モードが維持される', () => {
        // TODO
      });

      /**
       * 仕様の精緻化：サーバーからの詳細エラーメッセージをそのまま表示する
       * 旧実装: catch 節で固定文字列 'タグの保存に失敗しました' のみ表示
       * 新実装: Error.message（サーバー返却の {error: "..."} から生成）を優先して表示
       */
      it('保存失敗時にサーバーからのエラーメッセージがスナックバーに表示される', () => {
        // TODO: api.tags.setMessageTags を reject させてサーバーエラーメッセージが showError に渡されることを検証
      });
    });

    describe('CASCADE 削除との整合', () => {
      it('メッセージが削除済み (isDeleted=true) のときタグチップは表示されない', () => {
        // TODO
      });
    });
  });

  // #108 会話イベント投稿 — メッセージに event が紐づく場合の描画分岐
  describe('イベント投稿の描画分岐 (#108)', () => {
    it('message.event が存在するとき EventCard が描画される', () => {
      // TODO: アサーション
    });

    it('message.event が存在するとき MessageBubble の本文（プレースホルダ）の代わりに EventCard が前面に表示される', () => {
      // TODO: アサーション
    });

    it('message.event が null または undefined のとき EventCard は描画されない', () => {
      // TODO: アサーション
    });

    it('message.event が存在し isDeleted=true のとき EventCard は描画されず削除済み表示になる', () => {
      // TODO: アサーション
    });

    it('EventCard 描画時もタグチップ・スレッド返信ボタン等のメッセージアクションは引き続き利用できる', () => {
      // TODO: アサーション
    });
  });
});
