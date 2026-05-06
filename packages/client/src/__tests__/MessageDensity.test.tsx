// テスト対象: DensityContext / MessageItem / MessageList / ProfilePage（表示密度セクション）
// 戦略: 密度モード（cozy/compact）の切替・永続化・CSS変数適用・UI を複数コンポーネントにまたがって検証する
// 対象ソースファイルが DensityContext・MessageItem・MessageList・ProfilePage と複数にまたがるため独立ファイルとして作成

import { describe, it } from 'vitest';

describe('メッセージ密度切替機能', () => {
  describe('DensityContext', () => {
    it.todo('初期値は cozy になる');
    it.todo('setDensity("compact") を呼ぶと density が compact に変わる');
    it.todo('setDensity("cozy") を呼ぶと density が cozy に戻る');
    it.todo('Provider 外で useDensity を呼ぶとエラーをスローする');
  });

  describe('localStorage 永続化', () => {
    it.todo('compact に切り替えると localStorage に "compact" が保存される');
    it.todo('cozy に切り替えると localStorage に "cozy" が保存される');
    it.todo('localStorage に不正な値がある場合はデフォルトの cozy になる');
  });

  describe('初期表示時の復元', () => {
    it.todo('localStorage に "compact" が保存されていれば初期値が compact になる');
    it.todo('localStorage に "cozy" が保存されていれば初期値が cozy になる');
    it.todo('localStorage が空の場合は cozy がデフォルトになる');
  });

  describe('compact モード時の CSS 変数適用', () => {
    it.todo('compact モードのとき document.documentElement に data-density="compact" が付与される');
    it.todo('cozy モードのとき document.documentElement に data-density="cozy" が付与される');
  });

  describe('連投時の名前省略強化（compact モード）', () => {
    it.todo('compact モードかつ isContinued=true のとき送信者名が表示されない');
    it.todo('cozy モードかつ isContinued=true のとき送信者名が表示されない（既存動作を変えない）');
    it.todo('compact モードかつ isContinued=false のとき送信者名が表示される');
  });

  describe('設定 UI（ProfilePage 表示密度セクション）', () => {
    it.todo('ProfilePage に「表示密度」セクションが表示される');
    it.todo('"快適" ラジオボタンを選択すると density が cozy になる');
    it.todo('"コンパクト" ラジオボタンを選択すると density が compact になる');
    it.todo('現在の density に応じたラジオボタンが選択済み状態になる');
  });
});
