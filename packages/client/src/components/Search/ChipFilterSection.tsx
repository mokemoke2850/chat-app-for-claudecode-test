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
 * モジュールレベルキャッシュ。
 *
 * React 19 の concurrent モードでは、コミット前に同じコンポーネントが複数回
 * インスタンス化される場合があり、useState イニシャライザが多重実行されると
 * Promise.all 内の API が 3 種 × 多重 で大量に発行される。実環境では検索画面
 * 表示後 2 秒で /api/channels と /api/tags/suggestions が各 3000 回以上発行
 * されていた（リクエストループ）。ChannelList / SidebarDmList と同じく
 * モジュールレベルキャッシュで 1 回だけフェッチするように揃える。
 */
let _masterDataPromise: Promise<MasterData> | null = null;

function getOrCreateMasterDataPromise(): Promise<MasterData> {
  if (!_masterDataPromise) {
    _masterDataPromise = Promise.all([
      api.auth.users(),
      api.channels.list(),
      api.tags.suggestions('', 1000),
    ]).then(
      ([usersRes, channelsRes, tagsRes]: [
        { users: User[] },
        { channels: Channel[] },
        { suggestions: TagSuggestion[] },
      ]) => ({
        users: usersRes.users,
        channels: channelsRes.channels,
        tags: tagsRes.suggestions.map(suggestionToTag),
      }),
    );
  }
  return _masterDataPromise;
}

/** テスト用キャッシュリセット */
export function resetChipFilterMasterDataCache(): void {
  _masterDataPromise = null;
}

/**
 * ChipFilterInput の Suspense ラッパー。
 * 親 (SearchPage) の Suspense 内で `use(promise)` を解決し、純粋コンポーネント
 * ChipFilterInput にマスタデータ (users / channels / tags) を渡す責務分離パターン。
 *
 * このラッパーを別ファイルに切り出すことで SearchPage のテスト時に `vi.mock` で丸ごと
 * スタブ化でき、Suspense 解決を経由せずにテストできる。
 */
export default function ChipFilterSection({ value, onTextChange, onResolved }: Props) {
  const [promise] = useState<Promise<MasterData>>(() => getOrCreateMasterDataPromise());
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
