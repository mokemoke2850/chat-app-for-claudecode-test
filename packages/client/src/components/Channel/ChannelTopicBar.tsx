import { useState } from 'react';
import {
  Box,
  Typography,
  IconButton,
  Tooltip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
} from '@mui/material';
import EditIcon from '@mui/icons-material/Edit';
import type { Channel } from '@chat-app/shared';
import { api } from '../../api/client';
import { useSnackbar } from '../../contexts/SnackbarContext';

interface Props {
  channel: Channel;
  currentUserId: number;
  userRole: string;
  onTopicUpdated: (channel: Channel) => void;
}

export default function ChannelTopicBar({ channel, currentUserId, userRole, onTopicUpdated }: Props) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [topicInput, setTopicInput] = useState(channel.topic ?? '');
  const [descriptionInput, setDescriptionInput] = useState(channel.description ?? '');
  const [saving, setSaving] = useState(false);
  const { showSuccess, showError } = useSnackbar();

  const canEdit = userRole === 'admin' || channel.createdBy === currentUserId;

  const handleOpen = () => {
    setTopicInput(channel.topic ?? '');
    setDescriptionInput(channel.description ?? '');
    setDialogOpen(true);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const result = await api.channels.updateTopic(channel.id, {
        topic: topicInput || null,
        description: descriptionInput || null,
      });
      onTopicUpdated(result.channel);
      showSuccess('トピックを更新しました');
      setDialogOpen(false);
    } catch {
      showError('トピックの更新に失敗しました');
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <Box sx={{ display: 'flex', alignItems: 'center', minHeight: 24 }}>
        {channel.topic && (
          <Typography
            variant="body2"
            color="text.secondary"
            sx={{ flexGrow: 1, fontSize: 12 }}
            data-testid="channel-topic-text"
          >
            {channel.topic}
          </Typography>
        )}
        {!channel.topic && <Box sx={{ flexGrow: 1 }} />}
        {canEdit && (
          <Tooltip title="トピックを編集">
            <IconButton size="small" aria-label="編集" onClick={handleOpen}>
              <EditIcon sx={{ fontSize: 14 }} />
            </IconButton>
          </Tooltip>
        )}
      </Box>

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>チャンネルトピックを編集</DialogTitle>
        <DialogContent>
          <TextField
            label="トピック"
            fullWidth
            value={topicInput}
            onChange={(e) => setTopicInput(e.target.value)}
            margin="normal"
            placeholder="チャンネルの目的や現在のテーマ"
            inputProps={{ 'aria-label': 'トピック' }}
          />
          <TextField
            label="説明"
            fullWidth
            multiline
            rows={3}
            value={descriptionInput}
            onChange={(e) => setDescriptionInput(e.target.value)}
            margin="normal"
            placeholder="チャンネルの詳細な説明"
            inputProps={{ 'aria-label': '説明' }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)} disabled={saving}>
            キャンセル
          </Button>
          <Button onClick={() => void handleSave()} disabled={saving} variant="contained">
            保存
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
