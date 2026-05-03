import { Box, Tooltip } from '@mui/material';
import type { Reaction, User } from '@chat-app/shared';

interface Props {
  reaction: Reaction;
  currentUserId: number;
  users: User[];
  onClick: (emoji: string) => void;
}

// 22px ピル形状 + accent 色化を inline style で渡し、テストから値を読めるようにする
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
        style={{
          height: '22px',
          borderRadius: '11px',
          borderWidth: '1px',
          borderStyle: 'solid',
          borderColor: reacted ? 'var(--accent)' : 'var(--border)',
          background: reacted ? 'var(--accent-soft)' : 'var(--surface)',
          color: reacted ? 'var(--accent)' : 'var(--text-muted)',
          fontWeight: reacted ? 600 : 400,
        }}
        sx={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 0.5,
          px: 0.875,
          py: 0,
          cursor: 'pointer',
          fontSize: '0.72rem',
          lineHeight: 1,
          transition: 'background 0.1s, border-color 0.1s',
          '&:hover': { background: 'var(--surface-hover)' },
        }}
      >
        <span>{reaction.emoji}</span>
        <span>{reaction.count}</span>
      </Box>
    </Tooltip>
  );
}
