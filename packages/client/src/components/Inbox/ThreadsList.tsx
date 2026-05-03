import { Box, Card, CardContent, Typography } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import type { ThreadSummary } from '@chat-app/shared';
import { extractMessageText } from '../../utils/extractMessageText';

interface Props {
  threads: ThreadSummary[];
}

function formatDateTime(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleString([], {
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * Inbox の「スレッド」タブ表示用の純粋コンポーネント。
 * Promise の解決は親 (InboxPage) の Suspense 側で行う責務分離パターン。
 * 各カードにはスレッドのルートメッセージ本文・送信元チャンネル名・返信件数・最終返信時刻を表示。
 */
export default function ThreadsList({ threads }: Props) {
  const navigate = useNavigate();

  if (threads.length === 0) {
    return (
      <Typography variant="body2" color="text.secondary" sx={{ p: 2 }}>
        購読中スレッドはありません
      </Typography>
    );
  }
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
      {threads.map((t) => {
        const goTo = () =>
          navigate(`/chat?channel=${t.rootMessage.channelId}#message-${t.rootMessage.id}`);
        return (
          <Card
            key={t.rootMessage.id}
            variant="outlined"
            data-testid="thread-card"
            role="button"
            tabIndex={0}
            aria-label={`#${t.channelName} の ${t.rootMessage.username} のスレッドを開く`}
            onClick={goTo}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                goTo();
              }
            }}
            sx={{
              cursor: 'pointer',
              transition: 'background-color 120ms',
              '&:hover': { bgcolor: 'action.hover' },
            }}
          >
            <CardContent>
              <Typography variant="caption" color="text.secondary">
                🧵 #{t.channelName} · {t.rootMessage.username} · 返信 {t.replyCount} 件 ·{' '}
                {formatDateTime(t.lastReplyAt)}
              </Typography>
              <Typography variant="body2">{extractMessageText(t.rootMessage.content)}</Typography>
            </CardContent>
          </Card>
        );
      })}
    </Box>
  );
}
