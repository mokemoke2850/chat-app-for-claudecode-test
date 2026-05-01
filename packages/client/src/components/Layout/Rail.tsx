import { ReactNode } from 'react';
import { Box, Tooltip, Divider } from '@mui/material';
import HomeOutlinedIcon from '@mui/icons-material/HomeOutlined';
import MailOutlineIcon from '@mui/icons-material/MailOutline';
import CalendarMonthOutlinedIcon from '@mui/icons-material/CalendarMonthOutlined';
import AssignmentOutlinedIcon from '@mui/icons-material/AssignmentOutlined';
import BookmarkBorderOutlinedIcon from '@mui/icons-material/BookmarkBorderOutlined';
import ArticleOutlinedIcon from '@mui/icons-material/ArticleOutlined';
import AdminPanelSettingsOutlinedIcon from '@mui/icons-material/AdminPanelSettingsOutlined';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';

interface NavItem {
  label: string;
  to: string;
  icon: ReactNode;
  /** ルートパス "/" の部分一致を防ぐため。NavLink の end prop に渡す */
  end?: boolean;
}

const TOP_ITEMS: NavItem[] = [
  { label: 'ホーム', to: '/', icon: <HomeOutlinedIcon />, end: true },
  { label: 'DM', to: '/dm', icon: <MailOutlineIcon /> },
  { label: 'カレンダー', to: '/calendar', icon: <CalendarMonthOutlinedIcon /> },
  { label: 'タスク', to: '/tasks', icon: <AssignmentOutlinedIcon /> },
  { label: 'ブックマーク', to: '/bookmarks', icon: <BookmarkBorderOutlinedIcon /> },
];

const BOTTOM_ITEMS: NavItem[] = [
  { label: 'テンプレート', to: '/templates', icon: <ArticleOutlinedIcon /> },
];

const ADMIN_ITEM: NavItem = {
  label: '管理',
  to: '/admin',
  icon: <AdminPanelSettingsOutlinedIcon />,
};

function RailLink({ item }: { item: NavItem }) {
  return (
    <Tooltip title={item.label} placement="right">
      <Box
        component={NavLink}
        to={item.to}
        end={item.end}
        aria-label={item.label}
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: 40,
          height: 40,
          mx: 'auto',
          my: 0.5,
          borderRadius: 'var(--radius-md)',
          color: 'var(--text-muted)',
          textDecoration: 'none',
          transition: 'background 120ms, color 120ms',
          '&:hover': {
            background: 'var(--surface-hover)',
            color: 'var(--text)',
          },
          '&.active, &[aria-current="page"]': {
            color: 'var(--accent)',
            background: 'var(--accent-soft)',
          },
        }}
      >
        {item.icon}
      </Box>
    </Tooltip>
  );
}

export default function Rail() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';

  return (
    <Box
      component="nav"
      aria-label="メインナビゲーション"
      sx={{
        width: 64,
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'stretch',
        py: 1,
        background: 'var(--bg-elev)',
        borderRight: '1px solid var(--border)',
      }}
    >
      <Box sx={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
        {TOP_ITEMS.map((item) => (
          <RailLink key={item.to} item={item} />
        ))}
      </Box>
      <Divider sx={{ width: 32, mx: 'auto', my: 1, borderColor: 'var(--border)' }} />
      <Box sx={{ display: 'flex', flexDirection: 'column' }}>
        {BOTTOM_ITEMS.map((item) => (
          <RailLink key={item.to} item={item} />
        ))}
        {isAdmin && <RailLink item={ADMIN_ITEM} />}
      </Box>
    </Box>
  );
}
