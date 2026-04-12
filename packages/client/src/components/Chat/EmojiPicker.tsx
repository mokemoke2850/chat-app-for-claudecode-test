import { Box, ClickAwayListener, Paper, Popper } from '@mui/material';

const EMOJI_LIST = [
  '👍',
  '👎',
  '❤️',
  '😂',
  '😮',
  '😢',
  '🎉',
  '🔥',
  '👀',
  '✅',
  '❌',
  '🚀',
  '💯',
  '🙏',
  '😍',
  '🤔',
  '👏',
  '💪',
  '🫡',
  '⭐',
];

interface Props {
  anchorEl: HTMLElement | null;
  onSelect: (emoji: string) => void;
  onClose: () => void;
}

export default function EmojiPicker({ anchorEl, onSelect, onClose }: Props) {
  return (
    <Popper
      open={Boolean(anchorEl)}
      anchorEl={anchorEl}
      placement="top-start"
      sx={{ zIndex: 1300 }}
    >
      <ClickAwayListener onClickAway={onClose}>
        <Paper
          data-testid="emoji-picker"
          elevation={3}
          sx={{ p: 0.5, display: 'flex', flexWrap: 'wrap', gap: 0.25, maxWidth: 200 }}
        >
          {EMOJI_LIST.map((emoji) => (
            <Box
              key={emoji}
              component="button"
              aria-label={emoji}
              onClick={() => {
                onSelect(emoji);
                onClose();
              }}
              sx={{
                border: 'none',
                background: 'none',
                cursor: 'pointer',
                fontSize: '1.2rem',
                p: 0.5,
                borderRadius: 1,
                lineHeight: 1,
                '&:hover': { bgcolor: 'action.hover' },
              }}
            >
              {emoji}
            </Box>
          ))}
        </Paper>
      </ClickAwayListener>
    </Popper>
  );
}
