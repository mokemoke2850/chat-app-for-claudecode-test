import { useState, useEffect } from 'react';
import { Box, Avatar, Typography, IconButton, Tooltip, Button } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import RestoreIcon from '@mui/icons-material/Restore';
import type { Message, Reaction, User } from '@chat-app/shared';
import { useSocket } from '../../contexts/SocketContext';
import { usePresence } from '../../hooks/usePresence';
import RichEditor from './RichEditor';
import MessageBubble from './MessageBubble';
import EventCard from './EventCard';
import MessageActions from './MessageActions';
import UserProfilePopover from './UserProfilePopover';
import PresenceIndicator from './PresenceIndicator';
import { getAvatarColor } from '../../utils/avatarColor';
import TagChip from './TagChip';
import TagInput from './TagInput';
import { api } from '../../api/client';
import { useSnackbar } from '../../contexts/SnackbarContext';
import { useDensity } from '../../contexts/DensityContext';

interface Props {
  message: Message;
  currentUserId: number;
  users: User[];
  onOpenThread?: (messageId: number) => void;
  onPinMessage?: (messageId: number) => void;
  isPinned?: boolean;
  isBookmarked?: boolean;
  onBookmarkChange?: (messageId: number, bookmarked: boolean) => void;
  onQuoteReply?: (message: Message) => void;
  onTagClick?: (tagName: string) => void;
  /** 直前メッセージとの連投マージ状態 (同送信者 + 5 分以内)。MessageList 側で計算する */
  isContinued?: boolean;
}

function formatTime(dateStr: string): string {
  return new Date(dateStr).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export default function MessageItem({
  message,
  currentUserId,
  users,
  onOpenThread,
  onPinMessage,
  isPinned = false,
  isBookmarked = false,
  onBookmarkChange,
  onQuoteReply,
  onTagClick,
  isContinued = false,
}: Props) {
  const [editing, setEditing] = useState(false);
  const [profileAnchor, setProfileAnchor] = useState<HTMLElement | null>(null);
  const [reactions, setReactions] = useState<Reaction[]>(message.reactions ?? []);
  const [tagEditing, setTagEditing] = useState(false);
  const [tagNames, setTagNames] = useState<string[]>((message.tags ?? []).map((t) => t.name));
  const socket = useSocket();
  const presence = usePresence(socket);
  const { showError } = useSnackbar();
  const { density } = useDensity();
  const isOwn = message.userId === currentUserId;

  // compact + isContinued のときアバター・名前・時刻をすべて非表示にする
  // cozy + isContinued のときはアバターを表示したまま名前のみ省略する
  const isCompactContinued = isContinued && density === 'compact';
  const isHeaderHidden = isContinued; // 名前・時刻は cozy/compact 問わず非表示

  useEffect(() => {
    if (!socket) return;
    const handler = (data: { messageId: number; channelId: number; reactions: Reaction[] }) => {
      if (data.messageId === message.id) {
        setReactions(data.reactions);
      }
    };
    socket.on('reaction_updated', handler);
    return () => {
      socket.off('reaction_updated', handler);
    };
  }, [socket, message.id]);

  // 投稿者の User 情報を users 配列から取得
  const author = users.find((u) => u.id === message.userId);
  const displayName = author?.displayName || message.username;
  // #146 プレゼンス状態: Socket 購読マップを優先し、なければ User.presenceState にフォールバック
  // 会話イベント等で userId が null の場合はプレゼンス未指定（インジケータ非表示）
  const userState =
    message.userId !== null ? (presence.get(message.userId) ?? author?.presenceState) : undefined;

  const handleEditSend = (content: string, mentionedUserIds: number[], attachmentIds: number[]) => {
    socket?.emit('edit_message', {
      messageId: message.id,
      content,
      mentionedUserIds,
      attachmentIds,
    });
    setEditing(false);
  };

  const handleRestore = () => {
    socket?.emit('restore_message', message.id);
  };

  const handleTagSave = async (names: string[]) => {
    try {
      await api.tags.setMessageTags(message.id, names);
      setTagNames(names);
      setTagEditing(false);
    } catch (err) {
      const msg = err instanceof Error && err.message ? err.message : 'タグの保存に失敗しました';
      showError(msg);
    }
  };

  const handleReactionClick = (emoji: string) => {
    const alreadyReacted = reactions
      .find((r) => r.emoji === emoji)
      ?.userIds.includes(currentUserId);
    if (alreadyReacted) {
      socket?.emit('remove_reaction', { messageId: message.id, emoji });
    } else {
      socket?.emit('add_reaction', { messageId: message.id, emoji });
    }
  };

  if (message.isDeleted) {
    return (
      <Box
        sx={{
          display: 'flex',
          gap: 'var(--msg-gap)',
          px: 2,
          py: 'var(--msg-padding-y)',
          opacity: 0.5,
          alignItems: 'flex-start',
        }}
      >
        <Avatar
          src={author?.avatarUrl ?? undefined}
          sx={{
            width: 'var(--msg-avatar-size)',
            height: 'var(--msg-avatar-size)',
            mt: 0.5,
            ...(!author?.avatarUrl && { bgcolor: getAvatarColor(author?.email ?? '') }),
          }}
        >
          {displayName[0].toUpperCase()}
        </Avatar>
        <Box>
          <Typography variant="caption" color="text.secondary">
            {displayName}
          </Typography>
          <Typography variant="body2" fontStyle="italic" color="text.secondary">
            This message was deleted.
          </Typography>
          {isOwn && (
            <Tooltip title="取り消しを元に戻す">
              <IconButton size="small" aria-label="取り消しを元に戻す" onClick={handleRestore}>
                <RestoreIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          )}
        </Box>
      </Box>
    );
  }

  return (
    // フラット表示で全行左揃え。ホバー時はアクションバーをフロート (position: absolute) で浮上させる。
    <Box
      id={`message-${message.id}`}
      data-own={isOwn ? 'true' : 'false'}
      sx={{
        display: 'flex',
        gap: 'var(--msg-gap)',
        px: 2,
        py: 'var(--msg-padding-y)',
        position: 'relative',
        alignItems: 'flex-start',
        // display:none だと accessibility tree からアクション (Edit/Delete 等) が消えてしまうため、
        // opacity + pointer-events で見た目とクリックだけを抑制する
        '& .msg-actions-floating': { opacity: 0, pointerEvents: 'none' },
        '&:hover .msg-actions-floating': { opacity: 1, pointerEvents: 'auto' },
      }}
    >
      {/* アバター
          - compact + isContinued: スペーサーのみ（アバター非表示）
          - cozy + isContinued: アバター表示・名前省略
          - isContinued=false: 常にアバター表示
      */}
      {isCompactContinued ? (
        <Box
          sx={{ flexShrink: 0, width: 'var(--msg-avatar-size)', height: 0 }}
          aria-hidden="true"
        />
      ) : (
        <Box
          data-testid="user-avatar"
          onMouseEnter={(e) => setProfileAnchor(e.currentTarget)}
          onMouseLeave={() => setProfileAnchor(null)}
          sx={{
            flexShrink: 0,
            cursor: 'pointer',
            position: 'relative',
            width: 'var(--msg-avatar-size)',
            height: 'var(--msg-avatar-size)',
          }}
        >
          <Avatar
            src={author?.avatarUrl ?? message.avatarUrl ?? undefined}
            alt={displayName}
            sx={{
              width: 'var(--msg-avatar-size)',
              height: 'var(--msg-avatar-size)',
              ...(!(author?.avatarUrl ?? message.avatarUrl) && {
                bgcolor: getAvatarColor(author?.email ?? ''),
              }),
            }}
          >
            {displayName[0].toUpperCase()}
          </Avatar>
          <PresenceIndicator state={userState} size={9} />
        </Box>
      )}

      {/* プロフィールポップアップ（compact + 連投時は anchor が無いので描画しない） */}
      {!isCompactContinued && (
        <UserProfilePopover
          user={author}
          displayName={displayName}
          anchorEl={profileAnchor}
          open={Boolean(profileAnchor)}
          onClose={() => setProfileAnchor(null)}
          state={userState}
        />
      )}

      <Box
        sx={{
          flexGrow: 1,
          minWidth: 0,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-start',
        }}
      >
        {!isHeaderHidden && (
          <Box
            sx={{
              display: 'flex',
              alignItems: 'baseline',
              gap: 1,
            }}
          >
            <Typography
              variant="subtitle2"
              fontWeight="bold"
              sx={{ fontSize: 'var(--msg-name-font-size)' }}
            >
              {displayName}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {formatTime(message.createdAt)}
            </Typography>
            {message.isEdited && (
              <Typography variant="caption" color="text.secondary">
                (edited)
              </Typography>
            )}
          </Box>
        )}

        {editing ? (
          <Box sx={{ mt: 0.5, width: '100%' }}>
            <RichEditor
              users={users}
              onSend={handleEditSend}
              onCancel={() => setEditing(false)}
              initialContent={message.content}
              initialAttachments={message.attachments ?? []}
            />
          </Box>
        ) : (
          <Box
            sx={{
              display: 'flex',
              flexDirection: 'column',
              gap: 0.5,
              minWidth: 0,
              mt: isContinued ? 0 : 0.25,
              alignItems: 'flex-start',
            }}
          >
            {message.event ? (
              <EventCard event={message.event} />
            ) : message.forwardedFromMessage?.event ? (
              /*
               * #107 + #108 — イベント投稿の転送
               * 元メッセージの event を転送先で再利用してフル EventCard を描画する。
               * これにより転送先チャンネルからも RSVP 投票が可能になる。
               * 転送ヘッダー（MessageBubble の compact preview）はそのまま上部に残し、
               * 「誰が転送したか + 元イベントの概要」を示すラベルとして機能させる。
               */
              <>
                <MessageBubble
                  message={message}
                  reactions={reactions}
                  currentUserId={currentUserId}
                  users={users}
                  onReactionClick={handleReactionClick}
                  onOpenThread={onOpenThread}
                />
                <EventCard event={message.forwardedFromMessage.event} />
              </>
            ) : (
              <MessageBubble
                message={message}
                reactions={reactions}
                currentUserId={currentUserId}
                users={users}
                onReactionClick={handleReactionClick}
                onOpenThread={onOpenThread}
              />
            )}

            {/* タグ表示・編集エリア */}
            {tagEditing ? (
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, mt: 0.5 }}>
                <TagInput value={tagNames} onChange={setTagNames} />
                <Box sx={{ display: 'flex', gap: 1 }}>
                  <Button
                    size="small"
                    variant="contained"
                    onClick={() => void handleTagSave(tagNames)}
                  >
                    保存
                  </Button>
                  <Button
                    size="small"
                    onClick={() => {
                      setTagEditing(false);
                      setTagNames((message.tags ?? []).map((t) => t.name));
                    }}
                  >
                    キャンセル
                  </Button>
                </Box>
              </Box>
            ) : (
              tagNames.length > 0 && (
                <Box
                  sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mt: 0.25 }}
                  data-testid="tag-chips"
                >
                  {tagNames.map((name) => {
                    const tag = (message.tags ?? []).find((t) => t.name === name);
                    if (!tag) return null;
                    return <TagChip key={tag.id} tag={tag} onClick={onTagClick} readOnly={true} />;
                  })}
                  <Button
                    size="small"
                    aria-label="タグを編集"
                    sx={{ fontSize: '0.65rem', height: 20, px: 0.5 }}
                    onClick={() => setTagEditing(true)}
                  >
                    タグを編集
                  </Button>
                </Box>
              )
            )}
          </Box>
        )}
      </Box>

      {/* ホバー時にフロートするアクションバー（編集中は非表示） */}
      {!editing && (
        <Box
          className="msg-actions-floating"
          sx={{
            position: 'absolute',
            top: -12,
            right: 24,
            display: 'flex',
            bgcolor: 'background.paper',
            border: '1px solid',
            borderColor: 'divider',
            borderRadius: 1,
            boxShadow: 2,
            zIndex: 1,
            padding: 0.25,
            transition: 'opacity 0.15s',
          }}
        >
          <MessageActions
            message={message}
            isOwn={isOwn}
            isPinned={isPinned}
            isBookmarked={isBookmarked}
            onBookmarkChange={onBookmarkChange}
            onQuoteReply={onQuoteReply}
            onOpenThread={onOpenThread}
            onPinMessage={onPinMessage}
            onEdit={() => setEditing(true)}
            onEditTags={() => setTagEditing(true)}
          />
        </Box>
      )}

      {editing && (
        <Box sx={{ display: 'flex', gap: 0.5, alignItems: 'flex-start', flexShrink: 0 }}>
          <Tooltip title="Cancel">
            <IconButton size="small" onClick={() => setEditing(false)}>
              <CloseIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </Box>
      )}
    </Box>
  );
}
