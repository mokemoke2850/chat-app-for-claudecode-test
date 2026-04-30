/* global React, MaterialUI, window */
(function () {
const { useState, useMemo } = React;
const {
  Box,
  AppBar,
  Toolbar,
  Drawer,
  Typography,
  IconButton,
  Tooltip,
  InputBase,
  Paper,
  List,
  ListItemButton,
  ListItemText,
  ListItemIcon,
  Divider,
  Badge,
  Tabs,
  Tab,
  Avatar,
  Chip,
  Button,
  ButtonGroup,
  ToggleButton,
  ToggleButtonGroup,
  Stack,
} = MaterialUI;

const DRAWER_WIDTH = 240;

function Icon({ name, size = 20, sx }) {
  return (
    <span
      className="material-symbols-outlined"
      style={{ fontSize: size, ...(sx || {}) }}
    >
      {name}
    </span>
  );
}

function Sidebar({ activeChannelId, onSelectChannel, activeView, onSelectView }) {
  const { CHANNELS, CATEGORIES } = window.__MOCK_DATA__;

  return (
    <Box sx={{ overflow: 'auto', height: '100%', pb: 2 }}>
      {/* Workspace header (mimic ChannelList header) */}
      <Box sx={{ display: 'flex', alignItems: 'center', px: 2, py: 1 }}>
        <Typography
          variant="subtitle2"
          sx={{ flexGrow: 1, fontWeight: 'bold', textTransform: 'uppercase', fontSize: 11 }}
        >
          Acme Workspace
        </Typography>
        <Tooltip title="新規作成">
          <IconButton size="small"><Icon name="add" size={18} /></IconButton>
        </Tooltip>
      </Box>

      <Paper
        elevation={0}
        sx={{
          mx: 2,
          mb: 1,
          px: 1,
          py: 0.5,
          display: 'flex',
          alignItems: 'center',
          bgcolor: (t) => (t.palette.mode === 'dark' ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)'),
          borderRadius: 1,
        }}
      >
        <Icon name="search" size={16} />
        <InputBase placeholder="チャンネルを検索" sx={{ ml: 1, fontSize: 13, flexGrow: 1 }} />
      </Paper>

      <Divider />

      {/* Top-level nav: カレンダー */}
      <List dense disablePadding sx={{ pt: 0.5 }}>
        <ListItemButton
          selected={activeView === 'calendar-global'}
          onClick={() => onSelectView('calendar-global')}
          sx={{ px: 2 }}
        >
          <ListItemIcon sx={{ minWidth: 32 }}>
            <Icon name="calendar_month" size={20} />
          </ListItemIcon>
          <ListItemText primary="カレンダー" primaryTypographyProps={{ fontSize: 14 }} />
        </ListItemButton>
        <ListItemButton sx={{ px: 2 }}>
          <ListItemIcon sx={{ minWidth: 32 }}>
            <Icon name="bookmark" size={20} />
          </ListItemIcon>
          <ListItemText primary="ブックマーク" primaryTypographyProps={{ fontSize: 14 }} />
        </ListItemButton>
        <ListItemButton sx={{ px: 2 }}>
          <ListItemIcon sx={{ minWidth: 32 }}>
            <Icon name="alternate_email" size={20} />
          </ListItemIcon>
          <ListItemText primary="メンション" primaryTypographyProps={{ fontSize: 14 }} />
        </ListItemButton>
      </List>

      <Divider sx={{ my: 1 }} />

      {/* Channels */}
      <Typography
        variant="caption"
        sx={{
          px: 2,
          pb: 0.5,
          display: 'block',
          color: 'text.secondary',
          fontWeight: 'bold',
          textTransform: 'uppercase',
          fontSize: 10,
        }}
      >
        チャンネル
      </Typography>
      <List dense disablePadding>
        {CHANNELS.map((ch) => (
          <ListItemButton
            key={ch.id}
            selected={activeChannelId === ch.id && activeView === 'channel'}
            onClick={() => onSelectChannel(ch.id)}
            sx={{ px: 2, py: 0.25 }}
          >
            <ListItemIcon sx={{ minWidth: 24 }}>
              <Typography sx={{ color: 'text.secondary', fontSize: 15, lineHeight: 1 }}>#</Typography>
            </ListItemIcon>
            <ListItemText
              primary={ch.name}
              primaryTypographyProps={{
                fontSize: 14,
                fontWeight: ch.unreadCount > 0 ? 700 : 400,
              }}
            />
            {ch.mentionCount > 0 && (
              <Chip
                label={ch.mentionCount}
                size="small"
                color="error"
                sx={{ height: 18, fontSize: 11 }}
              />
            )}
            {ch.mentionCount === 0 && ch.unreadCount > 0 && (
              <Badge
                badgeContent={ch.unreadCount}
                color="primary"
                sx={{ mr: 1 }}
              />
            )}
          </ListItemButton>
        ))}
      </List>

      <Divider sx={{ my: 1 }} />

      <Typography
        variant="caption"
        sx={{
          px: 2,
          pb: 0.5,
          display: 'block',
          color: 'text.secondary',
          fontWeight: 'bold',
          textTransform: 'uppercase',
          fontSize: 10,
        }}
      >
        ダイレクトメッセージ
      </Typography>
      <List dense disablePadding>
        {window.__MOCK_DATA__.USERS.filter((u) => u.id !== window.__MOCK_DATA__.CURRENT_USER.id)
          .slice(0, 4)
          .map((u) => (
            <ListItemButton key={u.id} sx={{ px: 2, py: 0.25 }}>
              <ListItemIcon sx={{ minWidth: 28 }}>
                <Avatar sx={{ width: 18, height: 18, fontSize: 10, bgcolor: u.color }}>
                  {u.displayName[0]}
                </Avatar>
              </ListItemIcon>
              <ListItemText
                primary={u.displayName}
                primaryTypographyProps={{ fontSize: 13 }}
              />
            </ListItemButton>
          ))}
      </List>
    </Box>
  );
}

function TopBar({ onToggleTheme, themeMode, onToggleTweaks, tweaksOn, onNewEvent }) {
  const { CURRENT_USER } = window.__MOCK_DATA__;
  return (
    <AppBar position="fixed" sx={{ zIndex: (theme) => theme.zIndex.drawer + 1 }}>
      <Toolbar sx={{ gap: 1 }}>
        <Tooltip title="サイドバーを開閉する">
          <IconButton color="inherit" edge="start">
            <Icon name="menu" size={22} />
          </IconButton>
        </Tooltip>
        <Typography variant="h6" sx={{ flexShrink: 0, fontSize: 18, fontWeight: 500 }}>
          Chat App
        </Typography>

        <Paper
          component="form"
          onSubmit={(e) => e.preventDefault()}
          sx={{
            display: 'flex',
            alignItems: 'center',
            flexGrow: 1,
            mx: 2,
            px: 1,
            py: 0.25,
            bgcolor: 'rgba(255,255,255,0.15)',
            color: 'inherit',
            borderRadius: 1,
            maxWidth: 480,
            boxShadow: 'none',
          }}
        >
          <Icon name="search" size={18} />
          <InputBase
            placeholder="メッセージ・イベントを検索 (Ctrl+F)"
            sx={{ color: 'inherit', fontSize: 14, flexGrow: 1, ml: 1 }}
          />
        </Paper>

        <Box sx={{ flexGrow: 1 }} />

        <Button
          color="inherit"
          variant="outlined"
          startIcon={<Icon name="add" size={18} />}
          onClick={onNewEvent}
          sx={{ borderColor: 'rgba(255,255,255,0.5)', textTransform: 'none', mr: 1 }}
        >
          新しい予定
        </Button>

        <Typography variant="body2">{CURRENT_USER.displayName}</Typography>

        <Tooltip title={themeMode === 'dark' ? 'ライトモード' : 'ダークモード'}>
          <IconButton color="inherit" onClick={onToggleTheme}>
            <Icon name={themeMode === 'dark' ? 'light_mode' : 'dark_mode'} size={22} />
          </IconButton>
        </Tooltip>
        <Tooltip title="Tweaks">
          <IconButton color="inherit" onClick={onToggleTweaks}>
            <Icon name={tweaksOn ? 'tune' : 'tune'} size={22} />
          </IconButton>
        </Tooltip>
        <Tooltip title="通知">
          <IconButton color="inherit"><Icon name="notifications" size={22} /></IconButton>
        </Tooltip>
        <Tooltip title="プロフィール">
          <IconButton color="inherit"><Icon name="account_circle" size={22} /></IconButton>
        </Tooltip>
      </Toolbar>
    </AppBar>
  );
}

window.CalendarShell = { Sidebar, TopBar, Icon, DRAWER_WIDTH };
})();
