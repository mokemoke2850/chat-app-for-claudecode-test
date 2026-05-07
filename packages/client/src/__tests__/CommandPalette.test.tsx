/**
 * テスト対象: CommandPalette コンポーネント（新規作成予定）
 *
 * 戦略:
 *   - グローバルキーボードショートカット (Cmd+K / Ctrl+K) でモーダルの開閉を検証する
 *   - チャンネル・DM会話・ユーザー・コマンドの横断検索フィルタを検証する
 *   - キーボードナビゲーション（↑↓・Enter・Escape）の動作を検証する
 *   - api.channels.list / api.dm.listConversations / api.auth.users をモックでネットワーク通信を排除する
 *   - AppLayout など全体レイアウト内でショートカットが機能することを確認する
 */

import { describe, it } from 'vitest';

describe('CommandPalette', () => {
  describe('モーダルの開閉', () => {
    it.todo('Cmd+K でモーダルが開く（Mac）');
    it.todo('Ctrl+K でモーダルが開く（Windows/Linux）');
    it.todo('モーダルが開いている状態で Cmd+K を押すと閉じる');
    it.todo('Escape キーでモーダルを閉じる');
    it.todo('モーダル外のオーバーレイをクリックすると閉じる');
  });

  describe('入力フィルタリング', () => {
    it.todo('初期表示でチャンネル・DM・コマンドが統合表示される');
    it.todo('テキスト入力に応じてチャンネル名がリアルタイムでフィルタされる');
    it.todo('テキスト入力に応じてDM相手のユーザー名がリアルタイムでフィルタされる');
    it.todo('テキスト入力に応じてユーザー名がリアルタイムでフィルタされる');
    it.todo('テキスト入力に応じてコマンド名がリアルタイムでフィルタされる');
    it.todo('検索結果がゼロ件のとき「見つかりません」等の空状態が表示される');
  });

  describe('キーボードナビゲーション', () => {
    it.todo('↓ キーで次の候補が選択される');
    it.todo('↑ キーで前の候補が選択される');
    it.todo('リスト末尾で ↓ キーを押すと先頭に循環する');
    it.todo('リスト先頭で ↑ キーを押すと末尾に循環する');
    it.todo('Enter キーで選択中の項目が実行される');
  });

  describe('項目の選択・ジャンプ', () => {
    it.todo('チャンネルを選択すると /channels/:id に遷移してモーダルが閉じる');
    it.todo('DM会話を選択すると /dm?conv=N に遷移してモーダルが閉じる');
    it.todo('クリックでも項目を選択できる');
  });

  describe('メッセージ入力中のショートカット', () => {
    it.todo('テキストエリアにフォーカスがある状態でも Cmd+K でモーダルが開く');
    it.todo('モーダルを閉じた後、元の入力フォーカスが復元される');
  });

  describe('データ取得', () => {
    it.todo(
      'チャンネルと DM 会話のキャッシュ (getOrCreateChannelsPromise 等) を再利用し API を重複発行しない',
    );
  });
});
