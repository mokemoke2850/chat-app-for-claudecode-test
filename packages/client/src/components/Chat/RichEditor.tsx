import './MentionBlot'; // register before any editor mounts
import { useRef, useMemo, useCallback, useEffect, useState } from 'react';
import ReactQuill from 'react-quill-new';
import 'react-quill-new/dist/quill.snow.css';
import {
  Box, List, ListItem, ListItemButton, ListItemText, Paper, Popper,
} from '@mui/material';
import type { User } from '@chat-app/shared';
import type { MentionData } from './MentionBlot';

interface MentionState {
  atIndex: number;   // quill index of the '@' character
  query: string;     // text after '@'
  selectedIdx: number;
}

interface DeltaOp {
  insert?: string | { mention?: MentionData };
}

interface VirtualElement {
  getBoundingClientRect: () => DOMRect;
}

interface Props {
  users: User[];
  onSend: (content: string, mentionedUserIds: number[]) => void;
  onCancel?: () => void;
  initialContent?: string;
  disabled?: boolean;
}

export default function RichEditor({ users, onSend, onCancel, initialContent, disabled }: Props) {
  const quillRef = useRef<ReactQuill>(null);
  const [mentionState, setMentionState] = useState<MentionState | null>(null);

  // Refs so stable `modules` closure always reads fresh values
  const usersRef = useRef(users);
  const onSendRef = useRef(onSend);
  const onCancelRef = useRef(onCancel);
  const mentionStateRef = useRef(mentionState);
  usersRef.current = users;
  onSendRef.current = onSend;
  onCancelRef.current = onCancel;
  mentionStateRef.current = mentionState;

  // Filtered suggestions
  const suggestions = useMemo(
    () =>
      mentionState
        ? users
            .filter(u => u.username.toLowerCase().startsWith(mentionState.query.toLowerCase()))
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
    quill.insertEmbed(state.atIndex, 'mention', { id: user.id, value: user.username } satisfies MentionData, 'user');
    quill.insertText(state.atIndex + 1, ' ', 'user');
    quill.setSelection(state.atIndex + 2, 0);
    setMentionState(null);
  }, []);
  const insertMentionRef = useRef(insertMention);
  insertMentionRef.current = insertMention;

  // --- Send message ---
  const doSend = useCallback(() => {
    const quill = quillRef.current?.getEditor();
    if (!quill) return;
    const text = quill.getText().trim();
    if (!text) return;

    const delta = quill.getContents();
    const ops = (delta.ops ?? []) as DeltaOp[];
    const mentionedIds = [
      ...new Set(
        ops
          .filter(op => typeof op.insert === 'object' && op.insert?.mention != null)
          .map(op => (op.insert as { mention: MentionData }).mention.id),
      ),
    ];

    onSendRef.current(JSON.stringify(delta), mentionedIds);
    quill.setText('');
    quill.focus();
  }, []);
  const doSendRef = useRef(doSend);
  doSendRef.current = doSend;

  // --- Stable modules (created once, refs for dynamic access) ---
  const modules = useMemo(() => ({
    toolbar: [
      ['bold', 'italic', 'underline', 'strike'],
      ['code-block'],
      [{ list: 'ordered' }, { list: 'bullet' }],
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
              if (user) { insertMentionRef.current(user); return false; }
            }
            doSendRef.current();
            return false;
          },
        },
        arrowUp: {
          key: 'ArrowUp',
          handler() {
            if (!mentionStateRef.current) return true;
            setMentionState(prev =>
              prev ? { ...prev, selectedIdx: Math.max(0, prev.selectedIdx - 1) } : null,
            );
            return false;
          },
        },
        arrowDown: {
          key: 'ArrowDown',
          handler() {
            if (!mentionStateRef.current) return true;
            setMentionState(prev => {
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
            if (mentionStateRef.current) { setMentionState(null); return false; }
            onCancelRef.current?.();
            return true;
          },
        },
      },
    },
  }), []); // intentionally empty — all values accessed via refs

  // --- Detect @ mention as user types ---
  useEffect(() => {
    const quill = quillRef.current?.getEditor();
    if (!quill) return;

    const detect = () => {
      const sel = quill.getSelection();
      if (!sel || sel.length > 0) { setMentionState(null); return; }

      const textBefore = quill.getText(0, sel.index);
      const atPos = textBefore.lastIndexOf('@');
      if (atPos === -1) { setMentionState(null); return; }

      const query = textBefore.slice(atPos + 1);
      if (/[\s\n]/.test(query)) { setMentionState(null); return; }

      setMentionState(prev => ({
        atIndex: atPos,
        query,
        selectedIdx: prev?.atIndex === atPos ? prev.selectedIdx : 0,
      }));
    };

    quill.on('text-change', detect);
    quill.on('selection-change', detect);
    return () => {
      quill.off('text-change', detect);
      quill.off('selection-change', detect);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
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
    try { return JSON.parse(initialContent) as Record<string, unknown>; }
    catch { return undefined; }
  }, [initialContent]);

  const showDropdown = !!mentionState && suggestions.length > 0;

  return (
    <Box
      sx={{
        position: 'relative',
        opacity: disabled ? 0.6 : 1,
        pointerEvents: disabled ? 'none' : 'auto',
        '& .ql-editor': { minHeight: 60, maxHeight: 200, overflowY: 'auto', fontSize: '0.875rem' },
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
      <ReactQuill
        ref={quillRef}
        theme="snow"
        defaultValue={parsedInitial as never}
        modules={modules}
        placeholder="メッセージを入力… (@ でメンション、Enter で送信、Shift+Enter で改行)"
        readOnly={disabled}
      />

      <Popper
        open={showDropdown}
        anchorEl={popperAnchor}
        placement="bottom-start"
        style={{ zIndex: 1500 }}
        modifiers={[{ name: 'offset', options: { offset: [0, 4] } }]}
      >
        <Paper elevation={4} sx={{ minWidth: 160, maxHeight: 220, overflow: 'auto' }}>
          <List dense disablePadding>
            {suggestions.map((user, idx) => (
              <ListItem key={user.id} disablePadding>
                <ListItemButton
                  selected={idx === mentionState?.selectedIdx}
                  onMouseDown={(e) => {
                    e.preventDefault(); // keep editor focused
                    insertMention(user);
                  }}
                >
                  <ListItemText primary={`@${user.username}`} />
                </ListItemButton>
              </ListItem>
            ))}
          </List>
        </Paper>
      </Popper>
    </Box>
  );
}
