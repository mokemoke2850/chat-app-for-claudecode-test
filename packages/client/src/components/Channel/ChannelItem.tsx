import {
  Badge,
  Box,
  IconButton,
  ListItem,
  ListItemButton,
  ListItemText,
  Tooltip,
} from '@mui/material';
import LockIcon from '@mui/icons-material/Lock';
import PushPinIcon from '@mui/icons-material/PushPin';
import PushPinOutlinedIcon from '@mui/icons-material/PushPinOutlined';
import GroupAddIcon from '@mui/icons-material/GroupAdd';
import type { Channel } from '@chat-app/shared';

export interface ChannelItemProps {
  channel: Channel;
  isActive: boolean;
  isPinned: boolean;
  isHovered: boolean;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
  onClick: () => void;
  onPin: (channelId: number) => void;
  onUnpin: (channelId: number) => void;
  onOpenMembersDialog: (channel: Channel) => void;
}

export default function ChannelItem({
  channel,
  isActive,
  isPinned,
  isHovered,
  onMouseEnter,
  onMouseLeave,
  onClick,
  onPin,
  onUnpin,
  onOpenMembersDialog,
}: ChannelItemProps) {
  const secondaryAction = isHovered ? (
    <Box sx={{ display: 'flex' }}>
      {channel.isPrivate && (
        <Tooltip title="メンバー管理">
          <IconButton
            size="small"
            aria-label="メンバー管理"
            onClick={(e) => {
              e.stopPropagation();
              onOpenMembersDialog(channel);
            }}
          >
            <GroupAddIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      )}
      {isPinned ? (
        <Tooltip title="ピン留めを解除">
          <IconButton
            size="small"
            edge="end"
            aria-label="ピン留めを解除"
            onClick={() => onUnpin(channel.id)}
          >
            <PushPinIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      ) : (
        <Tooltip title="ピン留め">
          <IconButton
            size="small"
            edge="end"
            aria-label="ピン留め"
            onClick={() => onPin(channel.id)}
          >
            <PushPinOutlinedIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      )}
    </Box>
  ) : undefined;

  return (
    <ListItem
      disablePadding
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      secondaryAction={secondaryAction}
    >
      <ListItemButton selected={isActive} onClick={onClick}>
        {channel.isPrivate && (
          <LockIcon
            aria-label="private channel"
            sx={{ fontSize: 12, mr: 0.5, color: 'text.secondary' }}
          />
        )}
        <ListItemText
          primary={`# ${channel.name}`}
          primaryTypographyProps={{
            fontSize: 14,
            style: channel.unreadCount > 0 ? { fontWeight: 'bold' } : undefined,
          }}
        />
        {(channel.mentionCount ?? 0) > 0 && (
          <Badge
            badgeContent={(channel.mentionCount ?? 0) > 9 ? '9+' : channel.mentionCount}
            color="error"
            sx={{ ml: 1 }}
          >
            <Box component="span" sx={{ display: 'inline-block', width: 8, height: 8 }} />
          </Badge>
        )}
        {channel.unreadCount > 0 && (channel.mentionCount ?? 0) === 0 && (
          <Badge badgeContent={channel.unreadCount} color="primary" max={9} sx={{ ml: 1 }}>
            <Box component="span" sx={{ display: 'inline-block', width: 8, height: 8 }} />
          </Badge>
        )}
      </ListItemButton>
    </ListItem>
  );
}
