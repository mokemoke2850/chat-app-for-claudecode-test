import { ReactNode, useEffect, useRef, useState } from 'react';
import {
  Box,
  Snackbar,
  Alert,
  useMediaQuery,
  IconButton,
  Tooltip,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
  Drawer,
  SwipeableDrawer,
} from '@mui/material';
import SearchOutlinedIcon from '@mui/icons-material/SearchOutlined';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import MenuIcon from '@mui/icons-material/Menu';
import BookmarkBorderOutlinedIcon from '@mui/icons-material/BookmarkBorderOutlined';
import ArticleOutlinedIcon from '@mui/icons-material/ArticleOutlined';
import AdminPanelSettingsOutlinedIcon from '@mui/icons-material/AdminPanelSettingsOutlined';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import { useSocket } from '../../contexts/SocketContext';
import { useAuth } from '../../contexts/AuthContext';
import Rail from './Rail';
import MobileBottomNav from './MobileBottomNav';
import SidebarFooter from './SidebarFooter';

// モバイル Sidebar ドロワー幅 (デスクトップ SIDEBAR_WIDTH より広め、親指タップ余裕)
const MOBILE_DRAWER_WIDTH = 280;

// モバイル幅ブレークポイント (iPad 縦 768px は 3 列維持、767px 以下のみモバイルレイアウト)
const MOBILE_QUERY = '(max-width: 767px)';

const RAIL_WIDTH = 64;
const SIDEBAR_DEFAULT_WIDTH = 240;
const SIDEBAR_MIN_WIDTH = 160;
const SIDEBAR_MAX_WIDTH = 480;
const RIGHT_PANE_WIDTH = 320;
const SIDEBAR_WIDTH_STORAGE_KEY = 'sidebar.width';

interface Props {
  sidebar: ReactNode;
  children: ReactNode;
  /** ContextRail などの右ペインを表示するときに渡す。undefined のときは grid を 3 列構造に保つ */
  rightPane?: ReactNode;
  /**
   * 初回 (localStorage に値が無い時) の Sidebar 開閉状態。
   * ChatPage/SearchPage = true、その他 = false を想定。
   * 過去にユーザーがトグルしていれば localStorage["sidebar.open"] が優先される。省略時は true。
   */
  defaultSidebarOpen?: boolean;
  /**
   * sidebar 中身が空なページ (Admin / DM / Bookmark / Templates / Profile / Files) で
   * 強制的に sidebar を閉じる。localStorage["sidebar.open"] への書き込みも抑制し、
   * 他ページの開閉状態を汚さない。Rail トグルボタンも非表示になる。
   */
  forceSidebarClosed?: boolean;
  /**
   * モバイルでボトムシートを閉じたとき (バックドロップタップ / スワイプダウン) に呼ばれる。
   * 親で rightPane を undefined に戻して状態整合を保つ用途を想定。
   */
  onCloseRightPane?: () => void;
}

/** Rail / Sidebar / Main 構成の 3 列グリッドレイアウト (rightPane 指定時は 4 列、モバイル時は 1 列)。 */
export default function AppLayout({
  sidebar,
  children,
  rightPane,
  defaultSidebarOpen,
  forceSidebarClosed,
  onCloseRightPane,
}: Props) {
  const [reminderNotification, setReminderNotification] = useState<string | null>(null);
  const socket = useSocket();
  const isMobile = useMediaQuery(MOBILE_QUERY);
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const [moreMenuAnchor, setMoreMenuAnchor] = useState<null | HTMLElement>(null);

  // Issue #258: サイドバー幅のドラッグリサイズ
  const [sidebarWidth, setSidebarWidth] = useState<number>(() => {
    const stored = window.localStorage.getItem(SIDEBAR_WIDTH_STORAGE_KEY);
    if (stored !== null) {
      const parsed = parseInt(stored, 10);
      if (!isNaN(parsed)) {
        return Math.min(SIDEBAR_MAX_WIDTH, Math.max(SIDEBAR_MIN_WIDTH, parsed));
      }
    }
    return SIDEBAR_DEFAULT_WIDTH;
  });
  const dragStartXRef = useRef(0);
  const dragStartWidthRef = useRef(0);
  // アンマウント時のクリーンアップ用にリスナーを ref で保持
  const dragMoveListenerRef = useRef<((e: MouseEvent) => void) | null>(null);
  const dragUpListenerRef = useRef<((e: MouseEvent) => void) | null>(null);

  // コンポーネントのアンマウント時にドキュメントリスナーを必ずクリーンアップ
  useEffect(() => {
    return () => {
      if (dragMoveListenerRef.current) {
        document.removeEventListener('mousemove', dragMoveListenerRef.current);
        dragMoveListenerRef.current = null;
      }
      if (dragUpListenerRef.current) {
        document.removeEventListener('mouseup', dragUpListenerRef.current);
        dragUpListenerRef.current = null;
      }
    };
  }, []);

  const handleDragStart = (e: React.MouseEvent) => {
    e.preventDefault();
    dragStartXRef.current = e.clientX;
    dragStartWidthRef.current = sidebarWidth;

    const onMouseMove = (moveEvent: MouseEvent) => {
      const delta = moveEvent.clientX - dragStartXRef.current;
      const newWidth = Math.min(
        SIDEBAR_MAX_WIDTH,
        Math.max(SIDEBAR_MIN_WIDTH, dragStartWidthRef.current + delta),
      );
      setSidebarWidth(newWidth);
    };

    const onMouseUp = (upEvent: MouseEvent) => {
      const delta = upEvent.clientX - dragStartXRef.current;
      const newWidth = Math.min(
        SIDEBAR_MAX_WIDTH,
        Math.max(SIDEBAR_MIN_WIDTH, dragStartWidthRef.current + delta),
      );
      window.localStorage.setItem(SIDEBAR_WIDTH_STORAGE_KEY, String(newWidth));
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
      dragMoveListenerRef.current = null;
      dragUpListenerRef.current = null;
    };

    // 前回のリスナーが残っている場合はクリーンアップ
    if (dragMoveListenerRef.current) {
      document.removeEventListener('mousemove', dragMoveListenerRef.current);
    }
    if (dragUpListenerRef.current) {
      document.removeEventListener('mouseup', dragUpListenerRef.current);
    }

    dragMoveListenerRef.current = onMouseMove;
    dragUpListenerRef.current = onMouseUp;
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  };

  const handleDragDoubleClick = () => {
    setSidebarWidth(SIDEBAR_DEFAULT_WIDTH);
    window.localStorage.setItem(SIDEBAR_WIDTH_STORAGE_KEY, String(SIDEBAR_DEFAULT_WIDTH));
  };
  const moreMenuOpen = Boolean(moreMenuAnchor);
  const handleMoreMenuClose = () => setMoreMenuAnchor(null);
  const handleMoreMenuNavigate = (to: string) => {
    handleMoreMenuClose();
    navigate(to);
  };

  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);
  // URL 変更で Sidebar ドロワーを自動閉じ (チャンネル切替など navigate 後)
  useEffect(() => {
    setMobileDrawerOpen(false);
  }, [location.pathname, location.search]);
  // モバイル ContextRail ボトムシートは rightPane の truthy 連動で開閉する。
  // 専用 state は持たず、親で rightPane を undefined に戻すと自動で閉じる設計
  // ("内部トグル + 外部トグル" の二重操作を防ぐため)。

  // Sidebar 開閉 state (localStorage 永続化)
  const [persistedSidebarOpen, setPersistedSidebarOpen] = useState<boolean>(() => {
    const stored = window.localStorage.getItem('sidebar.open');
    if (stored !== null) return stored === 'true';
    return defaultSidebarOpen ?? true;
  });
  // 強制閉じページでは表示状態のみ false にし、永続化値は据置く
  const sidebarOpen = forceSidebarClosed ? false : persistedSidebarOpen;
  useEffect(() => {
    if (forceSidebarClosed) return; // 強制閉じ時は localStorage を汚さない
    window.localStorage.setItem('sidebar.open', String(persistedSidebarOpen));
  }, [persistedSidebarOpen, forceSidebarClosed]);

  useEffect(() => {
    if (!socket) return;
    const handler = (data: {
      type: 'reminder';
      reminderId: number;
      messageId: number;
      messageContent: string;
      remindAt: string;
    }) => {
      if (data.type === 'reminder') {
        const preview = (() => {
          try {
            const parsed = JSON.parse(data.messageContent) as {
              ops?: { insert?: string | object }[];
            };
            return (
              parsed.ops
                ?.map((op) => (typeof op.insert === 'string' ? op.insert : ''))
                .join('')
                .trim()
                .slice(0, 50) ?? data.messageContent
            );
          } catch {
            return data.messageContent;
          }
        })();
        setReminderNotification(`リマインダー: ${preview}`);
      }
    };
    socket.on('notification', handler);
    return () => {
      socket.off('notification', handler);
    };
  }, [socket]);

  return (
    <Box sx={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* モバイル幅専用 AppBar (ハンバーガー / ロゴ / 検索 / 3 点メニュー) */}
      {isMobile && (
        <Box
          component="header"
          data-testid="app-layout-mobile-header"
          sx={{
            height: 56,
            display: 'flex',
            alignItems: 'center',
            gap: 1,
            px: 2,
            borderBottom: '1px solid var(--border)',
            background: 'var(--bg-elev)',
            flexShrink: 0,
          }}
        >
          {/* ハンバーガー (forceSidebarClosed ページでは非表示) */}
          {!forceSidebarClosed && (
            <Tooltip title="サイドバーを開く">
              <IconButton
                size="small"
                aria-label="サイドバーを開く"
                onClick={() => setMobileDrawerOpen(true)}
                sx={{ color: 'var(--text-muted)' }}
              >
                <MenuIcon />
              </IconButton>
            </Tooltip>
          )}

          <Box
            component={NavLink}
            to="/"
            aria-label="ホーム"
            sx={{
              width: 36,
              height: 36,
              borderRadius: 'var(--radius-md)',
              background: 'var(--accent)',
              color: 'var(--accent-fg)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              textDecoration: 'none',
              flexShrink: 0,
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
              <circle cx="6" cy="7" r="2" />
              <circle cx="12" cy="6" r="2.4" />
              <circle cx="18" cy="7" r="2" />
              <path d="M5 14 L19 14 L12 22 Z" />
            </svg>
          </Box>

          <Box sx={{ flexGrow: 1 }} />

          <Tooltip title="検索">
            <IconButton
              size="small"
              aria-label="検索"
              onClick={() => navigate('/search')}
              sx={{ color: 'var(--text-muted)' }}
            >
              <SearchOutlinedIcon />
            </IconButton>
          </Tooltip>

          {/* 低頻度ナビ項目 (ブックマーク / テンプレート / 管理) は 3 点メニューに集約 */}
          <Tooltip title="メニュー">
            <IconButton
              size="small"
              aria-label="メニュー"
              onClick={(e) => setMoreMenuAnchor(e.currentTarget)}
              sx={{ color: 'var(--text-muted)' }}
            >
              <MoreVertIcon />
            </IconButton>
          </Tooltip>
          <Menu anchorEl={moreMenuAnchor} open={moreMenuOpen} onClose={handleMoreMenuClose}>
            <MenuItem onClick={() => handleMoreMenuNavigate('/bookmarks')}>
              <ListItemIcon>
                <BookmarkBorderOutlinedIcon fontSize="small" />
              </ListItemIcon>
              <ListItemText>ブックマーク</ListItemText>
            </MenuItem>
            <MenuItem onClick={() => handleMoreMenuNavigate('/templates')}>
              <ListItemIcon>
                <ArticleOutlinedIcon fontSize="small" />
              </ListItemIcon>
              <ListItemText>テンプレート</ListItemText>
            </MenuItem>
            {user?.role === 'admin' && (
              <MenuItem onClick={() => handleMoreMenuNavigate('/admin')}>
                <ListItemIcon>
                  <AdminPanelSettingsOutlinedIcon fontSize="small" />
                </ListItemIcon>
                <ListItemText>管理</ListItemText>
              </MenuItem>
            )}
          </Menu>
        </Box>
      )}

      <Box
        data-testid="app-layout-grid"
        sx={{
          flex: 1,
          display: 'grid',
          gridTemplateColumns: isMobile
            ? '1fr'
            : rightPane
              ? `${RAIL_WIDTH}px ${sidebarOpen ? sidebarWidth : 0}px 1fr ${RIGHT_PANE_WIDTH}px`
              : `${RAIL_WIDTH}px ${sidebarOpen ? sidebarWidth : 0}px 1fr`,
          overflow: 'hidden',
          minHeight: 0,
        }}
      >
        {!isMobile && (
          <Rail
            sidebarOpen={sidebarOpen}
            onToggleSidebar={
              // 強制閉じページではトグルボタン非表示 (Rail 側で onToggleSidebar 未指定なら非表示)
              forceSidebarClosed ? undefined : () => setPersistedSidebarOpen((v) => !v)
            }
          />
        )}

        {!isMobile && (
          <Box
            data-testid="app-layout-sidebar"
            sx={{
              // display: 'none' にすると grid auto-placement から除外され、後続の Main Box が
              // Sidebar 列 (幅 0) に押し込まれて縮むバグが起きる。display: 'flex' で grid セルを
              // 占有し続け、列幅 0 + overflow:hidden で視覚的に消す。
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
              position: 'relative',
              borderRight: sidebarOpen ? '1px solid var(--border)' : 'none',
              background: 'var(--surface)',
              minHeight: 0,
            }}
          >
            <Box sx={{ flex: 1, overflow: 'auto', minHeight: 0 }}>{sidebar}</Box>
            {/* Issue #258: ドラッグリサイズハンドル (サイドバーが開いているときのみ表示) */}
            {sidebarOpen && (
              <Box
                role="separator"
                aria-orientation="vertical"
                aria-label="サイドバー幅を調整"
                onMouseDown={handleDragStart}
                onDoubleClick={handleDragDoubleClick}
                sx={{
                  position: 'absolute',
                  top: 0,
                  right: -4,
                  width: 8,
                  height: '100%',
                  cursor: 'col-resize',
                  zIndex: 10,
                  '&:hover': {
                    background: 'var(--accent)',
                    opacity: 0.4,
                  },
                }}
              />
            )}
          </Box>
        )}

        <Box
          component="main"
          data-testid="app-layout-main"
          sx={{
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            minWidth: 0,
            // モバイル時は底部 56px の BottomNav に被らないよう padding-bottom を確保
            ...(isMobile ? { pb: '56px' } : {}),
          }}
        >
          {children}
        </Box>

        {!isMobile && rightPane && (
          <Box
            data-testid="app-layout-right"
            sx={{
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
              minHeight: 0,
            }}
          >
            {rightPane}
          </Box>
        )}
      </Box>

      {isMobile && <MobileBottomNav />}

      {/* モバイル Sidebar ドロワー (左から slide-in)。
          forceSidebarClosed ページでも描画はするが、ハンバーガー側で開かせないため実害なし */}
      <Drawer
        anchor="left"
        open={isMobile && mobileDrawerOpen}
        onClose={() => setMobileDrawerOpen(false)}
        PaperProps={{
          sx: {
            width: MOBILE_DRAWER_WIDTH,
            display: 'flex',
            flexDirection: 'column',
            background: 'var(--surface)',
          },
        }}
      >
        <Box sx={{ flex: 1, overflow: 'auto', minHeight: 0 }}>{sidebar}</Box>
        <SidebarFooter variant="drawer" />
      </Drawer>

      {/* モバイル ContextRail ボトムシート (底部から slide-up、75vh)。
          rightPane truthy + モバイル幅でのみ mount し、open は常に true。閉じる際は
          onCloseRightPane で親に通知し、親が rightPane を undefined に戻すと unmount される。
          デスクトップでは右ペイン列に直接描画されるため二重 mount しない。 */}
      {isMobile && rightPane && (
        <SwipeableDrawer
          anchor="bottom"
          open={true}
          onOpen={() => {
            // SwipeableDrawer の API 要請で関数定義が必要だが、常に open のため no-op
          }}
          onClose={() => onCloseRightPane?.()}
          disableBackdropTransition
          disableSwipeToOpen
          PaperProps={{
            sx: {
              height: '75vh',
              borderTopLeftRadius: 16,
              borderTopRightRadius: 16,
              display: 'flex',
              flexDirection: 'column',
              background: 'var(--surface)',
            },
          }}
        >
          {/* スワイプ用の grabber バー (UX ヒント) */}
          <Box
            sx={{
              flexShrink: 0,
              display: 'flex',
              justifyContent: 'center',
              py: 1,
            }}
          >
            <Box
              sx={{
                width: 36,
                height: 4,
                borderRadius: 2,
                background: 'var(--border)',
              }}
            />
          </Box>
          <Box sx={{ flex: 1, overflow: 'auto', minHeight: 0 }}>{rightPane}</Box>
        </SwipeableDrawer>
      )}

      <Snackbar
        open={!!reminderNotification}
        autoHideDuration={6000}
        onClose={() => setReminderNotification(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert severity="info" variant="filled" onClose={() => setReminderNotification(null)}>
          {reminderNotification}
        </Alert>
      </Snackbar>
    </Box>
  );
}
