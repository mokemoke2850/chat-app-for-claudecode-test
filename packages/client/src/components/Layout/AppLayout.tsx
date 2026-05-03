import { ReactNode, useEffect, useState } from 'react';
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
} from '@mui/material';
import SearchOutlinedIcon from '@mui/icons-material/SearchOutlined';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import BookmarkBorderOutlinedIcon from '@mui/icons-material/BookmarkBorderOutlined';
import ArticleOutlinedIcon from '@mui/icons-material/ArticleOutlined';
import AdminPanelSettingsOutlinedIcon from '@mui/icons-material/AdminPanelSettingsOutlined';
import { NavLink, useNavigate } from 'react-router-dom';
import { useSocket } from '../../contexts/SocketContext';
import { useAuth } from '../../contexts/AuthContext';
import Rail from './Rail';
import MobileBottomNav from './MobileBottomNav';

// Step 9a: モバイル幅ブレークポイント (claude-code-prompt.md §7 準拠 / iPad 縦は 3 列維持)
const MOBILE_QUERY = '(max-width: 767px)';

const RAIL_WIDTH = 64;
const SIDEBAR_WIDTH = 240;
const RIGHT_PANE_WIDTH = 320;

interface Props {
  sidebar: ReactNode;
  children: ReactNode;
  // Step 5a: ContextRail などの右ペインを表示するときに渡す。undefined のときは grid を従来の 3 列構造に保つ
  rightPane?: ReactNode;
  /**
   * Step 8d: 初回 (localStorage に値が無い時) の Sidebar 開閉状態。
   * ChatPage/SearchPage = true、その他 = false を想定。
   * 過去にユーザーがトグルしていれば localStorage["sidebar.open"] が優先される。
   * 省略時は true (従来挙動維持)。
   */
  defaultSidebarOpen?: boolean;
  /**
   * Step 8e-5: sidebar 中身が空なページ (Admin / DM / Bookmark / Templates / Profile / Files)
   * では強制的に sidebar を閉じる。さらに localStorage["sidebar.open"] への書き込みも
   * 抑制し、他ページの開閉状態を汚さない。Rail トグルボタンも非表示になる。
   */
  forceSidebarClosed?: boolean;
}

/**
 * 3 列 / 4 列グリッドの共通レイアウト。
 * - Step 2a: Drawer 撤去 / 3 列 grid 化 / Rail 新設。
 * - Step 2b: AppBar 撤去 / SidebarFooter (ステータス・テーマ・通知・プロフィール・ログアウト)
 *           を Sidebar 列フッターに集約。検索 box は AppLayout 側からは撤去
 *           （PROGRESS.md 保留 TODO #2、Step 7 で検索ページ新設時に再構築）。
 * - Step 5a: rightPane prop で 4 列構造をオプション対応 (Rail / Sidebar / Main / RightPane 320px)。
 */
export default function AppLayout({
  sidebar,
  children,
  rightPane,
  defaultSidebarOpen,
  forceSidebarClosed,
}: Props) {
  const [reminderNotification, setReminderNotification] = useState<string | null>(null);
  const socket = useSocket();
  // Step 9a: モバイル判定 (< 768px)。Rail / Sidebar / RightPane を非表示にし、上部に AppBar を出す
  const isMobile = useMediaQuery(MOBILE_QUERY);
  const navigate = useNavigate();
  // Step 9b: モバイル AppBar の 3 点メニュー (低頻度ナビ項目)
  const { user } = useAuth();
  const [moreMenuAnchor, setMoreMenuAnchor] = useState<null | HTMLElement>(null);
  const moreMenuOpen = Boolean(moreMenuAnchor);
  const handleMoreMenuClose = () => setMoreMenuAnchor(null);
  const handleMoreMenuNavigate = (to: string) => {
    handleMoreMenuClose();
    navigate(to);
  };

  // Step 8d: Sidebar 開閉 state (localStorage 永続化)
  const [persistedSidebarOpen, setPersistedSidebarOpen] = useState<boolean>(() => {
    const stored = window.localStorage.getItem('sidebar.open');
    if (stored !== null) return stored === 'true';
    return defaultSidebarOpen ?? true;
  });
  // Step 8e-5: 強制閉じページでは表示状態のみ false にし、永続化値は据置く
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
      {/* Step 9a/9b: モバイル幅専用 AppBar (9c でハンバーガー / 9d で ContextRail トグル追加予定) */}
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
          {/* Step 9b: 左 — アプリロゴ (タップで `/` 遷移) */}
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

          {/* Step 9b: 右 — 検索アイコン (`/search` へ遷移) */}
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

          {/* Step 9b: 右 — 3 点メニュー (低頻度ナビ項目: ブックマーク / テンプレート / 管理) */}
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
              ? `${RAIL_WIDTH}px ${sidebarOpen ? SIDEBAR_WIDTH : 0}px 1fr ${RIGHT_PANE_WIDTH}px`
              : `${RAIL_WIDTH}px ${sidebarOpen ? SIDEBAR_WIDTH : 0}px 1fr`,
          overflow: 'hidden',
          minHeight: 0,
        }}
      >
        {!isMobile && (
          <Rail
            sidebarOpen={sidebarOpen}
            onToggleSidebar={
              // Step 8e-5: 強制閉じページではトグルボタン非表示 (Rail 側で onToggleSidebar 未指定なら非表示)
              forceSidebarClosed ? undefined : () => setPersistedSidebarOpen((v) => !v)
            }
          />
        )}

        {!isMobile && (
          <Box
            data-testid="app-layout-sidebar"
            sx={{
              // Step 8d 修正: display: 'none' は grid auto-placement から除外され、
              // 後続の Main Box が Sidebar 列 (幅 0) に押し込まれて縮むバグになる。
              // display: 'flex' を維持して grid セルを占有し続け、列幅 0 + overflow:hidden で視覚的に消す。
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
              borderRight: sidebarOpen ? '1px solid var(--border)' : 'none',
              background: 'var(--surface)',
              minHeight: 0,
            }}
          >
            {/* Step 8e-3: SidebarFooter は Rail に移動。Sidebar 列は sidebar prop の中身のみ。 */}
            <Box sx={{ flex: 1, overflow: 'auto', minHeight: 0 }}>{sidebar}</Box>
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
            // Step 9b: モバイル時は底部 56px の BottomNav に被らないよう padding-bottom 確保
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

      {/* Step 9b: モバイル幅で底部 5 タブナビ */}
      {isMobile && <MobileBottomNav />}

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
