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
  Menu,
  MenuItem,
  MenuList,
  Paper,
  Popover,
  Tooltip,
} from '@mui/material';
import LockIcon from '@mui/icons-material/Lock';
import PushPinIcon from '@mui/icons-material/PushPin';
import PushPinOutlinedIcon from '@mui/icons-material/PushPinOutlined';
import DragIndicatorIcon from '@mui/icons-material/DragIndicator';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import CheckIcon from '@mui/icons-material/Check';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import { useDraggable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import type { Channel, ChannelCategory, ChannelNotificationLevel } from '@chat-app/shared';

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

const NOTIFICATION_LEVELS: { value: ChannelNotificationLevel; label: string }[] = [
  { value: 'all', label: 'すべての通知' },
  { value: 'mentions', label: 'メンションのみ' },
  { value: 'muted', label: 'ミュート' },
];

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

  // 3点メニュー
  const [menuAnchorEl, setMenuAnchorEl] = useState<HTMLElement | null>(null);
  const menuOpen = Boolean(menuAnchorEl);

  // カテゴリ移動サブメニュー
  const [assignAnchorEl, setAssignAnchorEl] = useState<HTMLElement | null>(null);
  const assignMenuOpen = Boolean(assignAnchorEl);

  // 通知レベルサブメニュー
  const [notifAnchorEl, setNotifAnchorEl] = useState<HTMLElement | null>(null);
  const notifMenuOpen = Boolean(notifAnchorEl);

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

  const hasCategories = Boolean(onAssignChannel && allCategories && allCategories.length > 0);

  const handleMenuOpen = (e: React.MouseEvent<HTMLElement>) => {
    e.stopPropagation();
    setMenuAnchorEl(e.currentTarget);
  };

  const handleMenuClose = () => {
    setMenuAnchorEl(null);
    setAssignAnchorEl(null);
    setNotifAnchorEl(null);
  };

  const handleArchiveClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    handleMenuClose();
    setConfirmOpen(true);
  };

  const handleArchiveConfirm = () => {
    setConfirmOpen(false);
    onArchive?.(channel.id);
  };

  const handlePinClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    handleMenuClose();
    onPin(channel.id);
  };

  const handleUnpinClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    handleMenuClose();
    onUnpin(channel.id);
  };

  const handleMembersClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    handleMenuClose();
    onOpenMembersDialog(channel);
  };

  const handleAssignClick = (e: React.MouseEvent<HTMLElement>) => {
    e.stopPropagation();
    setAssignAnchorEl(e.currentTarget);
  };

  const handleAssignSelect = (e: React.MouseEvent, catId: number | null) => {
    e.stopPropagation();
    handleMenuClose();
    onAssignChannel?.(channel.id, catId);
  };

  const handleNotifClick = (e: React.MouseEvent<HTMLElement>) => {
    e.stopPropagation();
    setNotifAnchorEl(e.currentTarget);
  };

  const handleNotifSelect = (e: React.MouseEvent, level: ChannelNotificationLevel) => {
    e.stopPropagation();
    handleMenuClose();
    onChangeNotificationLevel?.(channel.id, level).catch(() => {
      // エラーは呼び出し元で処理
    });
  };

  // メニューが開いている間はホバーが解除されてもボタンを DOM に残す。
  // （ボタンが消えると anchorEl が detached になり MUI Menu が位置計算できなくなるため）
  const isAnyMenuOpen = menuOpen || assignMenuOpen || notifMenuOpen;
  const secondaryAction =
    isHovered || isAnyMenuOpen ? (
      <Box sx={{ display: 'flex' }}>
        <Tooltip title="その他のアクション">
          <IconButton size="small" aria-label="その他のアクション" onClick={handleMenuOpen}>
            <MoreVertIcon fontSize="small" />
          </IconButton>
        </Tooltip>
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
                display: isHovered || isAnyMenuOpen ? 'flex' : 'none',
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
                sx={{ ml: 1, mr: isHovered ? '36px' : 0 }}
              >
                <Box component="span" sx={{ display: 'inline-block', width: 8, height: 8 }} />
              </Badge>
            )}
            {channel.unreadCount > 0 && (channel.mentionCount ?? 0) === 0 && !isMuted && (
              <Badge
                badgeContent={channel.unreadCount}
                color="primary"
                max={9}
                sx={{ ml: 1, mr: isHovered ? '36px' : 0 }}
              >
                <Box component="span" sx={{ display: 'inline-block', width: 8, height: 8 }} />
              </Badge>
            )}
          </ListItemButton>
        </ListItem>
      </Box>

      {/* 3点メニュー */}
      <Menu
        anchorEl={menuAnchorEl}
        open={menuOpen}
        onClose={handleMenuClose}
        anchorOrigin={{ vertical: 'top', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'left' }}
        onClick={(e) => e.stopPropagation()}
        slotProps={{ paper: { sx: { minWidth: 160 } } }}
      >
        {/* カテゴリへ移動 */}
        {hasCategories && (
          <MenuItem
            aria-label="カテゴリへ移動"
            onClick={handleAssignClick}
            sx={{ fontSize: 13, justifyContent: 'space-between' }}
          >
            カテゴリへ移動
            <ChevronRightIcon fontSize="small" />
          </MenuItem>
        )}

        {/* 通知レベル */}
        {onChangeNotificationLevel && (
          <MenuItem
            aria-label="通知レベル"
            onClick={handleNotifClick}
            sx={{ fontSize: 13, justifyContent: 'space-between' }}
          >
            通知レベル
            <ChevronRightIcon fontSize="small" />
          </MenuItem>
        )}

        {/* メンバー管理（プライベートのみ） */}
        {channel.isPrivate && (
          <MenuItem aria-label="メンバー管理" onClick={handleMembersClick} sx={{ fontSize: 13 }}>
            メンバー管理
          </MenuItem>
        )}

        {/* アーカイブ（権限保持者のみ） */}
        {canArchive && onArchive && (
          <MenuItem aria-label="アーカイブ" onClick={handleArchiveClick} sx={{ fontSize: 13 }}>
            アーカイブ
          </MenuItem>
        )}

        {/* ピン留め / ピン留め解除 */}
        {isPinned ? (
          <MenuItem aria-label="ピン留めを解除" onClick={handleUnpinClick} sx={{ fontSize: 13 }}>
            <PushPinIcon sx={{ fontSize: 14, mr: 0.5 }} />
            ピン留めを解除
          </MenuItem>
        ) : (
          <MenuItem aria-label="ピン留め" onClick={handlePinClick} sx={{ fontSize: 13 }}>
            <PushPinOutlinedIcon sx={{ fontSize: 14, mr: 0.5 }} />
            ピン留め
          </MenuItem>
        )}
      </Menu>

      {/* カテゴリ移動サブメニュー */}
      <Popover
        open={assignMenuOpen}
        anchorEl={assignAnchorEl}
        onClose={() => setAssignAnchorEl(null)}
        anchorOrigin={{ vertical: 'top', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'left' }}
        disablePortal={false}
        slotProps={{
          paper: { sx: { zIndex: (theme) => theme.zIndex.modal + 1, minWidth: 160 } },
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <Paper>
          <MenuList dense>
            {allCategories?.map((cat) => (
              <MenuItem
                key={cat.id}
                selected={categoryId === cat.id}
                aria-label={`${cat.name}に移動`}
                onClick={(e) => handleAssignSelect(e, cat.id)}
                sx={{ fontSize: 13 }}
              >
                {categoryId === cat.id && <CheckIcon sx={{ fontSize: 14, mr: 0.5 }} />}
                {cat.name}
              </MenuItem>
            ))}
            <MenuItem
              aria-label="割当なし（その他）"
              onClick={(e) => handleAssignSelect(e, null)}
              sx={{ fontSize: 13, borderTop: '1px solid', borderColor: 'divider' }}
            >
              割当なし（その他）
            </MenuItem>
          </MenuList>
        </Paper>
      </Popover>

      {/* 通知レベルサブメニュー */}
      <Popover
        open={notifMenuOpen}
        anchorEl={notifAnchorEl}
        onClose={() => setNotifAnchorEl(null)}
        anchorOrigin={{ vertical: 'top', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'left' }}
        disablePortal={false}
        slotProps={{
          paper: { sx: { zIndex: (theme) => theme.zIndex.modal + 1, minWidth: 160 } },
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <Paper>
          <MenuList dense>
            {NOTIFICATION_LEVELS.map(({ value, label }) => (
              <MenuItem
                key={value}
                selected={notificationLevel === value}
                aria-label={label}
                onClick={(e) => handleNotifSelect(e, value)}
                sx={{ fontSize: 13 }}
              >
                {notificationLevel === value && <CheckIcon sx={{ fontSize: 14, mr: 0.5 }} />}
                {label}
              </MenuItem>
            ))}
          </MenuList>
        </Paper>
      </Popover>

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
