import { use, useState } from 'react';
import { api } from '../../api/client';
import type { User, Channel, Tag, TagSuggestion } from '@chat-app/shared';
import ChipFilterInput from './ChipFilterInput';
import type { SearchFilters } from '../Chat/SearchFilterPanel';

function suggestionToTag(s: TagSuggestion): Tag {
  return { id: s.id, name: s.name, useCount: s.useCount, createdAt: '' };
}

interface Props {
  value: string;
  onTextChange: (text: string) => void;
  onResolved: (params: { keyword: string; filters: Partial<SearchFilters> }) => void;
}

interface MasterData {
  users: User[];
  channels: Channel[];
  tags: Tag[];
}

/**
 * Step 7c-1: ChipFilterInput の Suspense ラッパー。
 *
 * 親 (SearchPage) の Suspense 内で `use(promise)` を解決し、純粋コンポーネント
 * ChipFilterInput にマスタデータ (users / channels / tags) を渡す責務分離パターン。
 *
 * Step 7b で確立した「Suspense ラッパーは別ファイルに切り出す」パターンを踏襲し、
 * SearchPage のテスト時に `vi.mock` で丸ごとスタブ化できるようにする。
 */
export default function ChipFilterSection({ value, onTextChange, onResolved }: Props) {
  const [promise] = useState<Promise<MasterData>>(() =>
    Promise.all([api.auth.users(), api.channels.list(), api.tags.suggestions('', 1000)]).then(
      ([usersRes, channelsRes, tagsRes]: [
        { users: User[] },
        { channels: Channel[] },
        { suggestions: TagSuggestion[] },
      ]) => ({
        users: usersRes.users,
        channels: channelsRes.channels,
        tags: tagsRes.suggestions.map(suggestionToTag),
      }),
    ),
  );
  const { users, channels, tags } = use(promise);

  return (
    <ChipFilterInput
      value={value}
      onTextChange={onTextChange}
      onResolved={onResolved}
      users={users}
      channels={channels}
      tags={tags}
    />
  );
}
