import { ReactNode } from 'react';
import { Badge, Box, IconButton, Tooltip, Divider } from '@mui/material';
import HomeOutlinedIcon from '@mui/icons-material/HomeOutlined';
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

export default function Rail() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const dmUnreadCount = useDmUnreadCount();
  const mentionUnreadCount = useMentionUnreadCount();

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
      {/* 最上部のロゴ。Step 2b で AppBar から移譲した暫定デザイン
          (PROGRESS.md 保留 TODO #4 で最終デザインに差し替え予定) */}
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
          fontWeight: 700,
          fontFamily: 'var(--font-sans)',
          fontSize: 18,
          letterSpacing: '-0.02em',
          userSelect: 'none',
        }}
      >
        C
      </Box>

      <Box sx={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
        {TOP_ITEMS.map((item) => {
          let badgeCount = 0;
          if (item.to === '/dm') badgeCount = dmUnreadCount;
          else if (item.to === '/') badgeCount = mentionUnreadCount;
          return <RailLink key={item.to} item={item} badgeCount={badgeCount} />;
        })}

        {/* 検索アイコン (Step 2b で配置だけ追加、Step 7 で検索ページ新設時に有効化)
            動線未完成として PROGRESS.md 保留 TODO #1 に登録済み */}
        <Tooltip title="検索 (Step 7 で実装予定)" placement="right">
          <span style={{ display: 'flex', justifyContent: 'center' }}>
            <IconButton
              aria-label="検索"
              disabled
              sx={{
                width: 40,
                height: 40,
                my: 0.5,
                borderRadius: 'var(--radius-md)',
              }}
            >
              <SearchOutlinedIcon />
            </IconButton>
          </span>
        </Tooltip>
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
