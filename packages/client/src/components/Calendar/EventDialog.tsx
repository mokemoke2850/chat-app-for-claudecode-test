// Issue #152 — カレンダーイベント作成・編集ダイアログ
// 「予定」と「日程調整（候補日投票）」のタブ切替付き

import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Autocomplete,
  Avatar,
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  MenuItem,
  Stack,
  Tab,
  Tabs,
  TextField,
  Typography,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import CloseIcon from '@mui/icons-material/Close';
import EventIcon from '@mui/icons-material/Event';
import PlaceIcon from '@mui/icons-material/Place';

import { fromDateTimeInputValue, toDateTimeInputValue } from '../../utils/calendar';
import { getAvatarColor } from '../../utils/avatarColor';
import { api } from '../../api/client';
import type {
  CalendarEvent,
  CalendarPoll,
  Channel,
  RecurrenceEditScope,
  RecurrenceInput,
  RecurrenceRule,
  User,
} from '@chat-app/shared';

type RecurrenceUiRule = 'NONE' | RecurrenceRule;
type RecurrenceEndType = 'never' | 'date' | 'count';

interface Props {
  open: boolean;
  channels: Channel[];
  users: User[];
  initialDate: Date | null;
  event: CalendarEvent | null; // null = 新規、値あり = 編集
  /** 繰り返しイベント編集時のスコープ。新規時 / 単発編集時は undefined */
  editScope?: RecurrenceEditScope;
  onClose: () => void;
  onCreated: (event: CalendarEvent) => void;
  onUpdated: (event: CalendarEvent) => void;
  onPollCreated: (poll: CalendarPoll) => void;
}

interface CandidateRow {
  date: string;
  from: string;
  to: string;
}

const REMINDER_OPTIONS = [
  { value: 0, label: 'なし' },
  { value: 5, label: '5分前' },
  { value: 15, label: '15分前' },
  { value: 30, label: '30分前' },
  { value: 60, label: '1時間前' },
  { value: 1440, label: '1日前' },
];

function buildIso(date: string, time: string): string {
  // date = YYYY-MM-DD, time = HH:MM
  return new Date(`${date}T${time}:00`).toISOString();
}

const WEEKDAY_LABELS = ['日', '月', '火', '水', '木', '金', '土'];

export function EventDialog({
  open,
  channels,
  users,
  initialDate,
  event,
  editScope,
  onClose,
  onCreated,
  onUpdated,
  onPollCreated,
}: Props) {
  const isEdit = !!event;

  const [mode, setMode] = useState<0 | 1>(0); // 0=予定, 1=日程調整
  const [title, setTitle] = useState('');
  const [channelId, setChannelId] = useState<number | ''>('');
  const [startsAtInput, setStartsAtInput] = useState('');
  const [endsAtInput, setEndsAtInput] = useState('');
  const [location, setLocation] = useState('');
  const [description, setDescription] = useState('');
  const [attendees, setAttendees] = useState<User[]>([]);
  const [reminderOffset, setReminderOffset] = useState<number>(15);
  const [candidates, setCandidates] = useState<CandidateRow[]>([
    { date: '', from: '10:00', to: '11:00' },
    { date: '', from: '14:00', to: '15:00' },
  ]);
  const [deadline, setDeadline] = useState('');
  // #302 繰り返し設定
  const [recurrenceRule, setRecurrenceRule] = useState<RecurrenceUiRule>('NONE');
  const [recurrenceInterval, setRecurrenceInterval] = useState<number>(1);
  const [recurrenceDays, setRecurrenceDays] = useState<number[]>([]);
  const [endType, setEndType] = useState<RecurrenceEndType>('never');
  const [endDate, setEndDate] = useState<string>('');
  const [endCount, setEndCount] = useState<number>(10);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // 初期化（open + event/initialDate 切替時）
  useEffect(() => {
    if (!open) return;
    setError(null);
    setSubmitting(false);
    if (event) {
      // 編集モード
      setMode(0);
      setTitle(event.title);
      setChannelId(event.channelId ?? '');
      setStartsAtInput(toDateTimeInputValue(new Date(event.startsAt)));
      setEndsAtInput(toDateTimeInputValue(new Date(event.endsAt)));
      setLocation(event.location ?? '');
      setDescription(event.description ?? '');
      setReminderOffset(event.reminderOffsetMinutes ?? 0);
      setAttendees(users.filter((u) => event.attendees.some((a) => a.userId === u.id)));
      // 繰り返し設定の復元
      setRecurrenceRule((event.recurrenceRule ?? 'NONE') as RecurrenceUiRule);
      setRecurrenceInterval(event.recurrenceInterval ?? 1);
      setRecurrenceDays(event.recurrenceDaysOfWeek ?? []);
      if (event.recurrenceEndDate) {
        setEndType('date');
        setEndDate(event.recurrenceEndDate.slice(0, 10));
      } else if (event.recurrenceCount) {
        setEndType('count');
        setEndCount(event.recurrenceCount);
      } else {
        setEndType('never');
      }
    } else {
      // 新規モード
      setMode(0);
      setTitle('');
      setChannelId(channels[0]?.id ?? '');
      const base = initialDate ? new Date(initialDate) : new Date();
      base.setMinutes(0, 0, 0);
      setStartsAtInput(toDateTimeInputValue(base));
      const end = new Date(base);
      end.setHours(end.getHours() + 1);
      setEndsAtInput(toDateTimeInputValue(end));
      setLocation('');
      setDescription('');
      setAttendees([]);
      setReminderOffset(15);
      setCandidates([
        { date: '', from: '10:00', to: '11:00' },
        { date: '', from: '14:00', to: '15:00' },
      ]);
      setDeadline('');
      setRecurrenceRule('NONE');
      setRecurrenceInterval(1);
      // 開始日の曜日を初期値として選択
      setRecurrenceDays([base.getDay()]);
      setEndType('never');
      setEndDate('');
      setEndCount(10);
    }
  }, [open, event, initialDate, channels, users]);

  const channelMenu = useMemo(
    () =>
      channels.map((c) => (
        <MenuItem key={c.id} value={c.id}>
          # {c.name}
        </MenuItem>
      )),
    [channels],
  );

  const validateEventForm = (): string | null => {
    if (!title.trim()) return 'タイトルを入力してください';
    if (!startsAtInput || !endsAtInput) return '日時を入力してください';
    const s = new Date(startsAtInput).getTime();
    const e = new Date(endsAtInput).getTime();
    if (Number.isNaN(s) || Number.isNaN(e)) return '日時の形式が不正です';
    if (s >= e) return '終了日時は開始日時より後である必要があります';
    if (recurrenceRule === 'WEEKLY' && recurrenceDays.length === 0) {
      return '曜日を 1 つ以上選択してください';
    }
    if (endType === 'date' && endDate) {
      const ed = new Date(endDate).getTime();
      if (!Number.isNaN(ed) && ed < s) {
        return '繰り返し終了日は開始日より後である必要があります';
      }
    }
    if (endType === 'count' && endCount < 1) {
      return '繰り返し回数は 1 以上で指定してください';
    }
    return null;
  };

  /** UI の状態から API 送信用 RecurrenceInput を組み立てる。NONE のときは null を返す。 */
  const buildRecurrenceInput = (): RecurrenceInput | null => {
    if (recurrenceRule === 'NONE') return null;
    const rec: RecurrenceInput = {
      rule: recurrenceRule,
      interval: recurrenceInterval,
    };
    if (recurrenceRule === 'WEEKLY' && recurrenceDays.length > 0) {
      rec.daysOfWeek = [...recurrenceDays].sort();
    }
    if (endType === 'date' && endDate) {
      rec.endDate = new Date(`${endDate}T23:59:59`).toISOString();
    }
    if (endType === 'count') {
      rec.count = endCount;
    }
    return rec;
  };

  const validatePollForm = (): string | null => {
    if (!title.trim()) return 'タイトルを入力してください';
    if (channelId === '') return 'チャンネルを選択してください';
    const valid = candidates.filter((c) => c.date && c.from && c.to);
    if (valid.length === 0) return '候補日を 1 件以上入力してください';
    for (const c of valid) {
      const s = new Date(`${c.date}T${c.from}:00`).getTime();
      const e = new Date(`${c.date}T${c.to}:00`).getTime();
      if (s >= e) return '候補日の終了時刻は開始時刻より後である必要があります';
    }
    return null;
  };

  const handleSubmitEvent = async () => {
    const err = validateEventForm();
    if (err) {
      setError(err);
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      if (isEdit && event) {
        const { event: updated } = await api.calendar.events.update(event.id, {
          title,
          description: description || null,
          location: location || null,
          startsAt: fromDateTimeInputValue(startsAtInput),
          endsAt: fromDateTimeInputValue(endsAtInput),
          scope: editScope,
        });
        onUpdated(updated);
      } else {
        const { event: created } = await api.calendar.events.create({
          channelId: channelId === '' ? null : channelId,
          title,
          description: description || null,
          location: location || null,
          startsAt: fromDateTimeInputValue(startsAtInput),
          endsAt: fromDateTimeInputValue(endsAtInput),
          attendeeUserIds: attendees.map((u) => u.id),
          reminderOffsetMinutes: reminderOffset > 0 ? reminderOffset : null,
          recurrence: buildRecurrenceInput(),
        });
        onCreated(created);
      }
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : '保存に失敗しました');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmitPoll = async () => {
    const err = validatePollForm();
    if (err) {
      setError(err);
      return;
    }
    // validatePollForm で channelId === '' は弾かれるため、ここでは number で確定
    if (channelId === '') return;
    setError(null);
    setSubmitting(true);
    try {
      const valid = candidates.filter((c) => c.date && c.from && c.to);
      const { poll } = await api.calendar.polls.create({
        channelId,
        title,
        // deadline / candidates ともに buildIso() を通すことで時刻変換ロジックを統一
        deadline: deadline ? buildIso(deadline, '00:00') : null,
        candidates: valid.map((c) => ({
          startsAt: buildIso(c.date, c.from),
          endsAt: buildIso(c.date, c.to),
        })),
      });
      onPollCreated(poll);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : '保存に失敗しました');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="sm"
      fullWidth
      data-testid="calendar-event-dialog"
    >
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1, pb: 1 }}>
        <EventIcon fontSize="small" />
        {isEdit ? 'イベントを編集' : mode === 0 ? '新しい予定' : '日程調整を作成'}
        <Box sx={{ flexGrow: 1 }} />
        <IconButton size="small" onClick={onClose} aria-label="event-dialog-close">
          <CloseIcon fontSize="small" />
        </IconButton>
      </DialogTitle>

      {!isEdit && (
        <Tabs
          value={mode}
          onChange={(_, v) => setMode(v as 0 | 1)}
          sx={{ px: 3, borderBottom: 1, borderColor: 'divider' }}
        >
          <Tab label="予定" sx={{ textTransform: 'none' }} aria-label="event-tab" />
          <Tab
            label="日程調整（候補日投票）"
            sx={{ textTransform: 'none' }}
            aria-label="poll-tab"
          />
        </Tabs>
      )}

      <DialogContent sx={{ pt: 3 }}>
        {error && (
          <Alert severity="error" sx={{ mb: 2 }} role="alert" data-testid="event-dialog-error">
            {error}
          </Alert>
        )}
        <Stack spacing={2.5}>
          <TextField
            label="タイトル"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="例: デザインレビュー"
            autoFocus
            fullWidth
            size="small"
            inputProps={{ 'aria-label': 'event-title' }}
          />

          <TextField
            label="投稿先チャンネル"
            select
            value={channelId === '' ? '' : channelId}
            onChange={(e) => setChannelId(Number(e.target.value))}
            fullWidth
            size="small"
            inputProps={{ 'aria-label': 'event-channel' }}
            helperText="このチャンネルのメンバーに通知されます"
          >
            {channelMenu}
          </TextField>

          {mode === 0 && (
            <>
              <Stack direction="row" spacing={2}>
                <TextField
                  label="開始"
                  type="datetime-local"
                  value={startsAtInput}
                  onChange={(e) => setStartsAtInput(e.target.value)}
                  fullWidth
                  size="small"
                  InputLabelProps={{ shrink: true }}
                  inputProps={{ 'aria-label': 'event-starts-at' }}
                />
                <TextField
                  label="終了"
                  type="datetime-local"
                  value={endsAtInput}
                  onChange={(e) => setEndsAtInput(e.target.value)}
                  fullWidth
                  size="small"
                  InputLabelProps={{ shrink: true }}
                  inputProps={{ 'aria-label': 'event-ends-at' }}
                />
              </Stack>

              {/* #302 繰り返し設定 */}
              <Stack spacing={1.5} data-testid="event-recurrence-section">
                <TextField
                  label="繰り返し"
                  select
                  value={recurrenceRule}
                  onChange={(e) => setRecurrenceRule(e.target.value as RecurrenceUiRule)}
                  size="small"
                  fullWidth
                  inputProps={{ 'aria-label': 'event-recurrence-rule' }}
                  // 編集スコープが 'one' のときは個別インスタンスのみ更新するため繰り返しルールは変更不可
                  disabled={isEdit && editScope === 'one'}
                >
                  <MenuItem value="NONE">なし</MenuItem>
                  <MenuItem value="DAILY">毎日</MenuItem>
                  <MenuItem value="WEEKLY">毎週</MenuItem>
                  <MenuItem value="MONTHLY">毎月</MenuItem>
                  <MenuItem value="YEARLY">毎年</MenuItem>
                </TextField>

                {recurrenceRule === 'WEEKLY' && (
                  <Stack
                    direction="row"
                    spacing={0.5}
                    role="group"
                    aria-label="event-recurrence-weekdays"
                    data-testid="event-recurrence-weekdays"
                  >
                    {WEEKDAY_LABELS.map((label, i) => {
                      const selected = recurrenceDays.includes(i);
                      return (
                        <Chip
                          key={i}
                          label={label}
                          color={selected ? 'primary' : 'default'}
                          variant={selected ? 'filled' : 'outlined'}
                          size="small"
                          onClick={() => {
                            setRecurrenceDays(
                              selected
                                ? recurrenceDays.filter((d) => d !== i)
                                : [...recurrenceDays, i],
                            );
                          }}
                          aria-label={`weekday-${i}`}
                          aria-pressed={selected}
                          sx={{ minWidth: 36 }}
                        />
                      );
                    })}
                  </Stack>
                )}

                {recurrenceRule !== 'NONE' && (
                  <Stack direction="row" spacing={2} alignItems="center">
                    <TextField
                      label="終了条件"
                      select
                      value={endType}
                      onChange={(e) => setEndType(e.target.value as RecurrenceEndType)}
                      size="small"
                      sx={{ width: 160 }}
                      inputProps={{ 'aria-label': 'event-recurrence-end-type' }}
                    >
                      <MenuItem value="never">なし</MenuItem>
                      <MenuItem value="date">終了日</MenuItem>
                      <MenuItem value="count">回数</MenuItem>
                    </TextField>
                    {endType === 'date' && (
                      <TextField
                        type="date"
                        size="small"
                        value={endDate}
                        onChange={(e) => setEndDate(e.target.value)}
                        InputLabelProps={{ shrink: true }}
                        inputProps={{ 'aria-label': 'event-recurrence-end-date' }}
                      />
                    )}
                    {endType === 'count' && (
                      <TextField
                        type="number"
                        size="small"
                        value={endCount}
                        onChange={(e) => setEndCount(Number(e.target.value))}
                        sx={{ width: 100 }}
                        inputProps={{
                          min: 1,
                          max: 365,
                          'aria-label': 'event-recurrence-end-count',
                        }}
                      />
                    )}
                  </Stack>
                )}
              </Stack>

              <TextField
                label="場所 / URL"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="会議室A / Google Meet URL"
                fullWidth
                size="small"
                inputProps={{ 'aria-label': 'event-location' }}
                InputProps={{
                  startAdornment: (
                    <Box sx={{ mr: 1, color: 'text.secondary', display: 'flex' }}>
                      <PlaceIcon fontSize="small" />
                    </Box>
                  ),
                }}
              />
            </>
          )}

          {mode === 1 && !isEdit && (
            <Box>
              <Typography variant="body2" sx={{ mb: 1, fontWeight: 600 }}>
                候補日時
              </Typography>
              <Stack spacing={1}>
                {candidates.map((c, i) => (
                  <Stack
                    key={i}
                    direction="row"
                    spacing={1}
                    alignItems="center"
                    data-testid={`poll-candidate-row-${i}`}
                  >
                    <TextField
                      type="date"
                      size="small"
                      value={c.date}
                      onChange={(e) => {
                        const next = [...candidates];
                        next[i] = { ...c, date: e.target.value };
                        setCandidates(next);
                      }}
                      sx={{ flexGrow: 1 }}
                      inputProps={{ 'aria-label': `poll-candidate-date-${i}` }}
                      InputLabelProps={{ shrink: true }}
                    />
                    <TextField
                      type="time"
                      size="small"
                      value={c.from}
                      onChange={(e) => {
                        const next = [...candidates];
                        next[i] = { ...c, from: e.target.value };
                        setCandidates(next);
                      }}
                      sx={{ width: 110 }}
                      inputProps={{ 'aria-label': `poll-candidate-from-${i}` }}
                    />
                    <Typography>〜</Typography>
                    <TextField
                      type="time"
                      size="small"
                      value={c.to}
                      onChange={(e) => {
                        const next = [...candidates];
                        next[i] = { ...c, to: e.target.value };
                        setCandidates(next);
                      }}
                      sx={{ width: 110 }}
                      inputProps={{ 'aria-label': `poll-candidate-to-${i}` }}
                    />
                    <IconButton
                      size="small"
                      onClick={() => setCandidates(candidates.filter((_, idx) => idx !== i))}
                      aria-label={`poll-candidate-remove-${i}`}
                    >
                      <CloseIcon fontSize="small" />
                    </IconButton>
                  </Stack>
                ))}
              </Stack>
              <Button
                size="small"
                startIcon={<AddIcon fontSize="small" />}
                onClick={() =>
                  setCandidates([...candidates, { date: '', from: '10:00', to: '11:00' }])
                }
                sx={{ mt: 1, textTransform: 'none' }}
                aria-label="poll-add-candidate"
              >
                候補を追加
              </Button>
              <TextField
                label="投票締切"
                type="date"
                value={deadline}
                onChange={(e) => setDeadline(e.target.value)}
                size="small"
                fullWidth
                sx={{ mt: 2 }}
                inputProps={{ 'aria-label': 'poll-deadline' }}
                InputLabelProps={{ shrink: true }}
              />
            </Box>
          )}

          {mode === 0 && !isEdit && (
            <Autocomplete
              multiple
              size="small"
              options={users}
              getOptionLabel={(u) => u.displayName ?? u.username}
              value={attendees}
              onChange={(_, v) => setAttendees(v)}
              renderTags={(value, getTagProps) =>
                value.map((u, index) => (
                  <Chip
                    avatar={
                      <Avatar sx={{ bgcolor: getAvatarColor(u.email) }}>
                        {u.displayName?.[0] ?? u.username[0]}
                      </Avatar>
                    }
                    label={u.displayName ?? u.username}
                    size="small"
                    {...getTagProps({ index })}
                  />
                ))
              }
              renderInput={(params) => (
                <TextField
                  {...params}
                  label="参加者"
                  placeholder="@ ユーザーを追加"
                  inputProps={{ ...params.inputProps, 'aria-label': 'event-attendees' }}
                />
              )}
            />
          )}

          {mode === 0 && (
            <TextField
              label="説明"
              multiline
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              fullWidth
              size="small"
              inputProps={{ 'aria-label': 'event-description' }}
            />
          )}

          {mode === 0 && !isEdit && (
            <Stack direction="row" spacing={2} alignItems="center">
              <TextField
                label="リマインダー"
                select
                value={reminderOffset}
                onChange={(e) => setReminderOffset(Number(e.target.value))}
                size="small"
                sx={{ width: 180 }}
                inputProps={{ 'aria-label': 'event-reminder' }}
              >
                {REMINDER_OPTIONS.map((opt) => (
                  <MenuItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </MenuItem>
                ))}
              </TextField>
            </Stack>
          )}
        </Stack>
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} sx={{ textTransform: 'none' }} disabled={submitting}>
          キャンセル
        </Button>
        <Button
          variant="contained"
          onClick={mode === 0 ? handleSubmitEvent : handleSubmitPoll}
          disabled={submitting}
          aria-label="event-dialog-submit"
          sx={{ textTransform: 'none' }}
        >
          {isEdit ? '保存' : mode === 0 ? '作成' : '投票を開始'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
