import { Box, Avatar, Typography, Popover, Paper } from '@mui/material';
import LocationOnIcon from '@mui/icons-material/LocationOn';
import type { User } from '@chat-app/shared';
import { getAvatarColor } from '../../utils/avatarColor';

interface Props {
  user: User | undefined;
  displayName: string;
  anchorEl: HTMLElement | null;
  open: boolean;
  onClose: () => void;
}

export default function UserProfilePopover({
  user,
  displayName,
  anchorEl,
  open,
  onClose,
}: Props) {
  return (
    <Popover
      open={open}
      anchorEl={anchorEl}
      onClose={onClose}
      anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
      transformOrigin={{ vertical: 'top', horizontal: 'left' }}
      disableRestoreFocus
      sx={{ pointerEvents: 'none' }}
    >
      <Paper sx={{ p: 2, display: 'flex', gap: 1.5, alignItems: 'center', minWidth: 200 }}>
        <Avatar
          src={user?.avatarUrl ?? undefined}
          alt={displayName}
          sx={{
            width: 48,
            height: 48,
            ...(!user?.avatarUrl && { bgcolor: getAvatarColor(user?.email ?? '') }),
          }}
        >
          {displayName[0]?.toUpperCase()}
        </Avatar>
        <Box>
          <Typography variant="subtitle2" fontWeight="bold">
            {displayName}
          </Typography>
          {user && (
            <Typography variant="caption" color="text.secondary" display="block">
              {`ID: ${user.id}`}
            </Typography>
          )}
          {user?.email && (
            <Typography variant="caption" color="text.secondary" display="block">
              {user.email}
            </Typography>
          )}
          {user?.location && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <LocationOnIcon fontSize="small" color="action" />
              <Typography variant="body2" color="text.secondary">
                {user.location}
              </Typography>
            </Box>
          )}
        </Box>
      </Paper>
    </Popover>
  );
}
