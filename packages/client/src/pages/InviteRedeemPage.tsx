import { useState, useEffect } from 'react';
import { useParams, useNavigate, Navigate } from 'react-router-dom';
import { Alert, Box, Button, CircularProgress, Container, Typography } from '@mui/material';
import type { InviteLinkLookupResult } from '@chat-app/shared';
import { api } from '../api/client';
import { useAuth } from '../contexts/AuthContext';

/**
 * /invite/:token ルートのページ。
 *
 * - 未ログイン時: sessionStorage に redirect_after_login を保存して /login へリダイレクト
 * - ログイン済み時: トークンを lookup して有効な場合は参加確認カードを表示し、
 *   承諾で redeem → 対象チャンネルまたはホームへ遷移する
 */
export default function InviteRedeemPage() {
  const { token } = useParams<{ token: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [invite, setInvite] = useState<InviteLinkLookupResult | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [redeeming, setRedeeming] = useState(false);
  const [shouldRedirect, setShouldRedirect] = useState(false);
  const [redirectPath, setRedirectPath] = useState('');

  // hooks はすべて条件分岐の前に宣言する（Hooks のルール）
  useEffect(() => {
    // 未ログイン時はリダイレクト先を保存して /login へ
    if (!user) {
      const path = `/invite/${token ?? ''}`;
      sessionStorage.setItem('redirect_after_login', path);
      setRedirectPath('/login');
      setShouldRedirect(true);
      setLoading(false);
      return;
    }

    if (!token) {
      setError('無効な招待リンクです');
      setLoading(false);
      return;
    }

    api.invites
      .lookup(token)
      .then(({ invite: result }) => {
        setInvite(result);
        setLoading(false);
      })
      .catch(() => {
        setError('招待リンクが見つかりません');
        setLoading(false);
      });
  }, [token, user]);

  const handleRedeem = async () => {
    if (!token) return;
    setRedeeming(true);
    try {
      const result = await api.invites.redeem(token);
      if (result.channelId !== null) {
        navigate(`/?channel=${result.channelId}`, { replace: true });
      } else {
        navigate('/', { replace: true });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '参加処理に失敗しました');
      setRedeeming(false);
    }
  };

  if (shouldRedirect) {
    return <Navigate to={redirectPath} replace />;
  }

  if (loading) {
    return (
      <Box
        sx={{ display: 'flex', height: '100vh', alignItems: 'center', justifyContent: 'center' }}
      >
        <CircularProgress />
      </Box>
    );
  }

  const isInvalid = !invite || invite.isRevoked || invite.isExpired || invite.isExhausted;

  return (
    <Container maxWidth="xs">
      <Box sx={{ mt: 8, display: 'flex', flexDirection: 'column', gap: 2 }}>
        <Typography variant="h5" fontWeight="bold" textAlign="center">
          招待リンク
        </Typography>

        {error && <Alert severity="error">{error}</Alert>}

        {!error && isInvalid && (
          <Alert severity="error">
            {invite?.isRevoked
              ? 'この招待リンクは無効化されています'
              : invite?.isExpired
                ? 'この招待リンクは有効期限切れです'
                : invite?.isExhausted
                  ? 'この招待リンクは使用上限に達しています'
                  : '無効な招待リンクです'}
          </Alert>
        )}

        {!error && !isInvalid && invite && (
          <>
            <Typography textAlign="center">
              {invite.channelName
                ? `#${invite.channelName} に参加しますか？`
                : 'ワークスペースに参加しますか？'}
            </Typography>
            <Button
              variant="contained"
              fullWidth
              disabled={redeeming}
              onClick={() => void handleRedeem()}
            >
              {redeeming ? <CircularProgress size={20} /> : '参加する'}
            </Button>
          </>
        )}

        <Button variant="text" onClick={() => navigate('/')}>
          ホームへ戻る
        </Button>
      </Box>
    </Container>
  );
}
