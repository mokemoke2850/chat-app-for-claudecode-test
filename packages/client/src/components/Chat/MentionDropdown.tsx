import { Box, List, ListItem, ListItemButton, ListItemText, Paper, Popper } from '@mui/material';
import type { User } from '@chat-app/shared';
import { useSocket } from '../../contexts/SocketContext';
import { usePresence } from '../../hooks/usePresence';
import PresenceIndicator from './PresenceIndicator';

interface VirtualElement {
  getBoundingClientRect: () => DOMRect;
}

interface Props {
  open: boolean;
  anchorEl: VirtualElement | null;
  candidates: User[];
  selectedIdx: number;
  onSelect: (user: User) => void;
}

export default function MentionDropdown({
  open,
  anchorEl,
  candidates,
  selectedIdx,
  onSelect,
}: Props) {
  const visible = candidates.slice(0, 8);
  const socket = useSocket();
  const presence = usePresence(socket);

  return (
    <Popper
      open={open && visible.length > 0}
      anchorEl={anchorEl}
      placement="bottom-start"
      style={{ zIndex: 1500 }}
      modifiers={[{ name: 'offset', options: { offset: [0, 4] } }]}
    >
      <Paper elevation={4} sx={{ minWidth: 160, maxHeight: 220, overflow: 'auto' }}>
        <List dense disablePadding>
          {visible.map((user, idx) => {
            const state = presence.get(user.id) ?? user.presenceState;
            return (
              <ListItem key={user.id} disablePadding>
                <ListItemButton
                  selected={idx === selectedIdx}
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
