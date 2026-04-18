import { Box, IconButton, Typography } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';

interface AttachmentItem {
  id: number;
  originalName: string;
}

interface Props {
  attachments: AttachmentItem[];
  onRemove: (id: number) => void;
}

export default function AttachmentPreview({ attachments, onRemove }: Props) {
  if (attachments.length === 0) return null;

  return (
    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, px: 1, pt: 0.5 }}>
      {attachments.map((a) => (
        <Box
          key={a.id}
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 0.25,
            bgcolor: 'grey.100',
            borderRadius: 2,
            px: 1,
            py: 0.25,
          }}
        >
          <Typography variant="caption">{a.originalName}</Typography>
          <IconButton
            size="small"
            aria-label={`${a.originalName} を削除`}
            onClick={() => onRemove(a.id)}
            sx={{ p: 0.1 }}
          >
            <CloseIcon sx={{ fontSize: '0.8rem' }} />
          </IconButton>
        </Box>
      ))}
    </Box>
  );
}
