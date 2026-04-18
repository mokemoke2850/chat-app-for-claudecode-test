/**
 * components/Chat/QuotedMessageBanner.tsx のユニットテスト
 *
 * テスト対象: RichEditor 上部に表示される引用プレビューバナー
 *   - 引用元ユーザー名と本文プレビューの表示
 *   - Quill Delta JSON のプレーンテキスト変換
 *   - 引用クリアボタンの動作
 */

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import QuotedMessageBanner from '../components/Chat/QuotedMessageBanner';

const makeQuotedMessage = (overrides: Partial<{ id: number; content: string; username: string; createdAt: string }> = {}) => ({
  id: 1,
  content: 'plain text',
  username: 'bob',
  createdAt: '2024-06-01T12:00:00Z',
  ...overrides,
});

describe('QuotedMessageBanner', () => {
  describe('バナーの表示', () => {
    it('quotedMessage が存在するときバナーを表示する', () => {
      render(<QuotedMessageBanner quotedMessage={makeQuotedMessage()} onClearQuote={vi.fn()} />);
      expect(screen.getByTestId('quoted-message-preview')).toBeInTheDocument();
    });

    it('quotedMessage が null のときバナーを表示しない', () => {
      render(<QuotedMessageBanner quotedMessage={null} onClearQuote={vi.fn()} />);
      expect(screen.queryByTestId('quoted-message-preview')).not.toBeInTheDocument();
    });

    it('引用元ユーザー名を表示する', () => {
      render(<QuotedMessageBanner quotedMessage={makeQuotedMessage({ username: 'charlie' })} onClearQuote={vi.fn()} />);
      expect(screen.getByTestId('quoted-username')).toHaveTextContent('charlie');
    });
  });

  describe('本文プレビューの変換', () => {
    it('content が Quill Delta JSON のとき ops をプレーンテキストに変換して表示する', () => {
      const deltaContent = JSON.stringify({
        ops: [{ insert: 'hello from delta\n' }],
      });
      render(
        <QuotedMessageBanner
          quotedMessage={makeQuotedMessage({ content: deltaContent })}
          onClearQuote={vi.fn()}
        />,
      );
      expect(screen.getByTestId('quoted-content')).toHaveTextContent('hello from delta');
    });

    it('プレーンテキストは 100 文字に切り詰めて表示する', () => {
      const longText = 'a'.repeat(150);
      const deltaContent = JSON.stringify({ ops: [{ insert: longText + '\n' }] });
      render(
        <QuotedMessageBanner
          quotedMessage={makeQuotedMessage({ content: deltaContent })}
          onClearQuote={vi.fn()}
        />,
      );
      const content = screen.getByTestId('quoted-content').textContent ?? '';
      expect(content.length).toBeLessThanOrEqual(100);
    });

    it('content が不正な JSON のとき raw テキストとしてフォールバック表示する', () => {
      render(
        <QuotedMessageBanner
          quotedMessage={makeQuotedMessage({ content: 'not json' })}
          onClearQuote={vi.fn()}
        />,
      );
      expect(screen.getByTestId('quoted-content')).toHaveTextContent('not json');
    });
  });

  describe('引用クリア', () => {
    it('引用クリアボタンが "引用をクリア" aria-label で表示される', () => {
      render(<QuotedMessageBanner quotedMessage={makeQuotedMessage()} onClearQuote={vi.fn()} />);
      expect(screen.getByRole('button', { name: '引用をクリア' })).toBeInTheDocument();
    });

    it('引用クリアボタンをクリックすると onClearQuote が呼ばれる', async () => {
      const onClearQuote = vi.fn();
      render(<QuotedMessageBanner quotedMessage={makeQuotedMessage()} onClearQuote={onClearQuote} />);
      await userEvent.click(screen.getByRole('button', { name: '引用をクリア' }));
      expect(onClearQuote).toHaveBeenCalledTimes(1);
    });
  });
});
