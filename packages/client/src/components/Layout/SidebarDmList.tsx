import { use, useState, Suspense } from 'react';
import { Box, CircularProgress, IconButton, List, Tooltip, Typography } from '@mui/material';
import AddCommentIcon from '@mui/icons-material/AddComment';
import { useNavigate } from 'react-router-dom';
import type { DmConversationWithDetails } from '@chat-app/shared';
import { api } from '../../api/client';
import { useAuth } from '../../contexts/AuthContext';
import { useDmConversationsSocket } from '../../hooks/useDmConversationsSocket';
import DmListRow from '../DM/DmListRow';

/**
 * Sidebar 列下部に積む DM 会話一覧ブロック。
 * - api.dm.listConversations を Suspense で取得
 * - Socket new_dm_message で lastMessage / unreadCount をリアルタイム更新
 * - 行クリックで /dm?conv=N に遷移、新規 DM ボタンで /dm に遷移
 */

let _conversationsPromise: Promise<{ conversations: DmConversationWithDetails[] }> | null = null;

function getOrCreatePromise(): Promise<{ conversations: DmConversationWithDetails[] }> {
  if (!_conversationsPromise) {
    _conversationsPromise = api.dm.listConversations();
  }
  return _conversationsPromise;
}

/** テスト用キャッシュリセット */
export function resetSidebarDmListCache(): void {
  _conversationsPromise = null;
}

function SidebarDmListContent({
  conversationsPromise,
  currentUserId,
}: {
  conversationsPromise: Promise<{ conversations: DmConversationWithDetails[] }>;
  currentUserId: number;
}) {
  const { conversations: initial } = use(conversationsPromise);
  const [conversations, setConversations] = useState<DmConversationWithDetails[]>(initial);
  const navigate = useNavigate();

  // Sidebar はアクティブ会話の概念を持たないため activeConvId は省略 (= 常に未読加算)
  useDmConversationsSocket({ currentUserId, setConversations });

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        minHeight: 0,
        background: 'var(--surface)',
      }}
    >
      <Box
        sx={{
          px: 1,
          py: 0.5,
          display: 'flex',
          alignItems: 'center',
          borderTop: '1px solid var(--border)',
        }}
      >
        <Typography
          variant="caption"
          sx={{
            flexGrow: 1,
            fontWeight: 'bold',
            textTransform: 'uppercase',
            color: 'text.secondary',
            fontSize: 10,
            letterSpacing: '0.05em',
          }}
        >
          DM
        </Typography>
        <Tooltip title="新規 DM">
          <IconButton size="small" aria-label="新規 DM" onClick={() => navigate('/dm')}>
            <AddCommentIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      </Box>

      <Box sx={{ overflowY: 'auto', maxHeight: 240, minHeight: 0 }}>
        {conversations.length === 0 ? (
          <Box sx={{ px: 2, py: 1.5, textAlign: 'center', color: 'text.secondary' }}>
            <Typography variant="caption">DM会話がありません</Typography>
          </Box>
        ) : (
          <List dense disablePadding>
            {conversations.map((conv) => (
              <DmListRow
                key={conv.id}
                conversation={conv}
                variant="compact"
                onClick={() => navigate(`/dm?conv=${conv.id}`)}
              />
            ))}
          </List>
        )}
      </Box>
    </Box>
  );
}

export default function SidebarDmList() {
  const [conversationsPromise] = useState(() => getOrCreatePromise());
  const { user } = useAuth();
  if (!user) return null;
  return (
    <Suspense
      fallback={
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 2 }}>
          <CircularProgress size={20} />
        </Box>
      }
    >
      <SidebarDmListContent conversationsPromise={conversationsPromise} currentUserId={user.id} />
    </Suspense>
  );
}
