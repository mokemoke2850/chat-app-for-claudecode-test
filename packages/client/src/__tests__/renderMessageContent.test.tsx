/**
 * utils/renderMessageContent.tsx のユニットテスト（#132 末尾改行バグ修正）
 *
 * テスト対象: renderMessageContent — Quill Delta から React ノードへの描画
 * 戦略:
 *   - Delta JSON 文字列を直接渡し、出力 DOM を検証する
 *   - Quill の仕様上、本文末尾には常に行終端の \n が含まれるため、
 *     描画時にこれを <br /> として出力しないことを確認する
 *   - 既存のコードブロック / mention / 画像 などの描画には影響を与えないことを担保する
 */

import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { renderMessageContent } from '../utils/renderMessageContent';

function makeDelta(ops: object[]): string {
  return JSON.stringify({ ops });
}

function renderContent(content: string) {
  return render(<div>{renderMessageContent(content)}</div>);
}

describe('renderMessageContent — 末尾改行の処理（#132）', () => {
  describe('単一行メッセージ', () => {
    it('"あああ\\n" を渡したとき、<br> が描画されず 1 行で表示される', () => {
      const content = makeDelta([{ insert: 'あああ\n' }]);
      const { container } = renderContent(content);
      expect(container.querySelectorAll('br').length).toBe(0);
      expect(screen.getByText('あああ')).toBeInTheDocument();
    });

    it('attributes 付きテキスト（bold）末尾の \\n も描画されない', () => {
      const content = makeDelta([{ insert: 'あああ\n', attributes: { bold: true } }]);
      const { container } = renderContent(content);
      expect(container.querySelectorAll('br').length).toBe(0);
      expect(container.querySelector('strong')?.textContent).toBe('あああ');
    });
  });

  describe('複数行メッセージ', () => {
    it('"行1\\n行2\\n" は <br> が 1 つだけ描画される（末尾の \\n は無視）', () => {
      const content = makeDelta([{ insert: '行1\n行2\n' }]);
      const { container } = renderContent(content);
      expect(container.querySelectorAll('br').length).toBe(1);
      expect(screen.getByText('行1')).toBeInTheDocument();
      expect(screen.getByText('行2')).toBeInTheDocument();
    });

    it('"行1\\n行2\\n行3\\n" は <br> が 2 つだけ描画される', () => {
      const content = makeDelta([{ insert: '行1\n行2\n行3\n' }]);
      const { container } = renderContent(content);
      expect(container.querySelectorAll('br').length).toBe(2);
    });
  });

  describe('Enter 押下直後の二重改行への耐性', () => {
    it('"あああ\\n\\n" のように末尾に余分な \\n が含まれていても 1 行で表示される', () => {
      const content = makeDelta([{ insert: 'あああ\n\n' }]);
      const { container } = renderContent(content);
      expect(container.querySelectorAll('br').length).toBe(0);
      expect(screen.getByText('あああ')).toBeInTheDocument();
    });
  });

  describe('Quill 仕様上の末尾改行のみのケース', () => {
    it('"\\n" のみ（空メッセージ相当）の場合、<br> は描画されない', () => {
      const content = makeDelta([{ insert: '\n' }]);
      const { container } = renderContent(content);
      expect(container.querySelectorAll('br').length).toBe(0);
    });
  });

  describe('既存機能への影響なし', () => {
    it('mention を含むメッセージの末尾 \\n は無視されつつメンションは描画される', () => {
      const content = makeDelta([
        { insert: { mention: { value: 'alice' } } },
        { insert: ' こんにちは\n' },
      ]);
      const { container } = renderContent(content);
      expect(container.querySelectorAll('br').length).toBe(0);
      expect(container.textContent).toContain('@alice');
      expect(container.textContent).toContain('こんにちは');
    });

    it('画像（image）を含むメッセージの末尾 \\n は無視されつつ画像は描画される', () => {
      const content = makeDelta([
        { insert: { image: 'https://example.com/cat.png' } },
        { insert: '\n' },
      ]);
      const { container } = renderContent(content);
      expect(container.querySelectorAll('br').length).toBe(0);
      const img = container.querySelector('img');
      expect(img).not.toBeNull();
      expect(img?.getAttribute('src')).toBe('https://example.com/cat.png');
    });

    it('コードブロックを含むメッセージは従来通り <pre> として描画される', () => {
      const content = makeDelta([
        { insert: 'const x = 1;\n', attributes: { 'code-block': 'javascript' } },
      ]);
      const { container } = renderContent(content);
      expect(container.querySelector('pre')).not.toBeNull();
    });
  });
});
