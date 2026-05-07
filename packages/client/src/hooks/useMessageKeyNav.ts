/**
 * useMessageKeyNav
 *
 * メッセージリスト上でのキーボードナビゲーションを管理するカスタムフック。
 *
 * キーバインド:
 *   j     — 次のメッセージへ移動
 *   k     — 前のメッセージへ移動
 *   Enter — フォーカス中メッセージのスレッドを開く
 *   r     — フォーカス中メッセージにリアクション
 *   p     — フォーカス中メッセージをピン留め
 *
 * エディタ（RichEditor）がフォーカスを持っているときはすべてのキーを無視する。
 */

import { useState, useEffect, useRef } from 'react';
import type { Message } from '@chat-app/shared';

interface Options {
  messages: Message[];
  isEditorFocused: boolean;
  onOpenThread?: (messageId: number) => void;
  onReact?: (messageId: number) => void;
  onPinMessage?: (messageId: number) => void;
}

interface Result {
  /** 現在フォーカスされているメッセージのインデックス（messages 配列上の位置）。未選択なら null */
  focusedIndex: number | null;
  /** 現在フォーカスされているメッセージの id。未選択なら null */
  focusedMessageId: number | null;
}

export function useMessageKeyNav({
  messages,
  isEditorFocused,
  onOpenThread,
  onReact,
  onPinMessage,
}: Options): Result {
  const [focusedIndex, setFocusedIndex] = useState<number | null>(null);

  // Ref で最新値を保持し、keydown ハンドラが stale closure にならないようにする。
  // useCallback + deps による再登録では React の非同期バッチ更新により
  // キーイベント発火時に古い値を参照するケースがあるため useRef を採用する。
  const isEditorFocusedRef = useRef(isEditorFocused);
  isEditorFocusedRef.current = isEditorFocused;

  const messagesRef = useRef(messages);
  messagesRef.current = messages;

  const focusedIndexRef = useRef(focusedIndex);
  focusedIndexRef.current = focusedIndex;

  const onOpenThreadRef = useRef(onOpenThread);
  onOpenThreadRef.current = onOpenThread;

  const onReactRef = useRef(onReact);
  onReactRef.current = onReact;

  const onPinMessageRef = useRef(onPinMessage);
  onPinMessageRef.current = onPinMessage;

  useEffect(() => {
    const handleKeydown = (e: KeyboardEvent) => {
      // エディタフォーカス中はすべて無視（常に最新値を ref 経由で参照する）
      if (isEditorFocusedRef.current) return;
      const currentMessages = messagesRef.current;
      // メッセージが空のときは無視
      if (currentMessages.length === 0) return;

      switch (e.key) {
        case 'j': {
          e.preventDefault();
          setFocusedIndex((prev) => {
            if (prev === null) return 0;
            return Math.min(prev + 1, currentMessages.length - 1);
          });
          break;
        }
        case 'k': {
          e.preventDefault();
          setFocusedIndex((prev) => {
            if (prev === null) return 0;
            return Math.max(prev - 1, 0);
          });
          break;
        }
        case 'Enter': {
          const idx = focusedIndexRef.current;
          if (idx === null) break;
          const msg = currentMessages[idx];
          if (msg) onOpenThreadRef.current?.(msg.id);
          break;
        }
        case 'r': {
          const idx = focusedIndexRef.current;
          if (idx === null) break;
          const msg = currentMessages[idx];
          if (msg) onReactRef.current?.(msg.id);
          break;
        }
        case 'p': {
          const idx = focusedIndexRef.current;
          if (idx === null) break;
          const msg = currentMessages[idx];
          if (msg) onPinMessageRef.current?.(msg.id);
          break;
        }
      }
    };

    document.addEventListener('keydown', handleKeydown);
    return () => {
      document.removeEventListener('keydown', handleKeydown);
    };
  }, []); // マウント時に1回だけ登録。最新値はすべて ref 経由で参照する

  const focusedMessageId =
    focusedIndex !== null && messagesRef.current[focusedIndex]
      ? messagesRef.current[focusedIndex].id
      : null;

  return { focusedIndex, focusedMessageId };
}
