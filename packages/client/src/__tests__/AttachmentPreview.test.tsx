/**
 * components/Chat/AttachmentPreview.tsx のユニットテスト
 *
 * テスト対象: RichEditor の添付ファイルプレビューリスト
 *   - 添付ファイル名の表示
 *   - 削除ボタンの動作
 *   - 複数ファイルの表示
 */

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import AttachmentPreview from '../components/Chat/AttachmentPreview';

const makeAttachment = (overrides: Partial<{ id: number; originalName: string }> = {}) => ({
  id: 1,
  originalName: 'test.txt',
  ...overrides,
});

describe('AttachmentPreview', () => {
  describe('プレビューリストの表示', () => {
    it('attachments が空のときリストを表示しない', () => {
      const { container } = render(<AttachmentPreview attachments={[]} onRemove={vi.fn()} />);
      expect(container.firstChild).toBeNull();
    });

    it('各添付ファイルの originalName を表示する', () => {
      render(
        <AttachmentPreview
          attachments={[makeAttachment({ originalName: 'document.pdf' })]}
          onRemove={vi.fn()}
        />,
      );
      expect(screen.getByText('document.pdf')).toBeInTheDocument();
    });

    it('複数の添付ファイルをすべて表示する', () => {
      render(
        <AttachmentPreview
          attachments={[
            makeAttachment({ id: 1, originalName: 'file1.txt' }),
            makeAttachment({ id: 2, originalName: 'file2.png' }),
          ]}
          onRemove={vi.fn()}
        />,
      );
      expect(screen.getByText('file1.txt')).toBeInTheDocument();
      expect(screen.getByText('file2.png')).toBeInTheDocument();
    });
  });

  describe('削除ボタン', () => {
    it('各ファイルに "{originalName} を削除" aria-label の削除ボタンが存在する', () => {
      render(
        <AttachmentPreview
          attachments={[makeAttachment({ originalName: 'report.xlsx' })]}
          onRemove={vi.fn()}
        />,
      );
      expect(screen.getByRole('button', { name: 'report.xlsx を削除' })).toBeInTheDocument();
    });

    it('削除ボタンをクリックすると onRemove が対応するファイル ID を引数に呼ばれる', async () => {
      const onRemove = vi.fn();
      render(
        <AttachmentPreview
          attachments={[makeAttachment({ id: 42, originalName: 'delete-me.txt' })]}
          onRemove={onRemove}
        />,
      );
      await userEvent.click(screen.getByRole('button', { name: 'delete-me.txt を削除' }));
      expect(onRemove).toHaveBeenCalledWith(42);
    });

    it('削除後、そのファイルがリストから消える', async () => {
      const { rerender } = render(
        <AttachmentPreview
          attachments={[makeAttachment({ id: 1, originalName: 'removable.txt' })]}
          onRemove={vi.fn()}
        />,
      );
      expect(screen.getByText('removable.txt')).toBeInTheDocument();
      rerender(<AttachmentPreview attachments={[]} onRemove={vi.fn()} />);
      expect(screen.queryByText('removable.txt')).not.toBeInTheDocument();
    });
  });
});
