import { Box, Button, Card, CardActions, CardContent, Typography } from '@mui/material';
import type { Draft } from '@chat-app/shared';
import { extractMessageText } from '../../utils/extractMessageText';

/** 「再開」アクションの宛先種別 (チャンネル / DM) */
export type DraftResumeTarget =
  | { kind: 'channel'; channelId: number }
  | { kind: 'dm'; dmConversationId: number };

interface Props {
  drafts: Draft[];
  /** 「再開」ボタン押下時に、対象種別を判別して呼ばれる */
  onResume?: (target: DraftResumeTarget) => void;
  /** 後方互換のために受け付けるが、下書きは未読フラグを持たないため全件表示する。後方互換のため optional。 */
  unreadOnly?: boolean;
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
 * Inbox の「下書き」タブ表示用の純粋コンポーネント。
 * Promise の解決は親 (InboxPage) の Suspense 側で行い、ここは配列を受け取って描画するだけ。
 * 「再開」クイックアクションは onResume?.(target) で親に通知し、navigation は親に委譲する。
 */
export default function DraftsList({ drafts, onResume, unreadOnly: _unreadOnly }: Props) {
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
              <Typography variant="body2">{extractMessageText(d.content)}</Typography>
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
