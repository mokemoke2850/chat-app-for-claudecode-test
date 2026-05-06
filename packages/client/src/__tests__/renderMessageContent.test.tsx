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

    describe('メンション直後の余分な「@」除去（#250）', () => {
      it('単一メンション + 半角スペース + 本文 を描画したとき、チップ直後に余分な「@」が出ない', () => {
        const content = makeDelta([
          { insert: { mention: { value: 'alice' } } },
          { insert: ' hello\n' },
        ]);
        const { container } = renderContent(content);
        // メンションチップは「@alice」を表示する
        expect(container.textContent).toContain('@alice');
        // チップ直後に「 @」（空白+@）が連続して現れない（= 余分な @ が出ない）
        expect(container.textContent).not.toMatch(/@alice\s+@/);
        // 本文「hello」は維持される
        expect(container.textContent).toContain('hello');
        // textContent 全体としては「@alice hello」相当（末尾改行は除去済み）
        expect(container.textContent).toBe('@alice hello');
      });

      it('単一メンション直後の文字列が「@ 」（@+空白）で始まるとき、@ がレンダリングから除去される', () => {
        const content = makeDelta([
          { insert: { mention: { value: 'alice' } } },
          { insert: '@ hello\n' },
        ]);
        const { container } = renderContent(content);
        // チップ直後の「@ 」由来の余分な @ が消えている
        expect(container.textContent).not.toMatch(/@alice\s*@/);
        // メンションチップと本文は残る
        expect(container.textContent).toContain('@alice');
        expect(container.textContent).toContain('hello');
      });

      it('単一メンション直後の文字列が「 @」（空白+@）で始まるとき、メンションチップ後ろに余分な @ が出ない', () => {
        const content = makeDelta([
          { insert: { mention: { value: 'alice' } } },
          { insert: ' @ hello\n' },
        ]);
        const { container } = renderContent(content);
        // チップ直後の「 @」由来の余分な @ が消えている
        expect(container.textContent).not.toMatch(/@alice\s+@/);
        expect(container.textContent).toContain('@alice');
        expect(container.textContent).toContain('hello');
      });

      it('連続メンション（@user1 @user2 hello）で各チップ直後に余分な @ が出ない', () => {
        // 余分な @ が混入したパターン（チップとチップの間、最終チップの後にいずれも「 @ 」が残っている）
        const content = makeDelta([
          { insert: { mention: { value: 'alice' } } },
          { insert: ' @ ' },
          { insert: { mention: { value: 'bob' } } },
          { insert: ' @ hello\n' },
        ]);
        const { container } = renderContent(content);
        // 期待: 余分な @ は両方とも吸収され、最終的に「@alice @bob hello」になる
        expect(container.textContent).toBe('@alice @bob hello');
        expect(container.textContent).toContain('@alice');
        expect(container.textContent).toContain('@bob');
        expect(container.textContent).toContain('hello');
      });

      it('メンション直後の文字列に @ が一切含まれていない通常パターンは従来どおり描画される', () => {
        const content = makeDelta([
          { insert: { mention: { value: 'alice' } } },
          { insert: ' good morning\n' },
        ]);
        const { container } = renderContent(content);
        expect(container.textContent).toBe('@alice good morning');
      });

      it('本文中の @ 文字（メールアドレスなど）はメンションチップ直後でなければ削除されない', () => {
        // メンションチップは含まず、本文中に @ を含むケース
        const content = makeDelta([{ insert: 'send to alice@example.com please\n' }]);
        const { container } = renderContent(content);
        expect(container.textContent).toContain('alice@example.com');
      });

      it('メンションを含まない通常メッセージの描画には影響しない', () => {
        const content = makeDelta([{ insert: 'just plain text\n' }]);
        const { container } = renderContent(content);
        expect(container.textContent).toBe('just plain text');
      });

      it('レガシーデータ（mention embed の直後に「 @ 」が混入した既存 delta）でも余分な @ が表示されない', () => {
        // 既存 DB に保存されているレガシー delta を想定: 「 @ 」が混入している
        const content = makeDelta([
          { insert: { mention: { value: 'e2e_alice' } } },
          { insert: ' @ hello mention test\n' },
        ]);
        const { container } = renderContent(content);
        // 「@e2e_alice @ hello mention test」のような余分な @ が出ない
        expect(container.textContent).not.toMatch(/@e2e_alice\s+@/);
        // チップは表示される
        expect(container.textContent).toContain('@e2e_alice');
        // 本文は保持される
        expect(container.textContent).toContain('hello mention test');
      });
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
