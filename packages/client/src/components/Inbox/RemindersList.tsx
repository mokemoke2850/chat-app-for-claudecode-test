import { Box, Button, Card, CardActions, CardContent, Typography } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import type { Reminder } from '@chat-app/shared';
import { extractMessageText } from '../../utils/extractMessageText';

interface Props {
  reminders: Reminder[];
  /** 「完了」ボタン押下時に対象リマインダー id で呼ばれる */
  onComplete?: (id: number) => void;
  /** true のとき isSent=false のリマインダーのみ表示する。後方互換のため optional（デフォルト false）。 */
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

/**
 * Inbox の「リマインダー」タブ表示用の純粋コンポーネント。
 * Promise の解決は親 (InboxPage) の Suspense 側に任せ、ここは配列を描画するだけ。
 * 「完了」クイックアクションは onComplete?.(id) で親に通知し、API 呼び出しは親に委譲。
 */
export default function RemindersList({ reminders, onComplete, unreadOnly = false }: Props) {
  const navigate = useNavigate();

  const displayedReminders = unreadOnly ? reminders.filter((r) => !r.isSent) : reminders;

  if (displayedReminders.length === 0) {
    return (
      <Typography variant="body2" color="text.secondary" sx={{ p: 2 }}>
        リマインダーはありません
      </Typography>
    );
  }
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
      {displayedReminders.map((r) => {
        // message が存在するときのみカードクリックでジャンプ可能にする
        const canNavigate = r.message != null;
        const goTo = () => {
          if (r.message) {
            navigate(`/chat?channel=${r.message.channelId}#message-${r.messageId}`);
          }
        };
        return (
          <Card
            key={r.id}
            variant="outlined"
            data-testid="reminder-card"
            role="button"
            tabIndex={0}
            aria-label={
              r.message
                ? `${formatDateTime(r.remindAt)} のリマインダーメッセージを開く`
                : 'メッセージが見つからないリマインダー'
            }
            onClick={canNavigate ? goTo : undefined}
            onKeyDown={
              canNavigate
                ? (e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      goTo();
                    }
                  }
                : undefined
            }
            sx={{
              cursor: canNavigate ? 'pointer' : 'default',
              transition: 'background-color 120ms',
              ...(canNavigate ? { '&:hover': { bgcolor: 'action.hover' } } : {}),
            }}
          >
            <CardContent>
              <Typography variant="caption" color="text.secondary">
                ⏰ {formatDateTime(r.remindAt)}
              </Typography>
              <Typography variant="body2">
                {r.message ? extractMessageText(r.message.content) : '(メッセージが見つかりません)'}
              </Typography>
            </CardContent>
            {/* 完了ボタンクリックではカード遷移を発火させない */}
            <CardActions
              sx={{ justifyContent: 'flex-end', pt: 0 }}
              onClick={(e) => e.stopPropagation()}
            >
              <Button size="small" onClick={() => onComplete?.(r.id)}>
                完了
              </Button>
            </CardActions>
          </Card>
        );
      })}
    </Box>
  );
}
