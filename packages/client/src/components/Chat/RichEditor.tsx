import './MentionBlot'; // register before any editor mounts
import { useRef, useMemo, useCallback, useEffect, useState, useId } from 'react';
import ScheduleSendButton from './ScheduleSendButton';
import ReactQuill from 'react-quill-new';
import 'react-quill-new/dist/quill.snow.css';
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  ClickAwayListener,
  Divider,
  IconButton,
  Paper,
  Popper,
  Tooltip,
  Typography,
  useMediaQuery,
} from '@mui/material';
import AttachFileIcon from '@mui/icons-material/AttachFile';
import EmojiEmotionsIcon from '@mui/icons-material/EmojiEmotions';
import VisibilityIcon from '@mui/icons-material/Visibility';
import EditIcon from '@mui/icons-material/Edit';
import SendIcon from '@mui/icons-material/Send';
import FormatBoldIcon from '@mui/icons-material/FormatBold';
import FormatItalicIcon from '@mui/icons-material/FormatItalic';
import FormatUnderlinedIcon from '@mui/icons-material/FormatUnderlined';
import StrikethroughSIcon from '@mui/icons-material/StrikethroughS';
import CodeIcon from '@mui/icons-material/Code';
import FormatListNumberedIcon from '@mui/icons-material/FormatListNumbered';
import FormatListBulletedIcon from '@mui/icons-material/FormatListBulleted';
import ImageIcon from '@mui/icons-material/Image';
import FormatClearIcon from '@mui/icons-material/FormatClear';
import type { Attachment, User } from '@chat-app/shared';
import type { MentionData } from './MentionBlot';
import { api } from '../../api/client';
import MentionDropdown, { filterSpecialEntries, type SpecialMentionType } from './MentionDropdown';
import TemplatePicker from './TemplatePicker';
import AttachmentPreview from './AttachmentPreview';
import QuotedMessageBanner from './QuotedMessageBanner';
import { renderMessageContent } from '../../utils/renderMessageContent';
import { isLateNightInTimezone } from '../../utils/timezone';

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
    mentionType?: SpecialMentionType,
  ) => void;
  onCancel?: () => void;
  initialContent?: string;
  initialAttachments?: Attachment[];
  disabled?: boolean;
  quotedMessage?: QuotedMessagePreview;
  onClearQuote?: () => void;
  /** 予約送信を有効にするチャンネルID。指定時のみ予約ボタンが表示される */
  channelId?: number;
  /** DM会話ID（指定時はDM下書きとして保存される） */
  dmConversationId?: number;
  /** 予約確定後に呼ばれるコールバック（エディタクリア等） */
  onSchedule?: () => void;
  /** #108 `/event` スラッシュコマンド検知時に呼ばれる（イベント作成ダイアログを開く） */
  onSlashEvent?: () => void;
  /** #148 下書き保存完了時に呼ばれる（content が空なら削除通知） */
  onDraftSaved?: (channelId: number, content: string) => void;
  /** #148 送信成功後（下書き削除後）に呼ばれる */
  onDraftDeleted?: (channelId: number) => void;
  /** エディタがフォーカスを得たときに呼ばれる（キーボードナビゲーション無効化用） */
  onFocus?: () => void;
  /** エディタがフォーカスを失ったときに呼ばれる（キーボードナビゲーション有効化用） */
  onBlur?: () => void;
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
  channelId,
  dmConversationId,
  onSchedule,
  onSlashEvent,
  onDraftSaved,
  onDraftDeleted,
  onFocus,
  onBlur,
}: Props) {
  const quillRef = useRef<ReactQuill>(null);
  // カスタムツールバーの一意なIDを生成（同一ページに複数エディタが存在しても衝突しない）
  const toolbarId = useId().replace(/:/g, '-');
  const [mentionState, setMentionState] = useState<MentionState | null>(null);
  const [showTemplatePicker, setShowTemplatePicker] = useState(false);
  const [emojiAnchor, setEmojiAnchor] = useState<HTMLElement | null>(null);
  // プレビューモード状態
  const [previewMode, setPreviewMode] = useState(false);
  const [previewContent, setPreviewContent] = useState<string>('');
  const showTemplatePickerRef = useRef(showTemplatePicker);
  showTemplatePickerRef.current = showTemplatePicker;
  // モバイル幅では長いプレースホルダーが枠からはみ出るため短縮版に切り替える
  const isMobile = useMediaQuery('(max-width: 767px)');
  const [attachments, setAttachments] = useState<PendingAttachment[]>(
    (initialAttachments ?? []) as PendingAttachment[],
  );
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  // 予約ボタン用: エディタの現在テキストを追跡する
  const [currentContent, setCurrentContent] = useState('');
  // #306 エディタ内に挿入された @mention のうち、相手が深夜帯になっているユーザー一覧
  const [lateNightMentioned, setLateNightMentioned] = useState<User[]>([]);
  // #306 ヒントを手動で閉じたかどうか（true なら次のメンション削除/追加までヒントを出さない）
  const [lateNightHintDismissed, setLateNightHintDismissed] = useState(false);
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
  const onSlashEventRef = useRef(onSlashEvent);
  usersRef.current = users;
  onSendRef.current = onSend;
  onCancelRef.current = onCancel;
  mentionStateRef.current = mentionState;
  quotedMessageRef.current = quotedMessage;
  onClearQuoteRef.current = onClearQuote;
  onSlashEventRef.current = onSlashEvent;

  // @here / @channel 固定エントリのフィルタリング
  const specialSuggestions = useMemo(
    () => (mentionState ? filterSpecialEntries(mentionState.query) : []),
    [mentionState],
  );

  // Filtered suggestions (特殊エントリ分を差し引いて最大8件)
  const suggestions = useMemo(
    () =>
      mentionState
        ? users
            .filter((u) => u.username.toLowerCase().startsWith(mentionState.query.toLowerCase()))
            .slice(0, Math.max(0, 8 - specialSuggestions.length))
        : [],
    [users, mentionState, specialSuggestions.length],
  );
  const suggestionsRef = useRef(suggestions);
  suggestionsRef.current = suggestions;
  const specialSuggestionsRef = useRef(specialSuggestions);
  specialSuggestionsRef.current = specialSuggestions;

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

  // --- @here / @channel 特殊メンションを挿入してドロップダウンを閉じる ---
  const [pendingMentionType, setPendingMentionType] = useState<SpecialMentionType | undefined>(
    undefined,
  );
  const pendingMentionTypeRef = useRef(pendingMentionType);
  pendingMentionTypeRef.current = pendingMentionType;
  const insertSpecialMention = useCallback((type: SpecialMentionType) => {
    const quill = quillRef.current?.getEditor();
    const state = mentionStateRef.current;
    if (!quill || !state) return;

    const deleteLen = state.query.length + 1; // '@' + query
    quill.deleteText(state.atIndex, deleteLen, 'user');
    quill.insertText(state.atIndex, `@${type}`, 'user');
    quill.insertText(state.atIndex + type.length + 1, ' ', 'user');
    quill.setSelection(state.atIndex + type.length + 2, 0);
    setMentionState(null);
    setPendingMentionType(type);
  }, []);
  const insertSpecialMentionRef = useRef(insertSpecialMention);
  insertSpecialMentionRef.current = insertSpecialMention;

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

  // disabled の最新値を参照するための ref
  const disabledRef = useRef(disabled);
  disabledRef.current = disabled;

  // --- #261 クリップボード画像ペースト ---
  const handlePaste = useCallback(
    (e: React.ClipboardEvent<HTMLDivElement>) => {
      if (disabledRef.current) return;
      const items = e.clipboardData?.items;
      if (!items) return;

      const imageItems = Array.from(items).filter((item) => item.type.startsWith('image/'));
      if (imageItems.length === 0) return;

      // 画像がある場合はデフォルトの貼り付けを抑制してアップロードフローへ
      e.preventDefault();
      imageItems.forEach((item) => {
        const file = item.getAsFile();
        if (file) {
          void uploadFile(file);
        }
      });
    },
    [uploadFile],
  );

  // --- #148 下書きデバウンス保存 ---
  const draftTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const channelIdRef = useRef(channelId);
  const dmConversationIdRef = useRef(dmConversationId);
  channelIdRef.current = channelId;
  dmConversationIdRef.current = dmConversationId;

  // コールバックをRefで保持して saveDraft/clearDraftOnSend の deps を安定させる
  const onDraftSavedRef = useRef(onDraftSaved);
  const onDraftDeletedRef = useRef(onDraftDeleted);
  onDraftSavedRef.current = onDraftSaved;
  onDraftDeletedRef.current = onDraftDeleted;

  const saveDraft = useCallback((content: string) => {
    if (draftTimerRef.current !== null) {
      clearTimeout(draftTimerRef.current);
    }
    draftTimerRef.current = setTimeout(() => {
      const cid = channelIdRef.current;
      const did = dmConversationIdRef.current;
      if (cid !== undefined) {
        void api.drafts.upsertChannel(cid, content).then(() => {
          onDraftSavedRef.current?.(cid, content);
        });
      } else if (did !== undefined) {
        void api.drafts.upsertDm(did, content);
      }
    }, 1500);
  }, []);

  const clearDraftOnSend = useCallback(() => {
    if (draftTimerRef.current !== null) {
      clearTimeout(draftTimerRef.current);
      draftTimerRef.current = null;
    }
    const cid = channelIdRef.current;
    const did = dmConversationIdRef.current;
    if (cid !== undefined) {
      void api.drafts.deleteChannel(cid).then(() => {
        onDraftDeletedRef.current?.(cid);
      });
    } else if (did !== undefined) {
      void api.drafts.deleteDm(did);
    }
  }, []);

  // --- Send message ---
  const doSend = useCallback(() => {
    if (disabledRef.current) return;
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
    const mentionType = pendingMentionTypeRef.current;
    clearDraftOnSend();
    onSendRef.current(JSON.stringify(delta), mentionedIds, attachmentIds, quotedId, mentionType);
    quill.setText('');
    quill.focus();
    setAttachments([]);
    setPendingMentionType(undefined);
    onClearQuoteRef.current?.();
  }, [clearDraftOnSend]);
  const doSendRef = useRef(doSend);
  doSendRef.current = doSend;

  // --- プレビューモード切替 ---
  const togglePreview = useCallback(() => {
    setPreviewMode((prev) => {
      if (!prev) {
        // 編集 → プレビュー: 現在の delta を取得してプレビューコンテンツを更新
        const quill = quillRef.current?.getEditor();
        const delta = quill?.getContents() ?? { ops: [] };
        setPreviewContent(JSON.stringify(delta));
      }
      return !prev;
    });
  }, []);

  // 予約用: text-change でエディタ内容を currentContent に同期 ---
  const onScheduleRef = useRef(onSchedule);
  onScheduleRef.current = onSchedule;

  const handleScheduled = useCallback(() => {
    const quill = quillRef.current?.getEditor();
    quill?.setText('');
    setAttachments([]);
    onClearQuoteRef.current?.();
    onScheduleRef.current?.();
  }, []);

  // --- Stable modules (created once, refs for dynamic access) ---
  const modules = useMemo(
    () => ({
      // カスタムツールバーのDOM要素をQuillのツールバーとして登録する
      toolbar: { container: `#${toolbarId}` },
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
    [toolbarId],
  );

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

      // /event コマンド検知（@ メンション検知より先に評価）
      if (textBefore.endsWith('/event')) {
        // /event 文字列をクリアする
        const eventPos = textBefore.lastIndexOf('/event');
        if (eventPos !== -1) {
          quill.deleteText(eventPos, sel.index - eventPos, 'user');
        }
        onSlashEventRef.current?.();
        setMentionState(null);
        setShowTemplatePicker(false);
        return;
      }

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

  // --- 予約ボタン用: エディタのテキストを currentContent に同期（初期値も設定）---
  useEffect(() => {
    const quill = quillRef.current?.getEditor();
    if (!quill) return;
    // マウント時に現在のテキストで初期化する
    setCurrentContent(quill.getText().trim());
    const sync = () => setCurrentContent(quill.getText().trim());
    quill.on('text-change', sync);
    return () => {
      quill.off('text-change', sync);
    };
  }, []);

  // --- #306 メンション挿入時、対象ユーザーが深夜帯ならヒントを表示 ---
  useEffect(() => {
    const quill = quillRef.current?.getEditor();
    if (!quill) return;
    const syncMentions = () => {
      const delta = quill.getContents();
      const ops = (delta.ops ?? []) as DeltaOp[];
      const mentionedIds = new Set<number>();
      ops.forEach((op) => {
        if (typeof op.insert === 'object' && op.insert?.mention != null) {
          mentionedIds.add(op.insert.mention.id);
        }
      });
      const currentUsers = usersRef.current;
      const lateUsers: User[] = [];
      mentionedIds.forEach((id) => {
        const u = currentUsers.find((x) => x.id === id);
        if (!u) return;
        // timezone 未設定ユーザーは判定対象外（深夜帯扱いしない）
        if (isLateNightInTimezone(u.timezone)) {
          lateUsers.push(u);
        }
      });
      setLateNightMentioned(lateUsers);
      // メンション数が変動したら dismiss 状態をリセット
      setLateNightHintDismissed((prev) => (lateUsers.length === 0 ? false : prev));
    };
    quill.on('text-change', syncMentions);
    return () => {
      quill.off('text-change', syncMentions);
    };
  }, []);

  // --- #148 下書きデバウンス保存: text-change のたびに保存スケジュール ---
  useEffect(() => {
    const quill = quillRef.current?.getEditor();
    if (!quill) return;
    const handleTextChange = () => {
      const text = quill.getText().trim();
      const content = text ? JSON.stringify(quill.getContents()) : '';
      saveDraft(content);
    };
    quill.on('text-change', handleTextChange);
    return () => {
      quill.off('text-change', handleTextChange);
    };
  }, [saveDraft]);

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

  // --- #148 channelId/dmConversationId が変わったとき initialContent をエディタに反映 ---
  // 初回マウント時はエディタの defaultValue で初期化されるため、
  // channelId/dmConversationId が実際に変化したときだけ反映する
  const isFirstChannelMount = useRef(true);
  useEffect(() => {
    if (isFirstChannelMount.current) {
      isFirstChannelMount.current = false;
      return;
    }
    const quill = quillRef.current?.getEditor();
    if (!quill) return;
    if (initialContent) {
      try {
        const delta = JSON.parse(initialContent) as Record<string, unknown>;
        quill.setContents(delta as never);
      } catch {
        quill.setText(initialContent);
      }
    } else {
      quill.setText('');
    }
    // キャンセル中のデバウンスタイマーをリセット
    if (draftTimerRef.current !== null) {
      clearTimeout(draftTimerRef.current);
      draftTimerRef.current = null;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [channelId, dmConversationId]);

  const showDropdown = !!mentionState && (suggestions.length > 0 || specialSuggestions.length > 0);

  return (
    <Box>
      {/* 引用プレビューバナー */}
      <QuotedMessageBanner quotedMessage={quotedMessage} onClearQuote={onClearQuote} />

      <Box
        data-testid="file-drop-zone"
        data-dragover={dragOver ? 'true' : undefined}
        onDragEnter={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
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
        onPaste={handlePaste}
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

        {/* プレビュートグルボタン — ツールバー右端に配置 */}
        <Box sx={{ display: 'flex', justifyContent: 'flex-end', px: 0.5, pt: 0.5 }}>
          <Tooltip title={previewMode ? '編集に戻る' : 'プレビューを表示'}>
            <IconButton
              size="small"
              aria-label={previewMode ? '編集に戻る' : 'プレビューを表示'}
              onMouseDown={(e) => {
                e.preventDefault();
                togglePreview();
              }}
              sx={{ p: 0.25, color: previewMode ? 'primary.main' : 'text.secondary' }}
            >
              {previewMode ? <EditIcon fontSize="small" /> : <VisibilityIcon fontSize="small" />}
            </IconButton>
          </Tooltip>
        </Box>

        {/* カスタムツールバー — Quill が container として参照する */}
        <Box
          id={toolbarId}
          sx={{
            display: previewMode ? 'none' : 'flex',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: 0.25,
            px: 0.5,
            py: 0.25,
            borderBottom: '1px solid',
            borderColor: 'divider',
          }}
        >
          {/* グループ1: 書式 */}
          <Tooltip title="太字 (Cmd+B)">
            <IconButton size="small" className="ql-bold" aria-label="太字 (Cmd+B)" sx={{ p: 0.5 }}>
              <FormatBoldIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          <Tooltip title="斜体 (Cmd+I)">
            <IconButton
              size="small"
              className="ql-italic"
              aria-label="斜体 (Cmd+I)"
              sx={{ p: 0.5 }}
            >
              <FormatItalicIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          <Tooltip title="下線 (Cmd+U)">
            <IconButton
              size="small"
              className="ql-underline"
              aria-label="下線 (Cmd+U)"
              sx={{ p: 0.5 }}
            >
              <FormatUnderlinedIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          <Tooltip title="取り消し線">
            <IconButton size="small" className="ql-strike" aria-label="取り消し線" sx={{ p: 0.5 }}>
              <StrikethroughSIcon fontSize="small" />
            </IconButton>
          </Tooltip>

          {/* セパレータ: 書式 | 挿入 */}
          <Divider
            orientation="vertical"
            flexItem
            data-testid="toolbar-separator"
            sx={{ mx: 0.5, my: 0.25 }}
          />

          {/* グループ2: 挿入 */}
          <Tooltip title="コードブロック">
            <IconButton
              size="small"
              className="ql-code-block"
              aria-label="コードブロック"
              sx={{ p: 0.5 }}
            >
              <CodeIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          <Tooltip title="番号付きリスト">
            <IconButton
              size="small"
              className="ql-list"
              value="ordered"
              aria-label="番号付きリスト"
              sx={{ p: 0.5 }}
            >
              <FormatListNumberedIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          <Tooltip title="箇条書きリスト">
            <IconButton
              size="small"
              className="ql-list"
              value="bullet"
              aria-label="箇条書きリスト"
              sx={{ p: 0.5 }}
            >
              <FormatListBulletedIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          <Tooltip title="画像を挿入">
            <IconButton size="small" className="ql-image" aria-label="画像を挿入" sx={{ p: 0.5 }}>
              <ImageIcon fontSize="small" />
            </IconButton>
          </Tooltip>

          {/* セパレータ: 挿入 | 整形解除 */}
          <Divider
            orientation="vertical"
            flexItem
            data-testid="toolbar-separator"
            sx={{ mx: 0.5, my: 0.25 }}
          />

          {/* グループ3: 整形解除 */}
          <Tooltip title="整形を解除">
            <IconButton size="small" className="ql-clean" aria-label="整形を解除" sx={{ p: 0.5 }}>
              <FormatClearIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </Box>

        {/* エディタ本体（プレビューモード中は非表示だが DOM に残す） */}
        <Box sx={{ display: previewMode ? 'none' : 'block' }}>
          <ReactQuill
            ref={quillRef}
            theme="snow"
            defaultValue={parsedInitial as never}
            modules={modules}
            placeholder={
              disabled
                ? 'このチャンネルには投稿できません'
                : isMobile
                  ? 'メッセージを入力…'
                  : 'メッセージを入力… (@ でメンション、/event でイベント作成、/tpl でテンプレート、Cmd+/ でショートカット一覧)'
            }
            readOnly={disabled}
            onFocus={onFocus}
            onBlur={onBlur}
          />
        </Box>

        {/* プレビューエリア — プレビューモード中のみ表示 */}
        <Box
          data-testid="message-preview-area"
          sx={{
            display: previewMode ? 'block' : 'none',
            minHeight: 60,
            maxHeight: 200,
            overflowY: 'auto',
            px: 1.5,
            py: 1,
            fontSize: '0.875rem',
            color:
              previewContent && JSON.parse(previewContent).ops?.length > 0
                ? 'text.primary'
                : 'text.disabled',
            borderRadius: 1,
            border: '1px solid',
            borderColor: 'divider',
          }}
        >
          {previewContent ? renderMessageContent(previewContent) : null}
        </Box>

        {/* #306 深夜帯メンションヒント */}
        {!lateNightHintDismissed && lateNightMentioned.length > 0 && (
          <Alert
            data-testid="late-night-mention-hint"
            severity="warning"
            variant="outlined"
            icon={false}
            onClose={() => setLateNightHintDismissed(true)}
            sx={{ mt: 0.5, py: 0, fontSize: '0.75rem' }}
          >
            {lateNightMentioned.length === 1
              ? `@${lateNightMentioned[0]!.username} は深夜帯かもしれません`
              : `${lateNightMentioned
                  .map((u) => `@${u.username}`)
                  .join(', ')} は深夜帯かもしれません`}
          </Alert>
        )}

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

        {/* 予約送信ボタン — channelId が指定されている場合のみ表示 */}
        {channelId !== undefined && (
          <Box sx={{ position: 'absolute', bottom: 6, right: 62, zIndex: 10 }}>
            <ScheduleSendButton
              channelId={channelId}
              content={currentContent}
              disabled={disabled}
              onScheduled={handleScheduled}
            />
          </Box>
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
          onSelectSpecial={insertSpecialMention}
          specialEntries={specialSuggestions}
        />
      </Box>

      {/* テンプレートピッカー */}
      {showTemplatePicker && (
        <TemplatePicker onSelect={insertTemplate} onClose={() => setShowTemplatePicker(false)} />
      )}

      {/* 送信ボタン — 常に表示。内容が空のとき無効化 */}
      <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 0.5 }}>
        <Button
          variant="contained"
          size="small"
          color="primary"
          disabled={!currentContent && attachments.length === 0}
          startIcon={<SendIcon />}
          onMouseDown={(e) => {
            e.preventDefault();
            doSend();
          }}
        >
          送信
        </Button>
      </Box>
    </Box>
  );
}
