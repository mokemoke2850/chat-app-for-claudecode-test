import { Box, Card, CardContent, Typography } from '@mui/material';
import type { MessageSearchResult } from '@chat-app/shared';

interface Props {
  messages: MessageSearchResult[];
}

function parseMessageContent(raw: string): string {
  try {
    const parsed = JSON.parse(raw) as { ops?: { insert?: string | object }[] };
    return (
      parsed.ops
        ?.map((op) => (typeof op.insert === 'string' ? op.insert : ''))
        .join('')
        .trim() ?? raw
    );
  } catch {
    return raw;
  }
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
 * Step 6b: Inbox の「メンション」タブ表示用の純粋コンポーネント。
 * Promise の解決は親 (InboxPage) の Suspense で行い、ここには配列を受け取って描画するだけにする。
 *
 * MessageSearchResult はメッセージ本体に加えて channelName / rootMessageContent を持つので、
 * 送信元チャンネル名 / 投稿者名 / 本文を一覧表示する。
 */
export default function MentionsList({ messages }: Props) {
  if (messages.length === 0) {
    return (
      <Typography variant="body2" color="text.secondary" sx={{ p: 2 }}>
        未読のメンションはありません
      </Typography>
    );
  }
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
      {messages.map((m) => (
        <Card key={m.id} variant="outlined" data-testid="mention-card">
          <CardContent>
            <Typography variant="caption" color="text.secondary">
              📨 #{m.channelName} · {m.username} · {formatDateTime(m.createdAt)}
            </Typography>
            <Typography variant="body2">{parseMessageContent(m.content)}</Typography>
          </CardContent>
        </Card>
      ))}
    </Box>
  );
}
