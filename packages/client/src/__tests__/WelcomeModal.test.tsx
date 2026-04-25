/**
 * テスト対象: packages/client/src/components/Onboarding/WelcomeModal.tsx
 * 戦略:
 *   - vi.mock で api/client を差し替え、初回ログインモーダルの
 *     ステップ遷移・おすすめチャンネル参加・完了/スキップ時の API 呼び出しを検証する。
 *   - Issue #114 のオンボーディング UI。
 */

import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { User, Channel } from '@chat-app/shared';

vi.mock('../api/client', () => ({
  api: {
    auth: {
      completeOnboarding: vi.fn(),
    },
    channels: {
      list: vi.fn(),
      join: vi.fn(),
    },
  },
}));

import { api } from '../api/client';
import WelcomeModal from '../components/Onboarding/WelcomeModal';

const mockedApi = api as unknown as {
  auth: {
    completeOnboarding: ReturnType<typeof vi.fn>;
  };
  channels: {
    list: ReturnType<typeof vi.fn>;
    join: ReturnType<typeof vi.fn>;
  };
};

const incompleteUser: User = {
  id: 1,
  username: 'alice',
  email: 'alice@example.com',
  avatarUrl: null,
  displayName: null,
  location: null,
  createdAt: '2024-01-01T00:00:00Z',
  role: 'user',
  isActive: true,
  onboardingCompletedAt: null,
};

const completedUser: User = {
  ...incompleteUser,
  onboardingCompletedAt: '2024-02-01T00:00:00Z',
};

const recommendedChannels: Channel[] = [
  {
    id: 10,
    name: 'welcome',
    description: null,
    topic: null,
    createdBy: null,
    createdAt: '2024-01-01T00:00:00Z',
    isPrivate: false,
    isArchived: false,
    postingPermission: 'everyone',
    unreadCount: 0,
    isRecommended: true,
  },
  {
    id: 11,
    name: 'announcements',
    description: null,
    topic: null,
    createdBy: null,
    createdAt: '2024-01-01T00:00:00Z',
    isPrivate: false,
    isArchived: false,
    postingPermission: 'everyone',
    unreadCount: 0,
    isRecommended: true,
  },
  {
    id: 12,
    name: 'other',
    description: null,
    topic: null,
    createdBy: null,
    createdAt: '2024-01-01T00:00:00Z',
    isPrivate: false,
    isArchived: false,
    postingPermission: 'everyone',
    unreadCount: 0,
    isRecommended: false,
  },
];

beforeEach(() => {
  vi.clearAllMocks();
  mockedApi.channels.list.mockResolvedValue({ channels: recommendedChannels });
  mockedApi.channels.join.mockResolvedValue(undefined);
  mockedApi.auth.completeOnboarding.mockResolvedValue({ user: completedUser });
});

async function renderModal(user: User | null, onComplete: () => void = () => {}) {
  await act(async () => {
    render(<WelcomeModal user={user} onComplete={onComplete} />);
  });
}

describe('WelcomeModal', () => {
  describe('表示制御', () => {
    it('user.onboardingCompletedAt === null のとき自動的に開く', async () => {
      await renderModal(incompleteUser);
      // ダイアログの本文として「ようこそ」系のテキストが表示される
      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument();
      });
    });

    it('user.onboardingCompletedAt が埋まっているとき開かない', async () => {
      await renderModal(completedUser);
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    it('未ログイン（user === null）のときは開かない', async () => {
      await renderModal(null);
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
  });

  describe('ステップ遷移', () => {
    it('初期表示時はステップ 1（ようこそ）が表示される', async () => {
      await renderModal(incompleteUser);
      await waitFor(() => {
        // ステップコンテンツのh5見出しで確認（Stepperラベルとの重複を避けるためrole指定）
        expect(screen.getByRole('heading', { level: 5 })).toHaveTextContent(/ようこそ/);
      });
    });

    it('「次へ」ボタンでステップ 2（おすすめチャンネル）に進む', async () => {
      await renderModal(incompleteUser);
      await waitFor(() =>
        expect(screen.getByRole('heading', { level: 5 })).toHaveTextContent(/ようこそ/),
      );
      await userEvent.click(screen.getByRole('button', { name: '次へ' }));
      await waitFor(() => {
        expect(screen.getByText(/おすすめチャンネルに参加/)).toBeInTheDocument();
      });
    });

    it('「戻る」ボタンで前のステップに戻る', async () => {
      await renderModal(incompleteUser);
      await waitFor(() =>
        expect(screen.getByRole('heading', { level: 5 })).toHaveTextContent(/ようこそ/),
      );
      await userEvent.click(screen.getByRole('button', { name: '次へ' }));
      await waitFor(() => expect(screen.getByText(/おすすめチャンネルに参加/)).toBeInTheDocument());
      await userEvent.click(screen.getByRole('button', { name: '戻る' }));
      await waitFor(() =>
        expect(screen.getByRole('heading', { level: 5 })).toHaveTextContent(/ようこそ/),
      );
    });

    it('最終ステップでは「次へ」ではなく「完了」ボタンが表示される', async () => {
      await renderModal(incompleteUser);
      // 4ステップ分「次へ」を押す
      for (let i = 0; i < 3; i++) {
        const next = screen.queryByRole('button', { name: '次へ' });
        if (!next) break;
        await userEvent.click(next);
      }
      await waitFor(() => {
        expect(screen.getByRole('button', { name: '完了' })).toBeInTheDocument();
      });
      expect(screen.queryByRole('button', { name: '次へ' })).not.toBeInTheDocument();
    });

    it('再レンダリングされても activeStep がリセットされない（useMemo で Promise を安定化）', async () => {
      const { rerender } = render(<WelcomeModal user={incompleteUser} onComplete={() => {}} />);
      await act(async () => {});
      await waitFor(() =>
        expect(screen.getByRole('heading', { level: 5 })).toHaveTextContent(/ようこそ/),
      );
      await userEvent.click(screen.getByRole('button', { name: '次へ' }));
      await waitFor(() => expect(screen.getByText(/おすすめチャンネルに参加/)).toBeInTheDocument());

      // 再レンダリング
      rerender(<WelcomeModal user={incompleteUser} onComplete={() => {}} />);
      await act(async () => {});

      // ステップ 2 が保持されている
      expect(screen.getByText(/おすすめチャンネルに参加/)).toBeInTheDocument();
    });
  });

  describe('おすすめチャンネル参加', () => {
    it('isRecommended === true のチャンネルが一覧表示される', async () => {
      await renderModal(incompleteUser);
      await userEvent.click(screen.getByRole('button', { name: '次へ' }));
      await waitFor(() => {
        expect(screen.getByText('welcome')).toBeInTheDocument();
        expect(screen.getByText('announcements')).toBeInTheDocument();
      });
      // isRecommended !== true のチャンネルは含まれない
      expect(screen.queryByText('other')).not.toBeInTheDocument();
    });

    it('「このチャンネルに参加」ボタンで channels.join API が呼ばれる', async () => {
      await renderModal(incompleteUser);
      await userEvent.click(screen.getByRole('button', { name: '次へ' }));
      await waitFor(() => expect(screen.getByText('welcome')).toBeInTheDocument());

      const joinButtons = screen.getAllByRole('button', { name: /参加/ });
      await userEvent.click(joinButtons[0]);
      await waitFor(() => expect(mockedApi.channels.join).toHaveBeenCalledWith(10));
    });

    it('参加済みチャンネルは「参加済み」表示になる', async () => {
      await renderModal(incompleteUser);
      await userEvent.click(screen.getByRole('button', { name: '次へ' }));
      await waitFor(() => expect(screen.getByText('welcome')).toBeInTheDocument());

      const joinButtons = screen.getAllByRole('button', { name: /参加/ });
      await userEvent.click(joinButtons[0]);
      await waitFor(() => {
        expect(screen.getByText(/参加済み/)).toBeInTheDocument();
      });
    });

    it('複数チャンネルを続けて参加できる', async () => {
      await renderModal(incompleteUser);
      await userEvent.click(screen.getByRole('button', { name: '次へ' }));
      await waitFor(() => expect(screen.getByText('welcome')).toBeInTheDocument());

      const joinButtons = screen.getAllByRole('button', { name: /参加/ });
      await userEvent.click(joinButtons[0]);
      await waitFor(() => expect(mockedApi.channels.join).toHaveBeenCalledWith(10));

      const joinButtons2 = screen.getAllByRole('button', { name: /参加/ });
      await userEvent.click(joinButtons2[0]);
      await waitFor(() => expect(mockedApi.channels.join).toHaveBeenCalledWith(11));
    });
  });

  describe('完了・スキップ', () => {
    it('「完了」ボタンで auth.completeOnboarding API が呼ばれてモーダルが閉じる', async () => {
      const onComplete = vi.fn();
      await renderModal(incompleteUser, onComplete);
      // ステップを最後まで進める
      for (let i = 0; i < 3; i++) {
        const next = screen.queryByRole('button', { name: '次へ' });
        if (!next) break;
        await userEvent.click(next);
      }
      await userEvent.click(screen.getByRole('button', { name: '完了' }));
      await waitFor(() => expect(mockedApi.auth.completeOnboarding).toHaveBeenCalled());
      await waitFor(() => expect(onComplete).toHaveBeenCalled());
    });

    it('「スキップ」ボタンでも auth.completeOnboarding API が呼ばれてモーダルが閉じる', async () => {
      const onComplete = vi.fn();
      await renderModal(incompleteUser, onComplete);
      await userEvent.click(screen.getByRole('button', { name: 'スキップ' }));
      await waitFor(() => expect(mockedApi.auth.completeOnboarding).toHaveBeenCalled());
      await waitFor(() => expect(onComplete).toHaveBeenCalled());
    });

    it('completeOnboarding 成功後に AuthContext の user.onboardingCompletedAt が更新される', async () => {
      const onComplete = vi.fn();
      await renderModal(incompleteUser, onComplete);
      await userEvent.click(screen.getByRole('button', { name: 'スキップ' }));
      await waitFor(() => {
        expect(onComplete).toHaveBeenCalledWith(
          expect.objectContaining({ onboardingCompletedAt: expect.any(String) }),
        );
      });
    });

    it('completeOnboarding が失敗してもモーダルは閉じる（UX 優先）', async () => {
      mockedApi.auth.completeOnboarding.mockRejectedValue(new Error('server error'));
      const onComplete = vi.fn();
      await renderModal(incompleteUser, onComplete);
      await userEvent.click(screen.getByRole('button', { name: 'スキップ' }));
      await waitFor(() => expect(onComplete).toHaveBeenCalled());
    });
  });
});
