import { Box, IconButton, Tooltip, Typography } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';

interface QuotedMessage {
  id: number;
  content: string;
  username: string;
  createdAt: string;
}

interface Props {
  quotedMessage: QuotedMessage | null | undefined;
  onClearQuote?: () => void;
}

export default function QuotedMessageBanner({ quotedMessage, onClearQuote }: Props) {
  if (!quotedMessage) return null;

  const preview = (() => {
    try {
      const parsed = JSON.parse(quotedMessage.content) as {
        ops?: { insert?: string | object }[];
      };
      return (
        parsed.ops
          ?.map((op) => (typeof op.insert === 'string' ? op.insert : ''))
          .join('')
          .trim()
          .slice(0, 100) ?? quotedMessage.content
      );
    } catch {
      return quotedMessage.content;
    }
  })();

  return (
    <Box
      data-testid="quoted-message-preview"
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 1,
        borderLeft: '3px solid',
        borderColor: 'primary.main',
        pl: 1,
        pr: 0.5,
        py: 0.5,
        mb: 0.5,
        bgcolor: 'action.hover',
        borderRadius: '0 4px 4px 0',
      }}
    >
      <Box sx={{ flexGrow: 1, minWidth: 0 }}>
        <Typography
          variant="caption"
          fontWeight="bold"
          data-testid="quoted-username"
          display="block"
        >
          {quotedMessage.username}
        </Typography>
        <Typography
          variant="caption"
          color="text.secondary"
          data-testid="quoted-content"
          display="block"
          sx={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
        >
          {preview}
        </Typography>
      </Box>
      <Tooltip title="引用をクリア">
        <IconButton
          size="small"
          aria-label="引用をクリア"
          onClick={onClearQuote}
          sx={{ p: 0.25, flexShrink: 0 }}
        >
          <CloseIcon sx={{ fontSize: '0.8rem' }} />
        </IconButton>
      </Tooltip>
    </Box>
  );
}
