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
  Box,
  Button,
  CircularProgress,
  Container,
  Paper,
  TextField,
  Typography,
} from '@mui/material';
import { api } from '../api/client';
import type { GuestLinkLookupResult } from '@chat-app/shared';
import { renderMessageContent } from '../utils/renderMessageContent';

interface GuestMessageItem {
  id: number;
  channelId: number;
  userId: number | null;
  username: string | null;
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
        <Typography variant="h6" sx={{ mb: 2 }}>
          #{link.channelName ?? `channel-${link.channelId}`}（ゲスト閲覧）
        </Typography>
        {messages.length === 0 && (
          <Typography color="text.secondary">メッセージはありません</Typography>
        )}
        {messages.map((m) => (
          <Paper key={m.id} sx={{ p: 2, mb: 1 }} data-testid="guest-message-item">
            <Typography variant="caption" color="text.secondary">
              {m.username ?? '(unknown)'} ・ {new Date(m.createdAt).toLocaleString()}
            </Typography>
            <Typography variant="body1" sx={{ whiteSpace: 'pre-wrap' }}>
              {renderMessageContent(m.content)}
            </Typography>
            {m.attachments.length > 0 && (
              <Box sx={{ mt: 1 }} data-testid="guest-message-attachments">
                {m.attachments.map((att) => (
                  <Box key={att.id}>
                    <a href={att.url} target="_blank" rel="noopener noreferrer">
                      {att.originalName}
                    </a>
                  </Box>
                ))}
              </Box>
            )}
          </Paper>
        ))}
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
    <Container maxWidth="md" sx={{ mt: 4 }}>
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
