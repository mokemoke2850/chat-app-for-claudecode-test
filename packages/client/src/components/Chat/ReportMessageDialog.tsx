/**
 * #116 通報ダイアログ
 * メッセージの通報理由を選択して送信するダイアログ
 */

import { useState } from 'react';
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  FormControlLabel,
  Radio,
  RadioGroup,
  TextField,
  Typography,
} from '@mui/material';
import type { ReportReason } from '@chat-app/shared';
import { api } from '../../api/client';

interface Props {
  open: boolean;
  messageId: number;
  onClose: () => void;
}

const REASON_LABELS: Record<ReportReason, string> = {
  spam: 'スパム',
  harassment: 'ハラスメント',
  other: 'その他',
};

export default function ReportMessageDialog({ open, messageId, onClose }: Props) {
  const [reason, setReason] = useState<ReportReason | ''>('');
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleClose = () => {
    setReason('');
    setComment('');
    setError(null);
    onClose();
  };

  const handleSubmit = async () => {
    if (!reason) return;
    setSubmitting(true);
    setError(null);
    try {
      await api.messages.report(messageId, { reason, comment: comment || undefined });
      handleClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : '通報に失敗しました');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="xs" fullWidth>
      <DialogTitle>メッセージを通報</DialogTitle>
      <DialogContent>
        <FormControl component="fieldset" sx={{ width: '100%' }}>
          <RadioGroup
            aria-label="通報理由"
            value={reason}
            onChange={(e) => setReason(e.target.value as ReportReason)}
          >
            {(Object.keys(REASON_LABELS) as ReportReason[]).map((r) => (
              <FormControlLabel key={r} value={r} control={<Radio />} label={REASON_LABELS[r]} />
            ))}
          </RadioGroup>
        </FormControl>
        <TextField
          label="コメント（任意）"
          multiline
          rows={3}
          fullWidth
          sx={{ mt: 2 }}
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          inputProps={{ 'aria-label': '通報コメント' }}
        />
        {error && (
          <Typography color="error" variant="body2" sx={{ mt: 1 }}>
            {error}
          </Typography>
        )}
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={handleClose} variant="outlined">
          キャンセル
        </Button>
        <Button
          onClick={() => void handleSubmit()}
          variant="contained"
          color="error"
          disabled={!reason || submitting}
        >
          通報する
        </Button>
      </DialogActions>
    </Dialog>
  );
}
