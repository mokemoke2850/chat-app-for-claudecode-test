import { Box, Card, CardContent, Typography } from '@mui/material';
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
 * Step 6c: Inbox の「スレッド」タブ表示用の純粋コンポーネント。
 * 親 (InboxPage) の Suspense 内で `use(promise)` を解決し、配列を渡して描画する責務分離パターン。
 *
 * 各カードはスレッドのルートメッセージ本文・送信元チャンネル名・返信件数・最終返信時刻を表示する。
 */
export default function ThreadsList({ threads }: Props) {
  if (threads.length === 0) {
    return (
      <Typography variant="body2" color="text.secondary" sx={{ p: 2 }}>
        購読中スレッドはありません
      </Typography>
    );
  }
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
      {threads.map((t) => (
        <Card key={t.rootMessage.id} variant="outlined" data-testid="thread-card">
          <CardContent>
            <Typography variant="caption" color="text.secondary">
              🧵 #{t.channelName} · {t.rootMessage.username} · 返信 {t.replyCount} 件 ·{' '}
              {formatDateTime(t.lastReplyAt)}
            </Typography>
            <Typography variant="body2">{extractMessageText(t.rootMessage.content)}</Typography>
          </CardContent>
        </Card>
      ))}
    </Box>
  );
}
