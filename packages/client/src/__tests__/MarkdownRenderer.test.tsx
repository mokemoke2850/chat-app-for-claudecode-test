/**
 * テスト対象: components/Wiki/MarkdownRenderer.tsx（#355）
 * 戦略:
 *   - react-markdown + remark-gfm を用いた Markdown レンダリングコンポーネントを検証
 *   - XSS 対策（生HTML/scriptタグの無害化）を含む
 *   - 基本的なMarkdown要素（見出し・リスト・コード・リンク）の出力を検証する
 */

import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import MarkdownRenderer from '../components/Wiki/MarkdownRenderer';

describe('MarkdownRenderer', () => {
  it('見出し（# 〜 ######）が h1〜h6 にレンダリングされる', () => {
    render(<MarkdownRenderer source={'# H1\n## H2\n### H3\n#### H4\n##### H5\n###### H6'} />);
    expect(screen.getByRole('heading', { level: 1, name: 'H1' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: 'H2' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 6, name: 'H6' })).toBeInTheDocument();
  });

  it('箇条書きリストが ul/li にレンダリングされる', () => {
    const { container } = render(<MarkdownRenderer source={'- a\n- b\n- c'} />);
    expect(container.querySelectorAll('ul li').length).toBe(3);
  });

  it('番号付きリストが ol/li にレンダリングされる', () => {
    const { container } = render(<MarkdownRenderer source={'1. a\n2. b'} />);
    expect(container.querySelectorAll('ol li').length).toBe(2);
  });

  it('コードブロック（```）が pre/code にレンダリングされる', () => {
    const { container } = render(<MarkdownRenderer source={'```\nhello\n```'} />);
    expect(container.querySelector('pre code')).toBeInTheDocument();
  });

  it('インラインコード（`code`）が code にレンダリングされる', () => {
    const { container } = render(<MarkdownRenderer source={'use `code` here'} />);
    const codes = Array.from(container.querySelectorAll('code')).filter((el) => !el.closest('pre'));
    expect(codes.length).toBeGreaterThan(0);
    expect(codes[0].textContent).toBe('code');
  });

  it('リンク（[text](url)）が a タグにレンダリングされる', () => {
    render(<MarkdownRenderer source={'[click](https://example.com)'} />);
    const link = screen.getByRole('link', { name: 'click' }) as HTMLAnchorElement;
    expect(link.href).toBe('https://example.com/');
  });

  it('GFM の表組みがテーブルとしてレンダリングされる', () => {
    const md = '| a | b |\n|---|---|\n| 1 | 2 |';
    const { container } = render(<MarkdownRenderer source={md} />);
    expect(container.querySelector('table')).toBeInTheDocument();
  });

  it('GFM のチェックボックスがチェックボックスとしてレンダリングされる', () => {
    const md = '- [x] done\n- [ ] todo';
    const { container } = render(<MarkdownRenderer source={md} />);
    expect(container.querySelectorAll('input[type="checkbox"]').length).toBe(2);
  });

  it('生の <script> タグは出力されない（XSS対策）', () => {
    const { container } = render(
      <MarkdownRenderer source={'<script>alert(1)</script>\n通常のテキスト'} />,
    );
    expect(container.querySelector('script')).toBeNull();
  });

  it('javascript: スキームのリンクは無害化される', () => {
    const { container } = render(<MarkdownRenderer source={'[bad](javascript:alert(1))'} />);
    const a = container.querySelector('a');
    // href が javascript: で始まらない（react-markdown 標準でブロック）
    expect(a?.getAttribute('href') ?? '').not.toMatch(/^javascript:/);
  });
});
