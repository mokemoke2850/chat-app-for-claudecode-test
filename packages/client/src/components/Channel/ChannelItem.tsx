import { useState } from 'react';
import {
  Badge,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  IconButton,
  ListItem,
  ListItemButton,
  ListItemText,
  MenuItem,
  MenuList,
  Paper,
  Popover,
  Tooltip,
} from '@mui/material';
import LockIcon from '@mui/icons-material/Lock';
import PushPinIcon from '@mui/icons-material/PushPin';
import PushPinOutlinedIcon from '@mui/icons-material/PushPinOutlined';
import GroupAddIcon from '@mui/icons-material/GroupAdd';
import ArchiveIcon from '@mui/icons-material/Archive';
import DragIndicatorIcon from '@mui/icons-material/DragIndicator';
import { useDraggable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import type { Channel, ChannelCategory, ChannelNotificationLevel } from '@chat-app/shared';
import NotificationLevelMenu from './NotificationLevelMenu';

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
  onArchive?: (channelId: number) => void;
  currentUserId?: number;
  userRole?: string;
  /** 現在のカテゴリID（カテゴリ機能用） */
  categoryId?: number | null;
  /** 全カテゴリ一覧（割当メニュー用） */
  allCategories?: ChannelCategory[];
  /** カテゴリ割当/解除コールバック */
  onAssignChannel?: (channelId: number, categoryId: number | null) => void;
  /** D&D 対象外にする場合 true（ピン留めセクションなど） */
  disableDrag?: boolean;
  /** チャンネルの通知レベル（未指定時は 'all'） */
  notificationLevel?: ChannelNotificationLevel;
  /** 通知レベル変更コールバック */
  onChangeNotificationLevel?: (channelId: number, level: ChannelNotificationLevel) => Promise<void>;
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
  onArchive,
  currentUserId,
  userRole,
  categoryId,
  allCategories,
  onAssignChannel,
  disableDrag = false,
  notificationLevel = 'all',
  onChangeNotificationLevel,
}: ChannelItemProps) {
  const isMuted = notificationLevel === 'muted';
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [assignAnchorEl, setAssignAnchorEl] = useState<HTMLElement | null>(null);
  const assignMenuOpen = Boolean(assignAnchorEl);

  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `channel-${channel.id}`,
    data: { channelId: channel.id },
    disabled: disableDrag,
  });

  const dragStyle = {
    transform: CSS.Translate.toString(transform),
    opacity: isDragging ? 0.4 : 1,
    position: 'relative' as const,
    zIndex: isDragging ? 999 : undefined,
  };

  const canArchive =
    userRole === 'admin' || (currentUserId != null && channel.createdBy === currentUserId);

  const handleArchiveConfirm = () => {
    setConfirmOpen(false);
    onArchive?.(channel.id);
  };

  const secondaryAction = isHovered ? (
    <Box sx={{ display: 'flex' }}>
      {onAssignChannel && allCategories && allCategories.length > 0 && (
        <>
          <Tooltip title="カテゴリへ移動">
            <IconButton
              size="small"
              aria-label="カテゴリへ移動"
              onClick={(e) => {
                e.stopPropagation();
                setAssignAnchorEl(e.currentTarget);
              }}
            >
              <ArchiveIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          <Popover
            open={assignMenuOpen}
            anchorEl={assignAnchorEl}
            onClose={() => setAssignAnchorEl(null)}
            anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
            transformOrigin={{ vertical: 'top', horizontal: 'right' }}
            disablePortal={false}
            slotProps={{
              paper: {
                sx: { zIndex: (theme) => theme.zIndex.modal + 1, minWidth: 140 },
              },
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <Paper>
              <MenuList dense>
                {allCategories.map((cat) => (
                  <MenuItem
                    key={cat.id}
                    selected={categoryId === cat.id}
                    aria-label={`${cat.name}に移動`}
                    onClick={(e) => {
                      e.stopPropagation();
                      setAssignAnchorEl(null);
                      onAssignChannel(channel.id, cat.id);
                    }}
                    sx={{ fontSize: 13 }}
                  >
                    {categoryId === cat.id && <span style={{ marginRight: 4 }}>✓</span>}
                    {cat.name}
                  </MenuItem>
                ))}
                <MenuItem
                  aria-label="割当なし（その他）"
                  onClick={(e) => {
                    e.stopPropagation();
                    setAssignAnchorEl(null);
                    onAssignChannel(channel.id, null);
                  }}
                  sx={{ fontSize: 13, borderTop: '1px solid', borderColor: 'divider' }}
                >
                  割当なし（その他）
                </MenuItem>
              </MenuList>
            </Paper>
          </Popover>
        </>
      )}
      {onChangeNotificationLevel && (
        <span onClick={(e) => e.stopPropagation()}>
          <NotificationLevelMenu
            channelId={channel.id}
            currentLevel={notificationLevel}
            onChangeLevel={onChangeNotificationLevel}
          />
        </span>
      )}
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
      {canArchive && (
        <Tooltip title="アーカイブ">
          <IconButton
            size="small"
            aria-label="アーカイブ"
            onClick={(e) => {
              e.stopPropagation();
              setConfirmOpen(true);
            }}
          >
            <ArchiveIcon fontSize="small" />
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
    <>
      <Box ref={setNodeRef} style={dragStyle}>
        <ListItem
          disablePadding
          onMouseEnter={onMouseEnter}
          onMouseLeave={onMouseLeave}
          secondaryAction={secondaryAction}
        >
          {!disableDrag && (
            <Box
              {...attributes}
              {...listeners}
              aria-label="ドラッグハンドル"
              sx={{
                display: isHovered ? 'flex' : 'none',
                alignItems: 'center',
                cursor: 'grab',
                pl: 0.5,
                color: 'text.disabled',
                '&:active': { cursor: 'grabbing' },
              }}
            >
              <DragIndicatorIcon sx={{ fontSize: 14 }} />
            </Box>
          )}
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
                style: {
                  ...(channel.unreadCount > 0 && !isMuted ? { fontWeight: 'bold' } : {}),
                  ...(isMuted ? { color: 'text.disabled', opacity: 0.5 } : {}),
                },
              }}
            />
            {(channel.mentionCount ?? 0) > 0 && !isMuted && (
              <Badge
                badgeContent={(channel.mentionCount ?? 0) > 9 ? '9+' : channel.mentionCount}
                color="error"
                sx={{ ml: 1, mr: isHovered ? '80px' : 0 }}
              >
                <Box component="span" sx={{ display: 'inline-block', width: 8, height: 8 }} />
              </Badge>
            )}
            {channel.unreadCount > 0 && (channel.mentionCount ?? 0) === 0 && !isMuted && (
              <Badge
                badgeContent={channel.unreadCount}
                color="primary"
                max={9}
                sx={{ ml: 1, mr: isHovered ? '80px' : 0 }}
              >
                <Box component="span" sx={{ display: 'inline-block', width: 8, height: 8 }} />
              </Badge>
            )}
          </ListItemButton>
        </ListItem>
      </Box>

      {/* アーカイブ確認ダイアログ */}
      <Dialog open={confirmOpen} onClose={() => setConfirmOpen(false)}>
        <DialogTitle>チャンネルのアーカイブ</DialogTitle>
        <DialogContent>
          <DialogContentText>
            #{channel.name} をアーカイブしますか？アーカイブ後はメッセージの送信ができなくなります。
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmOpen(false)}>キャンセル</Button>
          <Button onClick={handleArchiveConfirm} color="warning" aria-label="アーカイブ">
            アーカイブ
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
