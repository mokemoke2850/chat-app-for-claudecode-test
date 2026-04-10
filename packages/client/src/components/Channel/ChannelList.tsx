import { useState, useEffect } from 'react';
import {
  Box, List, ListItem, ListItemButton, ListItemText, IconButton,
  Typography, Divider, Tooltip,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import type { Channel } from '@chat-app/shared';
import { api } from '../../api/client';
import CreateChannelDialog from './CreateChannelDialog';

interface Props {
  activeChannelId: number | null;
  onSelect: (id: number) => void;
}

export default function ChannelList({ activeChannelId, onSelect }: Props) {
  const [channels, setChannels] = useState<Channel[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);

  useEffect(() => {
    api.channels.list()
      .then(({ channels }) => setChannels(channels))
      .catch(console.error);
  }, []);

  const handleCreate = (channel: Channel) => {
    setChannels((prev) => [...prev, channel].sort((a, b) => a.name.localeCompare(b.name)));
    onSelect(channel.id);
  };

  return (
    <Box sx={{ overflow: 'auto', height: '100%' }}>
      <Box sx={{ display: 'flex', alignItems: 'center', px: 2, py: 1 }}>
        <Typography variant="subtitle2" sx={{ flexGrow: 1, fontWeight: 'bold', textTransform: 'uppercase', fontSize: 11 }}>
          Channels
        </Typography>
        <Tooltip title="Create channel">
          <IconButton size="small" onClick={() => setDialogOpen(true)}>
            <AddIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      </Box>

      <Divider />

      <List dense disablePadding>
        {channels.map((ch) => (
          <ListItem key={ch.id} disablePadding>
            <ListItemButton
              selected={ch.id === activeChannelId}
              onClick={() => onSelect(ch.id)}
            >
              <ListItemText
                primary={`# ${ch.name}`}
                primaryTypographyProps={{ fontSize: 14 }}
              />
            </ListItemButton>
          </ListItem>
        ))}
      </List>

      <CreateChannelDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        onCreate={handleCreate}
      />
    </Box>
  );
}
