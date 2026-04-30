/**
 * #147 カスタムステータス編集ダイアログ
 *
 * 絵文字 + テキスト + 有効期限（プリセット）を設定できる。
 * 絵文字とテキストが両方空の場合はステータスをクリアする。
 */

import { useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  IconButton,
  InputLabel,
  MenuItem,
  Select,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import EmojiEmotionsIcon from '@mui/icons-material/EmojiEmotions';
import type { UserStatus } from '@chat-app/shared';
import { api } from '../../api/client';
import EmojiPicker from '../Chat/EmojiPicker';

type ExpiresPreset = 'none' | '1h' | 'today' | 'tomorrow' | '1week';

function calcExpiresAt(preset: ExpiresPreset): string | null {
  if (preset === 'none') return null;

  const now = new Date();
  if (preset === '1h') {
    return new Date(now.getTime() + 60 * 60 * 1000).toISOString();
  }
  if (preset === 'today') {
    const d = new Date(now);
    d.setHours(23, 59, 59, 0);
    return d.toISOString();
  }
  if (preset === 'tomorrow') {
    const d = new Date(now);
    d.setDate(d.getDate() + 1);
    d.setHours(23, 59, 59, 0);
    return d.toISOString();
  }
  if (preset === '1week') {
    return new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString();
  }
  return null;
}

interface Props {
  open: boolean;
  onClose: () => void;
  onSaved?: () => void;
  currentStatus?: UserStatus | null;
}

export default function StatusEditDialog({ open, onClose, onSaved, currentStatus }: Props) {
  const [emoji, setEmoji] = useState<string | null>(currentStatus?.emoji ?? null);
  const [text, setText] = useState<string>(currentStatus?.text ?? '');
  const [expiresPreset, setExpiresPreset] = useState<ExpiresPreset>('none');
  const [emojiAnchorEl, setEmojiAnchorEl] = useState<HTMLElement | null>(null);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setError('');
    setSaving(true);
    try {
      await api.auth.updateStatus({
        emoji: emoji || null,
        text: text.trim() || null,
        expiresAt: calcExpiresAt(expiresPreset),
      });
      onSaved?.();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : '保存に失敗しました');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="xs">
      <DialogTitle>ステータスを設定</DialogTitle>
      <DialogContent>
        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        {/* 絵文字 + テキスト */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
          <Tooltip title={emoji ? '絵文字をクリア' : '絵文字を選択'}>
            <IconButton
              aria-label={emoji ? '絵文字をクリア' : '絵文字を選択'}
              onClick={(e) => {
                if (emoji) {
                  setEmoji(null);
                } else {
                  setEmojiAnchorEl(e.currentTarget);
                }
              }}
              sx={{
                fontSize: '1.5rem',
                width: 44,
                height: 44,
                border: '1px solid',
                borderColor: 'divider',
              }}
            >
              {emoji ? (
                <Typography sx={{ fontSize: '1.4rem', lineHeight: 1 }}>{emoji}</Typography>
              ) : (
                <EmojiEmotionsIcon />
              )}
            </IconButton>
          </Tooltip>
          <TextField
            label="ステータステキスト"
            inputProps={{ 'aria-label': 'ステータステキスト' }}
            value={text}
            onChange={(e) => setText(e.target.value)}
            fullWidth
            size="small"
            placeholder="例: 会議中、集中モード…"
          />
        </Box>

        {/* 有効期限プリセット */}
        <FormControl fullWidth size="small">
          <InputLabel id="expires-label">有効期限</InputLabel>
          <Select
            labelId="expires-label"
            label="有効期限"
            value={expiresPreset}
            onChange={(e) => setExpiresPreset(e.target.value as ExpiresPreset)}
            inputProps={{ 'aria-label': '有効期限' }}
          >
            <MenuItem value="none">期限なし</MenuItem>
            <MenuItem value="1h">1時間後</MenuItem>
            <MenuItem value="today">今日中</MenuItem>
            <MenuItem value="tomorrow">明日まで</MenuItem>
            <MenuItem value="1week">1週間</MenuItem>
          </Select>
        </FormControl>

        {/* 絵文字ピッカー */}
        <EmojiPicker
          anchorEl={emojiAnchorEl}
          onSelect={(e) => {
            setEmoji(e);
            setEmojiAnchorEl(null);
          }}
          onClose={() => setEmojiAnchorEl(null)}
        />
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>キャンセル</Button>
        <Button variant="contained" onClick={() => void handleSave()} disabled={saving}>
          保存
        </Button>
      </DialogActions>
    </Dialog>
  );
}
