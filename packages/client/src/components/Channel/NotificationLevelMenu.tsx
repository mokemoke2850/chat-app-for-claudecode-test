import { useState } from 'react';
import { IconButton, MenuItem, MenuList, Paper, Popover, Tooltip } from '@mui/material';
import NotificationsIcon from '@mui/icons-material/Notifications';
import NotificationsOffIcon from '@mui/icons-material/NotificationsOff';
import type { ChannelNotificationLevel } from '@chat-app/shared';

const LEVELS: { value: ChannelNotificationLevel; label: string }[] = [
  { value: 'all', label: 'すべての通知' },
  { value: 'mentions', label: 'メンションのみ' },
  { value: 'muted', label: 'ミュート' },
];

export interface NotificationLevelMenuProps {
  channelId: number;
  currentLevel: ChannelNotificationLevel;
  onChangeLevel: (channelId: number, level: ChannelNotificationLevel) => Promise<void>;
}

export default function NotificationLevelMenu({
  channelId,
  currentLevel,
  onChangeLevel,
}: NotificationLevelMenuProps) {
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  const open = Boolean(anchorEl);

  const handleOpen = (e: React.MouseEvent<HTMLElement>) => {
    e.stopPropagation();
    setAnchorEl(e.currentTarget);
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  const handleSelect = (level: ChannelNotificationLevel) => {
    handleClose();
    onChangeLevel(channelId, level).catch(() => {
      // エラーは呼び出し元で処理済みのため無視
    });
  };

  const isMuted = currentLevel === 'muted';

  return (
    <>
      <Tooltip title="通知設定">
        <IconButton size="small" aria-label="通知設定" onClick={handleOpen}>
          {isMuted ? (
            <NotificationsOffIcon fontSize="small" />
          ) : (
            <NotificationsIcon fontSize="small" />
          )}
        </IconButton>
      </Tooltip>

      <Popover
        open={open}
        anchorEl={anchorEl}
        onClose={handleClose}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
        disablePortal={false}
        slotProps={{
          paper: {
            sx: { zIndex: (theme) => theme.zIndex.modal + 1, minWidth: 160 },
          },
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <Paper>
          <MenuList dense>
            {LEVELS.map(({ value, label }) => (
              <MenuItem
                key={value}
                selected={currentLevel === value}
                aria-label={label}
                onClick={() => void handleSelect(value)}
                sx={{ fontSize: 13 }}
              >
                {currentLevel === value && <span style={{ marginRight: 4 }}>✓</span>}
                {label}
              </MenuItem>
            ))}
          </MenuList>
        </Paper>
      </Popover>
    </>
  );
}
