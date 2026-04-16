/**
 * ファイル一覧ページ
 * チャンネルにアップロードされたファイルの一覧を表示する。
 * React 19 の use() + Suspense パターンを使用する。
 */

import { use, useState, Suspense } from 'react';
import {
  Box,
  Typography,
  CircularProgress,
  Tabs,
  Tab,
  Tooltip,
  IconButton,
  ToggleButtonGroup,
  ToggleButton,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Paper,
  Chip,
} from '@mui/material';
import FolderIcon from '@mui/icons-material/Folder';
import ImageIcon from '@mui/icons-material/Image';
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf';
import InsertDriveFileIcon from '@mui/icons-material/InsertDriveFile';
import DownloadIcon from '@mui/icons-material/Download';
import VisibilityIcon from '@mui/icons-material/Visibility';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import type { ChannelAttachment } from '@chat-app/shared';

type FileTypeFilter = 'all' | 'image' | 'pdf' | 'other';

/** ファイルサイズを人が読みやすい形式に変換する */
function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** 日時を日本語フォーマットで表示する */
function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleString('ja-JP', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/** MIMEタイプに対応するアイコンを返す */
function FileIcon({ mimeType }: { mimeType: string }) {
  if (mimeType.startsWith('image/')) return <ImageIcon color="primary" />;
  if (mimeType === 'application/pdf') return <PictureAsPdfIcon color="error" />;
  return <InsertDriveFileIcon color="action" />;
}

interface FileListContentProps {
  attachmentsPromise: Promise<{ attachments: ChannelAttachment[] }>;
}

function FileListContent({ attachmentsPromise }: FileListContentProps) {
  const { attachments } = use(attachmentsPromise);

  if (attachments.length === 0) {
    return (
      <Box sx={{ textAlign: 'center', mt: 8, color: 'text.secondary' }}>
        <FolderIcon sx={{ fontSize: 64, mb: 2, opacity: 0.3 }} />
        <Typography variant="h6">ファイルはありません</Typography>
        <Typography variant="body2" sx={{ mt: 1 }}>
          このチャンネルにはまだファイルがアップロードされていません
        </Typography>
      </Box>
    );
  }

  return (
    <List disablePadding>
      {attachments.map((attachment, index) => (
        <Box key={attachment.id}>
          {index > 0 && <Box sx={{ borderBottom: 1, borderColor: 'divider' }} />}
          <ListItem
            sx={{ py: 1.5 }}
            secondaryAction={
              <Box sx={{ display: 'flex', gap: 0.5 }}>
                {(attachment.mimeType.startsWith('image/') ||
                  attachment.mimeType === 'application/pdf') && (
                  <Tooltip title="プレビュー">
                    <IconButton
                      size="small"
                      aria-label="プレビュー"
                      onClick={() => window.open(attachment.url, '_blank')}
                    >
                      <VisibilityIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                )}
                <Tooltip title="ダウンロード">
                  <IconButton
                    size="small"
                    aria-label="ダウンロード"
                    component="a"
                    href={attachment.url}
                    download={attachment.originalName}
                  >
                    <DownloadIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
              </Box>
            }
          >
            <ListItemIcon sx={{ minWidth: 40 }}>
              <FileIcon mimeType={attachment.mimeType} />
            </ListItemIcon>
            <ListItemText
              primary={
                <Typography variant="body2" fontWeight="medium" noWrap sx={{ maxWidth: 400 }}>
                  {attachment.originalName}
                </Typography>
              }
              secondary={
                <Box
                  sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.5, flexWrap: 'wrap' }}
                >
                  <Typography variant="caption" color="text.secondary">
                    {attachment.uploaderName}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {formatDate(attachment.createdAt)}
                  </Typography>
                  <Chip label={formatFileSize(attachment.size)} size="small" variant="outlined" />
                </Box>
              }
            />
          </ListItem>
        </Box>
      ))}
    </List>
  );
}

/** キャッシュ: チャンネルID + フィルターごとにPromiseをキャッシュ */
const _attachmentsPromiseCache = new Map<string, Promise<{ attachments: ChannelAttachment[] }>>();

export function resetFilesCache(channelId?: number): void {
  if (channelId !== undefined) {
    // 指定チャンネルのキャッシュをすべて削除
    for (const key of _attachmentsPromiseCache.keys()) {
      if (key.startsWith(`${channelId}:`)) {
        _attachmentsPromiseCache.delete(key);
      }
    }
  } else {
    _attachmentsPromiseCache.clear();
  }
}

function getOrCreateAttachmentsPromise(
  channelId: number,
  filter: FileTypeFilter,
): Promise<{ attachments: ChannelAttachment[] }> {
  const key = `${channelId}:${filter}`;
  if (!_attachmentsPromiseCache.has(key)) {
    const apiFilter = filter === 'all' ? undefined : filter;
    _attachmentsPromiseCache.set(key, api.channels.getAttachments(channelId, apiFilter));
  }
  return _attachmentsPromiseCache.get(key)!;
}

interface FilesPageInnerProps {
  channelId: number;
  channelName: string;
}

function FilesPageInner({ channelId, channelName }: FilesPageInnerProps) {
  const navigate = useNavigate();
  const [filter, setFilter] = useState<FileTypeFilter>('all');
  const [attachmentsPromise, setAttachmentsPromise] = useState<
    Promise<{ attachments: ChannelAttachment[] }>
  >(() => getOrCreateAttachmentsPromise(channelId, 'all'));

  const handleFilterChange = (_: React.MouseEvent, newFilter: FileTypeFilter | null) => {
    if (!newFilter) return;
    setFilter(newFilter);
    setAttachmentsPromise(getOrCreateAttachmentsPromise(channelId, newFilter));
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
      {/* チャンネルヘッダー + タブ */}
      <Box sx={{ borderBottom: 1, borderColor: 'divider', px: 2, pt: 1 }}>
        <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 0.5 }}>
          # {channelName}
        </Typography>
        <Tabs value="files" sx={{ minHeight: 36 }}>
          <Tab
            label="メッセージ"
            value="messages"
            sx={{ minHeight: 36, py: 0 }}
            onClick={() => navigate(`/?channel=${channelId}`)}
          />
          <Tab label="ファイル" value="files" sx={{ minHeight: 36, py: 0 }} />
        </Tabs>
      </Box>

      <Box sx={{ flexGrow: 1, overflow: 'auto', p: 2 }}>
        <Box sx={{ maxWidth: 900, mx: 'auto' }}>
          {/* フィルターボタン */}
          <ToggleButtonGroup
            value={filter}
            exclusive
            onChange={handleFilterChange}
            size="small"
            sx={{ mb: 2 }}
            aria-label="ファイルタイプフィルター"
          >
            <ToggleButton value="all" aria-label="すべて">
              すべて
            </ToggleButton>
            <ToggleButton value="image" aria-label="画像">
              画像
            </ToggleButton>
            <ToggleButton value="pdf" aria-label="PDF">
              PDF
            </ToggleButton>
            <ToggleButton value="other" aria-label="その他">
              その他
            </ToggleButton>
          </ToggleButtonGroup>

          <Paper elevation={0} variant="outlined">
            <Suspense
              fallback={
                <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
                  <CircularProgress />
                </Box>
              }
            >
              <FileListContent attachmentsPromise={attachmentsPromise} />
            </Suspense>
          </Paper>
        </Box>
      </Box>
    </Box>
  );
}

interface FilesPageProps {
  channelId: number;
  channelName: string;
}

export default function FilesPage({ channelId, channelName }: FilesPageProps) {
  return (
    <Suspense
      fallback={
        <Box
          sx={{ display: 'flex', height: '100vh', alignItems: 'center', justifyContent: 'center' }}
        >
          <CircularProgress />
        </Box>
      }
    >
      <FilesPageInner channelId={channelId} channelName={channelName} />
    </Suspense>
  );
}
