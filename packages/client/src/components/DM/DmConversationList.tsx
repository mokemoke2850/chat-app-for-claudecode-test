import { Box, IconButton, List, Tooltip, Typography } from '@mui/material';
import AddCommentIcon from '@mui/icons-material/AddComment';
import { useSocket } from '../../contexts/SocketContext';
import { usePresence } from '../../hooks/usePresence';
import { useDmConversationsSocket } from '../../hooks/useDmConversationsSocket';
import DmListRow from './DmListRow';
import type { DmConversationWithDetails } from '@chat-app/shared';

export interface DmConversationListProps {
  conversations: DmConversationWithDetails[];
  activeConvId: number | null;
  currentUserId: number;
  onSelectConversation: (convId: number) => void;
  onNewDm: () => void;
  onConversationsChange: (
    updater: (prev: DmConversationWithDetails[]) => DmConversationWithDetails[],
  ) => void;
}

/**
 * DMPage の左カラム用 DM 一覧 (280px 幅、expanded variant)。
 * 行レンダリングは `DmListRow`、socket 購読は `useDmConversationsSocket` で
 * `SidebarDmList` と共通化している。
 */
export default function DmConversationList({
  conversations,
  activeConvId,
  currentUserId,
  onSelectConversation,
  onNewDm,
  onConversationsChange,
}: DmConversationListProps) {
  const socket = useSocket();
  const presence = usePresence(socket);

  useDmConversationsSocket({
    activeConvId,
    currentUserId,
    setConversations: onConversationsChange,
  });

  return (
    <Box
      sx={{
        width: 280,
        flexShrink: 0,
        borderRight: 1,
        borderColor: 'divider',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      <Box
        sx={{
          px: 2,
          py: 1.5,
          display: 'flex',
          alignItems: 'center',
          borderBottom: 1,
          borderColor: 'divider',
        }}
      >
        <Typography variant="subtitle1" fontWeight="bold" sx={{ flexGrow: 1 }}>
          ダイレクトメッセージ
        </Typography>
        <Tooltip title="新規DM">
          <IconButton size="small" onClick={onNewDm} aria-label="新規DM">
            <AddCommentIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      </Box>

      <Box sx={{ flexGrow: 1, overflowY: 'auto' }}>
        {conversations.length === 0 ? (
          <Box sx={{ p: 2, textAlign: 'center', color: 'text.secondary' }}>
            <Typography variant="body2">DM会話がありません</Typography>
            <Typography variant="caption">上のボタンから開始しましょう</Typography>
          </Box>
        ) : (
          <List disablePadding>
            {conversations.map((conv) => (
              <DmListRow
                key={conv.id}
                conversation={conv}
                variant="expanded"
                isActive={conv.id === activeConvId}
                presenceState={presence.get(conv.otherUser.id)}
                onClick={() => onSelectConversation(conv.id)}
              />
            ))}
          </List>
        )}
      </Box>
    </Box>
  );
}
