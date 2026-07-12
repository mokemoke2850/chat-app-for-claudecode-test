import { Box } from '@mui/material';
import hljs from 'highlight.js';

interface DeltaOp {
  insert?:
    | string
    | {
        // mention は新形式 ({id, value}) と DB 上に残るレガシー形式 ({id, username}) の両方を許容する
        mention?: { value?: string; username?: string; id?: number };
        image?: string;
      };
  attributes?: {
    bold?: boolean;
    italic?: boolean;
    underline?: boolean;
    strike?: boolean;
    code?: boolean;
    'code-block'?: boolean | string;
    color?: string;
    background?: string;
  };
}

/**
 * mention op から表示用の username を取得する。
 * 新形式 (`value`) と DB に残っているレガシー形式 (`username`) の両方をサポートする。
 */
function getMentionName(op: DeltaOp): string {
  if (typeof op.insert !== 'object' || !op.insert?.mention) return '';
  return op.insert.mention.value ?? op.insert.mention.username ?? '';
}

/**
 * コードブロックに highlight.js を適用してハイライト済み HTML を返す
 */
function highlightCode(code: string, language: boolean | string): string {
  if (typeof language === 'string') {
    const lang = language.toLowerCase();
    if (hljs.getLanguage(lang)) {
      return hljs.highlight(code, { language: lang }).value;
    }
  }
  return hljs.highlightAuto(code).value;
}

function renderHighlightedCode(html: string, term: string): React.ReactNode {
  if (typeof document === 'undefined') return html;
  const template = document.createElement('template');
  template.innerHTML = html;
  const visit = (node: ChildNode, key: string): React.ReactNode => {
    if (node.nodeType === 3) return <span key={key}>{highlightText(node.textContent ?? '', term)}</span>;
    if (!(node instanceof HTMLElement)) return null;
    return <span key={key} className={node.className}>{Array.from(node.childNodes).map((child, index) => visit(child, `${key}-${index}`))}</span>;
  };
  return Array.from(template.content.childNodes).map((node, index) => visit(node, `code-${index}`));
}

function highlightText(text: string, term?: string): React.ReactNode {
  if (!term) return text;
  const needle = term.toLocaleLowerCase();
  if (!needle) return text;
  const nodes: React.ReactNode[] = [];
  let cursor = 0;
  const lower = text.toLocaleLowerCase();
  while (cursor < text.length) {
    const index = lower.indexOf(needle, cursor);
    if (index < 0) {
      nodes.push(text.slice(cursor));
      break;
    }
    if (index > cursor) nodes.push(text.slice(cursor, index));
    nodes.push(<mark key={`${index}-${nodes.length}`} className="search-term-highlight">{text.slice(index, index + term.length)}</mark>);
    cursor = index + term.length;
  }
  return nodes;
}

function renderInlineOp(op: DeltaOp, key: string, highlightTerm?: string): React.ReactNode {
  if (typeof op.insert !== 'string') return null;
  const text = op.insert;
  const a = op.attributes;
  const inlineStyle: React.CSSProperties = {};
  if (a?.color) inlineStyle.color = a.color;
  if (a?.background) inlineStyle.backgroundColor = a.background;

  let node: React.ReactNode = highlightText(text, highlightTerm);
  if (a?.bold) node = <strong>{node}</strong>;
  if (a?.italic) node = <em>{node}</em>;
  if (a?.underline) node = <u>{node}</u>;
  if (a?.strike) node = <s>{node}</s>;
  if (a?.code)
    node = (
      <Box
        component="code"
        sx={{
          background: 'action.hover',
          px: 0.5,
          borderRadius: 1,
          fontFamily: 'monospace',
          fontSize: '0.85em',
        }}
      >
        {node}
      </Box>
    );
  if (Object.keys(inlineStyle).length > 0) node = <span style={inlineStyle}>{node}</span>;
  return <span key={key}>{node}</span>;
}

/**
 * Quill が本文末尾に必ず付与する行終端 \n を描画対象から除外する。
 * 連続する末尾 \n を 1 件分の行終端として扱い、まとめて除去する
 * （Enter 同期送信時に \n\n が混入するケースに耐えるため）。
 * code-block 等の attributes が付いた op は構造保持のため対象外。
 */
function stripTrailingBlockNewline(ops: DeltaOp[]): DeltaOp[] {
  const result = [...ops];
  while (result.length > 0) {
    const last = result[result.length - 1];
    if (typeof last.insert !== 'string' || last.attributes?.['code-block']) break;
    const stripped = last.insert.replace(/\n+$/, '');
    if (stripped === last.insert) break;
    if (stripped === '') {
      result.pop();
      continue;
    }
    result[result.length - 1] = { ...last, insert: stripped };
    break;
  }
  return result;
}

/**
 * メンション embed の **直前** に「@<username>(空白)」のテキスト op が残っているレガシー delta を補正する（#250 再修正）。
 *
 * 背景:
 *   - 過去の挿入経路バグで、本来「@al」と入力していた範囲が削除されず残ったまま
 *     mention embed が追加されたケースが DB に存在する
 *     例: `[{insert:"@e2e_alice "},{insert:{mention:{id:8,username:"e2e_alice"}}},{insert:" hello\n"}]`
 *   - そのまま描画すると「@e2e_alice 」(prefix text) + 「@e2e_alice」(チップ) で同じユーザー名が二重に出る
 *
 * 仕様:
 *   - 「テキスト op が末尾に `@<NAME>\s*` を含む」かつ「直後の op が mention embed で username が `<NAME>` と一致」する場合のみ
 *     テキスト op の末尾の `@<NAME>\s*` を 1 回だけ除去する
 *   - 除去結果が空文字になったら op 自体を削除する
 *   - 一致しない場合（別ユーザー名 / メンションが続かない通常文章）は触らない
 */
function stripPrefixMentionText(ops: DeltaOp[]): DeltaOp[] {
  const result: DeltaOp[] = [];
  for (let i = 0; i < ops.length; i++) {
    const op = ops[i];
    const next = ops[i + 1];
    const nextIsMention =
      next !== undefined && typeof next.insert === 'object' && next.insert?.mention != null;

    if (nextIsMention && typeof op.insert === 'string') {
      const name = getMentionName(next);
      if (name.length > 0) {
        // 末尾の「@<name>\s*」だけを除去（先頭〜途中の同名 @ は触らない）
        // \s* は半角/全角スペース・タブを許容
        const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const trimmed = op.insert.replace(new RegExp(`@${escaped}\\s*$`), '');
        if (trimmed === '') {
          // op 自体を削除（push しない）
          continue;
        }
        if (trimmed !== op.insert) {
          result.push({ ...op, insert: trimmed });
          continue;
        }
      }
    }
    result.push(op);
  }
  return result;
}

/**
 * メンション embed の直後に続くテキスト op の先頭に余分な「@」が混入しているケースを補正する（#250）。
 *
 * 背景:
 *   - 過去の挿入経路バグ等で「mention embed → ' @ ' のようなテキスト」が DB に保存されている
 *   - レンダリング側で chip が `@username` を表示するため、続くテキストの先頭 `@` が二重化して見える
 *
 * 仕様:
 *   - mention embed の直後にあるテキスト op の先頭 `\s*@\s*` を 1 回だけ除去する（「 @ 」「@ 」「 @」「@」を吸収）
 *   - 除去後は単一の半角スペースに置換して、チップ直後の見栄えを担保する
 *   - メンション直後でない位置にある @ は触らない（メールアドレス等を破壊しない）
 */
function stripExtraMentionAt(ops: DeltaOp[]): DeltaOp[] {
  const result: DeltaOp[] = [];
  for (let i = 0; i < ops.length; i++) {
    const op = ops[i];
    const prev = result[result.length - 1];
    const prevIsMention =
      prev !== undefined && typeof prev.insert === 'object' && prev.insert?.mention != null;

    if (prevIsMention && typeof op.insert === 'string') {
      // 先頭の「（空白）+@+（空白）」を 1 つのスペースにまとめる
      const replaced = op.insert.replace(/^\s*@\s*/, ' ');
      result.push({ ...op, insert: replaced });
      continue;
    }
    result.push(op);
  }
  return result;
}

export function renderMessageContent(content: string, highlightTerm?: string): React.ReactNode {
  try {
    const delta = JSON.parse(content) as { ops?: DeltaOp[] };
    const ops = stripExtraMentionAt(
      stripPrefixMentionText(stripTrailingBlockNewline(delta.ops ?? [])),
    );

    const result: React.ReactNode[] = [];
    // 現在の行に属するテキスト系 op を蓄積
    let lineOps: DeltaOp[] = [];
    // コードブロック行の蓄積: 各行は「テキスト + 言語」
    let codeLines: { text: string; lang: boolean | string }[] = [];

    const flushCodeBlock = () => {
      if (codeLines.length === 0) return;
      const code = codeLines.map((l) => l.text).join('\n');
      const lang = codeLines[codeLines.length - 1].lang;
      const highlighted = highlightCode(code, lang);
      result.push(
        <Box
          key={result.length}
          component="pre"
          sx={{
            background: '#282c34',
            borderRadius: 1,
            p: 1.5,
            my: 0.5,
            overflowX: 'auto',
            fontFamily: 'monospace',
            fontSize: '0.85em',
            lineHeight: 1.5,
          }}
        >
          {highlightTerm ? (
            <code className="hljs">{renderHighlightedCode(highlighted, highlightTerm)}</code>
          ) : (
            <code className="hljs" dangerouslySetInnerHTML={{ __html: highlighted }} />
          )}
        </Box>,
      );
      codeLines = [];
    };

    for (let i = 0; i < ops.length; i++) {
      const op = ops[i];

      // mention / image
      if (typeof op.insert === 'object') {
        flushCodeBlock();
        lineOps.forEach((lo, j) => {
          const n = renderInlineOp(lo, `${i}-${j}`, highlightTerm);
          if (n) result.push(n);
        });
        lineOps = [];
        if (op.insert?.mention) {
          result.push(
            <Box key={i} component="span" sx={{ color: 'primary.main', fontWeight: 600 }}>
              @{getMentionName(op)}
            </Box>,
          );
        } else if (op.insert?.image) {
          result.push(
            <Box
              key={i}
              component="img"
              src={op.insert.image}
              alt="Attached image"
              sx={{ maxWidth: '100%', maxHeight: 300, borderRadius: 1, display: 'block', mt: 0.5 }}
            />,
          );
        }
        continue;
      }

      if (typeof op.insert !== 'string') continue;

      const text = op.insert;
      const a = op.attributes;

      // Quill は行末の \n に block 属性を付与する。
      // パターン1: "\n" のみのop に code-block 属性 (標準的な Quill 2.x)
      // パターン2: テキスト+"\\n" のopに code-block 属性 (まれ)
      if (a?.['code-block']) {
        // lineOps に溜まったテキスト + このopのテキスト(\n を除く) をコード行として記録
        const lineText =
          lineOps
            .filter((lo) => typeof lo.insert === 'string')
            .map((lo) => lo.insert as string)
            .join('') + text.replace(/\n$/, '');
        codeLines.push({ text: lineText, lang: a['code-block'] });
        lineOps = [];
        continue;
      }

      // 通常テキストまたは改行
      if (text === '\n') {
        // コードブロック終了 → フラッシュ
        flushCodeBlock();
        lineOps.forEach((lo, j) => {
          const n = renderInlineOp(lo, `${i}-${j}`, highlightTerm);
          if (n) result.push(n);
        });
        result.push(<br key={`br${i}`} />);
        lineOps = [];
      } else if (text.includes('\n')) {
        // 改行を含む複合テキスト（貼り付けなど）
        flushCodeBlock();
        lineOps.forEach((lo, j) => {
          const n = renderInlineOp(lo, `${i}-${j}`, highlightTerm);
          if (n) result.push(n);
        });
        lineOps = [];
        const parts = text.split('\n');
        parts.forEach((part, pi) => {
          if (part) result.push(<span key={`${i}-p${pi}`}>{highlightText(part, highlightTerm)}</span>);
          if (pi < parts.length - 1) result.push(<br key={`${i}-br${pi}`} />);
        });
      } else {
        lineOps.push(op);
      }
    }

    // 末尾の残り
    flushCodeBlock();
    lineOps.forEach((lo, j) => {
      const n = renderInlineOp(lo, `end-${j}`, highlightTerm);
      if (n) result.push(n);
    });

    return result;
  } catch {
    return highlightText(content, highlightTerm);
  }
}
