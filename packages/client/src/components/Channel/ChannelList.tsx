import { useState, useEffect } from 'react';
import {
  Box,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  IconButton,
  Typography,
  Divider,
  Tooltip,
  InputBase,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import SearchIcon from '@mui/icons-material/Search';
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
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    api.channels
      .list()
      .then(({ channels }) => setChannels(channels))
      .catch(console.error);
  }, []);

  const handleCreate = (channel: Channel) => {
    setChannels((prev) => [...prev, channel].sort((a, b) => a.name.localeCompare(b.name)));
    onSelect(channel.id);
  };

  const filteredChannels = searchQuery
    ? channels.filter((ch) => ch.name.toLowerCase().includes(searchQuery.toLowerCase()))
    : channels;

  return (
    <Box sx={{ overflow: 'auto', height: '100%' }}>
      <Box sx={{ display: 'flex', alignItems: 'center', px: 2, py: 1 }}>
        <Typography
          variant="subtitle2"
          sx={{ flexGrow: 1, fontWeight: 'bold', textTransform: 'uppercase', fontSize: 11 }}
        >
          Channels
        </Typography>
        <Tooltip title="Create channel">
          <IconButton size="small" onClick={() => setDialogOpen(true)}>
            <AddIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      </Box>

      <Box sx={{ display: 'flex', alignItems: 'center', px: 1, pb: 1 }}>
        <SearchIcon sx={{ fontSize: 16, color: 'text.secondary', mr: 0.5 }} />
        <InputBase
          placeholder="Search channels"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          inputProps={{ 'aria-label': 'search channels' }}
          sx={{ fontSize: 13, flexGrow: 1 }}
        />
      </Box>

      <Divider />

      <List dense disablePadding>
        {filteredChannels.map((ch) => (
          <ListItem key={ch.id} disablePadding>
            <ListItemButton selected={ch.id === activeChannelId} onClick={() => onSelect(ch.id)}>
              <ListItemText primary={`# ${ch.name}`} primaryTypographyProps={{ fontSize: 14 }} />
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
