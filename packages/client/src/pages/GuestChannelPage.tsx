/**
 * /g/:token ルート — ゲスト閲覧ページ（#149）
 *
 * - ログイン済みユーザーでもゲストフロー固定で動作する
 * - パスワード保護されたリンクではパスワード入力フォームを表示する
 * - メッセージは読み取り専用（送信欄・編集・削除・リアクション・添付追加 UI は出さない）
 * - React 19 の use() + Suspense でトークン情報を取得する
 */

import { useState, use, Suspense, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import {
  Alert,
  Avatar,
  Box,
  Button,
  CircularProgress,
  Container,
  Link,
  TextField,
  Typography,
} from '@mui/material';
import InsertDriveFileIcon from '@mui/icons-material/InsertDriveFile';
import { api } from '../api/client';
import type { GuestLinkLookupResult } from '@chat-app/shared';
import { renderMessageContent } from '../utils/renderMessageContent';
import { getAvatarColor } from '../utils/avatarColor';

interface GuestMessageItem {
  id: number;
  channelId: number;
  userId: number | null;
  username: string | null;
  avatarUrl?: string | null;
  content: string;
  createdAt: string;
  updatedAt: string;
  isEdited: boolean;
  attachments: Array<{
    id: number;
    url: string;
    originalName: string;
    size: number;
    mimeType: string;
  }>;
}

function formatDateTime(dateStr: string): string {
  return new Date(dateStr).toLocaleString([], {
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/** 1 件のゲストメッセージをチャット風に描画する（読み取り専用） */
function GuestMessageRow({
  message,
  hideAvatar,
}: {
  message: GuestMessageItem;
  hideAvatar: boolean;
}) {
  const displayName = message.username ?? '(unknown)';
  // アバターの背景色はユーザー名から決定論的に生成する
  const avatarBgColor = getAvatarColor(displayName);

  return (
    <Box
      data-testid="guest-message-item"
      sx={{
        display: 'flex',
        flexDirection: 'row',
        gap: 1.5,
        px: 2,
        py: 0.5,
        alignItems: 'flex-start',
      }}
    >
      {/* アバター領域（連続メッセージは非表示にしてインデント揃え） */}
      <Box sx={{ flexShrink: 0, width: 36 }}>
        {!hideAvatar && (
          <Avatar
            src={message.avatarUrl ?? undefined}
            alt={displayName}
            sx={{
              width: 36,
              height: 36,
              ...(!message.avatarUrl && { bgcolor: avatarBgColor }),
              fontSize: '0.875rem',
            }}
          >
            {displayName[0].toUpperCase()}
          </Avatar>
        )}
      </Box>

      {/* 右側: 名前 + タイムスタンプ + 本文 + 添付 */}
      <Box sx={{ flexGrow: 1, minWidth: 0 }}>
        {!hideAvatar && (
          <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1, mb: 0.25 }}>
            <Typography variant="subtitle2" fontWeight="bold">
              {displayName}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {formatDateTime(message.createdAt)}
            </Typography>
            {message.isEdited && (
              <Typography variant="caption" color="text.secondary">
                (edited)
              </Typography>
            )}
          </Box>
        )}

        {/* 本文 */}
        <Box
          sx={{
            bgcolor: 'grey.100',
            borderRadius: hideAvatar ? '12px' : '12px 12px 12px 0',
            px: 1.5,
            py: 0.75,
            display: 'inline-block',
            maxWidth: '75%',
            wordBreak: 'break-word',
            overflowWrap: 'break-word',
            whiteSpace: 'pre-wrap',
            fontSize: '0.875rem',
            lineHeight: 1.5,
          }}
        >
          {renderMessageContent(message.content)}
        </Box>

        {/* 添付ファイル */}
        {message.attachments.length > 0 && (
          <Box
            data-testid="guest-message-attachments"
            sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, mt: 0.5 }}
          >
            {message.attachments.map((att) => {
              const isImage = att.mimeType.startsWith('image/');
              return isImage ? (
                <Link
                  key={att.id}
                  href={att.url}
                  download={att.originalName}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={att.originalName}
                >
                  <Box
                    component="img"
                    src={att.url}
                    alt={att.originalName}
                    sx={{
                      maxWidth: '100%',
                      maxHeight: 200,
                      borderRadius: 1,
                      display: 'block',
                    }}
                  />
                </Link>
              ) : (
                <Link
                  key={att.id}
                  href={att.url}
                  download={att.originalName}
                  underline="hover"
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={att.originalName}
                  sx={{ display: 'flex', alignItems: 'center', gap: 0.5, fontSize: '0.8rem' }}
                >
                  <InsertDriveFileIcon fontSize="small" data-testid="file-icon" />
                  <Typography variant="caption">{att.originalName}</Typography>
                </Link>
              );
            })}
          </Box>
        )}
      </Box>
    </Box>
  );
}

/** トークン情報を use() で読み取り、状態に応じた UI を描画する */
function GuestChannelContent({
  token,
  lookupPromise,
}: {
  token: string;
  lookupPromise: Promise<{ guestLink: GuestLinkLookupResult } | null>;
}) {
  const result = use(lookupPromise);
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [guestToken, setGuestToken] = useState<string | null>(null);
  const [messages, setMessages] = useState<GuestMessageItem[] | null>(null);

  if (!result) {
    return <Alert severity="error">ゲストリンクが見つかりません</Alert>;
  }

  const link = result.guestLink;

  if (link.isRevoked) {
    return <Alert severity="error">このリンクは無効化されています</Alert>;
  }
  if (link.isExpired) {
    return <Alert severity="error">このリンクは有効期限が切れています</Alert>;
  }

  // メッセージ取得済み → 表示
  if (messages !== null) {
    return (
      <Box>
        <Typography variant="h6" sx={{ mb: 2, px: 2 }}>
          #{link.channelName ?? `channel-${link.channelId}`}（ゲスト閲覧）
        </Typography>
        {messages.length === 0 && (
          <Typography color="text.secondary" sx={{ px: 2 }}>
            メッセージはありません
          </Typography>
        )}
        <Box sx={{ display: 'flex', flexDirection: 'column' }}>
          {messages.map((m, idx) => {
            // 連続する同一ユーザーのメッセージはアバターと名前を省略する
            const prev = idx > 0 ? messages[idx - 1] : null;
            const hideAvatar =
              prev !== null &&
              prev.userId === m.userId &&
              prev.username === m.username &&
              // 5 分以内の連続投稿に限りまとめる
              new Date(m.createdAt).getTime() - new Date(prev.createdAt).getTime() < 5 * 60 * 1000;
            return <GuestMessageRow key={m.id} message={m} hideAvatar={hideAvatar} />;
          })}
        </Box>
      </Box>
    );
  }

  // パスワード検証 + メッセージ取得
  const handleAccess = async (pw: string) => {
    setVerifying(true);
    setError('');
    try {
      const v = await api.guestLinks.verify(token, pw);
      setGuestToken(v.guestToken);
      const m = await api.guestLinks.messages(token, v.guestToken);
      setMessages(m.messages);
    } catch (err) {
      const msg = err instanceof Error ? err.message : '取得に失敗しました';
      // 429 想定: しばらく待つ
      if (msg.includes('ブロック')) {
        setError('しばらく時間をおいてください');
      } else {
        setError(msg);
      }
    } finally {
      setVerifying(false);
    }
  };

  // パスワード未設定なら自動で取得
  if (!link.hasPassword && guestToken === null && !verifying && error === '') {
    void handleAccess('');
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center' }}>
        <CircularProgress />
      </Box>
    );
  }

  // パスワード入力フォーム
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <Typography variant="h6">#{link.channelName ?? `channel-${link.channelId}`}</Typography>
      <Typography color="text.secondary">このリンクはパスワード保護されています</Typography>
      {error && <Alert severity="error">{error}</Alert>}
      <TextField
        type="password"
        label="パスワード"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        fullWidth
      />
      <Button variant="contained" disabled={verifying} onClick={() => void handleAccess(password)}>
        {verifying ? <CircularProgress size={20} /> : '閲覧する'}
      </Button>
    </Box>
  );
}

export default function GuestChannelPage() {
  const { token } = useParams<{ token: string }>();

  // useMemo で Promise を安定化（再レンダリングで再生成しないこと）
  const lookupPromise = useMemo(() => {
    if (!token) return Promise.resolve(null);
    return api.guestLinks.lookup(token).catch(() => null);
  }, [token]);

  if (!token) {
    return (
      <Container maxWidth="md" sx={{ mt: 4 }}>
        <Alert severity="error">無効なリンクです</Alert>
      </Container>
    );
  }

  return (
    <Container
      maxWidth="md"
      sx={{
        mt: 4,
        bgcolor: 'background.default',
        borderRadius: 2,
        pb: 4,
      }}
    >
      <Suspense
        fallback={
          <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}>
            <CircularProgress />
          </Box>
        }
      >
        <GuestChannelContent token={token} lookupPromise={lookupPromise} />
      </Suspense>
    </Container>
  );
}
