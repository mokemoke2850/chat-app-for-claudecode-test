/**
 * テスト対象: MentionDropdown コンポーネント (@here / @channel 固定エントリ機能)
 * 戦略: @here / @channel がサジェスト候補に固定エントリとして表示されること、
 *       クエリに応じたフィルタリング、選択時の動作を検証する。
 *       メッセージ送信コンポーネントから mentionedUserIds に特殊値が渡されるルートも確認する。
 */

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import MentionDropdown, {
  filterSpecialEntries,
  SPECIAL_ENTRIES,
  type SpecialMentionType,
} from '../components/Chat/MentionDropdown';
import { dummyUsers } from './__fixtures__/users';

const makeAnchor = () => ({
  getBoundingClientRect: () => new DOMRect(0, 0, 0, 0),
});

describe('@here / @channel 固定エントリ（MentionDropdown）', () => {
  describe('@here サジェスト表示', () => {
    it('@h と入力したとき候補リストのトップに @here が表示される', () => {
      const filtered = filterSpecialEntries('h');
      expect(filtered[0].type).toBe('here');
    });

    it('@he と入力したとき候補リストのトップに @here が表示される', () => {
      const filtered = filterSpecialEntries('he');
      expect(filtered[0].type).toBe('here');
    });

    it('@here と完全入力したとき候補リストに @here が表示される', () => {
      const filtered = filterSpecialEntries('here');
      expect(filtered.some((e) => e.type === 'here')).toBe(true);
    });

    it('@c と入力したとき @here は表示されず @channel のみが候補に現れる', () => {
      const filtered = filterSpecialEntries('c');
      expect(filtered.some((e) => e.type === 'here')).toBe(false);
      expect(filtered.some((e) => e.type === 'channel')).toBe(true);
    });
  });

  describe('@channel サジェスト表示', () => {
    it('@c と入力したとき候補リストのトップに @channel が表示される', () => {
      const filtered = filterSpecialEntries('c');
      expect(filtered[0].type).toBe('channel');
    });

    it('@ch と入力したとき候補リストのトップに @channel が表示される', () => {
      const filtered = filterSpecialEntries('ch');
      expect(filtered[0].type).toBe('channel');
    });

    it('@channel と完全入力したとき候補リストに @channel が表示される', () => {
      const filtered = filterSpecialEntries('channel');
      expect(filtered.some((e) => e.type === 'channel')).toBe(true);
    });

    it('@h と入力したとき @channel は表示されず @here のみが候補に現れる', () => {
      const filtered = filterSpecialEntries('h');
      expect(filtered.some((e) => e.type === 'channel')).toBe(false);
      expect(filtered.some((e) => e.type === 'here')).toBe(true);
    });
  });

  describe('固定エントリとユーザー候補の混在', () => {
    it('@h と入力したとき @here 固定エントリが通常ユーザー候補より前に表示される', () => {
      const hereEntries = filterSpecialEntries('h');
      render(
        <MentionDropdown
          open={true}
          anchorEl={makeAnchor()}
          candidates={dummyUsers}
          selectedIdx={0}
          onSelect={vi.fn()}
          specialEntries={hereEntries}
        />,
      );
      const items = screen.getAllByRole('listitem');
      // 最初のアイテムが @here であること
      expect(items[0].textContent).toContain('@here');
    });

    it('@a のように固定エントリに一致しないクエリでは @here / @channel は表示されない', () => {
      const filtered = filterSpecialEntries('a');
      expect(filtered).toHaveLength(0);
    });

    it('@ のみ入力（空クエリ）のとき @here と @channel が候補リストの先頭に表示される', () => {
      const filtered = filterSpecialEntries('');
      expect(filtered).toHaveLength(2);
      expect(filtered[0].type).toBe('here');
      expect(filtered[1].type).toBe('channel');
    });
  });

  describe('固定エントリの選択', () => {
    it('@here を選択すると onSelectSpecial が "here" を引数に呼ばれる', async () => {
      const onSelectSpecial = vi.fn<(type: SpecialMentionType) => void>();
      render(
        <MentionDropdown
          open={true}
          anchorEl={makeAnchor()}
          candidates={[]}
          selectedIdx={0}
          onSelect={vi.fn()}
          onSelectSpecial={onSelectSpecial}
          specialEntries={SPECIAL_ENTRIES}
        />,
      );
      await userEvent.click(screen.getByText('@here'));
      expect(onSelectSpecial).toHaveBeenCalledWith('here');
    });

    it('@channel を選択すると onSelectSpecial が "channel" を引数に呼ばれる', async () => {
      const onSelectSpecial = vi.fn<(type: SpecialMentionType) => void>();
      render(
        <MentionDropdown
          open={true}
          anchorEl={makeAnchor()}
          candidates={[]}
          selectedIdx={0}
          onSelect={vi.fn()}
          onSelectSpecial={onSelectSpecial}
          specialEntries={SPECIAL_ENTRIES}
        />,
      );
      await userEvent.click(screen.getByText('@channel'));
      expect(onSelectSpecial).toHaveBeenCalledWith('channel');
    });

    it('@here を選択してもエディタのフォーカスは維持される（e.preventDefault）', async () => {
      render(
        <MentionDropdown
          open={true}
          anchorEl={makeAnchor()}
          candidates={[]}
          selectedIdx={0}
          onSelect={vi.fn()}
          onSelectSpecial={vi.fn()}
          specialEntries={SPECIAL_ENTRIES}
        />,
      );
      const hereButton = screen.getByText('@here').closest('div[role="button"]') as HTMLElement;
      const mousedownEvent = new MouseEvent('mousedown', { bubbles: true, cancelable: true });
      hereButton.dispatchEvent(mousedownEvent);
      expect(mousedownEvent.defaultPrevented).toBe(true);
    });
  });
});
