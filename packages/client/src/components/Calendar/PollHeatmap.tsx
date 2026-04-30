// Issue #152 — 日程調整のヒートマップ表示 + 投票
// 縦=投票者、横=候補日、自分のセルは yes → maybe → no → null 循環で更新

import { useMemo, useState } from 'react';
import { Avatar, Box, Button, Chip, Paper, Stack, Tooltip, Typography } from '@mui/material';
import HowToVoteIcon from '@mui/icons-material/HowToVote';
import EventAvailableIcon from '@mui/icons-material/EventAvailable';

import { fmtDateShort, fmtTime } from '../../utils/calendar';
import { getAvatarColor } from '../../utils/avatarColor';
import { api } from '../../api/client';
import type { CalendarEvent, CalendarPoll, CalendarVoteValue, User } from '@chat-app/shared';

interface Props {
  poll: CalendarPoll;
  users: User[];
  currentUserId: number;
  isOrganizer: boolean;
  onVoteUpdated: (poll: CalendarPoll) => void;
  onConfirmed: (event: CalendarEvent) => void;
}

interface CountRow {
  candidateId: number;
  yes: number;
  maybe: number;
  no: number;
}

function nextVote(current: CalendarVoteValue | null | undefined): CalendarVoteValue | null {
  if (current === undefined || current === null) return 'yes';
  if (current === 'yes') return 'maybe';
  if (current === 'maybe') return 'no';
  return null; // 'no' → 解除
}

function voteLabel(v: CalendarVoteValue | null | undefined): string {
  if (v === 'yes') return '◯';
  if (v === 'maybe') return '△';
  if (v === 'no') return '×';
  return '';
}

function voteBg(v: CalendarVoteValue | null | undefined): string {
  if (v === 'yes') return 'rgba(56,142,60,0.75)';
  if (v === 'maybe') return 'rgba(245,124,0,0.55)';
  if (v === 'no') return 'rgba(211,47,47,0.35)';
  return 'rgba(127,127,127,0.15)';
}

export function PollHeatmap({
  poll,
  users,
  currentUserId,
  isOrganizer,
  onVoteUpdated,
  onConfirmed,
}: Props) {
  const [submitting, setSubmitting] = useState(false);

  const candidates = poll.candidates;

  // 投票したユーザー一覧（vote 情報がある userId）
  const voterIds = useMemo(() => {
    const set = new Set<number>();
    for (const v of poll.votes) set.add(v.userId);
    // 自分が未投票でも自分は表示する
    set.add(currentUserId);
    return Array.from(set);
  }, [poll.votes, currentUserId]);

  // userId × candidateId から vote を引く
  const voteAt = (userId: number, candidateId: number): CalendarVoteValue | null => {
    const v = poll.votes.find((x) => x.userId === userId && x.candidateId === candidateId);
    return v?.vote ?? null;
  };

  // 候補ごとの集計
  const counts: CountRow[] = useMemo(() => {
    return candidates.map((c) => {
      let yes = 0;
      let maybe = 0;
      let no = 0;
      for (const v of poll.votes) {
        if (v.candidateId !== c.id) continue;
        if (v.vote === 'yes') yes++;
        else if (v.vote === 'maybe') maybe++;
        else if (v.vote === 'no') no++;
      }
      return { candidateId: c.id, yes, maybe, no };
    });
  }, [candidates, poll.votes]);

  const maxYes = useMemo(() => Math.max(1, ...counts.map((c) => c.yes)), [counts]);

  const bestId = useMemo(() => {
    let best: CountRow | null = null;
    for (const c of counts) {
      if (best === null || c.yes > best.yes) best = c;
    }
    return best?.candidateId ?? null;
  }, [counts]);

  const isConfirmed = poll.confirmedEventId !== null;

  const userById = useMemo(() => {
    const m = new Map<number, User>();
    for (const u of users) m.set(u.id, u);
    return m;
  }, [users]);

  const handleCellClick = async (candidateId: number) => {
    if (submitting) return;
    if (isConfirmed) return;
    const current = voteAt(currentUserId, candidateId);
    const next = nextVote(current);
    setSubmitting(true);
    try {
      const { poll: updated } = await api.calendar.polls.castVote(poll.id, [
        { candidateId, vote: next },
      ]);
      onVoteUpdated(updated);
    } finally {
      setSubmitting(false);
    }
  };

  const handleConfirm = async () => {
    if (submitting || isConfirmed || !isOrganizer) return;
    if (bestId === null) return;
    setSubmitting(true);
    try {
      const { event } = await api.calendar.polls.confirm(poll.id, bestId);
      onConfirmed(event);
    } finally {
      setSubmitting(false);
    }
  };

  const organizer = userById.get(poll.organizerId);

  return (
    <Paper variant="outlined" sx={{ p: 2 }} data-testid={`poll-heatmap-${poll.id}`}>
      <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
        <HowToVoteIcon fontSize="small" />
        <Typography sx={{ fontSize: 14, fontWeight: 600, flexGrow: 1 }}>{poll.title}</Typography>
        {poll.deadline && (
          <Chip
            size="small"
            label={`締切 ${fmtDateShort(new Date(poll.deadline))}`}
            sx={{ height: 20, fontSize: 10 }}
          />
        )}
        {isConfirmed && (
          <Chip size="small" label="確定済み" color="success" sx={{ height: 20, fontSize: 10 }} />
        )}
      </Stack>
      {organizer && (
        <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1.5 }}>
          <Avatar
            sx={{
              width: 18,
              height: 18,
              fontSize: 9,
              bgcolor: getAvatarColor(organizer.email),
            }}
          >
            {organizer.displayName?.[0] ?? organizer.username[0]}
          </Avatar>
          <Typography variant="caption" color="text.secondary">
            {organizer.displayName ?? organizer.username} が作成
          </Typography>
        </Stack>
      )}

      <Box sx={{ overflowX: 'auto' }}>
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: `120px repeat(${candidates.length}, 1fr)`,
            gap: 0.5,
            minWidth: candidates.length * 90 + 120,
          }}
        >
          {/* ヘッダー行 */}
          <Box />
          {candidates.map((c, i) => {
            const cnt = counts[i];
            const isBest = c.id === bestId;
            return (
              <Box
                key={c.id}
                data-testid={`poll-heatmap-header-${c.id}`}
                data-best={isBest ? 'true' : 'false'}
                sx={{
                  textAlign: 'center',
                  p: 0.5,
                  borderRadius: 0.5,
                  bgcolor: isBest ? 'success.main' : 'transparent',
                  color: isBest ? 'success.contrastText' : 'text.primary',
                }}
              >
                <Typography sx={{ fontSize: 10, fontWeight: 500 }}>
                  {fmtDateShort(new Date(c.startsAt))}
                </Typography>
                <Typography sx={{ fontSize: 11, fontWeight: 700 }}>
                  {fmtTime(new Date(c.startsAt))}–{fmtTime(new Date(c.endsAt))}
                </Typography>
                <Typography sx={{ fontSize: 10, opacity: 0.9, mt: 0.25 }}>
                  ◯ {cnt.yes} / △ {cnt.maybe}
                </Typography>
              </Box>
            );
          })}

          {/* 各投票者行 */}
          {voterIds.map((uid) => {
            const u = userById.get(uid);
            if (!u) return null;
            const isMe = uid === currentUserId;
            return (
              <Box key={`row-${uid}`} sx={{ display: 'contents' }} data-testid={`poll-row-${uid}`}>
                <Stack direction="row" spacing={0.5} alignItems="center" sx={{ pl: 0.5 }}>
                  <Avatar
                    sx={{
                      width: 20,
                      height: 20,
                      fontSize: 10,
                      bgcolor: getAvatarColor(u.email),
                    }}
                  >
                    {u.displayName?.[0] ?? u.username[0]}
                  </Avatar>
                  <Typography sx={{ fontSize: 11 }}>
                    {u.displayName ?? u.username}
                    {isMe && (
                      <Typography component="span" color="primary" sx={{ ml: 0.5, fontSize: 10 }}>
                        (あなた)
                      </Typography>
                    )}
                  </Typography>
                </Stack>
                {candidates.map((c) => {
                  const v = voteAt(uid, c.id);
                  const interactive = isMe && !isConfirmed;
                  return (
                    <Tooltip
                      key={c.id}
                      title={interactive ? 'クリックで切替: ◯→△→×→未回答' : ''}
                      arrow
                    >
                      <Box
                        data-testid={`poll-cell-${uid}-${c.id}`}
                        data-vote={v ?? 'none'}
                        onClick={() => interactive && handleCellClick(c.id)}
                        sx={{
                          height: 28,
                          borderRadius: 0.5,
                          bgcolor: voteBg(v),
                          color: '#fff',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: 14,
                          fontWeight: 700,
                          cursor: interactive ? 'pointer' : 'default',
                          outline: interactive ? '1px dashed rgba(25,118,210,0.5)' : 'none',
                          '&:hover': interactive ? { opacity: 0.85 } : {},
                        }}
                      >
                        {voteLabel(v)}
                      </Box>
                    </Tooltip>
                  );
                })}
              </Box>
            );
          })}

          {/* 集計行（参加可能率バー） */}
          <Typography sx={{ fontSize: 10, color: 'text.secondary', pl: 0.5, pt: 0.5 }}>
            参加可能率
          </Typography>
          {counts.map((c, i) => {
            const pct = c.yes / maxYes;
            return (
              <Box
                key={`bar-${i}`}
                data-testid={`poll-bar-${c.candidateId}`}
                data-pct={pct}
                sx={{
                  mt: 0.5,
                  height: 18,
                  borderRadius: 0.5,
                  position: 'relative',
                  bgcolor: (t) =>
                    t.palette.mode === 'dark' ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)',
                  overflow: 'hidden',
                }}
              >
                <Box
                  sx={{
                    position: 'absolute',
                    inset: 0,
                    width: `${pct * 100}%`,
                    bgcolor: c.candidateId === bestId ? 'success.main' : 'primary.main',
                    opacity: 0.8,
                  }}
                />
              </Box>
            );
          })}
        </Box>
      </Box>

      {isOrganizer && (
        <Stack direction="row" spacing={1} sx={{ mt: 2 }} justifyContent="flex-end">
          <Button
            variant="contained"
            size="small"
            sx={{ textTransform: 'none' }}
            startIcon={<EventAvailableIcon fontSize="small" />}
            onClick={handleConfirm}
            disabled={isConfirmed || submitting || candidates.length === 0}
            aria-label="poll-confirm-best"
          >
            最多回答で確定
          </Button>
        </Stack>
      )}
    </Paper>
  );
}
