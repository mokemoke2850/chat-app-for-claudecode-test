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
  Tooltip,
} from '@mui/material';
import LockIcon from '@mui/icons-material/Lock';
import PushPinIcon from '@mui/icons-material/PushPin';
import PushPinOutlinedIcon from '@mui/icons-material/PushPinOutlined';
import GroupAddIcon from '@mui/icons-material/GroupAdd';
import ArchiveIcon from '@mui/icons-material/Archive';
import type { Channel, ChannelCategory } from '@chat-app/shared';

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
}: ChannelItemProps) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [assignMenuOpen, setAssignMenuOpen] = useState(false);

  const canArchive =
    userRole === 'admin' || (currentUserId != null && channel.createdBy === currentUserId);

  const handleArchiveConfirm = () => {
    setConfirmOpen(false);
    onArchive?.(channel.id);
  };

  const secondaryAction = isHovered ? (
    <Box sx={{ display: 'flex' }}>
      {onAssignChannel && allCategories && allCategories.length > 0 && (
        <Box sx={{ position: 'relative' }}>
          <Tooltip title="カテゴリへ移動">
            <IconButton
              size="small"
              aria-label="カテゴリへ移動"
              onClick={(e) => {
                e.stopPropagation();
                setAssignMenuOpen((prev) => !prev);
              }}
            >
              <ArchiveIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          {assignMenuOpen && (
            <Box
              sx={{
                position: 'absolute',
                top: '100%',
                right: 0,
                bgcolor: 'background.paper',
                boxShadow: 3,
                borderRadius: 1,
                zIndex: 1300,
                minWidth: 140,
              }}
              onMouseLeave={() => setAssignMenuOpen(false)}
            >
              {allCategories.map((cat) => (
                <Box
                  key={cat.id}
                  sx={{
                    px: 2,
                    py: 0.75,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    '&:hover': { bgcolor: 'action.hover' },
                    fontWeight: categoryId === cat.id ? 'bold' : 'normal',
                  }}
                  onClick={(e) => {
                    e.stopPropagation();
                    setAssignMenuOpen(false);
                    onAssignChannel(channel.id, cat.id);
                  }}
                  role="menuitem"
                  aria-label={`${cat.name}に移動`}
                >
                  {categoryId === cat.id && <span style={{ marginRight: 4 }}>✓</span>}
                  <span style={{ fontSize: 13 }}>{cat.name}</span>
                </Box>
              ))}
              <Box
                sx={{
                  px: 2,
                  py: 0.75,
                  cursor: 'pointer',
                  '&:hover': { bgcolor: 'action.hover' },
                  borderTop: '1px solid',
                  borderColor: 'divider',
                }}
                onClick={(e) => {
                  e.stopPropagation();
                  setAssignMenuOpen(false);
                  onAssignChannel(channel.id, null);
                }}
                role="menuitem"
                aria-label="割当なし（その他）"
              >
                <span style={{ fontSize: 13 }}>割当なし（その他）</span>
              </Box>
            </Box>
          )}
        </Box>
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
              sx={{ ml: 1, mr: isHovered ? '80px' : 0 }}
            >
              <Box component="span" sx={{ display: 'inline-block', width: 8, height: 8 }} />
            </Badge>
          )}
          {channel.unreadCount > 0 && (channel.mentionCount ?? 0) === 0 && (
            <Badge badgeContent={channel.unreadCount} color="primary" max={9} sx={{ ml: 1, mr: isHovered ? '80px' : 0 }}>
              <Box component="span" sx={{ display: 'inline-block', width: 8, height: 8 }} />
            </Badge>
          )}
        </ListItemButton>
      </ListItem>

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
          <Button
            onClick={handleArchiveConfirm}
            color="warning"
            aria-label="アーカイブ"
          >
            アーカイブ
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
