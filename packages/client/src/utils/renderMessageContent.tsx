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
 * - 言語指定あり（string）: hljs.highlight を試みる。未知の言語は highlightAuto にフォールバック
 * - 言語指定なし（true）: hljs.highlightAuto を使用
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

export function renderMessageContent(content: string): React.ReactNode {
  try {
    const delta = JSON.parse(content) as { ops?: DeltaOp[] };
    const ops = delta.ops ?? [];

    return ops.map((op, i) => {
      if (typeof op.insert === 'object' && op.insert?.mention) {
        return (
          <Box key={i} component="span" sx={{ color: 'primary.main', fontWeight: 600 }}>
            @{op.insert.mention.value}
          </Box>
        );
      }

      if (typeof op.insert === 'object' && op.insert?.image) {
        return (
          <Box
            key={i}
            component="img"
            src={op.insert.image}
            alt="Attached image"
            sx={{ maxWidth: '100%', maxHeight: 300, borderRadius: 1, display: 'block', mt: 0.5 }}
          />
        );
      }

      if (typeof op.insert !== 'string') return null;

      const text = op.insert;
      const a = op.attributes;

      if (a?.['code-block']) {
        const highlighted = highlightCode(text, a['code-block']);
        return (
          <Box
            key={i}
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
            <code
              className="hljs"
               
              dangerouslySetInnerHTML={{ __html: highlighted }}
            />
          </Box>
        );
      }

      const inlineStyle: React.CSSProperties = {};
      if (a?.color) inlineStyle.color = a.color;
      if (a?.background) inlineStyle.backgroundColor = a.background;

      let node: React.ReactNode = text;
      if (a?.bold) node = <strong key={`b${i}`}>{node}</strong>;
      if (a?.italic) node = <em key={`i${i}`}>{node}</em>;
      if (a?.underline) node = <u key={`u${i}`}>{node}</u>;
      if (a?.strike) node = <s key={`s${i}`}>{node}</s>;
      if (a?.code)
        node = (
          <Box
            key={`c${i}`}
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

      if (Object.keys(inlineStyle).length > 0) {
        node = (
          <span key={`style${i}`} style={inlineStyle}>
            {node}
          </span>
        );
      }

      return <span key={i}>{node}</span>;
    });
  } catch {
    return content;
  }
}
