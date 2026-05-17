/**
 * テスト対象: Rail コンポーネントの「アイコン + ラベル」常時表示モード (Issue #316)
 * 戦略:
 *   - 既存の Rail.test.tsx を変更せず、新機能の追加テストのみをこのファイルに集約する
 *   - 「アイコンのみ」モードと「アイコン + ラベル」モードの切り替えを検証する
 *   - localStorage への永続化（キー: rail.labelMode）を検証する
 *   - 既存の折り畳み（collapsed）モードとの共存を確認する
 *   - MemoryRouter でラップして react-router の NavLink を動作させる
 *   - AuthContext・useDmUnreadCount・useMentionUnreadCount・SidebarFooter はモックする
 */

import { render, screen, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import Rail from '../components/Layout/Rail';

vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => ({ user: mockUser }),
}));

vi.mock('../hooks/useDmUnreadCount', () => ({
  useDmUnreadCount: () => 0,
}));

vi.mock('../hooks/useMentionUnreadCount', () => ({
  useMentionUnreadCount: () => 0,
}));

vi.mock('../components/Layout/SidebarFooter', () => ({
  default: () => (
    <div data-testid="sidebar-footer-stub">
      <button aria-label="ステータスを設定">stub-status</button>
      <button aria-label="ダークモードに切り替える">stub-theme</button>
      <button aria-label="プロフィール設定">stub-profile</button>
      <button aria-label="ログアウト">stub-logout</button>
    </div>
  ),
}));

const mockUser = {
  id: 1,
  username: 'alice',
  email: 'alice@example.com',
  displayName: null as string | null,
  role: 'user' as 'user' | 'admin',
  location: null,
  avatarUrl: null,
  createdAt: '2024-01-01T00:00:00Z',
};

beforeEach(() => {
  mockUser.role = 'user';
  localStorage.clear();
});

afterEach(() => {
  localStorage.clear();
});

function renderRail(initialPath = '/') {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <Rail />
    </MemoryRouter>,
  );
}

describe('Rail ラベル表示モード (Issue #316)', () => {
  describe('表示モード切替ボタン', () => {
    it.todo('「アイコン + ラベル」モードに切り替えるボタンが存在する');
    it.todo('「アイコンのみ」モードに切り替えるボタンが存在する');
    it.todo('現在のモードに応じてボタンのラベルが変わる');
  });

  describe('アイコンのみモード（デフォルト）', () => {
    it.todo(
      'localStorage に rail.labelMode が存在しない場合、デフォルトは「アイコンのみ」モードになる',
    );
    it.todo('「アイコンのみ」モードでは各ナビ項目にテキストラベルが表示されない');
    it.todo('「アイコンのみ」モードでも Tooltip によるラベルは機能する（aria-label が存在する）');
  });

  describe('アイコン + ラベルモード', () => {
    it.todo('「アイコン + ラベル」モードでは各ナビ項目に日本語テキストラベルが表示される');
    it.todo('「アイコン + ラベル」モードで「受信箱」のテキストラベルが表示される');
    it.todo('「アイコン + ラベル」モードで「チャット」のテキストラベルが表示される');
    it.todo('「アイコン + ラベル」モードで「DM」のテキストラベルが表示される');
    it.todo('「アイコン + ラベル」モードで「カレンダー」のテキストラベルが表示される');
    it.todo('「アイコン + ラベル」モードで「タスク」のテキストラベルが表示される');
    it.todo('「アイコン + ラベル」モードで「ブックマーク」のテキストラベルが表示される');
    it.todo('「アイコン + ラベル」モードで「検索」のテキストラベルが表示される');
    it.todo('「アイコン + ラベル」モードで「テンプレート」のテキストラベルが表示される');
    it.todo('admin ロール時、「アイコン + ラベル」モードで「管理」のテキストラベルが表示される');
  });

  describe('localStorage への永続化', () => {
    it.todo('ラベルモードに切り替えると localStorage["rail.labelMode"] に "label" が保存される');
    it.todo(
      'アイコンのみモードに切り替えると localStorage["rail.labelMode"] に "icon" が保存される',
    );
    it.todo('localStorage["rail.labelMode"] が "label" の場合、再訪時にラベルモードで表示される');
    it.todo(
      'localStorage["rail.labelMode"] が "icon" の場合、再訪時にアイコンのみモードで表示される',
    );
    it.todo(
      'localStorage["rail.labelMode"] が不正な値の場合、デフォルト（アイコンのみ）にフォールバックする',
    );
  });

  describe('既存の折り畳みモードとの共存', () => {
    it.todo(
      'collapsed=true のとき、ラベルモードに設定していてもナビゲーションリンクは表示されない',
    );
    it.todo('collapsed=true から展開すると、保存されたラベルモードが復元される');
    it.todo('折り畳み状態の localStorage ("rail.collapsed") の挙動はラベルモードに影響されない');
  });

  describe('Rail 幅の変化', () => {
    it.todo('「アイコン + ラベル」モードでは Rail の幅がアイコンのみモードより広くなる');
    it.todo('「アイコンのみ」モードの Rail の幅は従来どおり 64px である');
  });
});
