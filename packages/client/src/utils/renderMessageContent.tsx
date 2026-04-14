import { Box } from '@mui/material';

interface DeltaOp {
  insert?: string | { mention?: { value: string }; image?: string };
  attributes?: {
    bold?: boolean;
    italic?: boolean;
    underline?: boolean;
    strike?: boolean;
    code?: boolean;
    'code-block'?: boolean;
    color?: string;
    background?: string;
  };
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
        return (
          <Box
            key={i}
            component="pre"
            sx={{
              display: 'inline',
              background: 'action.hover',
              px: 0.5,
              borderRadius: 1,
              fontFamily: 'monospace',
              fontSize: '0.85em',
            }}
          >
            {text}
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
