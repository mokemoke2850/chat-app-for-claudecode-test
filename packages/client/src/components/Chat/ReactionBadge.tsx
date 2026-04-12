import { Box, Tooltip } from '@mui/material';
import type { Reaction, User } from '@chat-app/shared';

interface Props {
  reaction: Reaction;
  currentUserId: number;
  users: User[];
  onClick: (emoji: string) => void;
}

export default function ReactionBadge({ reaction, currentUserId, users, onClick }: Props) {
  const reacted = reaction.userIds.includes(currentUserId);

  const tooltipNames = reaction.userIds
    .map(
      (id) =>
        users.find((u) => u.id === id)?.displayName ??
        users.find((u) => u.id === id)?.username ??
        `User ${id}`,
    )
    .join(', ');

  return (
    <Tooltip title={tooltipNames} arrow>
      <Box
        component="button"
        data-testid="reaction-badge"
        data-reacted={reacted ? 'true' : 'false'}
        onClick={() => onClick(reaction.emoji)}
        sx={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 0.5,
          border: '1px solid',
          borderColor: reacted ? 'primary.main' : 'divider',
          bgcolor: reacted ? 'primary.50' : 'background.paper',
          borderRadius: 3,
          px: 0.75,
          py: 0.25,
          cursor: 'pointer',
          fontSize: '0.8rem',
          lineHeight: 1.4,
          fontWeight: reacted ? 600 : 400,
          '&:hover': { bgcolor: reacted ? 'primary.100' : 'action.hover' },
        }}
      >
        <span>{reaction.emoji}</span>
        <span>{reaction.count}</span>
      </Box>
    </Tooltip>
  );
}
