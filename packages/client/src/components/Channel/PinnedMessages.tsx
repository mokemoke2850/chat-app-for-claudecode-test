import { use, useState, useMemo, Suspense } from 'react';
import {
  Box,
  Typography,
  IconButton,
  Tooltip,
  Collapse,
  Divider,
  CircularProgress,
} from '@mui/material';
import PushPinIcon from '@mui/icons-material/PushPin';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import CloseIcon from '@mui/icons-material/Close';
import type { PinnedMessage } from '@chat-app/shared';
import { api } from '../../api/client';

interface PinnedMessagesInnerProps {
  channelId: number;
  pinsPromise: Promise<{ pinnedMessages: PinnedMessage[] }>;
  onUnpin: (messageId: number) => void;
  currentUserId: number;
}

function PinnedMessagesInner({
  pinsPromise,
  onUnpin,
  currentUserId,
}: PinnedMessagesInnerProps) {
  const { pinnedMessages } = use(pinsPromise);
  const [expanded, setExpanded] = useState(true);

  if (pinnedMessages.length === 0) return null;

  return (
    <Box
      sx={{
        bgcolor: 'action.hover',
        borderBottom: 1,
        borderColor: 'divider',
        px: 2,
        py: 0.5,
      }}
    >
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 1,
          cursor: 'pointer',
        }}
        onClick={() => setExpanded((v) => !v)}
      >
        <PushPinIcon fontSize="small" color="primary" />
        <Typography variant="caption" fontWeight={600}>
          ピン留め ({pinnedMessages.length})
        </Typography>
        <Box sx={{ ml: 'auto' }}>
          {expanded ? (
            <ExpandLessIcon fontSize="small" />
          ) : (
            <ExpandMoreIcon fontSize="small" />
          )}
        </Box>
      </Box>

      <Collapse in={expanded}>
        <Divider sx={{ my: 0.5 }} />
        {pinnedMessages.map((pin) => (
          <Box
            key={pin.id}
            sx={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: 1,
              py: 0.5,
            }}
          >
            <PushPinIcon fontSize="small" sx={{ mt: 0.25, color: 'text.secondary' }} />
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography variant="caption" color="text.secondary">
                {pin.pinnedByUser?.username ?? '不明なユーザー'} がピン留め
              </Typography>
              <Typography
                variant="body2"
                sx={{
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {pin.message
                  ? (() => {
                      try {
                        const delta = JSON.parse(pin.message.content) as {
                          ops?: { insert?: string }[];
                        };
                        return (
                          delta.ops
                            ?.map((op) => (typeof op.insert === 'string' ? op.insert : ''))
                            .join('')
                            .trim() ?? ''
                        );
                      } catch {
                        return pin.message.content;
                      }
                    })()
                  : '(メッセージが見つかりません)'}
              </Typography>
            </Box>
            {pin.pinnedBy === currentUserId && (
              <Tooltip title="ピン留めを解除">
                <IconButton
                  size="small"
                  onClick={(e) => {
                    e.stopPropagation();
                    onUnpin(pin.messageId);
                  }}
                >
                  <CloseIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            )}
          </Box>
        ))}
      </Collapse>
    </Box>
  );
}

interface PinnedMessagesProps {
  channelId: number;
  currentUserId: number;
  refreshKey?: number;
  onUnpin: (messageId: number) => void;
}

export default function PinnedMessages({
  channelId,
  currentUserId,
  refreshKey = 0,
  onUnpin,
}: PinnedMessagesProps) {
  const pinsPromise = useMemo(
    () => api.pins.list(channelId),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [channelId, refreshKey],
  );

  return (
    <Suspense
      fallback={
        <Box sx={{ display: 'flex', justifyContent: 'center', p: 1 }}>
          <CircularProgress size={16} />
        </Box>
      }
    >
      <PinnedMessagesInner
        channelId={channelId}
        pinsPromise={pinsPromise}
        onUnpin={onUnpin}
        currentUserId={currentUserId}
      />
    </Suspense>
  );
}
