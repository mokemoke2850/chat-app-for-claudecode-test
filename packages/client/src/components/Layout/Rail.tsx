import { ReactNode, useState } from 'react';
import { Badge, Box, IconButton, Tooltip, Divider } from '@mui/material';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import HomeOutlinedIcon from '@mui/icons-material/HomeOutlined';
import MenuOpenIcon from '@mui/icons-material/MenuOpen';
import MenuIcon from '@mui/icons-material/Menu';
import ForumOutlinedIcon from '@mui/icons-material/ForumOutlined';
import MailOutlineIcon from '@mui/icons-material/MailOutline';
import CalendarMonthOutlinedIcon from '@mui/icons-material/CalendarMonthOutlined';
import AssignmentOutlinedIcon from '@mui/icons-material/AssignmentOutlined';
import BookmarkBorderOutlinedIcon from '@mui/icons-material/BookmarkBorderOutlined';
import ArticleOutlinedIcon from '@mui/icons-material/ArticleOutlined';
import AdminPanelSettingsOutlinedIcon from '@mui/icons-material/AdminPanelSettingsOutlined';
import SearchOutlinedIcon from '@mui/icons-material/SearchOutlined';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useDmUnreadCount } from '../../hooks/useDmUnreadCount';
import { useMentionUnreadCount } from '../../hooks/useMentionUnreadCount';
import SidebarFooter from './SidebarFooter';

interface NavItem {
  label: string;
  to: string;
  icon: ReactNode;
  /** ルートパス "/" の部分一致を防ぐため。NavLink の end prop に渡す */
  end?: boolean;
}

const TOP_ITEMS: NavItem[] = [
  { label: '受信箱', to: '/', icon: <HomeOutlinedIcon />, end: true },
  { label: 'チャット', to: '/chat', icon: <ForumOutlinedIcon /> },
  { label: 'DM', to: '/dm', icon: <MailOutlineIcon /> },
  { label: 'カレンダー', to: '/calendar', icon: <CalendarMonthOutlinedIcon /> },
  { label: 'タスク', to: '/tasks', icon: <AssignmentOutlinedIcon /> },
  { label: 'ブックマーク', to: '/bookmarks', icon: <BookmarkBorderOutlinedIcon /> },
  { label: '検索', to: '/search', icon: <SearchOutlinedIcon /> },
];

const BOTTOM_ITEMS: NavItem[] = [
  { label: 'テンプレート', to: '/templates', icon: <ArticleOutlinedIcon /> },
];

const ADMIN_ITEM: NavItem = {
  label: '管理',
  to: '/admin',
  icon: <AdminPanelSettingsOutlinedIcon />,
};

function RailLink({ item, badgeCount = 0 }: { item: NavItem; badgeCount?: number }) {
  const ariaLabel = badgeCount > 0 ? `${item.label} (${badgeCount} 件未読)` : item.label;
  return (
    <Tooltip title={ariaLabel} placement="right">
      <Box
        component={NavLink}
        to={item.to}
        end={item.end}
        aria-label={ariaLabel}
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
        <Badge badgeContent={badgeCount} max={9} color="error">
          {item.icon}
        </Badge>
      </Box>
    </Tooltip>
  );
}

interface RailProps {
  /** AppLayout から渡される sidebar 開閉状態。省略時 true */
  sidebarOpen?: boolean;
  /** トグルボタンクリック時のハンドラ。省略するとトグルボタン自体を非表示 */
  onToggleSidebar?: () => void;
}

const RAIL_COLLAPSED_KEY = 'rail.collapsed';

function readCollapsedFromStorage(): boolean {
  try {
    return localStorage.getItem(RAIL_COLLAPSED_KEY) === 'true';
  } catch {
    return false;
  }
}

export default function Rail({ sidebarOpen, onToggleSidebar }: RailProps = {}) {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const dmUnreadCount = useDmUnreadCount();
  const mentionUnreadCount = useMentionUnreadCount();

  const [collapsed, setCollapsed] = useState<boolean>(readCollapsedFromStorage);

  function toggleCollapsed() {
    setCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(RAIL_COLLAPSED_KEY, String(next));
      } catch {
        // localStorage が使えない環境では無視
      }
      return next;
    });
  }

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
      {/* ロゴ: 上部 3 つの円 (人の集合) + 下部三角形 (吹き出しの先端) で
          メッセージング + コミュニティを表現 */}
      <Box
        role="img"
        aria-label="Chat App ロゴ"
        sx={{
          width: 36,
          height: 36,
          mx: 'auto',
          mb: 1,
          borderRadius: 'var(--radius-md)',
          background: 'var(--accent)',
          color: 'var(--accent-fg)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          userSelect: 'none',
        }}
      >
        <svg
          viewBox="0 0 24 24"
          width="22"
          height="22"
          fill="currentColor"
          aria-hidden="true"
          focusable="false"
        >
          {/* 上部に 3 つの円 (人の集合) */}
          <circle cx="6" cy="7" r="2" />
          <circle cx="12" cy="6" r="2.4" />
          <circle cx="18" cy="7" r="2" />
          {/* 下部に三角形 (吹き出しの先端 / 共有のメタファー) */}
          <path d="M5 14 L19 14 L12 22 Z" />
        </svg>
      </Box>

      {/* Rail 自体の折り畳みトグル（localStorage に永続化） */}
      <Tooltip title={collapsed ? 'Rail を展開する' : 'Rail を折り畳む'} placement="right">
        <IconButton
          size="small"
          aria-label={collapsed ? 'Rail を展開する' : 'Rail を折り畳む'}
          onClick={toggleCollapsed}
          sx={{
            width: 36,
            height: 32,
            mx: 'auto',
            mb: 1,
            borderRadius: 'var(--radius-sm)',
            color: 'var(--text-muted)',
            '&:hover': { background: 'var(--surface-hover)', color: 'var(--text)' },
          }}
        >
          {collapsed ? <ChevronRightIcon fontSize="small" /> : <ChevronLeftIcon fontSize="small" />}
        </IconButton>
      </Tooltip>

      {onToggleSidebar && (
        <Tooltip title={sidebarOpen ? 'サイドバーを閉じる' : 'サイドバーを開く'} placement="right">
          <IconButton
            size="small"
            aria-label={sidebarOpen ? 'サイドバーを閉じる' : 'サイドバーを開く'}
            onClick={onToggleSidebar}
            sx={{
              width: 36,
              height: 32,
              mx: 'auto',
              mb: 1,
              borderRadius: 'var(--radius-sm)',
              color: 'var(--text-muted)',
              '&:hover': { background: 'var(--surface-hover)', color: 'var(--text)' },
            }}
          >
            {sidebarOpen ? <MenuOpenIcon fontSize="small" /> : <MenuIcon fontSize="small" />}
          </IconButton>
        </Tooltip>
      )}

      <Box sx={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
        {TOP_ITEMS.map((item) => {
          let badgeCount = 0;
          if (item.to === '/dm') badgeCount = dmUnreadCount;
          else if (item.to === '/') badgeCount = mentionUnreadCount;
          return <RailLink key={item.to} item={item} badgeCount={badgeCount} />;
        })}
      </Box>
      <Divider sx={{ width: 32, mx: 'auto', my: 1, borderColor: 'var(--border)' }} />
      <Box sx={{ display: 'flex', flexDirection: 'column' }}>
        {BOTTOM_ITEMS.map((item) => (
          <RailLink key={item.to} item={item} />
        ))}
        {isAdmin && <RailLink item={ADMIN_ITEM} />}
      </Box>

      <SidebarFooter />
    </Box>
  );
}
