/**
 * テスト対象: useMessageKeyNav カスタムフック（実装予定）
 *
 * 戦略:
 *   - j/k キーによるメッセージ間の移動ロジックをカスタムフックとして切り出す
 *   - renderHook + userEvent（または fireEvent）でキーイベントを発火してフォーカスインデックスを検証する
 *   - エディタフォーカス時の無効化は isEditorFocused フラグを注入して検証する
 *   - Enter / r / p などの操作キーはコールバックが呼ばれるかを検証する
 *   - MessageList.tsx への統合（ハイライト表示・スクロール追従）は MessageList テストで検証する
 */

import { describe, it } from 'vitest';

// ─────────────────────────────────────────
// useMessageKeyNav フック単体テスト
// ─────────────────────────────────────────
describe('useMessageKeyNav', () => {
  describe('j/k ナビゲーション', () => {
    it.todo('j キーを押すと次のメッセージへフォーカスが移動する');
    it.todo('k キーを押すと前のメッセージへフォーカスが移動する');
    it.todo('リスト末尾で j キーを押しても末尾より先へ進まない（境界値）');
    it.todo('リスト先頭で k キーを押しても 0 未満にならない（境界値）');
    it.todo('メッセージが空のときはフォーカスインデックスが変化しない');
  });

  describe('エディタフォーカス中の無効化', () => {
    it.todo('isEditorFocused が true のとき j キーを押してもフォーカスが移動しない');
    it.todo('isEditorFocused が true のとき k キーを押してもフォーカスが移動しない');
    it.todo('isEditorFocused が false のとき j/k が正常に動作する');
  });

  describe('Enter キー — スレッド展開', () => {
    it.todo('フォーカス中のメッセージで Enter を押すと onOpenThread が呼ばれる');
    it.todo(
      'フォーカスがない状態（focusedIndex が null）のとき Enter を押しても onOpenThread は呼ばれない',
    );
  });

  describe('r キー — リアクション', () => {
    it.todo('フォーカス中のメッセージで r キーを押すと onReact が呼ばれる');
    it.todo('エディタフォーカス中は r キーを押しても onReact は呼ばれない');
  });

  describe('p キー — ピン留め', () => {
    it.todo('フォーカス中のメッセージで p キーを押すと onPinMessage が呼ばれる');
    it.todo('エディタフォーカス中は p キーを押しても onPinMessage は呼ばれない');
  });

  describe('keydown リスナーのライフサイクル', () => {
    it.todo('マウント時に document に keydown リスナーが登録される');
    it.todo('アンマウント時に keydown リスナーが解除される');
  });
});

// ─────────────────────────────────────────
// MessageList への統合テスト（ハイライト・スクロール追従）
// ─────────────────────────────────────────
describe('MessageList — キーボードナビゲーション統合', () => {
  describe('フォーカスメッセージのハイライト表示', () => {
    it.todo('focusedMessageId と一致するメッセージに data-focused 属性が付与される');
    it.todo('focusedMessageId が変わると前の要素の data-focused が除去される');
  });

  describe('スクロール追従', () => {
    it.todo('フォーカスが変わったとき対象メッセージ要素の scrollIntoView が呼ばれる');
    it.todo('フォーカスが画面内に収まっている場合は不要な scrollIntoView が呼ばれない');
  });
});
