import { Box, List, ListItem, ListItemButton, ListItemText, Paper, Popper } from '@mui/material';
import type { User } from '@chat-app/shared';
import { useSocket } from '../../contexts/SocketContext';
import { usePresence } from '../../hooks/usePresence';
import PresenceIndicator from './PresenceIndicator';

interface VirtualElement {
  getBoundingClientRect: () => DOMRect;
}

/** @here / @channel などの特殊メンション種別 */
export type SpecialMentionType = 'here' | 'channel';

/** 特殊固定エントリ */
export interface SpecialEntry {
  type: SpecialMentionType;
  label: string;
  description: string;
}

/** サジェスト候補に表示する固定エントリ定義 */
export const SPECIAL_ENTRIES: SpecialEntry[] = [
  { type: 'here', label: '@here', description: 'オンライン中の全員に通知' },
  { type: 'channel', label: '@channel', description: 'チャンネルメンバー全員に通知' },
];

/**
 * クエリに一致する特殊エントリを返す。
 * 空クエリのときは全件、クエリがあるときは前方一致でフィルタリングする。
 */
export function filterSpecialEntries(query: string): SpecialEntry[] {
  if (!query) return SPECIAL_ENTRIES;
  const q = query.toLowerCase();
  return SPECIAL_ENTRIES.filter((e) => e.type.startsWith(q));
}

interface Props {
  open: boolean;
  anchorEl: VirtualElement | null;
  candidates: User[];
  selectedIdx: number;
  onSelect: (user: User) => void;
  /** 特殊エントリ（@here / @channel）が選択されたときのコールバック */
  onSelectSpecial?: (type: SpecialMentionType) => void;
  /** 表示する特殊固定エントリ（省略時は candidates のみ表示） */
  specialEntries?: SpecialEntry[];
}

export default function MentionDropdown({
  open,
  anchorEl,
  candidates,
  selectedIdx,
  onSelect,
  onSelectSpecial,
  specialEntries = [],
}: Props) {
  const socket = useSocket();
  const presence = usePresence(socket);

  const specialVisible = specialEntries.slice(0, 8);
  // 特殊エントリの分だけ selectedIdx を調整
  const adjustedIdx = selectedIdx - specialVisible.length;
  const userVisible = candidates.slice(0, Math.max(0, 8 - specialVisible.length));

  const hasItems = specialVisible.length > 0 || userVisible.length > 0;

  return (
    <Popper
      open={open && hasItems}
      anchorEl={anchorEl}
      placement="bottom-start"
      style={{ zIndex: 1500 }}
      modifiers={[{ name: 'offset', options: { offset: [0, 4] } }]}
    >
      <Paper elevation={4} sx={{ minWidth: 160, maxHeight: 220, overflow: 'auto' }}>
        <List dense disablePadding>
          {specialVisible.map((entry, idx) => (
            <ListItem key={`special-${entry.type}`} disablePadding>
              <ListItemButton
                selected={idx === selectedIdx}
                onMouseDown={(e) => {
                  e.preventDefault(); // keep editor focused
                  onSelectSpecial?.(entry.type);
                }}
              >
                <ListItemText
                  primary={entry.label}
                  secondary={entry.description}
                  secondaryTypographyProps={{ sx: { fontSize: '0.7rem' } }}
                />
              </ListItemButton>
            </ListItem>
          ))}
          {userVisible.map((user, idx) => {
            const state = presence.get(user.id) ?? user.presenceState;
            return (
              <ListItem key={user.id} disablePadding>
                <ListItemButton
                  selected={idx === adjustedIdx}
                  onMouseDown={(e) => {
                    e.preventDefault(); // keep editor focused
                    onSelect(user);
                  }}
                >
                  <Box
                    sx={{
                      position: 'relative',
                      width: 16,
                      height: 16,
                      mr: 1,
                      flexShrink: 0,
                    }}
                  >
                    <PresenceIndicator state={state} size={8} />
                  </Box>
                  <ListItemText primary={`@${user.username}`} />
                  {user.status && (
                    <Box
                      data-testid="user-status"
                      sx={{ display: 'flex', alignItems: 'center', gap: 0.25, ml: 0.5 }}
                    >
                      {user.status.emoji && (
                        <span style={{ fontSize: '0.9rem', lineHeight: 1 }}>
                          {user.status.emoji}
                        </span>
                      )}
                      {user.status.text && (
                        <span style={{ fontSize: '0.75rem', color: 'inherit', opacity: 0.7 }}>
                          {user.status.text}
                        </span>
                      )}
                    </Box>
                  )}
                </ListItemButton>
              </ListItem>
            );
          })}
        </List>
      </Paper>
    </Popper>
  );
}
