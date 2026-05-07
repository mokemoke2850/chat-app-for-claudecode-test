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

import { useState, useEffect, useCallback } from 'react';
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

  const handleKeydown = useCallback(
    (e: KeyboardEvent) => {
      // エディタフォーカス中はすべて無視
      if (isEditorFocused) return;
      // メッセージが空のときは無視
      if (messages.length === 0) return;

      switch (e.key) {
        case 'j': {
          e.preventDefault();
          setFocusedIndex((prev) => {
            if (prev === null) return 0;
            return Math.min(prev + 1, messages.length - 1);
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
          if (focusedIndex === null) break;
          const msg = messages[focusedIndex];
          if (msg) onOpenThread?.(msg.id);
          break;
        }
        case 'r': {
          if (focusedIndex === null) break;
          const msg = messages[focusedIndex];
          if (msg) onReact?.(msg.id);
          break;
        }
        case 'p': {
          if (focusedIndex === null) break;
          const msg = messages[focusedIndex];
          if (msg) onPinMessage?.(msg.id);
          break;
        }
      }
    },
    [isEditorFocused, messages, focusedIndex, onOpenThread, onReact, onPinMessage],
  );

  useEffect(() => {
    document.addEventListener('keydown', handleKeydown);
    return () => {
      document.removeEventListener('keydown', handleKeydown);
    };
  }, [handleKeydown]);

  const focusedMessageId =
    focusedIndex !== null && messages[focusedIndex] ? messages[focusedIndex].id : null;

  return { focusedIndex, focusedMessageId };
}
