import { Box, Typography } from '@mui/material';
import type { Channel } from '@chat-app/shared';
import TagChip from '../Chat/TagChip';

interface Props {
  channel: Channel;
  onTagClick?: (tagName: string) => void;
}

/**
 * Main トップバー上の topic / tags 表示に専念するコンポーネント。
 * 編集ボタン群 (招待 / ゲスト / 編集) は ContextRail 概要タブの ChannelSettingsForm に集約済み。
 */
export default function ChannelTopicBar({ channel, onTagClick }: Props) {
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', minHeight: 24 }}>
      {channel.topic && (
        <Typography
          variant="body2"
          color="text.secondary"
          sx={{
            flexGrow: 1,
            fontSize: 12,
            overflow: 'hidden',
            whiteSpace: 'nowrap',
            textOverflow: 'ellipsis',
          }}
          title={channel.topic}
          data-testid="channel-topic-text"
        >
          {channel.topic}
        </Typography>
      )}
      {!channel.topic && <Box sx={{ flexGrow: 1 }} />}
      {channel.tags && channel.tags.length > 0 && (
        <Box
          data-testid="channel-tags"
          sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', alignItems: 'center', mr: 0.5 }}
        >
          {channel.tags.map((tag) => (
            <TagChip key={tag.id} tag={tag} onClick={onTagClick} />
          ))}
        </Box>
      )}
    </Box>
  );
}
