import {
  Avatar,
  Badge,
  Box,
  ListItem,
  ListItemAvatar,
  ListItemButton,
  ListItemText,
  Typography,
} from '@mui/material';
import type { DmConversationWithDetails, PresenceState } from '@chat-app/shared';
import PresenceIndicator from '../Chat/PresenceIndicator';

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleString('ja-JP', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

interface Props {
  conversation: DmConversationWithDetails;
  /**
   * `expanded`: DMPage 用。32px avatar + presence + lastMessage プレビュー + 時刻
   * `compact`: Sidebar 用。24px avatar + 名前のみ
   */
  variant: 'expanded' | 'compact';
  isActive?: boolean;
  presenceState?: PresenceState;
  onClick: () => void;
}

/**
 * Step 8e-4: DmConversationList と SidebarDmList の共通行コンポーネント。
 * variant で密度・プレビュー有無を切り替える。
 */
export default function DmListRow({
  conversation: conv,
  variant,
  isActive = false,
  presenceState,
  onClick,
}: Props) {
  const isExpanded = variant === 'expanded';
  const avatarSize = isExpanded ? 32 : 24;
  const avatarMinWidth = isExpanded ? 40 : 32;
  const showPreview = isExpanded;

  return (
    <ListItem disablePadding>
      <ListItemButton
        selected={isActive}
        onClick={onClick}
        style={isExpanded ? undefined : { minHeight: 28, paddingTop: 0, paddingBottom: 0 }}
      >
        <ListItemAvatar sx={{ minWidth: avatarMinWidth }}>
          <Badge
            badgeContent={conv.unreadCount > 0 ? conv.unreadCount : undefined}
            color="error"
            max={9}
          >
            <Box sx={{ position: 'relative', width: avatarSize, height: avatarSize }}>
              <Avatar
                src={conv.otherUser.avatarUrl ?? undefined}
                sx={{
                  width: avatarSize,
                  height: avatarSize,
                  ...(isExpanded ? {} : { fontSize: 12 }),
                }}
              >
                {conv.otherUser.username[0]?.toUpperCase()}
              </Avatar>
              {isExpanded && <PresenceIndicator state={presenceState} size={9} />}
            </Box>
          </Badge>
        </ListItemAvatar>
        <ListItemText
          primary={
            <Typography
              variant="body2"
              style={{ fontWeight: conv.unreadCount > 0 ? 'bold' : 'normal' }}
              noWrap
            >
              {conv.otherUser.displayName ?? conv.otherUser.username}
            </Typography>
          }
          secondary={
            showPreview && conv.lastMessage ? (
              <Typography variant="caption" noWrap color="text.secondary">
                {conv.lastMessage.content}
              </Typography>
            ) : undefined
          }
        />
        {showPreview && conv.lastMessage && (
          <Typography variant="caption" color="text.secondary" sx={{ ml: 0.5, flexShrink: 0 }}>
            {formatDate(conv.lastMessage.createdAt)}
          </Typography>
        )}
      </ListItemButton>
    </ListItem>
  );
}
