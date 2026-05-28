import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Box } from '@mui/material';

interface Props {
  source: string;
}

export default function MarkdownRenderer({ source }: Props) {
  return (
    <Box
      className="markdown-body"
      sx={{ '& pre': { p: 1, bgcolor: 'action.hover', overflowX: 'auto' } }}
    >
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{source}</ReactMarkdown>
    </Box>
  );
}
