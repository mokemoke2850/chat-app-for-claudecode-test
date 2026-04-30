/* global React, MaterialUI, window */
const TweaksPanel = (function () {
  const {
    Box,
    Paper,
    Typography,
    ToggleButton,
    ToggleButtonGroup,
    Slider,
    Switch,
    FormControlLabel,
    Stack,
    IconButton,
    Divider,
  } = MaterialUI;
  const { Icon } = window.CalendarShell;

  return function TweaksPanel({ open, onClose, tweaks, onChange }) {
    if (!open) return null;
    return (
      <Paper
        elevation={8}
        sx={{
          position: 'fixed',
          right: 16,
          bottom: 16,
          width: 280,
          p: 2,
          zIndex: 1400,
          borderRadius: 2,
        }}
      >
        <Stack direction="row" alignItems="center" sx={{ mb: 1 }}>
          <Icon name="tune" size={18} />
          <Typography sx={{ ml: 1, fontSize: 14, fontWeight: 600, flexGrow: 1 }}>
            Tweaks
          </Typography>
          <IconButton size="small" onClick={onClose}>
            <Icon name="close" size={16} />
          </IconButton>
        </Stack>
        <Divider sx={{ mb: 2 }} />

        <Typography sx={{ fontSize: 12, fontWeight: 600, mb: 0.75 }}>デフォルトビュー</Typography>
        <ToggleButtonGroup
          exclusive
          size="small"
          value={tweaks.defaultView}
          onChange={(_, v) => v && onChange({ defaultView: v })}
          sx={{ mb: 2, width: '100%' }}
        >
          <ToggleButton value="month" sx={{ flexGrow: 1, textTransform: 'none' }}>月</ToggleButton>
          <ToggleButton value="week" sx={{ flexGrow: 1, textTransform: 'none' }}>週</ToggleButton>
          <ToggleButton value="agenda" sx={{ flexGrow: 1, textTransform: 'none' }}>アジェンダ</ToggleButton>
        </ToggleButtonGroup>

        <Typography sx={{ fontSize: 12, fontWeight: 600, mb: 0.5 }}>
          アクセントHue: {tweaks.accentHue}°
        </Typography>
        <Slider
          size="small"
          min={0}
          max={360}
          value={tweaks.accentHue}
          onChange={(_, v) => onChange({ accentHue: v })}
          sx={{
            mb: 2,
            color: `hsl(${tweaks.accentHue}, 70%, 50%)`,
          }}
        />

        <FormControlLabel
          control={
            <Switch
              size="small"
              checked={tweaks.showChannelPanel}
              onChange={(e) => onChange({ showChannelPanel: e.target.checked })}
            />
          }
          label={<Typography sx={{ fontSize: 12 }}>チャンネル別予定タブを表示</Typography>}
        />

        <Typography sx={{ fontSize: 11, color: 'text.secondary', mt: 2 }}>
          チャンネルを選ぶと「予定」タブが表示されます。
        </Typography>
      </Paper>
    );
  };
})();

window.TweaksPanel = TweaksPanel;
