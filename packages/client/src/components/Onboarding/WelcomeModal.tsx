/**
 * 初回ログイン時のウェルカムモーダル（Issue #114）
 *
 * - user.onboardingCompletedAt === null のとき自動表示
 * - 4ステップ構成: ようこそ / おすすめチャンネル / メッセージ送信 / チャンネル切替
 * - 「完了」「スキップ」いずれでも completeOnboarding() を呼ぶ（UX優先: 失敗しても閉じる）
 */
import { useState, useMemo, use, Suspense } from 'react';
import {
  Dialog,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Box,
  Stepper,
  Step,
  StepLabel,
  CircularProgress,
} from '@mui/material';
import type { User, Channel } from '@chat-app/shared';
import { api } from '../../api/client';
import RecommendedChannelList from './RecommendedChannelList';

const STEPS = ['ようこそ', 'おすすめチャンネル', 'メッセージ送信', 'チャンネル切替'];

interface Props {
  user: User | null;
  onComplete: (updatedUser?: User) => void;
}

function ChannelStep({ channelsPromise }: { channelsPromise: Promise<{ channels: Channel[] }> }) {
  const { channels } = use(channelsPromise);
  return <RecommendedChannelList channels={channels} />;
}

export default function WelcomeModal({ user, onComplete }: Props) {
  const open = user !== null && user.onboardingCompletedAt === null;
  const [activeStep, setActiveStep] = useState(0);

  // Promise を useMemo で安定化（再レンダリングで再 fetch しない）
  const channelsPromise = useMemo(() => api.channels.list(), []);

  const handleFinish = async () => {
    try {
      const result = await api.auth.completeOnboarding();
      onComplete(result.user);
    } catch {
      // API 失敗時も UX 優先でモーダルを閉じる
      onComplete();
    }
  };

  const handleNext = () => {
    if (activeStep < STEPS.length - 1) {
      setActiveStep((s) => s + 1);
    } else {
      void handleFinish();
    }
  };

  const handleBack = () => setActiveStep((s) => s - 1);
  const handleSkip = () => void handleFinish();

  if (!open) return null;

  return (
    <Dialog open={open} maxWidth="sm" fullWidth>
      <DialogContent>
        <Stepper activeStep={activeStep} alternativeLabel sx={{ mb: 3 }}>
          {STEPS.map((label) => (
            <Step key={label}>
              <StepLabel>{label}</StepLabel>
            </Step>
          ))}
        </Stepper>

        {activeStep === 0 && (
          <Box>
            <Typography variant="h5" gutterBottom>
              ようこそ！
            </Typography>
            <Typography variant="body1" color="text.secondary">
              このワークスペースへようこそ。基本的な使い方をご案内します。
            </Typography>
          </Box>
        )}

        {activeStep === 1 && (
          <Box>
            <Typography variant="h6" gutterBottom>
              おすすめチャンネルに参加しましょう
            </Typography>
            <Suspense fallback={<CircularProgress size={24} />}>
              <ChannelStep channelsPromise={channelsPromise} />
            </Suspense>
          </Box>
        )}

        {activeStep === 2 && (
          <Box>
            <Typography variant="h6" gutterBottom>
              メッセージを送信してみましょう
            </Typography>
            <Typography variant="body1" color="text.secondary">
              画面下部のエディタにメッセージを入力して Enter キーを押すと送信できます。
            </Typography>
          </Box>
        )}

        {activeStep === 3 && (
          <Box>
            <Typography variant="h6" gutterBottom>
              チャンネルを切り替えてみましょう
            </Typography>
            <Typography variant="body1" color="text.secondary">
              左サイドバーのチャンネル名をクリックすると切り替えができます。
            </Typography>
          </Box>
        )}
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 2, justifyContent: 'space-between' }}>
        <Button onClick={handleSkip} color="inherit">
          スキップ
        </Button>
        <Box sx={{ display: 'flex', gap: 1 }}>
          {activeStep > 0 && (
            <Button onClick={handleBack} variant="outlined">
              戻る
            </Button>
          )}
          <Button onClick={handleNext} variant="contained">
            {activeStep === STEPS.length - 1 ? '完了' : '次へ'}
          </Button>
        </Box>
      </DialogActions>
    </Dialog>
  );
}
