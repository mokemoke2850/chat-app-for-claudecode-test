/**
 * キーボードショートカットカタログ (Issue #256)
 *
 * アプリ全体のショートカットを 1 箇所に集約する。
 * ShortcutHelpModal はこのカタログを読み込んでカテゴリ別に表示する。
 * 新しいショートカットを追加するときはここだけ編集すればよい。
 */

export interface ShortcutEntry {
  /** カテゴリ名（グループ見出し） */
  category: string;
  /** キー表記の配列（例: ['Cmd', 'K'] / ['?'] / ['j', 'k'] など） */
  keys: string[];
  /** ショートカットの説明文 */
  description: string;
}

export const SHORTCUTS: ShortcutEntry[] = [
  // ── ナビゲーション ────────────────────────────────────────────────
  {
    category: 'ナビゲーション',
    keys: ['Cmd', 'K'],
    description: 'コマンドパレットを開く（#255）',
  },
  {
    category: 'ナビゲーション',
    keys: ['?'],
    description: 'このショートカット一覧を表示する',
  },
  {
    category: 'ナビゲーション',
    keys: ['Cmd', '/'],
    description: 'このショートカット一覧を表示する（エディタ内でも有効）',
  },

  // ── メッセージ操作 ────────────────────────────────────────────────
  {
    category: 'メッセージ操作',
    keys: ['j', 'k'],
    description: 'メッセージリストを上下に移動する（#257）',
  },
  {
    category: 'メッセージ操作',
    keys: ['Enter'],
    description: 'フォーカス中のメッセージのスレッドを開く（#257）',
  },
  {
    category: 'メッセージ操作',
    keys: ['r'],
    description: 'フォーカス中のメッセージにリアクションする（#257）',
  },
  {
    category: 'メッセージ操作',
    keys: ['p'],
    description: 'フォーカス中のメッセージをピン留めする（#257）',
  },

  // ── エディタ・送信 ────────────────────────────────────────────────
  {
    category: 'エディタ・送信',
    keys: ['Enter'],
    description: 'メッセージを送信する',
  },
  {
    category: 'エディタ・送信',
    keys: ['Shift', 'Enter'],
    description: 'メッセージ内で改行する',
  },
];

/** カテゴリ一覧（表示順を保持） */
export const SHORTCUT_CATEGORIES: string[] = [...new Set(SHORTCUTS.map((s) => s.category))];
