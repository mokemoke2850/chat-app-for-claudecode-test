import { Box, List, Typography, IconButton, Tooltip, Divider } from '@mui/material';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import type { MessageSearchResult } from '@chat-app/shared';
import TagChip from './TagChip';
import { extractMessageText } from '../../utils/extractMessageText';
import { buildSnippet } from '../../utils/buildSnippet';

interface Props {
  results: MessageSearchResult[];
  onNavigate: (channelId: number, messageId: number) => void;
  /**
   * Step 7c-2: マッチ部分のハイライト + スニペット切り出し用のキーワード。
   * 未指定 / 空のときは本文先頭抜粋を表示しハイライトしない。
   */
  keyword?: string;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString('ja-JP', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function SearchResults({ results, onNavigate, keyword = '' }: Props) {
  const handleCopy = (result: MessageSearchResult) => {
    const url = `${window.location.origin}${window.location.pathname}?channel=${result.channelId}#message-${result.id}`;
    void navigator.clipboard.writeText(url);
  };

  if (results.length === 0) {
    return (
      <Box sx={{ p: 4, textAlign: 'center' }}>
        <Typography color="text.secondary">見つかりませんでした</Typography>
      </Box>
    );
  }

  return (
    <List disablePadding>
      {results.map((result) => (
        <Box key={result.id} component="li" sx={{ listStyle: 'none' }}>
          <Box sx={{ px: 2, py: 1.5 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 0.5, gap: 1 }}>
              <Typography variant="caption" color="primary" fontWeight="bold">
                # {result.channelName}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {result.username}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {formatDate(result.createdAt)}
              </Typography>
              <Box sx={{ ml: 'auto', display: 'flex', gap: 0.5 }}>
                <Tooltip title="リンクをコピー">
                  <IconButton size="small" onClick={() => handleCopy(result)}>
                    <ContentCopyIcon fontSize="inherit" />
                  </IconButton>
                </Tooltip>
                <Tooltip title="投稿へ移動">
                  <IconButton size="small" onClick={() => onNavigate(result.channelId, result.id)}>
                    <OpenInNewIcon fontSize="inherit" />
                  </IconButton>
                </Tooltip>
              </Box>
            </Box>
            {result.rootMessageContent && (
              <Typography
                variant="caption"
                color="text.secondary"
                sx={{
                  display: 'block',
                  mb: 0.5,
                  pl: 1,
                  borderLeft: 2,
                  borderColor: 'divider',
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word',
                }}
              >
                {extractMessageText(result.rootMessageContent)}
              </Typography>
            )}
            {(() => {
              const snippet = buildSnippet(extractMessageText(result.content), keyword);
              return (
                <Typography
                  variant="body2"
                  sx={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}
                  data-testid="search-result-snippet"
                >
                  {snippet.before}
                  {snippet.match && (
                    <Box
                      component="mark"
                      sx={{
                        bgcolor: 'var(--accent-soft, #fff59d)',
                        color: 'inherit',
                        px: 0.25,
                        borderRadius: 0.5,
                      }}
                    >
                      {snippet.match}
                    </Box>
                  )}
                  {snippet.after}
                </Typography>
              );
            })()}
            {result.tags && result.tags.length > 0 && (
              <Box
                sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mt: 0.5 }}
                data-testid="search-result-tags"
              >
                {result.tags.map((tag) => (
                  <TagChip key={tag.id} tag={tag} readOnly={true} />
                ))}
              </Box>
            )}
          </Box>
          <Divider />
        </Box>
      ))}
    </List>
  );
}
