// #108 会話イベント投稿 — メッセージ内に表示するイベントカード
// タイトル / 日時 / RSVP ボタン / 集計を表示する。
// Socket 経由で `event:rsvp_updated` を購読して集計をリアルタイムに反映する。

import { useEffect, useState } from 'react';
import { Box, Button, Card, CardContent, Stack, Typography } from '@mui/material';
import EventIcon from '@mui/icons-material/Event';
import type { ChatEvent, RsvpCounts, RsvpStatus } from '@chat-app/shared';
import { api } from '../../api/client';
import { useSocket } from '../../contexts/SocketContext';
import { useSnackbar } from '../../contexts/SnackbarContext';

interface Props {
  event: ChatEvent;
}

const RSVP_LABELS: Record<RsvpStatus, string> = {
  going: '参加',
  not_going: '不参加',
  maybe: '未定',
};

function formatRange(startsAt: string, endsAt: string | null): string {
  const start = new Date(startsAt);
  const startStr = start.toLocaleString();
  if (!endsAt) return startStr;
  const end = new Date(endsAt);
  const sameDay =
    start.getFullYear() === end.getFullYear() &&
    start.getMonth() === end.getMonth() &&
    start.getDate() === end.getDate();
  return sameDay
    ? `${startStr} – ${end.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
    : `${startStr} – ${end.toLocaleString()}`;
}

export default function EventCard({ event }: Props) {
  const [counts, setCounts] = useState<RsvpCounts>(event.rsvpCounts);
  const [myRsvp, setMyRsvp] = useState<RsvpStatus | null>(event.myRsvp);
  const [busy, setBusy] = useState(false);
  const socket = useSocket();
  const { showError } = useSnackbar();

  useEffect(() => {
    setCounts(event.rsvpCounts);
    setMyRsvp(event.myRsvp);
  }, [event.rsvpCounts, event.myRsvp]);

  useEffect(() => {
    if (!socket) return;
    const handler = (data: {
      eventId: number;
      messageId: number;
      channelId: number;
      rsvpCounts: RsvpCounts;
    }) => {
      if (data.eventId === event.id) {
        setCounts(data.rsvpCounts);
      }
    };
    socket.on('event:rsvp_updated', handler);
    return () => {
      socket.off('event:rsvp_updated', handler);
    };
  }, [socket, event.id]);

  const handleSetRsvp = async (status: RsvpStatus) => {
    if (busy) return;
    setBusy(true);
    try {
      const res = await api.events.setRsvp(event.id, status);
      setCounts(res.event.rsvpCounts);
      setMyRsvp(res.event.myRsvp);
    } catch (err) {
      const msg = err instanceof Error && err.message ? err.message : 'RSVP の更新に失敗しました';
      showError(msg);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card variant="outlined" sx={{ maxWidth: 480, mt: 0.5 }} data-testid="event-card">
      <CardContent>
        <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
          <EventIcon fontSize="small" color="primary" />
          <Typography variant="subtitle1" fontWeight="bold">
            {event.title}
          </Typography>
        </Stack>

        <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
          {formatRange(event.startsAt, event.endsAt)}
        </Typography>

        {event.description && (
          <Typography variant="body2" sx={{ mb: 1, whiteSpace: 'pre-wrap' }}>
            {event.description}
          </Typography>
        )}

        <Stack direction="row" spacing={1} sx={{ mt: 1.5 }}>
          {(['going', 'not_going', 'maybe'] as const).map((s) => (
            <Button
              key={s}
              size="small"
              variant={myRsvp === s ? 'contained' : 'outlined'}
              disabled={busy}
              onClick={() => void handleSetRsvp(s)}
              aria-pressed={myRsvp === s}
              aria-label={`rsvp-${s}`}
            >
              {RSVP_LABELS[s]} (
              {s === 'going' ? counts.going : s === 'not_going' ? counts.notGoing : counts.maybe})
            </Button>
          ))}
        </Stack>

        <Box sx={{ mt: 1.5 }} data-testid="event-summary">
          <Typography variant="caption" color="text.secondary">
            参加 {counts.going} ／ 不参加 {counts.notGoing} ／ 未定 {counts.maybe}
          </Typography>
        </Box>
      </CardContent>
    </Card>
  );
}
