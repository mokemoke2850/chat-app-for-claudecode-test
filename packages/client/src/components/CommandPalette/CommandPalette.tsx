/**
 * コマンドパレット (Issue #255)
 *
 * - Cmd+K / Ctrl+K でモーダルを開閉する（グローバルショートカットの登録は ChatPage 側で行う）
 * - チャンネル / DM 会話 / ユーザー / コマンドを統合表示し、入力でフィルタする
 * - ↑↓ キーで選択、Enter でジャンプ。先頭 / 末尾は循環ナビゲーション
 *
 * 設計メモ:
 *   - データは React 19 use() + Suspense で取得する
 *   - 本コンポーネントは独自モジュールキャッシュ (_promiseCache) を持ち、
 *     api.channels.list / api.dm.listConversations / api.auth.users を直接呼ぶ
 *     （ChannelList / SidebarDmList のキャッシュとは独立。プロダクションでは
 *      初回ロード時に互いがそれぞれ 1 度ずつ呼ぶだけのため、API 重複は最小限）
 *   - Escape は MUI Dialog の onClose に任せ、自前で keydown を捕捉しない
 *     （二重発火を避ける）
 */

import {
  use,
  useState,
  useMemo,
  useCallback,
  useRef,
  useEffect,
  Suspense,
  type KeyboardEvent,
} from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Dialog,
  DialogContent,
  Box,
  TextField,
  List,
  ListItemButton,
  ListItemText,
  ListItemIcon,
  Typography,
  CircularProgress,
  InputAdornment,
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import TagIcon from '@mui/icons-material/Tag';
import ChatBubbleOutlineIcon from '@mui/icons-material/ChatBubbleOutline';
import PersonOutlineIcon from '@mui/icons-material/PersonOutline';
import SettingsIcon from '@mui/icons-material/Settings';
import BookmarkIcon from '@mui/icons-material/Bookmark';
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth';
import TaskAltIcon from '@mui/icons-material/TaskAlt';
import InboxIcon from '@mui/icons-material/Inbox';
import type { Channel, User, DmConversationWithDetails } from '@chat-app/shared';
import { api } from '../../api/client';

// ─── モジュールキャッシュ ─────────────────────────────────────────
// React 19 concurrent モードで useState イニシャライザが多重実行されても
// API を 1 度しか発行しないようにするため、モジュールスコープに保持する。

let _channelsPromise: Promise<{ channels: Channel[] }> | null = null;
let _dmConvPromise: Promise<{ conversations: DmConversationWithDetails[] }> | null = null;
let _usersPromise: Promise<{ users: User[] }> | null = null;

function getChannelsPromise(): Promise<{ channels: Channel[] }> {
  if (!_channelsPromise) _channelsPromise = api.channels.list();
  return _channelsPromise;
}
function getDmConvPromise(): Promise<{ conversations: DmConversationWithDetails[] }> {
  if (!_dmConvPromise) _dmConvPromise = api.dm.listConversations();
  return _dmConvPromise;
}
function getUsersPromise(): Promise<{ users: User[] }> {
  if (!_usersPromise) _usersPromise = api.auth.users();
  return _usersPromise;
}

/** テスト用キャッシュリセット */
export function resetCommandPaletteCache(): void {
  _channelsPromise = null;
  _dmConvPromise = null;
  _usersPromise = null;
}

// ─── 項目の型定義 ─────────────────────────────────────────────

type PaletteItem =
  | { kind: 'channel'; id: number; label: string; channel: Channel }
  | { kind: 'dm'; id: number; label: string; conversation: DmConversationWithDetails }
  | { kind: 'user'; id: number; label: string; user: User }
  | { kind: 'command'; id: string; label: string; path: string; icon: React.ReactNode };

const COMMANDS: Array<{ id: string; label: string; path: string; icon: React.ReactNode }> = [
  { id: 'cmd-inbox', label: 'インボックスを開く', path: '/', icon: <InboxIcon fontSize="small" /> },
  {
    id: 'cmd-bookmarks',
    label: 'ブックマークを開く',
    path: '/bookmarks',
    icon: <BookmarkIcon fontSize="small" />,
  },
  {
    id: 'cmd-calendar',
    label: 'カレンダーを開く',
    path: '/calendar',
    icon: <CalendarMonthIcon fontSize="small" />,
  },
  {
    id: 'cmd-tasks',
    label: 'タスクボードを開く',
    path: '/tasks',
    icon: <TaskAltIcon fontSize="small" />,
  },
  {
    id: 'cmd-settings',
    label: '設定を開く',
    path: '/profile',
    icon: <SettingsIcon fontSize="small" />,
  },
];

// ─── 内部コンポーネント（use() を呼ぶため Suspense 内に配置） ──────

interface ContentProps {
  onClose: () => void;
}

function CommandPaletteContent({ onClose }: ContentProps) {
  // promise はモジュールキャッシュから取得。useMemo で安定化。
  const channelsPromise = useMemo(() => getChannelsPromise(), []);
  const dmPromise = useMemo(() => getDmConvPromise(), []);
  const usersPromise = useMemo(() => getUsersPromise(), []);

  const { channels } = use(channelsPromise);
  const { conversations } = use(dmPromise);
  const { users } = use(usersPromise);

  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const listRef = useRef<HTMLUListElement | null>(null);

  // 全項目を統合（チャンネル → DM → ユーザー → コマンド の順）
  const allItems = useMemo<PaletteItem[]>(() => {
    const items: PaletteItem[] = [];
    for (const ch of channels) {
      items.push({ kind: 'channel', id: ch.id, label: ch.name, channel: ch });
    }
    for (const conv of conversations) {
      const name = conv.otherUser.displayName || conv.otherUser.username;
      items.push({ kind: 'dm', id: conv.id, label: name, conversation: conv });
    }
    for (const u of users) {
      const name = u.displayName || u.username;
      items.push({ kind: 'user', id: u.id, label: name, user: u });
    }
    for (const cmd of COMMANDS) {
      items.push({ kind: 'command', id: cmd.id, label: cmd.label, path: cmd.path, icon: cmd.icon });
    }
    return items;
  }, [channels, conversations, users]);

  // 入力クエリでフィルタ
  const filteredItems = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return allItems;
    return allItems.filter((it) => it.label.toLowerCase().includes(q));
  }, [allItems, query]);

  // クエリが変わるたびに先頭にリセット
  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  const handleExecute = useCallback(
    (item: PaletteItem) => {
      switch (item.kind) {
        case 'channel':
          navigate(`/chat?channel=${item.id}`);
          break;
        case 'dm':
          navigate(`/dm?conv=${item.id}`);
          break;
        case 'user':
          // ユーザーを選んだら DM 画面で対象ユーザーを指定（ユーザーIDで遷移）
          navigate(`/dm?user=${item.id}`);
          break;
        case 'command':
          navigate(item.path);
          break;
      }
      onClose();
    },
    [navigate, onClose],
  );

  // ↑↓ Enter のキーハンドリング（Escape は Dialog onClose に委譲）
  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLDivElement>) => {
      if (filteredItems.length === 0) return;
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex((i) => (i + 1) % filteredItems.length);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex((i) => (i - 1 + filteredItems.length) % filteredItems.length);
      } else if (e.key === 'Enter') {
        e.preventDefault();
        const target = filteredItems[selectedIndex] ?? filteredItems[0];
        if (target) handleExecute(target);
      }
    },
    [filteredItems, selectedIndex, handleExecute],
  );

  // 選択中項目をスクロールビューに保つ
  useEffect(() => {
    const list = listRef.current;
    if (!list) return;
    const el = list.querySelector<HTMLElement>(`[data-palette-index="${selectedIndex}"]`);
    if (el && typeof el.scrollIntoView === 'function') {
      el.scrollIntoView({ block: 'nearest' });
    }
  }, [selectedIndex]);

  return (
    <Box onKeyDown={handleKeyDown}>
      <Box sx={{ p: 1.5, borderBottom: 1, borderColor: 'divider' }}>
        <TextField
          autoFocus
          fullWidth
          size="small"
          variant="outlined"
          placeholder="チャンネル / DM / ユーザー / コマンドを検索..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon fontSize="small" />
              </InputAdornment>
            ),
          }}
        />
      </Box>

      {filteredItems.length === 0 ? (
        <Box sx={{ p: 4, textAlign: 'center', color: 'text.secondary' }}>
          <Typography variant="body2">見つかりませんでした</Typography>
        </Box>
      ) : (
        <List ref={listRef} role="listbox" dense sx={{ maxHeight: 360, overflowY: 'auto', py: 0 }}>
          {filteredItems.map((item, idx) => {
            const selected = idx === selectedIndex;
            return (
              <ListItemButton
                key={`${item.kind}-${item.id}`}
                role="option"
                aria-selected={selected}
                selected={selected}
                onClick={() => handleExecute(item)}
                onMouseEnter={() => setSelectedIndex(idx)}
                data-palette-index={idx}
                sx={{ py: 0.75 }}
              >
                <ListItemIcon sx={{ minWidth: 32 }}>
                  {item.kind === 'channel' && <TagIcon fontSize="small" />}
                  {item.kind === 'dm' && <ChatBubbleOutlineIcon fontSize="small" />}
                  {item.kind === 'user' && <PersonOutlineIcon fontSize="small" />}
                  {item.kind === 'command' && item.icon}
                </ListItemIcon>
                <ListItemText
                  primary={item.label}
                  secondary={
                    item.kind === 'channel'
                      ? 'チャンネル'
                      : item.kind === 'dm'
                        ? 'DM'
                        : item.kind === 'user'
                          ? 'ユーザー'
                          : 'コマンド'
                  }
                />
              </ListItemButton>
            );
          })}
        </List>
      )}
    </Box>
  );
}

// ─── 公開コンポーネント ───────────────────────────────────────────

export interface CommandPaletteProps {
  open: boolean;
  onClose: () => void;
}

export default function CommandPalette({ open, onClose }: CommandPaletteProps) {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      fullWidth
      maxWidth="sm"
      PaperProps={{ sx: { mt: 8, alignSelf: 'flex-start' } }}
    >
      <DialogContent sx={{ p: 0 }}>
        <Suspense
          fallback={
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
              <CircularProgress size={24} />
            </Box>
          }
        >
          {open && <CommandPaletteContent onClose={onClose} />}
        </Suspense>
      </DialogContent>
    </Dialog>
  );
}
