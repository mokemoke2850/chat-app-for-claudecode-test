import { useState, useEffect, useCallback, useMemo, Suspense, useRef } from 'react';
import { Box, IconButton, Tooltip, Typography, CircularProgress } from '@mui/material';
import ScheduleSendIcon from '@mui/icons-material/ScheduleSend';
import AttachFileIcon from '@mui/icons-material/AttachFile';
import AppLayout from '../components/Layout/AppLayout';
import { ChannelFilesTab } from './FilesPage';
import ChannelList from '../components/Channel/ChannelList';
import ChannelTopicBar from '../components/Channel/ChannelTopicBar';
import MessageList from '../components/Chat/MessageList';
import RichEditor, { type QuotedMessagePreview } from '../components/Chat/RichEditor';
import SearchResults from '../components/Chat/SearchResults';
import SearchFilterPanel, { type SearchFilters } from '../components/Chat/SearchFilterPanel';
import ThreadPanel from '../components/Chat/ThreadPanel';
import ScheduledMessagesDialog from '../components/Chat/ScheduledMessagesDialog';
import CreateEventDialog from '../components/Chat/CreateEventDialog';
import { useMessages } from '../hooks/useMessages';
import { useScheduledMessages } from '../hooks/useScheduledMessages';
import { useSocket } from '../contexts/SocketContext';
import { api } from '../api/client';
import type { User, Message, MessageSearchResult, Channel, SavedViewQuery } from '@chat-app/shared';
import PinnedMessages from '../components/Channel/PinnedMessages';
import ArchivedBanner from '../components/Channel/ArchivedBanner';
import { useAuth } from '../contexts/AuthContext';
import { useSnackbar } from '../contexts/SnackbarContext';

interface Props {
  users: User[];
}

export default function ChatPage({ users }: Props) {
  const [activeChannelId, setActiveChannelId] = useState<number | null>(null);
  const [activeChannelName, setActiveChannelName] = useState<string>('');
  const [activeChannel, setActiveChannel] = useState<Channel | null>(null);
  const [activeTab, setActiveTab] = useState<'messages' | 'files'>('messages');
  // #148 下書きマップ: channelId → 下書きコンテンツ
  const [draftMap, setDraftMap] = useState<Map<number, string>>(new Map());
  const draftMapRef = useRef(draftMap);
  draftMapRef.current = draftMap;
  const { user } = useAuth();
  // #113 投稿権限制御 — 現在のチャンネルとユーザーロールから投稿可否を計算
  // readonly: 全員不可 / admins: 管理者のみ / everyone: 全員可
  const canPostToActiveChannel = (() => {
    if (!activeChannel) return false;
    if (activeChannel.postingPermission === 'readonly') return false;
    if (activeChannel.postingPermission === 'admins') return user?.role === 'admin';
    return true;
  })();
  const [pinRefreshKey, setPinRefreshKey] = useState(0);
  const [bookmarkedMessageIds, setBookmarkedMessageIds] = useState<Set<number>>(new Set());
  const { messages, loading, loadMore, refetch } = useMessages(activeChannelId);
  const socket = useSocket();
  const [searchQuery, setSearchQuery] = useState('');
  const [searchFilters, setSearchFilters] = useState<SearchFilters>({});
  const [searchResults, setSearchResults] = useState<MessageSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  // 検索モードの「明示的な開始/終了」フラグ。
  // - true にする: 検索ボックスへの focus（onSearchFocus）
  // - false に戻す: チャンネル切替 / 検索結果からの遷移（handleNavigate）
  // blur では false にしない（フィルターパネル内のクリックでパネルが消えるバグの回避）
  const [searchActive, setSearchActive] = useState(false);
  const [threadRootId, setThreadRootId] = useState<number | null>(null);
  const [threadReplies, setThreadReplies] = useState<Message[]>([]);
  const [quotedMessage, setQuotedMessage] = useState<QuotedMessagePreview | undefined>(undefined);
  const [scheduledDialogOpen, setScheduledDialogOpen] = useState(false);
  const [eventDialogOpen, setEventDialogOpen] = useState(false);
  const {
    promise: scheduledPromise,
    refresh: refreshScheduled,
    cancel: cancelScheduled,
    update: updateScheduled,
  } = useScheduledMessages();

  // URL の ?channel=X からチャンネルを初期選択する
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const channelId = params.get('channel');
    if (channelId) setActiveChannelId(Number(channelId));
  }, []);

  // ブックマーク済みメッセージIDセットをマウント時に取得する
  useEffect(() => {
    api.bookmarks
      .list()
      .then(({ bookmarks }) => {
        setBookmarkedMessageIds(new Set(bookmarks.map((b) => b.messageId)));
      })
      .catch(console.error);
  }, []);

  // #148 下書き初期ロード: マウント時に GET /drafts を呼び draftMap を構築する
  useEffect(() => {
    api.drafts
      .getAll()
      .then(({ drafts }) => {
        const map = new Map<number, string>();
        for (const d of drafts) {
          if (d.channelId !== null && d.channelId !== undefined) {
            map.set(d.channelId, d.content);
          }
        }
        setDraftMap(map);
      })
      .catch(console.error);
  }, []);

  // #148 下書きマップを更新するコールバック（RichEditorのデバウンス保存成功時に呼ぶ）
  const handleDraftSaved = useCallback((channelId: number, content: string) => {
    setDraftMap((prev) => {
      const next = new Map(prev);
      if (content) {
        next.set(channelId, content);
      } else {
        next.delete(channelId);
      }
      return next;
    });
  }, []);

  // #148 送信成功後に下書きをキャッシュから削除するコールバック
  const handleDraftDeleted = useCallback((channelId: number) => {
    setDraftMap((prev) => {
      if (!prev.has(channelId)) return prev;
      const next = new Map(prev);
      next.delete(channelId);
      return next;
    });
  }, []);

  const handleBookmarkChange = useCallback((messageId: number, bookmarked: boolean) => {
    setBookmarkedMessageIds((prev) => {
      const next = new Set(prev);
      if (bookmarked) next.add(messageId);
      else next.delete(messageId);
      return next;
    });
  }, []);

  // フィルター（tagIds/dateFrom/dateTo/userId/hasAttachment）が 1 つでも指定されているか
  const hasAnyFilter =
    (searchFilters.tagIds?.length ?? 0) > 0 ||
    !!searchFilters.dateFrom ||
    !!searchFilters.dateTo ||
    searchFilters.userId !== undefined ||
    searchFilters.hasAttachment !== undefined;

  // 検索クエリ or フィルタが変わったら API を呼ぶ（300ms debounce）
  // クエリ・フィルタ両方が空なら API 呼び出しスキップ
  useEffect(() => {
    const trimmedQuery = searchQuery.trim();
    if (!trimmedQuery && !hasAnyFilter) {
      setSearchResults([]);
      setSearching(false);
      return;
    }
    const timer = setTimeout(() => {
      setSearching(true);
      api.messages
        .search(trimmedQuery, searchFilters)
        .then(({ messages }) => setSearchResults(messages))
        .catch(console.error)
        .finally(() => setSearching(false));
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery, searchFilters, hasAnyFilter]);

  // ピン留め状態の変化時にリフレッシュ
  useEffect(() => {
    if (!socket || !activeChannelId) return;
    const handlePinned = () => setPinRefreshKey((k) => k + 1);
    const handleUnpinned = () => setPinRefreshKey((k) => k + 1);
    socket.on('message_pinned', handlePinned);
    socket.on('message_unpinned', handleUnpinned);
    return () => {
      socket.off('message_pinned', handlePinned);
      socket.off('message_unpinned', handleUnpinned);
    };
  }, [socket, activeChannelId]);

  // #117 NG ワード関連: 送信エラー / 警告を Socket 経由で受信
  const { showError, showInfo, showSuccess } = useSnackbar();
  useEffect(() => {
    if (!socket) return;
    const handleError = (msg: string) => {
      showError(msg);
    };
    const handleWarning = (data: { matchedPattern: string; message: string }) => {
      showInfo(data.message);
    };
    socket.on('error', handleError);
    socket.on('message_warning', handleWarning);
    return () => {
      socket.off('error', handleError);
      socket.off('message_warning', handleWarning);
    };
  }, [socket, showError, showInfo]);

  const handlePinMessage = useCallback(
    (messageId: number) => {
      if (!activeChannelId || !socket) return;
      socket.emit('pin_message', { messageId, channelId: activeChannelId });
    },
    [activeChannelId, socket],
  );

  const handleUnpinMessage = useCallback(
    (messageId: number) => {
      if (!activeChannelId || !socket) return;
      socket.emit('unpin_message', { messageId, channelId: activeChannelId });
    },
    [activeChannelId, socket],
  );

  // スレッドパネルを開く
  const handleOpenThread = useCallback((messageId: number) => {
    setThreadRootId(messageId);
    setThreadReplies([]);
    api.messages
      .getReplies(messageId)
      .then(({ replies }) => setThreadReplies(replies))
      .catch(console.error);
  }, []);

  const handleCloseThread = useCallback(() => {
    setThreadRootId(null);
    setThreadReplies([]);
  }, []);

  const threadRootMessage = useMemo(
    () => messages.find((m) => m.id === threadRootId) ?? null,
    [messages, threadRootId],
  );

  const handleQuoteReply = useCallback((message: Message) => {
    setQuotedMessage({
      id: message.id,
      content: message.content,
      username: message.username,
      createdAt: message.createdAt,
    });
  }, []);

  const handleSend = (
    content: string,
    mentionedUserIds: number[],
    attachmentIds: number[],
    quotedMessageId?: number,
  ) => {
    if (!activeChannelId || !socket) return;
    socket.emit('send_message', {
      channelId: activeChannelId,
      content,
      mentionedUserIds,
      attachmentIds,
      ...(quotedMessageId != null ? { quotedMessageId } : {}),
    });
    setQuotedMessage(undefined);
  };

  // 検索結果から投稿へ移動
  const handleNavigate = useCallback((channelId: number, messageId: number) => {
    setSearchQuery('');
    setSearchFilters({});
    setSearchActive(false);
    setActiveChannelId(channelId);
    setTimeout(() => {
      window.location.hash = `#message-${messageId}`;
    }, 100);
  }, []);

  // 検索モード: クエリがある or フィルター指定済み or 検索が明示的にアクティブ
  // searchActive は onFocus で true、明示的な閉じる動作（チャンネル切替・結果遷移）で false
  const isSearchMode = searchQuery.trim().length > 0 || hasAnyFilter || searchActive;

  return (
    <AppLayout
      sidebar={
        <ChannelList
          activeChannelId={activeChannelId}
          onSelect={(id, name, channel) => {
            setActiveChannelId(id);
            setActiveChannelName(name);
            setActiveChannel(channel ?? null);
            setActiveTab('messages');
            // チャンネル切替は「検索を閉じる」アクションとして扱う
            setSearchActive(false);
            setSearchQuery('');
            setSearchFilters({});
          }}
          onSelectSavedView={(query: SavedViewQuery) => {
            // 保存ビュークリック → 検索モードを開始して条件を復元
            setSearchActive(true);
            setSearchQuery(query.keyword ?? '');
            setSearchFilters({
              dateFrom: query.dateFrom,
              dateTo: query.dateTo,
              userId: query.userId,
              hasAttachment: query.hasAttachment,
              tagIds: query.tagIds,
            });
          }}
          draftMap={draftMap}
        />
      }
      searchQuery={searchQuery}
      onSearchChange={setSearchQuery}
      onSearchFocus={() => setSearchActive(true)}
    >
      <Box sx={{ display: 'flex', height: '100%', overflow: 'hidden' }}>
        {/* メインエリア */}
        <Box sx={{ flexGrow: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          {/* チャンネルヘッダー（1行） */}
          {activeChannelId && (
            <Box
              sx={{
                borderBottom: 1,
                borderColor: 'divider',
                px: 2,
                py: 0.5,
                flexShrink: 0,
                display: 'flex',
                alignItems: 'center',
                minHeight: 40,
                gap: 1,
              }}
            >
              <Typography variant="subtitle2" color="text.secondary" sx={{ flexShrink: 0 }}>
                # {activeChannelName}
              </Typography>
              {activeChannel && user && (
                <Box sx={{ flexGrow: 1, minWidth: 0 }}>
                  <ChannelTopicBar
                    channel={activeChannel}
                    currentUserId={user.id}
                    userRole={user.role}
                    onTopicUpdated={(updated) => setActiveChannel(updated)}
                  />
                </Box>
              )}
              {!activeChannel && <Box sx={{ flexGrow: 1 }} />}
              <Tooltip title="ファイル一覧">
                <IconButton
                  size="small"
                  aria-label="ファイル一覧"
                  onClick={() => setActiveTab((t) => (t === 'files' ? 'messages' : 'files'))}
                  data-active={activeTab === 'files' ? 'true' : undefined}
                  sx={{
                    bgcolor: activeTab === 'files' ? 'action.selected' : undefined,
                    flexShrink: 0,
                  }}
                >
                  <AttachFileIcon fontSize="small" />
                </IconButton>
              </Tooltip>
              <Tooltip title="予約送信一覧">
                <IconButton
                  size="small"
                  aria-label="予約送信一覧"
                  onClick={() => setScheduledDialogOpen(true)}
                  sx={{ flexShrink: 0 }}
                >
                  <ScheduleSendIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            </Box>
          )}

          {/* ファイルタブ */}
          {activeTab === 'files' && activeChannelId && (
            <Suspense
              fallback={
                <Box
                  sx={{
                    display: 'flex',
                    flexGrow: 1,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <CircularProgress />
                </Box>
              }
            >
              <ChannelFilesTab channelId={activeChannelId} />
            </Suspense>
          )}

          {/* メッセージタブ */}
          {activeTab === 'messages' && (
            <>
              {isSearchMode ? (
                <Box sx={{ display: 'flex', flexGrow: 1, overflow: 'hidden' }}>
                  <Box
                    sx={{
                      width: 240,
                      flexShrink: 0,
                      borderRight: 1,
                      borderColor: 'divider',
                      overflowY: 'auto',
                    }}
                  >
                    <Suspense fallback={null}>
                      <SearchFilterPanel
                        onFilterChange={setSearchFilters}
                        searchResults={searchResults}
                        onSaveView={async ({ name, filters }) => {
                          try {
                            await api.savedViews.create({
                              name,
                              query: {
                                keyword: searchQuery || undefined,
                                dateFrom: filters.dateFrom,
                                dateTo: filters.dateTo,
                                userId: filters.userId,
                                hasAttachment: filters.hasAttachment,
                                tagIds: filters.tagIds,
                              },
                            });
                            showSuccess(`保存ビュー「${name}」を保存しました`);
                          } catch (err) {
                            showError(
                              err instanceof Error ? err.message : '保存ビューの作成に失敗しました',
                            );
                          }
                        }}
                      />
                    </Suspense>
                  </Box>
                  <Box sx={{ flexGrow: 1, overflowY: 'auto' }}>
                    {!searching && (
                      <SearchResults results={searchResults} onNavigate={handleNavigate} />
                    )}
                  </Box>
                </Box>
              ) : (
                <>
                  {activeChannelId && user && (
                    <PinnedMessages
                      channelId={activeChannelId}
                      currentUserId={user.id}
                      refreshKey={pinRefreshKey}
                      onUnpin={handleUnpinMessage}
                    />
                  )}
                  {activeChannel?.isArchived && <ArchivedBanner />}
                  <MessageList
                    messages={messages}
                    loading={loading}
                    onLoadMore={loadMore}
                    currentUserId={null}
                    users={users}
                    onOpenThread={handleOpenThread}
                    onPinMessage={handlePinMessage}
                    bookmarkedMessageIds={bookmarkedMessageIds}
                    onBookmarkChange={handleBookmarkChange}
                    onQuoteReply={handleQuoteReply}
                  />
                  <Box sx={{ p: 2, borderTop: 1, borderColor: 'divider' }}>
                    <RichEditor
                      users={users}
                      onSend={handleSend}
                      disabled={
                        !activeChannelId ||
                        activeChannel?.isArchived === true ||
                        !canPostToActiveChannel
                      }
                      quotedMessage={quotedMessage}
                      onClearQuote={() => setQuotedMessage(undefined)}
                      channelId={activeChannelId ?? undefined}
                      initialContent={
                        activeChannelId !== null ? draftMap.get(activeChannelId) : undefined
                      }
                      onDraftSaved={handleDraftSaved}
                      onDraftDeleted={handleDraftDeleted}
                      onSlashEvent={() => {
                        if (activeChannelId) {
                          setEventDialogOpen(true);
                        } else {
                          showError('チャンネルを選択してからイベントを作成してください');
                        }
                      }}
                    />
                  </Box>
                </>
              )}
            </>
          )}
        </Box>

        {/* イベント作成ダイアログ */}
        {activeChannelId && (
          <CreateEventDialog
            open={eventDialogOpen}
            channelId={activeChannelId}
            onClose={() => setEventDialogOpen(false)}
            onCreated={() => refetch()}
          />
        )}

        {/* 予約送信一覧ダイアログ */}
        <ScheduledMessagesDialog
          open={scheduledDialogOpen}
          onClose={() => setScheduledDialogOpen(false)}
          promise={scheduledPromise}
          onCancel={cancelScheduled}
          onUpdate={updateScheduled}
          onRefresh={refreshScheduled}
        />

        {/* スレッドパネル */}
        {threadRootMessage && (
          <ThreadPanel
            rootMessage={threadRootMessage}
            initialReplies={threadReplies}
            currentUserId={0}
            users={users}
            onClose={handleCloseThread}
          />
        )}
      </Box>
    </AppLayout>
  );
}
