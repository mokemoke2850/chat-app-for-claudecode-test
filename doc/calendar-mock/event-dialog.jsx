/* global React, MaterialUI, window */
const EventDialog = (function () {
  const { useState, useEffect } = React;
  const {
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    TextField,
    Button,
    Box,
    Stack,
    MenuItem,
    Chip,
    Typography,
    Autocomplete,
    Avatar,
    Switch,
    FormControlLabel,
    IconButton,
    Tabs,
    Tab,
  } = MaterialUI;
  const { Icon } = window.CalendarShell;

  function dateToInput(d) {
    const pad = (n) => n.toString().padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
      d.getHours(),
    )}:${pad(d.getMinutes())}`;
  }

  return function EventDialog({ open, onClose, initialDate, onCreate }) {
    const { USERS, CHANNELS, CURRENT_USER } = window.__MOCK_DATA__;
    const [mode, setMode] = useState(0); // 0 = 予定, 1 = 日程調整
    const [title, setTitle] = useState('');
    const [channelId, setChannelId] = useState(CHANNELS[0].id);
    const [start, setStart] = useState(() => {
      const d = initialDate || new Date();
      d.setMinutes(0, 0, 0);
      return dateToInput(d);
    });
    const [end, setEnd] = useState(() => {
      const d = initialDate ? new Date(initialDate) : new Date();
      d.setHours(d.getHours() + 1);
      d.setMinutes(0, 0, 0);
      return dateToInput(d);
    });
    const [location, setLocation] = useState('');
    const [description, setDescription] = useState('');
    const [attendees, setAttendees] = useState([]);
    const [notifyChannel, setNotifyChannel] = useState(true);
    const [reminder, setReminder] = useState(15);

    // 日程調整用
    const [candidates, setCandidates] = useState([
      { date: '', from: '10:00', to: '11:00' },
      { date: '', from: '14:00', to: '15:00' },
    ]);
    const [deadline, setDeadline] = useState('');

    useEffect(() => {
      if (open && initialDate) {
        const d = new Date(initialDate);
        d.setMinutes(0, 0, 0);
        setStart(dateToInput(d));
        const e = new Date(d);
        e.setHours(e.getHours() + 1);
        setEnd(dateToInput(e));
      }
    }, [open, initialDate]);

    const handleSubmit = () => {
      if (!title) return;
      onCreate && onCreate({ title, channelId, start, end, location, mode });
      onClose();
    };

    return (
      <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1, pb: 1 }}>
          <Icon name="event" size={22} />
          {mode === 0 ? '新しい予定' : '日程調整を作成'}
          <Box sx={{ flexGrow: 1 }} />
          <IconButton size="small" onClick={onClose}>
            <Icon name="close" size={20} />
          </IconButton>
        </DialogTitle>

        <Tabs
          value={mode}
          onChange={(_, v) => setMode(v)}
          sx={{ px: 3, borderBottom: 1, borderColor: 'divider' }}
        >
          <Tab label="予定" sx={{ textTransform: 'none' }} />
          <Tab label="日程調整（候補日投票）" sx={{ textTransform: 'none' }} />
        </Tabs>

        <DialogContent sx={{ pt: 3 }}>
          <Stack spacing={2.5}>
            <TextField
              label="タイトル"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="例: デザインレビュー"
              autoFocus
              fullWidth
              size="small"
            />

            <TextField
              label="投稿先チャンネル"
              select
              value={channelId}
              onChange={(e) => setChannelId(Number(e.target.value))}
              fullWidth
              size="small"
              helperText="このチャンネルのメンバーに通知されます"
            >
              {CHANNELS.map((c) => (
                <MenuItem key={c.id} value={c.id}>
                  # {c.name}
                </MenuItem>
              ))}
            </TextField>

            {mode === 0 && (
              <>
                <Stack direction="row" spacing={2}>
                  <TextField
                    label="開始"
                    type="datetime-local"
                    value={start}
                    onChange={(e) => setStart(e.target.value)}
                    fullWidth
                    size="small"
                    InputLabelProps={{ shrink: true }}
                  />
                  <TextField
                    label="終了"
                    type="datetime-local"
                    value={end}
                    onChange={(e) => setEnd(e.target.value)}
                    fullWidth
                    size="small"
                    InputLabelProps={{ shrink: true }}
                  />
                </Stack>

                <TextField
                  label="場所 / URL"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  placeholder="会議室A / Google Meet URL"
                  fullWidth
                  size="small"
                  InputProps={{
                    startAdornment: (
                      <Box sx={{ mr: 1, color: 'text.secondary', display: 'flex' }}>
                        <Icon name="place" size={18} />
                      </Box>
                    ),
                  }}
                />
              </>
            )}

            {mode === 1 && (
              <Box>
                <Typography variant="body2" sx={{ mb: 1, fontWeight: 600 }}>
                  候補日時
                </Typography>
                <Stack spacing={1}>
                  {candidates.map((c, i) => (
                    <Stack key={i} direction="row" spacing={1} alignItems="center">
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
                      />
                      <IconButton
                        size="small"
                        onClick={() =>
                          setCandidates(candidates.filter((_, idx) => idx !== i))
                        }
                      >
                        <Icon name="close" size={18} />
                      </IconButton>
                    </Stack>
                  ))}
                </Stack>
                <Button
                  size="small"
                  startIcon={<Icon name="add" size={16} />}
                  onClick={() =>
                    setCandidates([
                      ...candidates,
                      { date: '', from: '10:00', to: '11:00' },
                    ])
                  }
                  sx={{ mt: 1, textTransform: 'none' }}
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
                  InputLabelProps={{ shrink: true }}
                />
              </Box>
            )}

            <Autocomplete
              multiple
              size="small"
              options={USERS}
              getOptionLabel={(u) => u.displayName}
              value={attendees}
              onChange={(_, v) => setAttendees(v)}
              renderTags={(value, getTagProps) =>
                value.map((u, index) => (
                  <Chip
                    avatar={<Avatar sx={{ bgcolor: u.color }}>{u.displayName[0]}</Avatar>}
                    label={u.displayName}
                    size="small"
                    {...getTagProps({ index })}
                  />
                ))
              }
              renderInput={(params) => (
                <TextField {...params} label="参加者" placeholder="@ ユーザーを追加" />
              )}
            />

            <TextField
              label="説明"
              multiline
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              fullWidth
              size="small"
            />

            <Stack direction="row" spacing={2} alignItems="center">
              <TextField
                label="リマインダー"
                select
                value={reminder}
                onChange={(e) => setReminder(Number(e.target.value))}
                size="small"
                sx={{ width: 180 }}
              >
                <MenuItem value={0}>なし</MenuItem>
                <MenuItem value={5}>5分前</MenuItem>
                <MenuItem value={15}>15分前</MenuItem>
                <MenuItem value={30}>30分前</MenuItem>
                <MenuItem value={60}>1時間前</MenuItem>
                <MenuItem value={1440}>1日前</MenuItem>
              </TextField>
              <FormControlLabel
                control={
                  <Switch
                    checked={notifyChannel}
                    onChange={(e) => setNotifyChannel(e.target.checked)}
                  />
                }
                label={
                  <Typography variant="body2">チャンネルに投稿</Typography>
                }
              />
            </Stack>
          </Stack>
        </DialogContent>

        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={onClose} sx={{ textTransform: 'none' }}>
            キャンセル
          </Button>
          <Button
            variant="contained"
            onClick={handleSubmit}
            disabled={!title}
            sx={{ textTransform: 'none' }}
          >
            {mode === 0 ? '作成' : '投票を開始'}
          </Button>
        </DialogActions>
      </Dialog>
    );
  };
})();

window.EventDialog = EventDialog;
