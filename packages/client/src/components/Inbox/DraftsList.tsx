import { Box, Button, Card, CardActions, CardContent, Typography } from '@mui/material';
import type { Draft } from '@chat-app/shared';

/** Step 6d: 「再開」アクションの宛先種別 */
export type DraftResumeTarget =
  | { kind: 'channel'; channelId: number }
  | { kind: 'dm'; dmConversationId: number };

interface Props {
  drafts: Draft[];
  /**
   * Step 6d: 「再開」ボタンが押されたとき呼ばれる。
   * チャンネル下書き / DM 下書きのいずれかを判別して通知する。
   */
  onResume?: (target: DraftResumeTarget) => void;
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

function resolveTarget(d: Draft): DraftResumeTarget | null {
  if (d.channelId !== null && d.channelId !== undefined) {
    return { kind: 'channel', channelId: d.channelId };
  }
  if (d.dmConversationId !== null && d.dmConversationId !== undefined) {
    return { kind: 'dm', dmConversationId: d.dmConversationId };
  }
  return null;
}

/**
 * Step 6a: Inbox の「下書き」タブ表示用の純粋コンポーネント。
 * Promise の解決は親 (InboxPage) の Suspense で行い、ここには配列を受け取って描画するだけにする。
 *
 * Step 6d: 各カードに「再開」クイックアクションを追加。
 * 押下で onResume?.(target) を呼ぶ。target は channelId か dmConversationId のいずれか。
 * 実際の navigation は親 (InboxPage) に委譲。
 */
export default function DraftsList({ drafts, onResume }: Props) {
  if (drafts.length === 0) {
    return (
      <Typography variant="body2" color="text.secondary" sx={{ p: 2 }}>
        下書きはありません
      </Typography>
    );
  }
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
      {drafts.map((d) => {
        const target = resolveTarget(d);
        return (
          <Card key={d.id} variant="outlined" data-testid="draft-card">
            <CardContent>
              <Typography variant="caption" color="text.secondary">
                📝 {formatDateTime(d.updatedAt)}
              </Typography>
              <Typography variant="body2">{parseMessageContent(d.content)}</Typography>
            </CardContent>
            {target && (
              <CardActions sx={{ justifyContent: 'flex-end', pt: 0 }}>
                <Button size="small" onClick={() => onResume?.(target)}>
                  再開
                </Button>
              </CardActions>
            )}
          </Card>
        );
      })}
    </Box>
  );
}
