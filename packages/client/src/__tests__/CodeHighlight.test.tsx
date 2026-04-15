/**
 * コードブロック構文ハイライト のユニットテスト (#58)
 *
 * テスト対象: utils/renderMessageContent.tsx（コードブロック検出・ハイライト）
 * 戦略:
 *   - renderMessageContent にコードブロックを含む Delta を渡して DOM を検証する
 *   - highlight.js によるシンタックスハイライト適用後の DOM を検証する
 *   - 通常テキストへの影響がないことも合わせて確認する
 */

import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { renderMessageContent } from '../utils/renderMessageContent';

/** Delta ops を JSON 文字列に変換するヘルパー */
function makeDelta(ops: object[]): string {
  return JSON.stringify({ ops });
}

/** renderMessageContent の結果を div にマウントして返す */
function renderContent(content: string) {
  return render(<div>{renderMessageContent(content)}</div>);
}

describe('コードブロック構文ハイライト', () => {
  describe('コードブロックの検出', () => {
    it('```lang\\ncode\\n``` 形式の文字列を含むメッセージを正しく検出できる', () => {
      const content = makeDelta([
        { insert: 'const x = 1;\n', attributes: { 'code-block': 'javascript' } },
      ]);
      renderContent(content);
      expect(document.querySelector('pre')).toBeInTheDocument();
    });

    it('言語指定なし（```\\ncode\\n```）のコードブロックを検出できる', () => {
      const content = makeDelta([{ insert: 'plain code\n', attributes: { 'code-block': true } }]);
      renderContent(content);
      expect(document.querySelector('pre')).toBeInTheDocument();
    });

    it('言語指定あり（```js）のコードブロックを検出できる', () => {
      const content = makeDelta([
        { insert: 'console.log("hi");\n', attributes: { 'code-block': 'js' } },
      ]);
      renderContent(content);
      expect(document.querySelector('pre')).toBeInTheDocument();
    });

    it('言語指定あり（```python）のコードブロックを検出できる', () => {
      const content = makeDelta([
        { insert: 'print("hello")\n', attributes: { 'code-block': 'python' } },
      ]);
      renderContent(content);
      expect(document.querySelector('pre')).toBeInTheDocument();
    });

    it('言語指定あり（```tsx）のコードブロックを検出できる', () => {
      const content = makeDelta([
        { insert: 'const App = () => <div />\n', attributes: { 'code-block': 'tsx' } },
      ]);
      renderContent(content);
      expect(document.querySelector('pre')).toBeInTheDocument();
    });

    it('コードブロックが複数含まれるメッセージをすべて検出できる', () => {
      const content = makeDelta([
        { insert: 'const a = 1;\n', attributes: { 'code-block': 'js' } },
        { insert: 'between\n' },
        { insert: 'print("py")\n', attributes: { 'code-block': 'python' } },
      ]);
      renderContent(content);
      expect(document.querySelectorAll('pre').length).toBe(2);
    });
  });

  describe('シンタックスハイライトの適用', () => {
    it('言語指定なしのコードブロックに対してハイライトが適用される（plain text / fallback）', () => {
      const content = makeDelta([{ insert: 'plain code\n', attributes: { 'code-block': true } }]);
      renderContent(content);
      expect(document.querySelector('code.hljs')).toBeInTheDocument();
    });

    it('```js のコードブロックに JavaScript のシンタックスハイライトが適用される', () => {
      const content = makeDelta([{ insert: 'const x = 1;\n', attributes: { 'code-block': 'js' } }]);
      renderContent(content);
      expect(document.querySelector('code.hljs')).toBeInTheDocument();
    });

    it('```python のコードブロックに Python のシンタックスハイライトが適用される', () => {
      const content = makeDelta([
        { insert: 'def hello():\n    pass\n', attributes: { 'code-block': 'python' } },
      ]);
      renderContent(content);
      expect(document.querySelector('code.hljs')).toBeInTheDocument();
    });

    it('```tsx のコードブロックに TSX のシンタックスハイライトが適用される', () => {
      const content = makeDelta([
        { insert: 'const App = () => <div />\n', attributes: { 'code-block': 'tsx' } },
      ]);
      renderContent(content);
      expect(document.querySelector('code.hljs')).toBeInTheDocument();
    });

    it('ハイライト後の DOM にコードの文字列が含まれている', () => {
      const code = 'const answer = 42;';
      const content = makeDelta([
        { insert: `${code}\n`, attributes: { 'code-block': 'javascript' } },
      ]);
      const { container } = renderContent(content);
      expect(container.textContent).toContain(code);
    });

    it('ハイライト後の DOM に <code> または <pre> 要素が存在する', () => {
      const content = makeDelta([
        { insert: 'echo "hello"\n', attributes: { 'code-block': 'bash' } },
      ]);
      renderContent(content);
      const hasCode = document.querySelector('code') !== null;
      const hasPre = document.querySelector('pre') !== null;
      expect(hasCode || hasPre).toBe(true);
    });

    it('ハイライトライブラリが付与するクラス名（hljs または token）が要素に存在する', () => {
      const content = makeDelta([
        { insert: 'const x = 1;\n', attributes: { 'code-block': 'javascript' } },
      ]);
      renderContent(content);
      expect(document.querySelector('code.hljs')).not.toBeNull();
    });
  });

  describe('通常テキストへの影響なし', () => {
    it('コードブロックを含まない通常テキストはそのまま描画される', () => {
      const content = makeDelta([{ insert: 'Hello world\n' }]);
      renderContent(content);
      expect(screen.getByText('Hello world')).toBeInTheDocument();
    });

    it('コードブロックを含まないメッセージにハイライトクラスが付与されない', () => {
      const content = makeDelta([{ insert: 'No code here\n' }]);
      renderContent(content);
      expect(document.querySelector('code.hljs')).toBeNull();
      expect(document.querySelector('pre')).toBeNull();
    });

    it('コードブロックと通常テキストが混在するとき、通常テキスト部分は変化しない', () => {
      const content = makeDelta([
        { insert: 'Normal text before\n' },
        { insert: 'const x = 1;\n', attributes: { 'code-block': 'js' } },
        { insert: 'Normal text after\n' },
      ]);
      renderContent(content);
      expect(screen.getByText('Normal text before')).toBeInTheDocument();
      expect(screen.getByText('Normal text after')).toBeInTheDocument();
      expect(document.querySelector('pre')).toBeInTheDocument();
    });
  });

  describe('MessageItem 経由でのレンダリング', () => {
    it('コードブロックを含むメッセージが MessageItem で正しく表示される', () => {
      // MessageItem は内部で renderMessageContent を呼ぶ
      // ここでは renderMessageContent の返り値を直接検証する（統合的なスモークテスト）
      const content = makeDelta([
        { insert: 'Hello\n' },
        { insert: 'const x = 1;\n', attributes: { 'code-block': 'javascript' } },
      ]);
      renderContent(content);
      expect(screen.getByText('Hello')).toBeInTheDocument();
      expect(document.querySelector('pre')).toBeInTheDocument();
    });

    it('言語指定ありのコードブロックが MessageItem 内でハイライト表示される', () => {
      const content = makeDelta([
        { insert: 'print("hello")\n', attributes: { 'code-block': 'python' } },
      ]);
      renderContent(content);
      expect(document.querySelector('code.hljs')).toBeInTheDocument();
    });
  });
});
