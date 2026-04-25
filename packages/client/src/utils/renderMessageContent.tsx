import { Box } from '@mui/material';
import hljs from 'highlight.js';

interface DeltaOp {
  insert?: string | { mention?: { value: string }; image?: string };
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

function renderInlineOp(op: DeltaOp, key: string): React.ReactNode {
  if (typeof op.insert !== 'string') return null;
  const text = op.insert;
  const a = op.attributes;
  const inlineStyle: React.CSSProperties = {};
  if (a?.color) inlineStyle.color = a.color;
  if (a?.background) inlineStyle.backgroundColor = a.background;

  let node: React.ReactNode = text;
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

export function renderMessageContent(content: string): React.ReactNode {
  try {
    const delta = JSON.parse(content) as { ops?: DeltaOp[] };
    const ops = stripTrailingBlockNewline(delta.ops ?? []);

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
          <code className="hljs" dangerouslySetInnerHTML={{ __html: highlighted }} />
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
          const n = renderInlineOp(lo, `${i}-${j}`);
          if (n) result.push(n);
        });
        lineOps = [];
        if (op.insert?.mention) {
          result.push(
            <Box key={i} component="span" sx={{ color: 'primary.main', fontWeight: 600 }}>
              @{op.insert.mention.value}
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
          const n = renderInlineOp(lo, `${i}-${j}`);
          if (n) result.push(n);
        });
        result.push(<br key={`br${i}`} />);
        lineOps = [];
      } else if (text.includes('\n')) {
        // 改行を含む複合テキスト（貼り付けなど）
        flushCodeBlock();
        lineOps.forEach((lo, j) => {
          const n = renderInlineOp(lo, `${i}-${j}`);
          if (n) result.push(n);
        });
        lineOps = [];
        const parts = text.split('\n');
        parts.forEach((part, pi) => {
          if (part) result.push(<span key={`${i}-p${pi}`}>{part}</span>);
          if (pi < parts.length - 1) result.push(<br key={`${i}-br${pi}`} />);
        });
      } else {
        lineOps.push(op);
      }
    }

    // 末尾の残り
    flushCodeBlock();
    lineOps.forEach((lo, j) => {
      const n = renderInlineOp(lo, `end-${j}`);
      if (n) result.push(n);
    });

    return result;
  } catch {
    return content;
  }
}
