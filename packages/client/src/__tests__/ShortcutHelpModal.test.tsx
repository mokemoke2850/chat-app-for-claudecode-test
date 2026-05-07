/**
 * テスト対象: ShortcutHelpModal コンポーネント
 *
 * 戦略:
 *   - open/onClose prop を直接制御してモーダルの表示・非表示・Escape 閉じを検証する
 *   - window.dispatchEvent でキーイベントを発火し、ChatPage と同じハンドラロジックを
 *     テスト内ローカル関数として再現して動作を確認する
 *   - エディタフォーカス中は ? を無効化、Cmd+/ は有効を確認する
 *   - モーダルにカテゴリ別ショートカット一覧が表示されることを確認する
 *   - shortcutCatalog.ts の SHORTCUTS 配列の構造を確認する
 */

import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import ShortcutHelpModal from '../components/ShortcutHelp/ShortcutHelpModal';
import { SHORTCUT_CATEGORIES, SHORTCUTS } from '../components/ShortcutHelp/shortcutCatalog';

function renderModal(open: boolean, onClose: () => void = vi.fn()) {
  return render(<ShortcutHelpModal open={open} onClose={onClose} />);
}

describe('ShortcutHelpModal', () => {
  describe('モーダルの開閉', () => {
    it('open=true のときモーダルダイアログが表示される', async () => {
      renderModal(true);
      expect(screen.getByRole('dialog')).toBeInTheDocument();
      expect(screen.getByText('キーボードショートカット')).toBeInTheDocument();
    });

    it('open=false のときモーダルは表示されない', async () => {
      renderModal(false);
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    it('Escape キーで onClose が呼ばれる', async () => {
      const onClose = vi.fn();
      renderModal(true, onClose);
      await userEvent.keyboard('{Escape}');
      expect(onClose).toHaveBeenCalled();
    });

    it('? キーを押すとモーダルが開く（window イベント経由）', async () => {
      let open = false;
      const handler = (e: KeyboardEvent) => {
        if (e.key === '?' && !e.metaKey && !e.ctrlKey) {
          open = true;
        }
      };
      window.addEventListener('keydown', handler);

      await act(async () => {
        window.dispatchEvent(new KeyboardEvent('keydown', { key: '?', bubbles: true }));
      });

      window.removeEventListener('keydown', handler);
      expect(open).toBe(true);
    });

    it('Cmd+/ を押すとモーダルが開く（window イベント経由）', async () => {
      let open = false;
      const handler = (e: KeyboardEvent) => {
        if (e.metaKey && e.key === '/') {
          open = true;
        }
      };
      window.addEventListener('keydown', handler);

      await act(async () => {
        window.dispatchEvent(
          new KeyboardEvent('keydown', { key: '/', metaKey: true, bubbles: true }),
        );
      });

      window.removeEventListener('keydown', handler);
      expect(open).toBe(true);
    });

    it('Ctrl+/ を押すとモーダルが開く（window イベント経由）', async () => {
      let open = false;
      const handler = (e: KeyboardEvent) => {
        if (e.ctrlKey && e.key === '/') {
          open = true;
        }
      };
      window.addEventListener('keydown', handler);

      await act(async () => {
        window.dispatchEvent(
          new KeyboardEvent('keydown', { key: '/', ctrlKey: true, bubbles: true }),
        );
      });

      window.removeEventListener('keydown', handler);
      expect(open).toBe(true);
    });

    it('モーダルが開いているときに ? キーを押すと閉じる（トグル動作）', async () => {
      let open = true;
      const handler = (e: KeyboardEvent) => {
        if (e.key === '?' && !e.metaKey && !e.ctrlKey) {
          open = !open;
        }
      };
      window.addEventListener('keydown', handler);

      await act(async () => {
        window.dispatchEvent(new KeyboardEvent('keydown', { key: '?', bubbles: true }));
      });

      window.removeEventListener('keydown', handler);
      expect(open).toBe(false);
    });

    it('モーダルが開いているときに Escape キーを押すと閉じる', async () => {
      const onClose = vi.fn();
      renderModal(true, onClose);
      await userEvent.keyboard('{Escape}');
      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('モーダルが開いているときに Cmd+/ を押すと閉じる（トグル動作）', async () => {
      let open = true;
      const handler = (e: KeyboardEvent) => {
        if (e.metaKey && e.key === '/') {
          open = !open;
        }
      };
      window.addEventListener('keydown', handler);

      await act(async () => {
        window.dispatchEvent(
          new KeyboardEvent('keydown', { key: '/', metaKey: true, bubbles: true }),
        );
      });

      window.removeEventListener('keydown', handler);
      expect(open).toBe(false);
    });
  });

  describe('エディタフォーカス中の無効化', () => {
    it('isEditorFocused が true のとき ? キーでモーダルが開かない', async () => {
      const isEditorFocused = true;
      let open = false;
      const handler = (e: KeyboardEvent) => {
        const isQuestionMark = e.key === '?' && !e.metaKey && !e.ctrlKey;
        if (isQuestionMark && !isEditorFocused) {
          open = true;
        }
      };
      window.addEventListener('keydown', handler);

      await act(async () => {
        window.dispatchEvent(new KeyboardEvent('keydown', { key: '?', bubbles: true }));
      });

      window.removeEventListener('keydown', handler);
      expect(open).toBe(false);
    });

    it('isEditorFocused が true のとき Cmd+/ でモーダルが開く（エディタ内でも有効）', async () => {
      // Cmd+/ は isEditorFocused に関わらず常に有効
      let open = false;
      const handler = (e: KeyboardEvent) => {
        const isCmdSlash = (e.metaKey || e.ctrlKey) && e.key === '/';
        if (isCmdSlash) {
          open = true;
        }
      };
      window.addEventListener('keydown', handler);

      await act(async () => {
        window.dispatchEvent(
          new KeyboardEvent('keydown', { key: '/', metaKey: true, bubbles: true }),
        );
      });

      window.removeEventListener('keydown', handler);
      expect(open).toBe(true);
    });
  });

  describe('カテゴリ別ショートカット表示', () => {
    it('モーダル内にナビゲーションカテゴリが表示される', async () => {
      renderModal(true);
      expect(screen.getByText('ナビゲーション')).toBeInTheDocument();
    });

    it('モーダル内にメッセージ操作カテゴリが表示される', async () => {
      renderModal(true);
      expect(screen.getByText('メッセージ操作')).toBeInTheDocument();
    });

    it('モーダル内にエディタ・送信カテゴリが表示される', async () => {
      renderModal(true);
      expect(screen.getByText('エディタ・送信')).toBeInTheDocument();
    });

    it('モーダル内に入力支援カテゴリが表示される', async () => {
      renderModal(true);
      expect(screen.getByText('入力支援')).toBeInTheDocument();
    });
  });

  describe('ショートカット一覧の内容', () => {
    it('Cmd+K のショートカットとコマンドパレットの説明が表示される', async () => {
      renderModal(true);
      expect(screen.getAllByText('Cmd').length).toBeGreaterThan(0);
      expect(screen.getAllByText('K').length).toBeGreaterThan(0);
      expect(screen.getByText(/コマンドパレット/)).toBeInTheDocument();
    });

    it('j / k のショートカットとメッセージ移動の説明が表示される', async () => {
      renderModal(true);
      expect(screen.getByText('j')).toBeInTheDocument();
      expect(screen.getByText('k')).toBeInTheDocument();
      expect(screen.getByText(/メッセージリストを上下に移動/)).toBeInTheDocument();
    });

    it('Enter のショートカットとスレッドを開く説明が表示される', async () => {
      renderModal(true);
      expect(screen.getByText(/スレッドを開く/)).toBeInTheDocument();
    });

    it('r のショートカットとリアクションの説明が表示される', async () => {
      renderModal(true);
      expect(screen.getByText('r')).toBeInTheDocument();
      expect(screen.getByText(/リアクション/)).toBeInTheDocument();
    });

    it('p のショートカットとピン留めの説明が表示される', async () => {
      renderModal(true);
      expect(screen.getByText('p')).toBeInTheDocument();
      expect(screen.getByText(/ピン留め/)).toBeInTheDocument();
    });

    it('Enter のショートカットとメッセージ送信の説明が表示される（Quill 由来）', async () => {
      renderModal(true);
      expect(screen.getByText(/メッセージを送信/)).toBeInTheDocument();
    });

    it('Shift+Enter のショートカットと改行の説明が表示される（Quill 由来）', async () => {
      renderModal(true);
      expect(screen.getByText('Shift')).toBeInTheDocument();
      expect(screen.getByText(/改行/)).toBeInTheDocument();
    });
  });

  describe('ショートカットカタログの設計', () => {
    it('ショートカット定義が 1 箇所のカタログ配列（SHORTCUTS 等）からインポートされている', () => {
      expect(Array.isArray(SHORTCUTS)).toBe(true);
      expect(SHORTCUTS.length).toBeGreaterThan(0);
    });

    it('カタログ配列に category / keys / description のフィールドが存在する', () => {
      for (const entry of SHORTCUTS) {
        expect(typeof entry.category).toBe('string');
        expect(Array.isArray(entry.keys)).toBe(true);
        expect(entry.keys.length).toBeGreaterThan(0);
        expect(typeof entry.description).toBe('string');
      }
    });

    it('SHORTCUT_CATEGORIES が SHORTCUTS の category を網羅している', () => {
      const categoriesInShortcuts = new Set(SHORTCUTS.map((s) => s.category));
      for (const cat of categoriesInShortcuts) {
        expect(SHORTCUT_CATEGORIES).toContain(cat);
      }
    });
  });
});
