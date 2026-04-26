/**
 * components/Chat/MessageBubble.tsx のユニットテスト
 *
 * テスト対象: メッセージ本文エリアの描画
 *   - Quill Delta コンテンツの HTML 変換
 *   - 引用元メッセージプレビュー
 *   - 添付ファイル（画像・非画像）の表示
 *   - リアクションバッジリストの表示
 *   - 返信件数バッジの表示
 */

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import MessageBubble from '../components/Chat/MessageBubble';
import { makeMessage } from './__fixtures__/messages';
import { dummyUsers } from './__fixtures__/users';
import type { Reaction } from '@chat-app/shared';

const defaultProps = {
  message: makeMessage(),
  reactions: [] as Reaction[],
  currentUserId: 1,
  users: dummyUsers,
  isOwn: false,
  onReactionClick: vi.fn(),
  onOpenThread: vi.fn(),
};

describe('MessageBubble', () => {
  describe('本文レンダリング', () => {
    it('Quill Delta の ops を HTML として正しく描画する（bold, italic など）', () => {
      const content = JSON.stringify({
        ops: [{ insert: 'bold text', attributes: { bold: true } }, { insert: '\n' }],
      });
      render(<MessageBubble {...defaultProps} message={makeMessage({ content })} />);
      expect(screen.getByText('bold text').tagName).toBe('STRONG');
    });

    it('@メンションを含む ops をハイライト表示する', () => {
      const content = JSON.stringify({
        ops: [{ insert: { mention: { value: 'bob' } } }, { insert: '\n' }],
      });
      render(<MessageBubble {...defaultProps} message={makeMessage({ content })} />);
      expect(screen.getByText('@bob')).toBeInTheDocument();
    });

    it('content が不正な JSON のとき raw テキストとしてフォールバック表示する', () => {
      const rawContent = 'not a json string';
      render(<MessageBubble {...defaultProps} message={makeMessage({ content: rawContent })} />);
      expect(screen.getByText('not a json string')).toBeInTheDocument();
    });

    it('画像 op（insert.image）を img タグとして描画する', () => {
      const content = JSON.stringify({
        ops: [{ insert: { image: 'data:image/png;base64,abc123' } }],
      });
      render(<MessageBubble {...defaultProps} message={makeMessage({ content })} />);
      const img = screen.getByAltText('Attached image');
      expect(img).toHaveAttribute('src', 'data:image/png;base64,abc123');
    });

    it('color 属性を持つテキストをインラインスタイルの color で描画する', () => {
      const content = JSON.stringify({
        ops: [{ insert: 'colored text', attributes: { color: '#ff0000' } }],
      });
      render(<MessageBubble {...defaultProps} message={makeMessage({ content })} />);
      expect(screen.getByText('colored text')).toHaveStyle({ color: '#ff0000' });
    });

    it('background 属性を持つテキストをインラインスタイルの backgroundColor で描画する', () => {
      const content = JSON.stringify({
        ops: [{ insert: 'highlighted text', attributes: { background: '#ffff00' } }],
      });
      render(<MessageBubble {...defaultProps} message={makeMessage({ content })} />);
      expect(screen.getByText('highlighted text')).toHaveStyle({ backgroundColor: '#ffff00' });
    });
  });

  describe('引用メッセージプレビュー', () => {
    it('quotedMessage が存在するとき引用プレビューエリアを表示する', () => {
      const message = makeMessage({
        quotedMessage: {
          id: 10,
          content: 'quoted text',
          username: 'bob',
          createdAt: '2024-06-01T12:00:00Z',
        },
      });
      render(<MessageBubble {...defaultProps} message={message} />);
      expect(screen.getByTestId('quoted-message-preview')).toBeInTheDocument();
    });

    it('引用元のユーザー名と本文プレビューを表示する', () => {
      const message = makeMessage({
        quotedMessage: {
          id: 10,
          content: 'quoted text',
          username: 'bob',
          createdAt: '2024-06-01T12:00:00Z',
        },
      });
      render(<MessageBubble {...defaultProps} message={message} />);
      expect(screen.getByTestId('quoted-username')).toHaveTextContent('bob');
      expect(screen.getByTestId('quoted-content')).toHaveTextContent('quoted text');
    });

    it('quotedMessage.content が Quill Delta JSON のとき ops をプレーンテキストに変換して表示する', () => {
      const deltaContent = JSON.stringify({ ops: [{ insert: 'delta content\n' }] });
      const message = makeMessage({
        quotedMessage: {
          id: 10,
          content: deltaContent,
          username: 'bob',
          createdAt: '2024-06-01T12:00:00Z',
        },
      });
      render(<MessageBubble {...defaultProps} message={message} />);
      expect(screen.getByTestId('quoted-content')).toHaveTextContent('delta content');
    });

    it('quotedMessage.content が不正な JSON のとき raw テキストとしてフォールバック表示する', () => {
      const message = makeMessage({
        quotedMessage: {
          id: 10,
          content: 'raw text content',
          username: 'bob',
          createdAt: '2024-06-01T12:00:00Z',
        },
      });
      render(<MessageBubble {...defaultProps} message={message} />);
      expect(screen.getByTestId('quoted-content')).toHaveTextContent('raw text content');
    });

    it('quotedMessage が null のとき引用プレビューエリアを表示しない', () => {
      render(<MessageBubble {...defaultProps} message={makeMessage({ quotedMessage: null })} />);
      expect(screen.queryByTestId('quoted-message-preview')).not.toBeInTheDocument();
    });
  });

  describe('添付ファイル', () => {
    it('attachments が空のとき添付エリアを表示しない', () => {
      render(<MessageBubble {...defaultProps} message={makeMessage({ attachments: [] })} />);
      expect(screen.queryByTestId('message-attachments')).not.toBeInTheDocument();
    });

    it('mimeType が image/* の添付ファイルを img タグとして表示する', () => {
      const message = makeMessage({
        attachments: [
          {
            id: 1,
            url: '/img/photo.png',
            originalName: 'photo.png',
            size: 100,
            mimeType: 'image/png',
          },
        ],
      });
      render(<MessageBubble {...defaultProps} message={message} />);
      const img = screen.getByAltText('photo.png');
      expect(img.tagName).toBe('IMG');
    });

    it('非画像の添付ファイルをファイルアイコン付きリンクとして表示する', () => {
      const message = makeMessage({
        attachments: [
          {
            id: 1,
            url: '/files/doc.pdf',
            originalName: 'doc.pdf',
            size: 100,
            mimeType: 'application/pdf',
          },
        ],
      });
      render(<MessageBubble {...defaultProps} message={message} />);
      expect(screen.getByTestId('file-icon')).toBeInTheDocument();
      expect(screen.getByText('doc.pdf')).toBeInTheDocument();
    });

    it('画像添付ファイルのリンクは download 属性付きで originalName をファイル名として設定する', () => {
      const message = makeMessage({
        attachments: [
          {
            id: 1,
            url: '/img/photo.png',
            originalName: 'photo.png',
            size: 100,
            mimeType: 'image/png',
          },
        ],
      });
      render(<MessageBubble {...defaultProps} message={message} />);
      const link = screen.getByRole('link', { name: 'photo.png' });
      expect(link).toHaveAttribute('download', 'photo.png');
    });

    it('複数の添付ファイルをすべて表示する', () => {
      const message = makeMessage({
        attachments: [
          { id: 1, url: '/img/a.png', originalName: 'a.png', size: 100, mimeType: 'image/png' },
          {
            id: 2,
            url: '/files/b.pdf',
            originalName: 'b.pdf',
            size: 200,
            mimeType: 'application/pdf',
          },
        ],
      });
      render(<MessageBubble {...defaultProps} message={message} />);
      expect(screen.getByAltText('a.png')).toBeInTheDocument();
      expect(screen.getByText('b.pdf')).toBeInTheDocument();
    });
  });

  describe('リアクションバッジ', () => {
    it('reactions が空のときリアクションエリアを表示しない', () => {
      render(<MessageBubble {...defaultProps} reactions={[]} />);
      expect(screen.queryByTestId('reaction-badge')).not.toBeInTheDocument();
    });

    it('reactions の各絵文字に対して ReactionBadge を描画する', () => {
      const reactions: Reaction[] = [
        { emoji: '👍', count: 2, userIds: [1, 2] },
        { emoji: '❤️', count: 1, userIds: [3] },
      ];
      render(<MessageBubble {...defaultProps} reactions={reactions} />);
      expect(screen.getByText('👍')).toBeInTheDocument();
      expect(screen.getByText('❤️')).toBeInTheDocument();
    });

    it('リアクションバッジをクリックすると onReactionClick が対応する emoji を引数に呼ばれる', async () => {
      const onReactionClick = vi.fn();
      const reactions: Reaction[] = [{ emoji: '👍', count: 1, userIds: [2] }];
      render(
        <MessageBubble {...defaultProps} reactions={reactions} onReactionClick={onReactionClick} />,
      );
      await userEvent.click(screen.getByTestId('reaction-badge'));
      expect(onReactionClick).toHaveBeenCalledWith('👍');
    });
  });

  describe('転送ヘッダー（イベント概要描画）', () => {
    /**
     * #107 + #108 — イベント投稿の転送
     * 転送先メッセージの forwardedFromMessage.event があるとき、
     * 本文プレースホルダ（"[event]" 等）の代わりにイベント概要を描画する。
     */
    it('forwardedFromMessage.event があるときイベント概要エリアを表示する', () => {
      const message = makeMessage({
        forwardedFromMessageId: 10,
        forwardedFromMessage: {
          id: 10,
          content: '[event]',
          username: 'nakamura2',
          createdAt: '2026-04-20T03:00:00Z',
          event: {
            id: 5,
            messageId: 10,
            title: 'チームオフサイト',
            description: null,
            startsAt: '2026-05-01T09:00:00Z',
            endsAt: null,
            createdBy: 1,
            createdAt: '2026-04-20T03:00:00Z',
            updatedAt: '2026-04-20T03:00:00Z',
            rsvpCounts: { going: 0, notGoing: 0, maybe: 0 },
            myRsvp: null,
          },
        },
      });
      render(<MessageBubble {...defaultProps} message={message} />);
      expect(screen.getByTestId('forwarded-event-summary')).toBeInTheDocument();
    });

    it('イベント概要にタイトルが表示される', () => {
      const message = makeMessage({
        forwardedFromMessageId: 10,
        forwardedFromMessage: {
          id: 10,
          content: '[event]',
          username: 'nakamura2',
          createdAt: '2026-04-20T03:00:00Z',
          event: {
            id: 5,
            messageId: 10,
            title: 'チームオフサイト',
            description: null,
            startsAt: '2026-05-01T09:00:00Z',
            endsAt: null,
            createdBy: 1,
            createdAt: '2026-04-20T03:00:00Z',
            updatedAt: '2026-04-20T03:00:00Z',
            rsvpCounts: { going: 0, notGoing: 0, maybe: 0 },
            myRsvp: null,
          },
        },
      });
      render(<MessageBubble {...defaultProps} message={message} />);
      expect(screen.getByTestId('forwarded-event-title')).toHaveTextContent('チームオフサイト');
    });

    it('イベント概要に開始日時（📅 マーカー付き）が表示される', () => {
      const message = makeMessage({
        forwardedFromMessageId: 10,
        forwardedFromMessage: {
          id: 10,
          content: '[event]',
          username: 'nakamura2',
          createdAt: '2026-04-20T03:00:00Z',
          event: {
            id: 5,
            messageId: 10,
            title: 'チームオフサイト',
            description: null,
            startsAt: '2026-05-01T09:00:00Z',
            endsAt: null,
            createdBy: 1,
            createdAt: '2026-04-20T03:00:00Z',
            updatedAt: '2026-04-20T03:00:00Z',
            rsvpCounts: { going: 0, notGoing: 0, maybe: 0 },
            myRsvp: null,
          },
        },
      });
      render(<MessageBubble {...defaultProps} message={message} />);
      expect(screen.getByTestId('forwarded-event-start')).toHaveTextContent(/📅/);
    });

    it('forwardedFromMessage.event があるとき本文プレースホルダ（forwarded-content）は描画しない', () => {
      const message = makeMessage({
        forwardedFromMessageId: 10,
        forwardedFromMessage: {
          id: 10,
          content: '[event]',
          username: 'nakamura2',
          createdAt: '2026-04-20T03:00:00Z',
          event: {
            id: 5,
            messageId: 10,
            title: 'チームオフサイト',
            description: null,
            startsAt: '2026-05-01T09:00:00Z',
            endsAt: null,
            createdBy: 1,
            createdAt: '2026-04-20T03:00:00Z',
            updatedAt: '2026-04-20T03:00:00Z',
            rsvpCounts: { going: 0, notGoing: 0, maybe: 0 },
            myRsvp: null,
          },
        },
      });
      render(<MessageBubble {...defaultProps} message={message} />);
      expect(screen.queryByTestId('forwarded-content')).not.toBeInTheDocument();
    });

    it('forwardedFromMessage.event が無いとき従来どおり本文プレースホルダを表示する', () => {
      const message = makeMessage({
        forwardedFromMessageId: 10,
        forwardedFromMessage: {
          id: 10,
          content: 'plain text',
          username: 'bob',
          createdAt: '2026-04-20T03:00:00Z',
          event: null,
        },
      });
      render(<MessageBubble {...defaultProps} message={message} />);
      expect(screen.queryByTestId('forwarded-event-summary')).not.toBeInTheDocument();
      expect(screen.getByTestId('forwarded-content')).toHaveTextContent('plain text');
    });
  });

  describe('返信件数バッジ', () => {
    it('replyCount が 0 のとき返信バッジを表示しない', () => {
      render(<MessageBubble {...defaultProps} message={makeMessage({ replyCount: 0 })} />);
      expect(screen.queryByText(/件の返信/)).not.toBeInTheDocument();
    });

    it('replyCount > 0 のとき "{N}件の返信" バッジを表示する', () => {
      render(<MessageBubble {...defaultProps} message={makeMessage({ replyCount: 3 })} />);
      expect(screen.getByText(/3件の返信/)).toBeInTheDocument();
    });

    it('返信バッジをクリックすると onOpenThread が message.id を引数に呼ばれる', async () => {
      const onOpenThread = vi.fn();
      render(
        <MessageBubble
          {...defaultProps}
          message={makeMessage({ id: 42, replyCount: 2 })}
          onOpenThread={onOpenThread}
        />,
      );
      await userEvent.click(screen.getByText(/2件の返信/));
      expect(onOpenThread).toHaveBeenCalledWith(42);
    });
  });
});
