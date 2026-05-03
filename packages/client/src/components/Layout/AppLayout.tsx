import { ReactNode, useEffect, useState } from 'react';
import { Box, Snackbar, Alert } from '@mui/material';
import { useSocket } from '../../contexts/SocketContext';
import Rail from './Rail';
import SidebarFooter from './SidebarFooter';

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
}

/**
 * 3 列 / 4 列グリッドの共通レイアウト。
 * - Step 2a: Drawer 撤去 / 3 列 grid 化 / Rail 新設。
 * - Step 2b: AppBar 撤去 / SidebarFooter (ステータス・テーマ・通知・プロフィール・ログアウト)
 *           を Sidebar 列フッターに集約。検索 box は AppLayout 側からは撤去
 *           （PROGRESS.md 保留 TODO #2、Step 7 で検索ページ新設時に再構築）。
 * - Step 5a: rightPane prop で 4 列構造をオプション対応 (Rail / Sidebar / Main / RightPane 320px)。
 */
export default function AppLayout({ sidebar, children, rightPane, defaultSidebarOpen }: Props) {
  const [reminderNotification, setReminderNotification] = useState<string | null>(null);
  const socket = useSocket();

  // Step 8d: Sidebar 開閉 state (localStorage 永続化)
  const [sidebarOpen, setSidebarOpen] = useState<boolean>(() => {
    const stored = window.localStorage.getItem('sidebar.open');
    if (stored !== null) return stored === 'true';
    return defaultSidebarOpen ?? true;
  });
  useEffect(() => {
    window.localStorage.setItem('sidebar.open', String(sidebarOpen));
  }, [sidebarOpen]);

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
      <Box
        data-testid="app-layout-grid"
        sx={{
          flex: 1,
          display: 'grid',
          gridTemplateColumns: rightPane
            ? `${RAIL_WIDTH}px ${sidebarOpen ? SIDEBAR_WIDTH : 0}px 1fr ${RIGHT_PANE_WIDTH}px`
            : `${RAIL_WIDTH}px ${sidebarOpen ? SIDEBAR_WIDTH : 0}px 1fr`,
          overflow: 'hidden',
          minHeight: 0,
        }}
      >
        <Rail sidebarOpen={sidebarOpen} onToggleSidebar={() => setSidebarOpen((v) => !v)} />

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
          <Box sx={{ flex: 1, overflow: 'auto', minHeight: 0 }}>{sidebar}</Box>
          <SidebarFooter />
        </Box>

        <Box
          component="main"
          data-testid="app-layout-main"
          sx={{
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            minWidth: 0,
          }}
        >
          {children}
        </Box>

        {rightPane && (
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
