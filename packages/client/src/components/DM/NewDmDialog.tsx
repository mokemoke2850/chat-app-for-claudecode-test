import {
  Avatar,
  Dialog,
  DialogTitle,
  DialogContent,
  List,
  ListItemButton,
  ListItemAvatar,
  ListItemText,
  Typography,
} from '@mui/material';
import type { User } from '@chat-app/shared';

export interface NewDmDialogProps {
  open: boolean;
  users: User[];
  currentUserId: number;
  onClose: () => void;
  onSelect: (userId: number) => void;
}

export default function NewDmDialog({
  open,
  users,
  currentUserId,
  onClose,
  onSelect,
}: NewDmDialogProps) {
  const others = users.filter((u) => u.id !== currentUserId);

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle>新規ダイレクトメッセージ</DialogTitle>
      <DialogContent dividers sx={{ p: 0 }}>
        <List disablePadding>
          {others.map((u) => (
            <ListItemButton
              key={u.id}
              onClick={() => {
                onSelect(u.id);
                onClose();
              }}
            >
              <ListItemAvatar>
                <Avatar src={u.avatarUrl ?? undefined} sx={{ width: 32, height: 32 }}>
                  {u.username[0].toUpperCase()}
                </Avatar>
              </ListItemAvatar>
              <ListItemText
                primary={u.displayName ?? u.username}
                secondary={u.displayName ? `@${u.username}` : undefined}
              />
            </ListItemButton>
          ))}
          {others.length === 0 && (
            <Typography variant="body2" color="text.secondary" sx={{ p: 2, textAlign: 'center' }}>
              他のユーザーがいません
            </Typography>
          )}
        </List>
      </DialogContent>
    </Dialog>
  );
}
