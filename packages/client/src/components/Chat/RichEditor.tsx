import './MentionBlot'; // register before any editor mounts
import { useRef, useMemo, useCallback, useEffect, useState } from 'react';
import ReactQuill from 'react-quill-new';
import 'react-quill-new/dist/quill.snow.css';
import {
  Box,
  CircularProgress,
  ClickAwayListener,
  IconButton,
  Paper,
  Popper,
  Tooltip,
  Typography,
} from '@mui/material';
import AttachFileIcon from '@mui/icons-material/AttachFile';
import EmojiEmotionsIcon from '@mui/icons-material/EmojiEmotions';
import type { Attachment, User } from '@chat-app/shared';
import type { MentionData } from './MentionBlot';
import { api } from '../../api/client';
import MentionDropdown from './MentionDropdown';
import TemplatePicker from './TemplatePicker';
import AttachmentPreview from './AttachmentPreview';
import QuotedMessageBanner from './QuotedMessageBanner';

const COMMON_EMOJIS = [
  '😀',
  '😃',
  '😄',
  '😁',
  '😆',
  '😅',
  '😂',
  '🤣',
  '😊',
  '😇',
  '🙂',
  '😉',
  '😍',
  '🥰',
  '😘',
  '😎',
  '😏',
  '😔',
  '😢',
  '😭',
  '😤',
  '😠',
  '🤔',
  '🤗',
  '👍',
  '👎',
  '👌',
  '✌️',
  '👏',
  '🙌',
  '🙏',
  '✊',
  '❤️',
  '🧡',
  '💛',
  '💚',
  '💙',
  '💜',
  '🔥',
  '✨',
  '🎉',
  '🎊',
  '🎈',
  '💯',
  '🆗',
  '🤝',
  '💪',
  '🎵',
  '🌟',
  '⭐',
  '🌈',
  '🌙',
  '☀️',
  '🌸',
  '🍀',
  '🐶',
];

interface MentionState {
  atIndex: number; // quill index of the '@' character
  query: string; // text after '@'
  selectedIdx: number;
}

interface DeltaOp {
  insert?: string | { mention?: MentionData };
}

interface VirtualElement {
  getBoundingClientRect: () => DOMRect;
}

interface PendingAttachment extends Attachment {
  id: number;
}

export interface QuotedMessagePreview {
  id: number;
  content: string;
  username: string;
  createdAt: string;
}

interface Props {
  users: User[];
  onSend: (
    content: string,
    mentionedUserIds: number[],
    attachmentIds: number[],
    quotedMessageId?: number,
  ) => void;
  onCancel?: () => void;
  initialContent?: string;
  initialAttachments?: Attachment[];
  disabled?: boolean;
  quotedMessage?: QuotedMessagePreview;
  onClearQuote?: () => void;
}

export default function RichEditor({
  users,
  onSend,
  onCancel,
  initialContent,
  initialAttachments,
  disabled,
  quotedMessage,
  onClearQuote,
}: Props) {
  const quillRef = useRef<ReactQuill>(null);
  const [mentionState, setMentionState] = useState<MentionState | null>(null);
  const [showTemplatePicker, setShowTemplatePicker] = useState(false);
  const [emojiAnchor, setEmojiAnchor] = useState<HTMLElement | null>(null);
  const showTemplatePickerRef = useRef(showTemplatePicker);
  showTemplatePickerRef.current = showTemplatePicker;
  const [attachments, setAttachments] = useState<PendingAttachment[]>(
    (initialAttachments ?? []) as PendingAttachment[],
  );
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const attachmentsRef = useRef(attachments);
  attachmentsRef.current = attachments;

  // Refs so stable `modules` closure always reads fresh values
  const usersRef = useRef(users);
  const onSendRef = useRef(onSend);
  const onCancelRef = useRef(onCancel);
  const mentionStateRef = useRef(mentionState);
  const quotedMessageRef = useRef(quotedMessage);
  const onClearQuoteRef = useRef(onClearQuote);
  usersRef.current = users;
  onSendRef.current = onSend;
  onCancelRef.current = onCancel;
  mentionStateRef.current = mentionState;
  quotedMessageRef.current = quotedMessage;
  onClearQuoteRef.current = onClearQuote;

  // Filtered suggestions
  const suggestions = useMemo(
    () =>
      mentionState
        ? users
            .filter((u) => u.username.toLowerCase().startsWith(mentionState.query.toLowerCase()))
            .slice(0, 8)
        : [],
    [users, mentionState],
  );
  const suggestionsRef = useRef(suggestions);
  suggestionsRef.current = suggestions;

  // --- Insert a mention blot and close the dropdown ---
  const insertMention = useCallback((user: User) => {
    const quill = quillRef.current?.getEditor();
    const state = mentionStateRef.current;
    if (!quill || !state) return;

    const deleteLen = state.query.length + 1; // '@' + query
    quill.deleteText(state.atIndex, deleteLen, 'user');
    quill.insertEmbed(
      state.atIndex,
      'mention',
      { id: user.id, value: user.username } satisfies MentionData,
      'user',
    );
    quill.insertText(state.atIndex + 1, ' ', 'user');
    quill.setSelection(state.atIndex + 2, 0);
    setMentionState(null);
  }, []);
  const insertMentionRef = useRef(insertMention);
  insertMentionRef.current = insertMention;

  // --- Insert emoji at cursor ---
  const insertEmoji = useCallback((emoji: string) => {
    const quill = quillRef.current?.getEditor();
    if (!quill) return;
    const sel = quill.getSelection(true);
    quill.insertText(sel.index, emoji, 'user');
    quill.setSelection(sel.index + emoji.length, 0);
    setEmojiAnchor(null);
  }, []);

  // --- Upload file ---
  const uploadFile = useCallback(async (file: File) => {
    setUploading(true);
    setUploadError(null);
    try {
      const result = await api.files.upload(file);
      setAttachments((prev) => [...prev, result]);
    } catch {
      setUploadError('アップロードに失敗しました');
    } finally {
      setUploading(false);
    }
  }, []);

  // --- Send message ---
  const doSend = useCallback(() => {
    const quill = quillRef.current?.getEditor();
    if (!quill) return;
    const text = quill.getText().trim();
    const currentAttachments = attachmentsRef.current;
    if (!text && currentAttachments.length === 0) return;

    const delta = quill.getContents();
    const ops = (delta.ops ?? []) as DeltaOp[];
    const mentionedIds = [
      ...new Set(
        ops
          .filter((op) => typeof op.insert === 'object' && op.insert?.mention != null)
          .map((op) => (op.insert as { mention: MentionData }).mention.id),
      ),
    ];

    const attachmentIds = currentAttachments.map((a) => a.id);
    const quotedId = quotedMessageRef.current?.id;
    onSendRef.current(JSON.stringify(delta), mentionedIds, attachmentIds, quotedId);
    quill.setText('');
    quill.focus();
    setAttachments([]);
    onClearQuoteRef.current?.();
  }, []);
  const doSendRef = useRef(doSend);
  doSendRef.current = doSend;

  // --- Stable modules (created once, refs for dynamic access) ---
  const modules = useMemo(
    () => ({
      toolbar: [
        ['bold', 'italic', 'underline', 'strike'],
        [{ color: [] }, { background: [] }],
        ['code-block'],
        [{ list: 'ordered' }, { list: 'bullet' }],
        ['image'],
        ['clean'],
      ],
      keyboard: {
        bindings: {
          sendOnEnter: {
            key: 'Enter',
            shiftKey: false,
            handler() {
              const state = mentionStateRef.current;
              if (state && suggestionsRef.current.length > 0) {
                const user = suggestionsRef.current[state.selectedIdx];
                if (user) {
                  insertMentionRef.current(user);
                  return false;
                }
              }
              doSendRef.current();
              return false;
            },
          },
          arrowUp: {
            key: 'ArrowUp',
            handler() {
              if (!mentionStateRef.current) return true;
              setMentionState((prev) =>
                prev ? { ...prev, selectedIdx: Math.max(0, prev.selectedIdx - 1) } : null,
              );
              return false;
            },
          },
          arrowDown: {
            key: 'ArrowDown',
            handler() {
              if (!mentionStateRef.current) return true;
              setMentionState((prev) => {
                if (!prev) return null;
                const max = suggestionsRef.current.length - 1;
                return { ...prev, selectedIdx: Math.min(max, prev.selectedIdx + 1) };
              });
              return false;
            },
          },
          escapeKey: {
            key: 'Escape',
            handler() {
              if (showTemplatePickerRef.current) {
                setShowTemplatePicker(false);
                return false;
              }
              if (mentionStateRef.current) {
                setMentionState(null);
                return false;
              }
              onCancelRef.current?.();
              return true;
            },
          },
        },
      },
    }),
    [],
  ); // intentionally empty — all values accessed via refs

  // --- Insert template content at cursor ---
  const insertTemplate = useCallback((body: string) => {
    const quill = quillRef.current?.getEditor();
    if (!quill) return;
    const sel = quill.getSelection(true);
    // /tpl コマンド（4文字）を削除してからテンプレートを挿入する
    const textBefore = quill.getText(0, sel.index);
    const tplPos = textBefore.lastIndexOf('/tpl');
    if (tplPos !== -1) {
      quill.deleteText(tplPos, sel.index - tplPos, 'user');
      quill.insertText(tplPos, body, 'user');
      quill.setSelection(tplPos + body.length, 0);
    } else {
      quill.insertText(sel.index, body, 'user');
      quill.setSelection(sel.index + body.length, 0);
    }
    setShowTemplatePicker(false);
  }, []);

  // --- Detect @ mention as user types ---
  useEffect(() => {
    const quill = quillRef.current?.getEditor();
    if (!quill) return;

    const detect = () => {
      const sel = quill.getSelection();
      if (!sel || sel.length > 0) {
        setMentionState(null);
        setShowTemplatePicker(false);
        return;
      }

      const textBefore = quill.getText(0, sel.index);

      // /tpl コマンド検知（@ メンション検知より先に評価）
      if (textBefore.endsWith('/tpl')) {
        setShowTemplatePicker(true);
        setMentionState(null);
        return;
      } else if (!showTemplatePickerRef.current) {
        // /tpl が消えたらピッカーを閉じる（既に閉じている場合は何もしない）
      } else {
        setShowTemplatePicker(false);
      }

      const atPos = textBefore.lastIndexOf('@');
      if (atPos === -1) {
        setMentionState(null);
        return;
      }

      const query = textBefore.slice(atPos + 1);
      if (/[\s\n]/.test(query)) {
        setMentionState(null);
        return;
      }

      setMentionState((prev) => ({
        atIndex: atPos,
        query,
        selectedIdx: prev?.atIndex === atPos ? prev.selectedIdx : 0,
      }));
    };

    // requestAnimationFrame で defer: text-change 直後はまだ selection が更新されていない
    // ことがあるため、次フレームで detect することで @ 入力直後から確実に候補を表示する
    const detectDeferred = () => requestAnimationFrame(detect);

    const handleSelectionChange = (range: { index: number; length: number } | null) => {
      if (!range) {
        setMentionState(null);
        return;
      }
      detect();
    };

    quill.on('text-change', detectDeferred);
    quill.on('selection-change', handleSelectionChange);
    return () => {
      quill.off('text-change', detectDeferred);
      quill.off('selection-change', handleSelectionChange);
    };
  }, []); // run once after mount

  // --- Popper virtual anchor at the cursor position ---
  const popperAnchor = useMemo((): VirtualElement | null => {
    if (!mentionState) return null;
    return {
      getBoundingClientRect() {
        const quill = quillRef.current?.getEditor();
        if (!quill) return new DOMRect();
        // getBounds returns coords relative to the ql-editor div (quill.root)
        const editorRect = (quill.root as HTMLElement).getBoundingClientRect();
        const b = quill.getBounds(mentionState.atIndex + mentionState.query.length + 1);
        if (!b) return editorRect;
        return new DOMRect(
          editorRect.left + (b as { left: number }).left,
          editorRect.top + (b as { bottom: number }).bottom,
          0,
          0,
        );
      },
    };
    // Recreate anchor whenever mention state changes so Popper repositions
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mentionState?.atIndex, mentionState?.query]);

  const parsedInitial = useMemo(() => {
    if (!initialContent) return undefined;
    try {
      return JSON.parse(initialContent) as Record<string, unknown>;
    } catch {
      return undefined;
    }
  }, [initialContent]);

  const showDropdown = !!mentionState && suggestions.length > 0;

  return (
    <Box>
      {/* 引用プレビューバナー */}
      <QuotedMessageBanner quotedMessage={quotedMessage} onClearQuote={onClearQuote} />

      <Box
        data-testid="file-drop-zone"
        data-dragover={dragOver ? 'true' : undefined}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          const files = Array.from(e.dataTransfer.files);
          files.forEach((f) => void uploadFile(f));
        }}
        sx={{
          position: 'relative',
          opacity: disabled ? 0.6 : 1,
          pointerEvents: disabled ? 'none' : 'auto',
          outline: dragOver ? '2px dashed' : 'none',
          outlineColor: 'primary.main',
          borderRadius: 1,
          '& .ql-editor': {
            minHeight: 60,
            maxHeight: 200,
            overflowY: 'auto',
            fontSize: '0.875rem',
            paddingRight: '72px', // room for emoji + attach buttons
          },
          '& .ql-editor.ql-blank::before': { fontStyle: 'normal', color: '#aaa' },
          '& .ql-mention': {
            color: 'primary.main',
            fontWeight: 600,
            backgroundColor: 'rgba(25,118,210,0.08)',
            borderRadius: '3px',
            padding: '0 3px',
            cursor: 'default',
            userSelect: 'all',
          },
        }}
      >
        {/* 隠しファイル入力 */}
        <input
          ref={fileInputRef}
          type="file"
          multiple
          style={{ display: 'none' }}
          onChange={(e) => {
            const files = Array.from(e.target.files ?? []);
            files.forEach((f) => void uploadFile(f));
            e.target.value = '';
          }}
        />

        <ReactQuill
          ref={quillRef}
          theme="snow"
          defaultValue={parsedInitial as never}
          modules={modules}
          placeholder="メッセージを入力… (@ でメンション、/tpl でテンプレート、Enter で送信、Shift+Enter で改行)"
          readOnly={disabled}
        />

        {/* 添付ファイルプレビュー */}
        <AttachmentPreview
          attachments={attachments}
          onRemove={(id) => setAttachments((prev) => prev.filter((x) => x.id !== id))}
        />

        {/* アップロードエラー */}
        {uploadError && (
          <Typography variant="caption" color="error" sx={{ px: 1 }}>
            {uploadError}
          </Typography>
        )}

        {/* ファイル添付ボタン — エディタ右下に絶対配置（絵文字の左） */}
        <Box sx={{ position: 'absolute', bottom: 6, right: 34, zIndex: 10 }}>
          {uploading ? (
            <CircularProgress size={18} sx={{ color: 'text.secondary' }} role="progressbar" />
          ) : (
            <Tooltip title="ファイルを添付">
              <IconButton
                size="small"
                aria-label="ファイルを添付"
                onMouseDown={(e) => {
                  e.preventDefault();
                  fileInputRef.current?.click();
                }}
                sx={{ p: 0.25 }}
              >
                <AttachFileIcon fontSize="small" sx={{ color: 'text.secondary' }} />
              </IconButton>
            </Tooltip>
          )}
        </Box>

        {/* 絵文字ボタン — エディタ右下に絶対配置 */}
        <Box sx={{ position: 'absolute', bottom: 6, right: 6, zIndex: 10 }}>
          <Tooltip title="絵文字を挿入">
            <IconButton
              size="small"
              aria-label="絵文字を挿入"
              onMouseDown={(e) => {
                e.preventDefault(); // エディタフォーカスを維持
                setEmojiAnchor(emojiAnchor ? null : e.currentTarget);
              }}
              sx={{ p: 0.25 }}
            >
              <EmojiEmotionsIcon fontSize="small" sx={{ color: 'text.secondary' }} />
            </IconButton>
          </Tooltip>
        </Box>

        {/* 絵文字ピッカー */}
        <Popper
          open={Boolean(emojiAnchor)}
          anchorEl={emojiAnchor}
          placement="top-end"
          style={{ zIndex: 1500 }}
          modifiers={[{ name: 'offset', options: { offset: [0, 4] } }]}
        >
          <ClickAwayListener onClickAway={() => setEmojiAnchor(null)}>
            <Paper elevation={4} sx={{ p: 0.5 }}>
              <Box
                sx={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  width: 256,
                  maxHeight: 180,
                  overflowY: 'auto',
                }}
              >
                {COMMON_EMOJIS.map((emoji) => (
                  <IconButton
                    key={emoji}
                    size="small"
                    onMouseDown={(e) => {
                      e.preventDefault();
                      insertEmoji(emoji);
                    }}
                    sx={{ fontSize: '1.15rem', lineHeight: 1, p: 0.5, minWidth: 0 }}
                  >
                    {emoji}
                  </IconButton>
                ))}
              </Box>
            </Paper>
          </ClickAwayListener>
        </Popper>

        {/* メンション候補ドロップダウン */}
        <MentionDropdown
          open={showDropdown}
          anchorEl={popperAnchor}
          candidates={suggestions}
          selectedIdx={mentionState?.selectedIdx ?? 0}
          onSelect={insertMention}
        />
      </Box>

      {/* テンプレートピッカー */}
      {showTemplatePicker && (
        <TemplatePicker onSelect={insertTemplate} onClose={() => setShowTemplatePicker(false)} />
      )}
    </Box>
  );
}
