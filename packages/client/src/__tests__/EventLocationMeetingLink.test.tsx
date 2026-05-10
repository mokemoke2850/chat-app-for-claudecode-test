/**
 * テスト対象: イベント詳細のロケーション／会議リンク機能 (#303)
 *
 * 対象コンポーネント:
 *   - components/Calendar/EventDialog.tsx — 場所・会議リンクフィールドの入力
 *   - components/Calendar/EventDetailDrawer.tsx — 場所・会議リンクの詳細表示
 *
 * 戦略:
 *   - api.calendar.events.create / events.update を vi.mock
 *   - 場所（location）は既存フィールド、会議リンク（meeting_url）は新規追加フィールド
 */

import { describe, it } from 'vitest';

describe('EventDialog — 場所・会議リンクフィールド', () => {
  describe('新規作成モード', () => {
    it.todo('「場所」テキストフィールドが表示される');
    it.todo('「会議リンク」URLフィールドが表示される');
    it.todo('場所・会議リンクともに未入力でもイベントを作成できる');
    it.todo('場所を入力してイベントを作成すると location が API に送信される');
    it.todo('会議リンクを入力してイベントを作成すると meeting_url が API に送信される');
    it.todo('場所と会議リンクの両方を入力してイベントを作成できる');
    it.todo('不正な形式のURLを会議リンクに入力しても送信はブロックされない（任意入力）');
  });

  describe('編集モード', () => {
    it.todo('既存イベントの location が「場所」フィールドに初期値として表示される');
    it.todo('既存イベントの meeting_url が「会議リンク」フィールドに初期値として表示される');
    it.todo('場所を変更して保存すると更新後の location が API に送信される');
    it.todo('会議リンクを変更して保存すると更新後の meeting_url が API に送信される');
    it.todo('場所・会議リンクをクリアして保存すると null が API に送信される');
  });
});

describe('EventDetailDrawer — 場所・会議リンクの表示', () => {
  describe('場所（location）の表示', () => {
    it.todo('location が設定されているイベントでは場所が表示される');
    it.todo('location が null のイベントでは場所フィールドが表示されない');
    it.todo('場所のテキストが正しく表示される');
  });

  describe('会議リンク（meeting_url）の表示', () => {
    it.todo('meeting_url が設定されているイベントでは会議リンクが表示される');
    it.todo('meeting_url が null のイベントでは会議リンクフィールドが表示されない');
    it.todo('会議リンクがクリッカブルなリンク（<a>タグ）として表示される');
    it.todo('会議リンクをクリックすると外部タブ（target="_blank"）で開く');
    it.todo('会議リンクに rel="noopener noreferrer" が設定されている');
  });

  describe('場所と会議リンクの組み合わせ', () => {
    it.todo('location と meeting_url の両方が設定されているとき両方表示される');
    it.todo('location のみ設定されているとき会議リンクは表示されない');
    it.todo('meeting_url のみ設定されているとき場所は表示されない');
  });
});
