import { List, ListItem, ListItemButton, ListItemText, Paper, Popper } from '@mui/material';
import type { User } from '@chat-app/shared';

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
          {visible.map((user, idx) => (
            <ListItem key={user.id} disablePadding>
              <ListItemButton
                selected={idx === selectedIdx}
                onMouseDown={(e) => {
                  e.preventDefault(); // keep editor focused
                  onSelect(user);
                }}
              >
                <ListItemText primary={`@${user.username}`} />
              </ListItemButton>
            </ListItem>
          ))}
        </List>
      </Paper>
    </Popper>
  );
}
