/**
 * Step 9b: モバイル幅 (< 768px) 時に画面下部に固定表示する 5 タブナビ。
 *
 * AppLayout から `isMobile` 判定で条件付きレンダリングされる。
 * ナビ項目は受信箱 / チャット / DM / カレンダー / タスク の 5 つに絞り、
 * ブックマーク / テンプレート / 管理は AppBar 右の 3 点メニュー、
 * 検索は AppBar 右の検索アイコンに分離する。
 */

import { ReactNode } from 'react';
import { Badge, BottomNavigation, BottomNavigationAction, Box } from '@mui/material';
import HomeOutlinedIcon from '@mui/icons-material/HomeOutlined';
import ForumOutlinedIcon from '@mui/icons-material/ForumOutlined';
import MailOutlineIcon from '@mui/icons-material/MailOutline';
import CalendarMonthOutlinedIcon from '@mui/icons-material/CalendarMonthOutlined';
import AssignmentOutlinedIcon from '@mui/icons-material/AssignmentOutlined';
import { NavLink, useLocation } from 'react-router-dom';
import { useDmUnreadCount } from '../../hooks/useDmUnreadCount';
import { useMentionUnreadCount } from '../../hooks/useMentionUnreadCount';

interface NavItem {
  label: string;
  to: string;
  icon: ReactNode;
  /** ルートパス "/" の部分一致を防ぐため (NavLink の end prop に渡す) */
  end?: boolean;
}

const ITEMS: NavItem[] = [
  { label: '受信箱', to: '/', icon: <HomeOutlinedIcon />, end: true },
  { label: 'チャット', to: '/chat', icon: <ForumOutlinedIcon /> },
  { label: 'DM', to: '/dm', icon: <MailOutlineIcon /> },
  { label: 'カレンダー', to: '/calendar', icon: <CalendarMonthOutlinedIcon /> },
  { label: 'タスク', to: '/tasks', icon: <AssignmentOutlinedIcon /> },
];

/**
 * 現在 path に応じてアクティブ index を返す。
 * 受信箱は完全一致 (`end`)、それ以外は前方一致で判定。
 */
function getActiveIndex(pathname: string): number {
  // 完全一致するアイテムを優先
  for (let i = 0; i < ITEMS.length; i++) {
    if (ITEMS[i].end && pathname === ITEMS[i].to) return i;
  }
  // 前方一致 (より長い path を優先するため逆順走査)
  for (let i = ITEMS.length - 1; i >= 0; i--) {
    if (!ITEMS[i].end && pathname.startsWith(ITEMS[i].to)) return i;
  }
  return -1;
}

export default function MobileBottomNav() {
  const { pathname } = useLocation();
  const dmUnreadCount = useDmUnreadCount();
  const mentionUnreadCount = useMentionUnreadCount();

  const activeIndex = getActiveIndex(pathname);

  return (
    <Box
      data-testid="mobile-bottom-nav"
      sx={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        zIndex: (theme) => theme.zIndex.appBar,
        borderTop: '1px solid var(--border)',
        background: 'var(--bg-elev)',
      }}
    >
      <BottomNavigation
        value={activeIndex}
        showLabels
        sx={{ background: 'transparent', height: 56 }}
      >
        {ITEMS.map((item, idx) => {
          const isActive = idx === activeIndex;
          let badgeCount = 0;
          if (item.to === '/dm') badgeCount = dmUnreadCount;
          else if (item.to === '/') badgeCount = mentionUnreadCount;

          const iconWithBadge =
            badgeCount > 0 ? (
              <Badge badgeContent={badgeCount} max={9} color="error">
                {item.icon}
              </Badge>
            ) : (
              item.icon
            );

          return (
            <BottomNavigationAction
              key={item.to}
              component={NavLink}
              to={item.to}
              end={item.end}
              label={item.label}
              icon={iconWithBadge}
              aria-label={item.label}
              aria-current={isActive ? 'page' : undefined}
              sx={{
                minWidth: 0,
                color: 'var(--text-muted)',
                '&.Mui-selected, &[aria-current="page"]': {
                  color: 'var(--accent)',
                },
              }}
            />
          );
        })}
      </BottomNavigation>
    </Box>
  );
}
