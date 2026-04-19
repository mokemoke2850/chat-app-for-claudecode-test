/**
 * おすすめチャンネル一覧コンポーネント（オンボーディング Step 2 用）
 */
import { useState } from 'react';
import { Typography, Button, List, ListItem, ListItemText, Chip } from '@mui/material';
import type { Channel } from '@chat-app/shared';
import { api } from '../../api/client';

interface Props {
  channels: Channel[];
}

export default function RecommendedChannelList({ channels }: Props) {
  const [joinedIds, setJoinedIds] = useState<Set<number>>(new Set());

  const recommended = channels.filter((c) => c.isRecommended);

  const handleJoin = async (channelId: number) => {
    try {
      await api.channels.join(channelId);
      setJoinedIds((prev) => new Set([...prev, channelId]));
    } catch {
      // 参加失敗は無視（既に参加済み等）
    }
  };

  if (recommended.length === 0) {
    return (
      <Typography variant="body2" color="text.secondary">
        おすすめチャンネルはありません。
      </Typography>
    );
  }

  return (
    <List dense>
      {recommended.map((ch) => {
        const joined = joinedIds.has(ch.id);
        return (
          <ListItem
            key={ch.id}
            secondaryAction={
              joined ? (
                <Chip label="参加済み" size="small" color="success" />
              ) : (
                <Button size="small" variant="outlined" onClick={() => void handleJoin(ch.id)}>
                  このチャンネルに参加
                </Button>
              )
            }
          >
            <ListItemText primary={ch.name} secondary={ch.description ?? undefined} />
          </ListItem>
        );
      })}
    </List>
  );
}
