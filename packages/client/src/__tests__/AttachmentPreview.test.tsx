/**
 * components/Chat/AttachmentPreview.tsx のユニットテスト
 *
 * テスト対象: RichEditor の添付ファイルプレビューリスト
 *   - 添付ファイル名の表示
 *   - 削除ボタンの動作
 *   - 複数ファイルの表示
 */

import { describe, it } from 'vitest';

describe('AttachmentPreview', () => {
  describe('プレビューリストの表示', () => {
    it('attachments が空のときリストを表示しない', () => {
      // TODO: implement
    });

    it('各添付ファイルの originalName を表示する', () => {
      // TODO: implement
    });

    it('複数の添付ファイルをすべて表示する', () => {
      // TODO: implement
    });
  });

  describe('削除ボタン', () => {
    it('各ファイルに "{originalName} を削除" aria-label の削除ボタンが存在する', () => {
      // TODO: implement
    });

    it('削除ボタンをクリックすると onRemove が対応するファイル ID を引数に呼ばれる', () => {
      // TODO: implement
    });

    it('削除後、そのファイルがリストから消える', () => {
      // TODO: implement
    });
  });
});
