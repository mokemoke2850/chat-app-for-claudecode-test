import { Box, Button, Card, CardContent, Typography } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import type { MessageSearchResult } from '@chat-app/shared';
import { extractMessageText } from '../../utils/extractMessageText';

interface Props {
  messages: MessageSearchResult[];
  /** 未読のみ表示フラグ。MentionsList は API 側でフィルタ済みのため UI 上の挙動は変わらない。後方互換のため optional。 */
  unreadOnly?: boolean;
  /** 空状態のとき表示する「未読フィルタを解除」ボタンのコールバック。unreadOnly=true のときのみ親から渡される。 */
  onClearUnreadFilter?: () => void;
  /** 空状態のとき表示する「すべてのタブを表示」ボタンのコールバック。 */
  onShowAllTabs?: () => void;
  /** 空状態のとき表示する「通知設定を確認」ボタンのコールバック。 */
  onOpenNotificationSettings?: () => void;
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
 * Inbox の「メンション」タブ表示用の純粋コンポーネント。
 * Promise の解決は親 (InboxPage) の Suspense 側に任せ、ここは配列を描画するだけ。
 * MessageSearchResult が持つ channelName / rootMessageContent も合わせて表示する。
 */
export default function MentionsList({
  messages,
  unreadOnly,
  onClearUnreadFilter,
  onShowAllTabs,
  onOpenNotificationSettings,
}: Props) {
  const navigate = useNavigate();

  if (messages.length === 0) {
    return (
      <Box
        sx={{ p: 2, display: 'flex', flexDirection: 'column', gap: 1, alignItems: 'flex-start' }}
      >
        <Typography variant="body2" color="text.secondary">
          未読のメンションはありません
        </Typography>
        {unreadOnly && onClearUnreadFilter && (
          <Button size="small" variant="outlined" onClick={onClearUnreadFilter}>
            未読フィルタを解除
          </Button>
        )}
        {onShowAllTabs && (
          <Button size="small" variant="outlined" onClick={onShowAllTabs}>
            すべてのタブを表示
          </Button>
        )}
        {onOpenNotificationSettings && (
          <Button size="small" variant="outlined" onClick={onOpenNotificationSettings}>
            通知設定を確認
          </Button>
        )}
      </Box>
    );
  }
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
      {messages.map((m) => {
        const goTo = () => navigate(`/chat?channel=${m.channelId}#message-${m.id}`);
        return (
          <Card
            key={m.id}
            variant="outlined"
            data-testid="mention-card"
            role="button"
            tabIndex={0}
            aria-label={`#${m.channelName} の ${m.username} のメンションを開く`}
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
                📨 #{m.channelName} · {m.username} · {formatDateTime(m.createdAt)}
              </Typography>
              <Typography variant="body2">{extractMessageText(m.content)}</Typography>
            </CardContent>
          </Card>
        );
      })}
    </Box>
  );
}
