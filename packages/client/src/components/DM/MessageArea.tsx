import { useState, useEffect, useRef } from 'react';
import {
  Avatar,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  TextField,
  Typography,
} from '@mui/material';
import SendIcon from '@mui/icons-material/Send';
import EditIcon from '@mui/icons-material/Edit';
import { useSocket } from '../../contexts/SocketContext';
import { useSnackbar } from '../../contexts/SnackbarContext';
import { useScrollPositionMemory } from '../../hooks/useScrollPositionMemory';
import { api } from '../../api/client';
import type { DmConversationWithDetails, DmMessage, DmMessageEditHistory } from '@chat-app/shared';

function formatTime(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' });
}

export interface MessageAreaProps {
  conversation: DmConversationWithDetails;
  currentUserId: number;
  onSend: (content: string) => void;
  onEdit?: (messageId: number, content: string) => Promise<void>;
  messages: DmMessage[];
  typingUserId: number | null;
  highlightMessageId?: number | null;
  highlightTerm?: string;
}

function renderHighlightedText(text: string, term?: string): React.ReactNode {
  if (!term) return text;
  const lower = text.toLocaleLowerCase();
  const needle = term.toLocaleLowerCase();
  const result: React.ReactNode[] = [];
  let cursor = 0;
  while (cursor < text.length) {
    const index = lower.indexOf(needle, cursor);
    if (index < 0) {
      result.push(text.slice(cursor));
      break;
    }
    if (index > cursor) result.push(text.slice(cursor, index));
    result.push(
      <mark key={`${index}-${result.length}`} className="search-term-highlight">
        {text.slice(index, index + term.length)}
      </mark>,
    );
    cursor = index + term.length;
  }
  return result;
}

export default function MessageArea({
  conversation,
  currentUserId,
  onSend,
  onEdit,
  messages,
  typingUserId,
  highlightMessageId = null,
  highlightTerm,
}: MessageAreaProps) {
  const [input, setInput] = useState('');
  const [editingMessageId, setEditingMessageId] = useState<number | null>(null);
  const [editInput, setEditInput] = useState('');
  const [editSaving, setEditSaving] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyItems, setHistoryItems] = useState<DmMessageEditHistory[]>([]);
  const [historyLoadingMessageId, setHistoryLoadingMessageId] = useState<number | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const socket = useSocket();
  const { showError } = useSnackbar();
  const prevConvIdRef = useRef<number | null>(null);
  const isInitialLoad = useRef(true);

  const { save, restore } = useScrollPositionMemory(containerRef);

  useEffect(() => {
    setEditingMessageId(null);
    setEditInput('');
    setHistoryOpen(false);
    setHistoryItems([]);
    setHistoryLoadingMessageId(null);
  }, [conversation.id]);

  // conversation.id が変化したとき、離脱前の会話のスクロール位置を保存する
  useEffect(() => {
    const prevId = prevConvIdRef.current;
    const nextId = conversation.id;

    if (prevId !== null && prevId !== nextId) {
      save(prevId);
    }

    // 会話切替後は初回ロード扱いにする
    if (prevId !== nextId) {
      isInitialLoad.current = true;
    }

    prevConvIdRef.current = nextId;
  }, [conversation.id, save]);

  // メッセージが届いたとき: 初回ロードなら保存済み位置を復元、なければ最下部へ
  useEffect(() => {
    if (messages.length === 0) {
      isInitialLoad.current = true;
      return;
    }

    if (isInitialLoad.current) {
      isInitialLoad.current = false;
      const restored = restore(conversation.id);
      if (restored) return;
      bottomRef.current?.scrollIntoView({ behavior: 'instant' });
      return;
    }

    // 以降の新着メッセージ: 最下部付近のときのみスクロール
    const container = containerRef.current;
    if (!container) return;
    const isAtBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 100;
    if (isAtBottom) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, conversation.id, restore]);

  useEffect(() => {
    if (highlightMessageId === null) return;
    document
      .querySelector(`[data-dm-message-id="${highlightMessageId}"]`)
      ?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [highlightMessageId, messages]);

  const handleSend = () => {
    const trimmed = input.trim();
    if (!trimmed) return;
    onSend(trimmed);
    setInput('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInput(e.target.value);
    if (socket) {
      socket.emit('dm_typing_start', conversation.id);
    }
  };

  const handleBlur = () => {
    if (socket) {
      socket.emit('dm_typing_stop', conversation.id);
    }
  };

  const startEditing = (message: DmMessage) => {
    setEditingMessageId(message.id);
    setEditInput(message.content);
  };

  const saveEdit = async () => {
    if (editingMessageId === null || !onEdit || !editInput.trim()) return;
    setEditSaving(true);
    try {
      await onEdit(editingMessageId, editInput.trim());
      setEditingMessageId(null);
      setEditInput('');
    } catch {
      showError('DMの編集に失敗しました');
    } finally {
      setEditSaving(false);
    }
  };

  const showHistory = async (messageId: number) => {
    setHistoryLoadingMessageId(messageId);
    try {
      const { items } = await api.dm.history(conversation.id, messageId);
      setHistoryItems(items);
      setHistoryOpen(true);
    } catch {
      showError('DM編集履歴の取得に失敗しました');
    } finally {
      setHistoryLoadingMessageId(null);
    }
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* ヘッダー */}
      <Box
        sx={{
          px: 2,
          py: 1.5,
          borderBottom: 1,
          borderColor: 'divider',
          display: 'flex',
          alignItems: 'center',
          gap: 1,
        }}
      >
        <Avatar src={conversation.otherUser.avatarUrl ?? undefined} sx={{ width: 32, height: 32 }}>
          {conversation.otherUser.username[0].toUpperCase()}
        </Avatar>
        <Typography variant="subtitle1" fontWeight="bold">
          {conversation.otherUser.displayName ?? conversation.otherUser.username}
        </Typography>
      </Box>

      {/* メッセージ一覧 */}
      <Box ref={containerRef} sx={{ flexGrow: 1, overflowY: 'auto', p: 2 }}>
        {messages.map((msg) => {
          const isMine = msg.senderId === currentUserId;
          return (
            <Box
              key={msg.id}
              data-dm-message-id={msg.id}
              style={{ flexDirection: isMine ? 'row-reverse' : 'row' }}
              sx={{
                display: 'flex',
                alignItems: 'flex-end',
                gap: 1,
                mb: 1,
                outline:
                  highlightMessageId === msg.id ? '3px solid var(--accent, #1976d2)' : 'none',
                borderRadius: 2,
              }}
            >
              {!isMine && (
                <Avatar src={msg.senderAvatarUrl ?? undefined} sx={{ width: 28, height: 28 }}>
                  {msg.senderUsername[0].toUpperCase()}
                </Avatar>
              )}
              <Box
                sx={{
                  maxWidth: '70%',
                  bgcolor: isMine ? 'primary.main' : 'grey.100',
                  color: isMine ? 'primary.contrastText' : 'text.primary',
                  borderRadius: 2,
                  px: 1.5,
                  py: 1,
                }}
              >
                {editingMessageId === msg.id ? (
                  <Box sx={{ minWidth: 260 }}>
                    <TextField
                      fullWidth
                      multiline
                      size="small"
                      value={editInput}
                      onChange={(event) => setEditInput(event.target.value)}
                      inputProps={{ 'aria-label': 'DM編集' }}
                      sx={{ bgcolor: 'background.paper', borderRadius: 1 }}
                    />
                    <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 0.5, mt: 0.5 }}>
                      <Button
                        size="small"
                        color="inherit"
                        onClick={() => setEditingMessageId(null)}
                        disabled={editSaving}
                      >
                        キャンセル
                      </Button>
                      <Button
                        size="small"
                        variant="contained"
                        onClick={() => void saveEdit()}
                        disabled={editSaving || !editInput.trim()}
                        aria-label="編集を保存"
                      >
                        保存
                      </Button>
                    </Box>
                  </Box>
                ) : (
                  <Typography
                    variant="body2"
                    sx={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}
                  >
                    {renderHighlightedText(
                      msg.content,
                      highlightMessageId === msg.id ? highlightTerm : undefined,
                    )}
                  </Typography>
                )}
                <Typography
                  variant="caption"
                  sx={{
                    display: 'block',
                    textAlign: isMine ? 'right' : 'left',
                    opacity: 0.7,
                    mt: 0.25,
                  }}
                >
                  {formatTime(msg.createdAt)}
                  {msg.isEdited && (
                    <Button
                      size="small"
                      color="inherit"
                      onClick={() => void showHistory(msg.id)}
                      disabled={historyLoadingMessageId === msg.id}
                      aria-label="DM編集履歴を表示"
                      sx={{
                        minWidth: 0,
                        p: 0,
                        ml: 0.5,
                        fontSize: 'inherit',
                        textTransform: 'none',
                      }}
                    >
                      (edited)
                    </Button>
                  )}
                </Typography>
              </Box>
              {isMine && onEdit && editingMessageId !== msg.id && (
                <IconButton
                  size="small"
                  aria-label="DMを編集"
                  onClick={() => startEditing(msg)}
                  sx={{ color: 'text.secondary' }}
                >
                  <EditIcon fontSize="small" />
                </IconButton>
              )}
            </Box>
          );
        })}
        {typingUserId !== null && typingUserId !== currentUserId && (
          <Typography variant="caption" color="text.secondary" sx={{ ml: 1 }}>
            {conversation.otherUser.username} が入力中...
          </Typography>
        )}
        <div ref={bottomRef} />
      </Box>

      {/* 送信フォーム */}
      <Box sx={{ p: 1.5, borderTop: 1, borderColor: 'divider', display: 'flex', gap: 1 }}>
        <TextField
          fullWidth
          size="small"
          multiline
          maxRows={4}
          placeholder={`${conversation.otherUser.displayName ?? conversation.otherUser.username} にメッセージを送信`}
          value={input}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          onBlur={handleBlur}
          inputProps={{ 'aria-label': 'DM入力' }}
        />
        <IconButton color="primary" onClick={handleSend} disabled={!input.trim()} aria-label="送信">
          <SendIcon />
        </IconButton>
      </Box>

      <Dialog open={historyOpen} onClose={() => setHistoryOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>DM編集履歴</DialogTitle>
        <DialogContent dividers>
          {historyItems.map((item) => (
            <Box key={item.id} sx={{ mb: 2 }}>
              <Typography
                variant="body2"
                data-testid="dm-history-content"
                sx={{ whiteSpace: 'pre-wrap' }}
              >
                {item.content}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {item.editorUsername}・{new Date(item.editedAt).toLocaleString('ja-JP')}
              </Typography>
            </Box>
          ))}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setHistoryOpen(false)}>閉じる</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
