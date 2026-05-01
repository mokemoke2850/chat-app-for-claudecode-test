import { ReactNode, useEffect, useState } from 'react';
import { Box, Snackbar, Alert } from '@mui/material';
import { useSocket } from '../../contexts/SocketContext';
import Rail from './Rail';
import SidebarFooter from './SidebarFooter';

const RAIL_WIDTH = 64;
const SIDEBAR_WIDTH = 240;

interface Props {
  sidebar: ReactNode;
  children: ReactNode;
}

/**
 * 3 列グリッドの共通レイアウト。
 * - Step 2a: Drawer 撤去 / 3 列 grid 化 / Rail 新設。
 * - Step 2b: AppBar 撤去 / SidebarFooter (ステータス・テーマ・通知・プロフィール・ログアウト)
 *           を Sidebar 列フッターに集約。検索 box は AppLayout 側からは撤去
 *           （PROGRESS.md 保留 TODO #2、Step 7 で検索ページ新設時に再構築）。
 */
export default function AppLayout({ sidebar, children }: Props) {
  const [reminderNotification, setReminderNotification] = useState<string | null>(null);
  const socket = useSocket();

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
          gridTemplateColumns: `${RAIL_WIDTH}px ${SIDEBAR_WIDTH}px 1fr`,
          overflow: 'hidden',
          minHeight: 0,
        }}
      >
        <Rail />

        <Box
          data-testid="app-layout-sidebar"
          sx={{
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            borderRight: '1px solid var(--border)',
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
