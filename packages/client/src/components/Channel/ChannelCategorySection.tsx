import { useState } from 'react';
import {
  Box,
  Collapse,
  IconButton,
  List,
  Tooltip,
  Typography,
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import MoreHorizIcon from '@mui/icons-material/MoreHoriz';
import type { Channel, ChannelCategory } from '@chat-app/shared';
import ChannelItem from './ChannelItem';

interface ChannelCategorySectionProps {
  category: ChannelCategory;
  channels: Channel[];
  activeChannelId: number | null;
  hoveredId: number | null;
  onSelect: (channelId: number, name: string, channel?: Channel) => void;
  onMouseEnter: (id: number) => void;
  onMouseLeave: () => void;
  onPin: (channelId: number) => void;
  onUnpin: (channelId: number) => void;
  pinnedIds: number[];
  onOpenMembersDialog: (channel: Channel) => void;
  onArchive: (channelId: number) => void;
  currentUserId?: number;
  userRole?: string;
  onEditCategory: (category: ChannelCategory) => void;
  onDeleteCategory: (category: ChannelCategory) => void;
  onToggleCollapse: (categoryId: number, isCollapsed: boolean) => void;
  onAssignChannel: (channelId: number, categoryId: number | null) => void;
  allCategories: ChannelCategory[];
}

export default function ChannelCategorySection({
  category,
  channels,
  activeChannelId,
  hoveredId,
  onSelect,
  onMouseEnter,
  onMouseLeave,
  onPin,
  onUnpin,
  pinnedIds,
  onOpenMembersDialog,
  onArchive,
  currentUserId,
  userRole,
  onEditCategory,
  onDeleteCategory,
  onToggleCollapse,
  onAssignChannel,
  allCategories,
}: ChannelCategorySectionProps) {
  const [isCollapsed, setIsCollapsed] = useState(category.isCollapsed);
  const [menuAnchor, setMenuAnchor] = useState<null | HTMLElement>(null);

  const handleToggle = () => {
    const next = !isCollapsed;
    setIsCollapsed(next);
    onToggleCollapse(category.id, next);
  };

  return (
    <Box>
      {/* カテゴリヘッダー */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          px: 1,
          pt: 1,
          pb: 0.25,
          cursor: 'pointer',
          '&:hover': { bgcolor: 'action.hover' },
        }}
        onClick={handleToggle}
        data-testid={`category-header-${category.id}`}
      >
        <IconButton
          size="small"
          sx={{ p: 0.25, mr: 0.5 }}
          aria-label={isCollapsed ? `${category.name}を展開` : `${category.name}を折りたたむ`}
        >
          {isCollapsed ? (
            <ExpandMoreIcon sx={{ fontSize: 14 }} />
          ) : (
            <ExpandLessIcon sx={{ fontSize: 14 }} />
          )}
        </IconButton>
        <Typography
          variant="caption"
          sx={{
            flexGrow: 1,
            fontWeight: 'bold',
            textTransform: 'uppercase',
            fontSize: 10,
            color: 'text.secondary',
            userSelect: 'none',
          }}
        >
          {category.name}
        </Typography>
        <Tooltip title="カテゴリメニュー">
          <IconButton
            size="small"
            sx={{ p: 0.25 }}
            aria-label={`${category.name}のメニュー`}
            onClick={(e) => {
              e.stopPropagation();
              setMenuAnchor(e.currentTarget);
            }}
          >
            <MoreHorizIcon sx={{ fontSize: 14 }} />
          </IconButton>
        </Tooltip>
      </Box>

      {/* カテゴリメニュー（Material UI Menuに依存しないシンプル実装） */}
      {menuAnchor && (
        <Box
          sx={{
            position: 'fixed',
            top: menuAnchor.getBoundingClientRect().bottom,
            left: menuAnchor.getBoundingClientRect().left,
            bgcolor: 'background.paper',
            boxShadow: 3,
            borderRadius: 1,
            zIndex: 1300,
            minWidth: 140,
          }}
          onMouseLeave={() => setMenuAnchor(null)}
        >
          <Box
            sx={{ px: 2, py: 1, cursor: 'pointer', '&:hover': { bgcolor: 'action.hover' } }}
            onClick={() => {
              setMenuAnchor(null);
              onEditCategory(category);
            }}
            role="menuitem"
            aria-label="編集"
          >
            <Typography variant="body2">編集</Typography>
          </Box>
          <Box
            sx={{ px: 2, py: 1, cursor: 'pointer', '&:hover': { bgcolor: 'action.hover' }, color: 'error.main' }}
            onClick={() => {
              setMenuAnchor(null);
              onDeleteCategory(category);
            }}
            role="menuitem"
            aria-label="削除"
          >
            <Typography variant="body2" color="error">削除</Typography>
          </Box>
        </Box>
      )}

      {/* チャンネル一覧 */}
      <Collapse in={!isCollapsed}>
        <List dense disablePadding>
          {channels.map((ch) => (
            <ChannelItem
              key={ch.id}
              channel={ch}
              isActive={ch.id === activeChannelId}
              isPinned={pinnedIds.includes(ch.id)}
              isHovered={hoveredId === ch.id}
              onMouseEnter={() => onMouseEnter(ch.id)}
              onMouseLeave={onMouseLeave}
              onClick={() => onSelect(ch.id, ch.name, ch)}
              onPin={onPin}
              onUnpin={onUnpin}
              onOpenMembersDialog={onOpenMembersDialog}
              onArchive={onArchive}
              currentUserId={currentUserId}
              userRole={userRole}
              categoryId={category.id}
              allCategories={allCategories}
              onAssignChannel={onAssignChannel}
            />
          ))}
        </List>
      </Collapse>
    </Box>
  );
}
