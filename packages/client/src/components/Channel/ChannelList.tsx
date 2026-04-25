import { use, useState, Suspense, useEffect } from 'react';
import {
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Divider,
  IconButton,
  List,
  Tooltip,
  Typography,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  useDroppable,
} from '@dnd-kit/core';
import type { DragEndEvent, DragStartEvent } from '@dnd-kit/core';
import type { Channel, Message, ChannelCategory } from '@chat-app/shared';
import { api } from '../../api/client';
import { useSocket } from '../../contexts/SocketContext';
import { useAuth } from '../../contexts/AuthContext';
import { useSnackbar } from '../../contexts/SnackbarContext';
import CreateChannelDialog from './CreateChannelDialog';
import ChannelMembersDialog from './ChannelMembersDialog';
import ChannelSearchBox from './ChannelSearchBox';
import ChannelItem from './ChannelItem';
import ChannelCategorySection from './ChannelCategorySection';
import ChannelCategoryDialog from './ChannelCategoryDialog';
import DmNavigationItems from './DmNavigationItems';
import { useChannelNotifications } from '../../hooks/useChannelNotifications';

const PINS_STORAGE_KEY_PREFIX = 'channel_pins';

/**
 * React 19 の concurrent モードではコミット前に同じコンポーネントが複数回インスタンス化される
 * 場合があり、useState イニシャライザが多重実行されると API が多重発行される。
 * モジュールレベルキャッシュで 1 回しかフェッチしないようにする。
 */
let _channelsPromise: Promise<{ channels: Channel[] }> | null = null;
let _categoriesPromise: Promise<{ categories: ChannelCategory[] }> | null = null;

function getOrCreateChannelsPromise(): Promise<{ channels: Channel[] }> {
  if (!_channelsPromise) {
    _channelsPromise = api.channels.list();
  }
  return _channelsPromise;
}

function getOrCreateCategoriesPromise(): Promise<{ categories: ChannelCategory[] }> {
  if (!_categoriesPromise) {
    _categoriesPromise = api.channelCategories.list();
  }
  return _categoriesPromise;
}

/** テスト用: モジュールレベルのチャンネルキャッシュをリセットする */
export function resetChannelsCache(): void {
  _channelsPromise = null;
  _categoriesPromise = null;
}

/** @deprecated テスト用エイリアス。resetChannelsCache() を使うこと */
export const _resetChannelsPromiseForTest = resetChannelsCache;

interface Props {
  activeChannelId: number | null;
  onSelect: (id: number, name: string, channel?: Channel) => void;
}

function getPinsKey(userId: number): string {
  return `${PINS_STORAGE_KEY_PREFIX}_${userId}`;
}

function loadPins(userId: number): number[] {
  try {
    return JSON.parse(localStorage.getItem(getPinsKey(userId)) ?? '[]') as number[];
  } catch {
    return [];
  }
}

function savePins(userId: number, pins: number[]): void {
  localStorage.setItem(getPinsKey(userId), JSON.stringify(pins));
}

/** 「その他」ドロップゾーン */
function UnassignedSection({
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
  allCategories,
  onAssignChannel,
  getNotificationLevel,
  setNotificationLevel,
}: {
  channels: Channel[];
  activeChannelId: number | null;
  hoveredId: number | null;
  onSelect: (id: number) => void;
  onMouseEnter: (id: number) => void;
  onMouseLeave: () => void;
  onPin: (id: number) => void;
  onUnpin: (id: number) => void;
  pinnedIds: number[];
  onOpenMembersDialog: (ch: Channel) => void;
  onArchive: (id: number) => void;
  currentUserId?: number;
  userRole?: string;
  allCategories: ChannelCategory[];
  onAssignChannel: (channelId: number, categoryId: number | null) => void;
  getNotificationLevel: (channelId: number) => import('@chat-app/shared').ChannelNotificationLevel;
  setNotificationLevel: (
    channelId: number,
    level: import('@chat-app/shared').ChannelNotificationLevel,
  ) => Promise<void>;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: 'unassigned' });

  return (
    <Box
      ref={setNodeRef}
      data-testid="unassigned-channels"
      sx={
        isOver ? { outline: '2px solid', outlineColor: 'primary.main', borderRadius: 1 } : undefined
      }
    >
      <Typography
        variant="caption"
        sx={{
          px: 2,
          pt: 1,
          pb: 0.5,
          display: 'block',
          color: 'text.secondary',
          fontWeight: 'bold',
          textTransform: 'uppercase',
          fontSize: 10,
        }}
      >
        その他
      </Typography>
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
            onClick={() => onSelect(ch.id)}
            onPin={onPin}
            onUnpin={onUnpin}
            onOpenMembersDialog={onOpenMembersDialog}
            onArchive={onArchive}
            currentUserId={currentUserId}
            userRole={userRole}
            allCategories={allCategories}
            categoryId={null}
            onAssignChannel={onAssignChannel}
            notificationLevel={getNotificationLevel(ch.id)}
            onChangeNotificationLevel={setNotificationLevel}
          />
        ))}
      </List>
    </Box>
  );
}

interface ChannelListContentProps {
  channelsPromise: Promise<{ channels: Channel[] }>;
  categoriesPromise: Promise<{ categories: ChannelCategory[] }>;
  activeChannelId: number | null;
  onSelect: (id: number, name: string, channel?: Channel) => void;
}

function ChannelListContent({
  channelsPromise,
  categoriesPromise,
  activeChannelId,
  onSelect,
}: ChannelListContentProps) {
  const { channels: initialChannels } = use(channelsPromise);
  const { categories: initialCategories } = use(categoriesPromise);
  const [channels, setChannels] = useState<Channel[]>(initialChannels);
  const [categories, setCategories] = useState<ChannelCategory[]>(initialCategories);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [membersDialogChannel, setMembersDialogChannel] = useState<Channel | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const socket = useSocket();
  const { user } = useAuth();
  const { showSuccess, showError } = useSnackbar();
  const { getLevel: getNotificationLevel, setLevel: setNotificationLevel } =
    useChannelNotifications();
  const [pinnedIds, setPinnedIds] = useState<number[]>(() => loadPins(user?.id ?? 0));
  const [hoveredId, setHoveredId] = useState<number | null>(null);
  const [dmUnreadCount, setDmUnreadCount] = useState(0);

  // カテゴリダイアログ状態
  const [categoryDialogOpen, setCategoryDialogOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<ChannelCategory | null>(null);

  // カテゴリ削除確認ダイアログ状態
  const [deletingCategory, setDeletingCategory] = useState<ChannelCategory | null>(null);

  // チャンネルのカテゴリ割当マップ: channelId → categoryId
  const [channelCategoryMap, setChannelCategoryMap] = useState<Map<number, number>>(() => {
    const map = new Map<number, number>();
    for (const cat of initialCategories) {
      for (const chId of cat.channelIds ?? []) {
        map.set(chId, cat.id);
      }
    }
    return map;
  });

  // 非アクティブチャンネルの new_message を受信して unreadCount をインクリメント
  useEffect(() => {
    if (!socket) return;

    const handleNewMessage = (message: Message) => {
      if (message.channelId === activeChannelId) return;
      setChannels((prev) =>
        prev.map((ch) =>
          ch.id === message.channelId ? { ...ch, unreadCount: ch.unreadCount + 1 } : ch,
        ),
      );
    };

    socket.on('new_message', handleNewMessage);
    return () => {
      socket.off('new_message', handleNewMessage);
    };
  }, [socket, activeChannelId]);

  // mention_updated を受信して mentionCount を更新
  useEffect(() => {
    if (!socket) return;

    const handleMentionUpdated = (data: { channelId: number; mentionCount: number }) => {
      setChannels((prev) =>
        prev.map((ch) =>
          ch.id === data.channelId ? { ...ch, mentionCount: data.mentionCount } : ch,
        ),
      );
    };

    socket.on('mention_updated', handleMentionUpdated);
    return () => {
      socket.off('mention_updated', handleMentionUpdated);
    };
  }, [socket]);

  const handleSelect = (channelId: number) => {
    // 即時リセット（API レスポンス待ちなし）
    setChannels((prev) =>
      prev.map((ch) => (ch.id === channelId ? { ...ch, unreadCount: 0, mentionCount: 0 } : ch)),
    );
    void api.channels.read(channelId);
    const channel = channels.find((ch) => ch.id === channelId);
    const name = channel?.name ?? '';
    onSelect(channelId, name, channel);
  };

  const handleCreate = (channel: Channel) => {
    setChannels((prev) => [...prev, channel].sort((a, b) => a.name.localeCompare(b.name)));
    onSelect(channel.id, channel.name, channel);
  };

  const handlePin = (channelId: number) => {
    setPinnedIds((prev) => {
      const next = [...prev, channelId];
      savePins(user?.id ?? 0, next);
      return next;
    });
  };

  const handleUnpin = (channelId: number) => {
    setPinnedIds((prev) => {
      const next = prev.filter((id) => id !== channelId);
      savePins(user?.id ?? 0, next);
      return next;
    });
  };

  const handleArchive = async (channelId: number) => {
    const channel = channels.find((ch) => ch.id === channelId);
    try {
      await api.channels.archive(channelId);
      setChannels((prev) => prev.filter((ch) => ch.id !== channelId));
      showSuccess(`#${channel?.name ?? ''} をアーカイブしました`);
    } catch (err) {
      showError(err instanceof Error ? err.message : 'アーカイブに失敗しました');
    }
  };

  // カテゴリ作成
  const handleCreateCategory = async (name: string) => {
    try {
      const { category } = await api.channelCategories.create({ name });
      setCategories((prev) => [...prev, { ...category, channelIds: [] }]);
      showSuccess(`カテゴリ「${name}」を作成しました`);
    } catch (err) {
      showError(err instanceof Error ? err.message : 'カテゴリの作成に失敗しました');
      throw err;
    }
  };

  // カテゴリ更新
  const handleUpdateCategory = async (id: number, name: string) => {
    try {
      const { category } = await api.channelCategories.update(id, { name });
      setCategories((prev) =>
        prev.map((c) => (c.id === id ? { ...category, channelIds: c.channelIds } : c)),
      );
      showSuccess(`カテゴリ名を「${name}」に変更しました`);
    } catch (err) {
      showError(err instanceof Error ? err.message : 'カテゴリの更新に失敗しました');
      throw err;
    }
  };

  // カテゴリ削除
  const handleDeleteCategory = async (category: ChannelCategory) => {
    try {
      await api.channelCategories.delete(category.id);
      setCategories((prev) => prev.filter((c) => c.id !== category.id));
      // 削除カテゴリのチャンネルをマップから除去
      setChannelCategoryMap((prev) => {
        const next = new Map(prev);
        for (const [chId, catId] of next.entries()) {
          if (catId === category.id) next.delete(chId);
        }
        return next;
      });
      showSuccess(`カテゴリ「${category.name}」を削除しました`);
    } catch (err) {
      showError(err instanceof Error ? err.message : 'カテゴリの削除に失敗しました');
    }
    setDeletingCategory(null);
  };

  // D&D: ドラッグ中チャンネル追跡
  const [draggingChannelId, setDraggingChannelId] = useState<number | null>(null);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));

  const handleDragStart = (event: DragStartEvent) => {
    const channelId = event.active.data.current?.channelId as number | undefined;
    if (channelId !== undefined) {
      setDraggingChannelId(channelId);
    }
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    setDraggingChannelId(null);
    const { active, over } = event;
    if (!over) return;

    const channelId = active.data.current?.channelId as number | undefined;
    if (channelId === undefined) return;

    let targetCategoryId: number | null;
    if (over.id === 'unassigned') {
      targetCategoryId = null;
    } else {
      const catId = over.data.current?.categoryId as number | undefined;
      if (catId === undefined) return;
      targetCategoryId = catId;
    }

    // 既に同じカテゴリの場合はスキップ
    const currentCatId = channelCategoryMap.get(channelId) ?? null;
    if (currentCatId === targetCategoryId) return;

    await handleAssignChannel(channelId, targetCategoryId);
  };

  // カテゴリ折りたたみトグル
  const handleToggleCollapse = async (categoryId: number, isCollapsed: boolean) => {
    try {
      await api.channelCategories.update(categoryId, { isCollapsed });
      setCategories((prev) => prev.map((c) => (c.id === categoryId ? { ...c, isCollapsed } : c)));
    } catch {
      // サイレント失敗（UI側は既にトグル済み）
    }
  };

  // チャンネルのカテゴリ割当
  const handleAssignChannel = async (channelId: number, categoryId: number | null) => {
    try {
      if (categoryId === null) {
        await api.channelCategories.unassignChannel(channelId);
        setChannelCategoryMap((prev) => {
          const next = new Map(prev);
          next.delete(channelId);
          return next;
        });
        // categoriesのchannelIdsも更新
        setCategories((prev) =>
          prev.map((c) => ({
            ...c,
            channelIds: (c.channelIds ?? []).filter((id) => id !== channelId),
          })),
        );
      } else {
        await api.channelCategories.assignChannel(channelId, categoryId);
        const prevCatId = channelCategoryMap.get(channelId);
        setChannelCategoryMap((prev) => {
          const next = new Map(prev);
          next.set(channelId, categoryId);
          return next;
        });
        setCategories((prev) =>
          prev.map((c) => {
            if (c.id === prevCatId) {
              return { ...c, channelIds: (c.channelIds ?? []).filter((id) => id !== channelId) };
            }
            if (c.id === categoryId) {
              return { ...c, channelIds: [...(c.channelIds ?? []), channelId] };
            }
            return c;
          }),
        );
      }
    } catch (err) {
      showError(err instanceof Error ? err.message : 'カテゴリの割り当てに失敗しました');
    }
  };

  const filteredChannels = searchQuery
    ? channels.filter((ch) => ch.name.toLowerCase().includes(searchQuery.toLowerCase()))
    : channels;

  const pinnedChannels = filteredChannels.filter((ch) => pinnedIds.includes(ch.id));
  const unpinnedChannels = filteredChannels.filter((ch) => !pinnedIds.includes(ch.id));

  // カテゴリ別チャンネルグループを構築
  const hasCategories = categories.length > 0;

  // カテゴリごとのチャンネル一覧
  const channelsByCategory = categories.map((cat) => ({
    category: cat,
    channels: unpinnedChannels.filter((ch) => channelCategoryMap.get(ch.id) === cat.id),
  }));

  // 未割当チャンネル（「その他」）
  const unassignedChannels = unpinnedChannels.filter((ch) => !channelCategoryMap.has(ch.id));

  const draggingChannel =
    draggingChannelId !== null
      ? (channels.find((ch) => ch.id === draggingChannelId) ?? null)
      : null;

  return (
    <DndContext
      sensors={sensors}
      onDragStart={handleDragStart}
      onDragEnd={(e) => {
        void handleDragEnd(e);
      }}
    >
      <Box sx={{ overflow: 'auto', height: '100%' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', px: 2, py: 1 }}>
          <Typography
            variant="subtitle2"
            sx={{ flexGrow: 1, fontWeight: 'bold', textTransform: 'uppercase', fontSize: 11 }}
          >
            Channels
          </Typography>
          <Tooltip title="カテゴリを追加">
            <IconButton
              size="small"
              aria-label="カテゴリを追加"
              onClick={() => {
                setEditingCategory(null);
                setCategoryDialogOpen(true);
              }}
            >
              <AddIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          <Tooltip title="Create channel">
            <IconButton size="small" onClick={() => setDialogOpen(true)}>
              <AddIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </Box>

        <ChannelSearchBox value={searchQuery} onChange={setSearchQuery} />

        <Divider />

        {/* ピン留めセクション */}
        {pinnedChannels.length > 0 && (
          <Box data-testid="pinned-channels">
            <Typography
              variant="caption"
              sx={{
                px: 2,
                pt: 1,
                pb: 0.5,
                display: 'block',
                color: 'text.secondary',
                fontWeight: 'bold',
                textTransform: 'uppercase',
                fontSize: 10,
              }}
            >
              ピン留め
            </Typography>
            <List dense disablePadding>
              {pinnedChannels.map((ch) => (
                <ChannelItem
                  key={ch.id}
                  channel={ch}
                  isActive={ch.id === activeChannelId}
                  isPinned={true}
                  isHovered={hoveredId === ch.id}
                  onMouseEnter={() => setHoveredId(ch.id)}
                  onMouseLeave={() => setHoveredId(null)}
                  onClick={() => handleSelect(ch.id)}
                  onPin={handlePin}
                  onUnpin={handleUnpin}
                  onOpenMembersDialog={setMembersDialogChannel}
                  onArchive={(id) => void handleArchive(id)}
                  currentUserId={user?.id}
                  userRole={user?.role}
                  allCategories={categories}
                  categoryId={channelCategoryMap.get(ch.id) ?? null}
                  onAssignChannel={handleAssignChannel}
                  disableDrag={true}
                  notificationLevel={getNotificationLevel(ch.id)}
                  onChangeNotificationLevel={setNotificationLevel}
                />
              ))}
            </List>
            <Divider />
          </Box>
        )}

        {/* カテゴリセクション（カテゴリが存在する場合） */}
        {hasCategories ? (
          <>
            {channelsByCategory.map(({ category, channels: catChannels }) => {
              // 検索クエリがある場合、マッチするチャンネルが0件のカテゴリは非表示
              if (searchQuery && catChannels.length === 0) return null;
              return (
                <ChannelCategorySection
                  key={category.id}
                  category={category}
                  channels={catChannels}
                  activeChannelId={activeChannelId}
                  hoveredId={hoveredId}
                  onSelect={handleSelect}
                  onMouseEnter={setHoveredId}
                  onMouseLeave={() => setHoveredId(null)}
                  onPin={handlePin}
                  onUnpin={handleUnpin}
                  pinnedIds={pinnedIds}
                  onOpenMembersDialog={setMembersDialogChannel}
                  onArchive={(id) => void handleArchive(id)}
                  currentUserId={user?.id}
                  userRole={user?.role}
                  onEditCategory={(cat) => {
                    setEditingCategory(cat);
                    setCategoryDialogOpen(true);
                  }}
                  onDeleteCategory={setDeletingCategory}
                  onToggleCollapse={handleToggleCollapse}
                  onAssignChannel={handleAssignChannel}
                  allCategories={categories}
                  getNotificationLevel={getNotificationLevel}
                  setNotificationLevel={setNotificationLevel}
                />
              );
            })}

            {/* 「その他」セクション（未割当チャンネル・常にドロップ可能） */}
            <UnassignedSection
              channels={unassignedChannels}
              activeChannelId={activeChannelId}
              hoveredId={hoveredId}
              onSelect={handleSelect}
              onMouseEnter={setHoveredId}
              onMouseLeave={() => setHoveredId(null)}
              onPin={handlePin}
              onUnpin={handleUnpin}
              pinnedIds={pinnedIds}
              onOpenMembersDialog={setMembersDialogChannel}
              onArchive={(id) => void handleArchive(id)}
              currentUserId={user?.id}
              userRole={user?.role}
              allCategories={categories}
              onAssignChannel={handleAssignChannel}
              getNotificationLevel={getNotificationLevel}
              setNotificationLevel={setNotificationLevel}
            />
          </>
        ) : (
          /* カテゴリなし: 通常チャンネルセクション */
          <Box data-testid="all-channels">
            <List dense disablePadding>
              {unpinnedChannels.map((ch) => (
                <ChannelItem
                  key={ch.id}
                  channel={ch}
                  isActive={ch.id === activeChannelId}
                  isPinned={false}
                  isHovered={hoveredId === ch.id}
                  onMouseEnter={() => setHoveredId(ch.id)}
                  onMouseLeave={() => setHoveredId(null)}
                  onClick={() => handleSelect(ch.id)}
                  onPin={handlePin}
                  onUnpin={handleUnpin}
                  onOpenMembersDialog={setMembersDialogChannel}
                  onArchive={(id) => void handleArchive(id)}
                  currentUserId={user?.id}
                  userRole={user?.role}
                  notificationLevel={getNotificationLevel(ch.id)}
                  onChangeNotificationLevel={setNotificationLevel}
                />
              ))}
            </List>
          </Box>
        )}

        <DmNavigationItems dmUnreadCount={dmUnreadCount} onDmUnreadCountChange={setDmUnreadCount} />

        <CreateChannelDialog
          open={dialogOpen}
          onClose={() => setDialogOpen(false)}
          onCreate={handleCreate}
        />

        <ChannelCategoryDialog
          open={categoryDialogOpen}
          editingCategory={editingCategory}
          onClose={() => setCategoryDialogOpen(false)}
          onCreate={handleCreateCategory}
          onUpdate={handleUpdateCategory}
        />

        {/* カテゴリ削除確認ダイアログ */}
        <Dialog open={deletingCategory !== null} onClose={() => setDeletingCategory(null)}>
          <DialogTitle>カテゴリの削除</DialogTitle>
          <DialogContent>
            <DialogContentText>
              「{deletingCategory?.name}」を削除しますか？
              このカテゴリに割り当てられたチャンネルは「その他」に移動します。
            </DialogContentText>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setDeletingCategory(null)}>キャンセル</Button>
            <Button
              onClick={() => {
                if (deletingCategory) void handleDeleteCategory(deletingCategory);
              }}
              color="error"
              aria-label="削除"
            >
              削除
            </Button>
          </DialogActions>
        </Dialog>

        {membersDialogChannel && (
          <ChannelMembersDialog
            open={true}
            channelId={membersDialogChannel.id}
            onClose={() => setMembersDialogChannel(null)}
          />
        )}

        {/* D&D ドラッグ中オーバーレイ */}
        <DragOverlay>
          {draggingChannel ? (
            <Box
              sx={{
                bgcolor: 'background.paper',
                boxShadow: 3,
                borderRadius: 1,
                px: 2,
                py: 0.5,
                fontSize: 14,
                opacity: 0.9,
                cursor: 'grabbing',
              }}
            >
              # {draggingChannel.name}
            </Box>
          ) : null}
        </DragOverlay>
      </Box>
    </DndContext>
  );
}

export default function ChannelList({ activeChannelId, onSelect }: Props) {
  const [channelsPromise] = useState(() => getOrCreateChannelsPromise());
  const [categoriesPromise] = useState(() => getOrCreateCategoriesPromise());

  return (
    <Suspense
      fallback={
        <Box sx={{ display: 'flex', justifyContent: 'center', pt: 4 }}>
          <CircularProgress size={24} />
        </Box>
      }
    >
      <ChannelListContent
        channelsPromise={channelsPromise}
        categoriesPromise={categoriesPromise}
        activeChannelId={activeChannelId}
        onSelect={onSelect}
      />
    </Suspense>
  );
}
