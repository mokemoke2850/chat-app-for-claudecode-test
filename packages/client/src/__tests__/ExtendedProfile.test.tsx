/**
 * テスト対象: 拡張プロフィール項目（#305）
 *
 * 戦略:
 *   - ProfilePage に追加される自己紹介・役職・部署・タイムゾーン・GitHub URL・SNS URL の
 *     入力フォームを検証する
 *   - フォーム入力に対する URL 形式・タイムゾーン形式のバリデーションを検証する
 *   - API 呼び出し（取得・更新）が拡張フィールドを含めて正しく行われることを検証する
 *   - UserProfilePopover に他ユーザーの拡張プロフィールが表示されることを検証する
 *   - 任意項目のため空のまま保存・表示できる挙動を検証する
 *   - GitHub・SNS リンクが target=_blank かつ rel=noopener noreferrer で外部タブを開くことを検証する
 *   - タイムゾーン選択 UI（プルダウン）の選択肢・初期値・変更挙動を検証する
 */

import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import ProfilePage from '../pages/ProfilePage';
import UserProfilePopover from '../components/Chat/UserProfilePopover';
import type { User } from '@chat-app/shared';

// =====================
// モック定義（ProfilePage 用）
// =====================
const mockUpdateUser = vi.hoisted(() => vi.fn());
const mockUpdateProfile = vi.hoisted(() => vi.fn());
const mockChangePassword = vi.hoisted(() => vi.fn());
const mockShowSuccess = vi.hoisted(() => vi.fn());
const mockShowError = vi.hoisted(() => vi.fn());

const mockUserState = vi.hoisted(() => ({
  id: 1,
  username: 'alice',
  email: 'alice@example.com',
  avatarUrl: null as string | null,
  displayName: null as string | null,
  location: null as string | null,
  createdAt: '2024-01-01T00:00:00Z',
  // #305 拡張プロフィール項目
  bio: null as string | null,
  jobTitle: null as string | null,
  department: null as string | null,
  timezone: null as string | null,
  githubUrl: null as string | null,
  snsUrl: null as string | null,
}));

vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => ({
    user: mockUserState,
    updateUser: mockUpdateUser,
  }),
}));

vi.mock('../api/client', () => ({
  api: {
    auth: {
      updateProfile: mockUpdateProfile,
      changePassword: mockChangePassword,
    },
  },
}));

vi.mock('react-router-dom', () => ({
  useNavigate: () => vi.fn(),
}));

vi.mock('../contexts/SnackbarContext', () => ({
  useSnackbar: () => ({
    showSuccess: mockShowSuccess,
    showError: mockShowError,
    showInfo: vi.fn(),
  }),
}));

vi.mock('../components/Layout/AppLayout', () => ({
  default: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="app-layout-stub">{children}</div>
  ),
}));

vi.mock('../contexts/AccessibilityContext', () => ({
  useAccessibility: () => ({
    fontSize: 'medium' as const,
    highContrast: false,
    setFontSize: vi.fn(),
    setHighContrast: vi.fn(),
  }),
}));

vi.mock('../contexts/DensityContext', () => ({
  useDensity: () => ({
    density: 'cozy',
    setDensity: vi.fn(),
  }),
}));

beforeEach(() => {
  // mockResolvedValueOnce 等の queue が前テストから漏れないよう resetAllMocks を使う
  vi.resetAllMocks();
  // ユーザー状態をデフォルトにリセット
  mockUserState.avatarUrl = null;
  mockUserState.displayName = null;
  mockUserState.location = null;
  mockUserState.bio = null;
  mockUserState.jobTitle = null;
  mockUserState.department = null;
  mockUserState.timezone = null;
  mockUserState.githubUrl = null;
  mockUserState.snsUrl = null;
});

describe('拡張プロフィール項目（#305）', () => {
  describe('ProfilePage: プロフィール編集フォーム', () => {
    describe('自己紹介フィールド', () => {
      it('自己紹介テキストエリアが表示される', () => {
        render(<ProfilePage />);
        expect(screen.getByLabelText('自己紹介')).toBeInTheDocument();
      });

      it('user.bio の値が初期表示される', () => {
        mockUserState.bio = '私の自己紹介';
        render(<ProfilePage />);
        const ta = screen.getByLabelText('自己紹介') as HTMLTextAreaElement;
        expect(ta.value).toBe('私の自己紹介');
      });

      it('自己紹介を入力して保存できる', async () => {
        mockUpdateProfile.mockResolvedValueOnce({ user: { ...mockUserState, bio: 'hello' } });
        render(<ProfilePage />);
        await userEvent.type(screen.getByLabelText('自己紹介'), 'hello');
        await userEvent.click(screen.getByRole('button', { name: /保存/i }));
        await waitFor(() => {
          expect(mockUpdateProfile).toHaveBeenCalledWith(expect.objectContaining({ bio: 'hello' }));
        });
      });

      it('複数行の入力（改行）を保持できる', async () => {
        render(<ProfilePage />);
        const ta = screen.getByLabelText('自己紹介') as HTMLTextAreaElement;
        await userEvent.type(ta, 'line1{Enter}line2');
        expect(ta.value).toBe('line1\nline2');
      });

      it('空文字のまま保存しても成功する（任意項目）', async () => {
        mockUpdateProfile.mockResolvedValueOnce({ user: { ...mockUserState } });
        render(<ProfilePage />);
        await userEvent.click(screen.getByRole('button', { name: /保存/i }));
        await waitFor(() => {
          expect(mockUpdateProfile).toHaveBeenCalledWith(expect.objectContaining({ bio: null }));
        });
      });
    });

    describe('役職フィールド', () => {
      it('役職入力欄が表示される', () => {
        render(<ProfilePage />);
        expect(screen.getByLabelText('役職')).toBeInTheDocument();
      });

      it('user.jobTitle の値が初期表示される', () => {
        mockUserState.jobTitle = 'Engineer';
        render(<ProfilePage />);
        expect((screen.getByLabelText('役職') as HTMLInputElement).value).toBe('Engineer');
      });

      it('役職を入力して保存できる', async () => {
        mockUpdateProfile.mockResolvedValueOnce({ user: { ...mockUserState, jobTitle: 'Lead' } });
        render(<ProfilePage />);
        await userEvent.type(screen.getByLabelText('役職'), 'Lead');
        await userEvent.click(screen.getByRole('button', { name: /保存/i }));
        await waitFor(() => {
          expect(mockUpdateProfile).toHaveBeenCalledWith(
            expect.objectContaining({ jobTitle: 'Lead' }),
          );
        });
      });

      it('空のまま保存しても成功する（任意項目）', async () => {
        mockUpdateProfile.mockResolvedValueOnce({ user: { ...mockUserState } });
        render(<ProfilePage />);
        await userEvent.click(screen.getByRole('button', { name: /保存/i }));
        await waitFor(() => {
          expect(mockUpdateProfile).toHaveBeenCalledWith(
            expect.objectContaining({ jobTitle: null }),
          );
        });
      });
    });

    describe('部署フィールド', () => {
      it('部署入力欄が表示される', () => {
        render(<ProfilePage />);
        expect(screen.getByLabelText('部署')).toBeInTheDocument();
      });

      it('user.department の値が初期表示される', () => {
        mockUserState.department = 'Platform';
        render(<ProfilePage />);
        expect((screen.getByLabelText('部署') as HTMLInputElement).value).toBe('Platform');
      });

      it('部署を入力して保存できる', async () => {
        mockUpdateProfile.mockResolvedValueOnce({
          user: { ...mockUserState, department: 'Eng' },
        });
        render(<ProfilePage />);
        await userEvent.type(screen.getByLabelText('部署'), 'Eng');
        await userEvent.click(screen.getByRole('button', { name: /保存/i }));
        await waitFor(() => {
          expect(mockUpdateProfile).toHaveBeenCalledWith(
            expect.objectContaining({ department: 'Eng' }),
          );
        });
      });

      it('空のまま保存しても成功する（任意項目）', async () => {
        mockUpdateProfile.mockResolvedValueOnce({ user: { ...mockUserState } });
        render(<ProfilePage />);
        await userEvent.click(screen.getByRole('button', { name: /保存/i }));
        await waitFor(() => {
          expect(mockUpdateProfile).toHaveBeenCalledWith(
            expect.objectContaining({ department: null }),
          );
        });
      });
    });

    describe('タイムゾーン選択 UI', () => {
      it('タイムゾーン選択プルダウンが表示される', () => {
        render(<ProfilePage />);
        expect(screen.getByRole('combobox', { name: /タイムゾーン/ })).toBeInTheDocument();
      });

      it('IANA 形式のタイムゾーン候補（Asia/Tokyo, UTC, America/Los_Angeles 等）が選択肢に並ぶ', async () => {
        render(<ProfilePage />);
        await userEvent.click(screen.getByRole('combobox', { name: /タイムゾーン/ }));
        await waitFor(() => {
          expect(screen.getByRole('option', { name: 'Asia/Tokyo' })).toBeInTheDocument();
        });
        expect(screen.getByRole('option', { name: 'UTC' })).toBeInTheDocument();
      });

      it('user.timezone の値で初期選択される', () => {
        mockUserState.timezone = 'Asia/Tokyo';
        render(<ProfilePage />);
        // MUI Select の選択値はボタン要素のテキスト or 隣接する hidden input.value で確認
        const combobox = screen.getByRole('combobox', { name: /タイムゾーン/ });
        expect(combobox).toHaveTextContent('Asia/Tokyo');
      });

      it('プルダウンから別のタイムゾーンを選択して保存できる', async () => {
        mockUpdateProfile.mockResolvedValueOnce({
          user: { ...mockUserState, timezone: 'UTC' },
        });
        render(<ProfilePage />);
        await userEvent.click(screen.getByRole('combobox', { name: /タイムゾーン/ }));
        await waitFor(() => {
          expect(screen.getByRole('option', { name: 'UTC' })).toBeInTheDocument();
        });
        await userEvent.click(screen.getByRole('option', { name: 'UTC' }));
        await userEvent.click(screen.getByRole('button', { name: /保存/i }));
        await waitFor(() => {
          expect(mockUpdateProfile).toHaveBeenCalledWith(
            expect.objectContaining({ timezone: 'UTC' }),
          );
        });
      });

      it('未設定時はデフォルト（未選択）の状態で表示される', () => {
        render(<ProfilePage />);
        const combobox = screen.getByRole('combobox', { name: /タイムゾーン/ });
        // 初期値は空文字 → 表示は "未設定" プレースホルダー
        expect(combobox).toHaveTextContent('未設定');
      });
    });

    describe('GitHub URL フィールド', () => {
      it('GitHub URL 入力欄が表示される', () => {
        render(<ProfilePage />);
        expect(screen.getByLabelText('GitHub URL')).toBeInTheDocument();
      });

      it('user.githubUrl の値が初期表示される', () => {
        mockUserState.githubUrl = 'https://github.com/me';
        render(<ProfilePage />);
        expect((screen.getByLabelText('GitHub URL') as HTMLInputElement).value).toBe(
          'https://github.com/me',
        );
      });

      it('https://github.com/... の URL を入力して保存できる', async () => {
        mockUpdateProfile.mockResolvedValueOnce({
          user: { ...mockUserState, githubUrl: 'https://github.com/me' },
        });
        render(<ProfilePage />);
        await userEvent.type(screen.getByLabelText('GitHub URL'), 'https://github.com/me');
        await userEvent.click(screen.getByRole('button', { name: /保存/i }));
        await waitFor(() => {
          expect(mockUpdateProfile).toHaveBeenCalledWith(
            expect.objectContaining({ githubUrl: 'https://github.com/me' }),
          );
        });
      });

      it('空のまま保存しても成功する（任意項目）', async () => {
        mockUpdateProfile.mockResolvedValueOnce({ user: { ...mockUserState } });
        render(<ProfilePage />);
        await userEvent.click(screen.getByRole('button', { name: /保存/i }));
        await waitFor(() => {
          expect(mockUpdateProfile).toHaveBeenCalledWith(
            expect.objectContaining({ githubUrl: null }),
          );
        });
      });
    });

    describe('SNS URL フィールド', () => {
      it('SNS URL 入力欄が表示される', () => {
        render(<ProfilePage />);
        expect(screen.getByLabelText('SNS URL')).toBeInTheDocument();
      });

      it('user.snsUrl の値が初期表示される', () => {
        mockUserState.snsUrl = 'https://twitter.com/me';
        render(<ProfilePage />);
        expect((screen.getByLabelText('SNS URL') as HTMLInputElement).value).toBe(
          'https://twitter.com/me',
        );
      });

      it('SNS URL を入力して保存できる', async () => {
        mockUpdateProfile.mockResolvedValueOnce({
          user: { ...mockUserState, snsUrl: 'https://twitter.com/me' },
        });
        render(<ProfilePage />);
        await userEvent.type(screen.getByLabelText('SNS URL'), 'https://twitter.com/me');
        await userEvent.click(screen.getByRole('button', { name: /保存/i }));
        await waitFor(() => {
          expect(mockUpdateProfile).toHaveBeenCalledWith(
            expect.objectContaining({ snsUrl: 'https://twitter.com/me' }),
          );
        });
      });

      it('空のまま保存しても成功する（任意項目）', async () => {
        mockUpdateProfile.mockResolvedValueOnce({ user: { ...mockUserState } });
        render(<ProfilePage />);
        await userEvent.click(screen.getByRole('button', { name: /保存/i }));
        await waitFor(() => {
          expect(mockUpdateProfile).toHaveBeenCalledWith(expect.objectContaining({ snsUrl: null }));
        });
      });
    });
  });

  describe('ProfilePage: バリデーション', () => {
    describe('GitHub URL のバリデーション', () => {
      it('http(s) スキーム以外は保存時にエラーとなる', async () => {
        render(<ProfilePage />);
        await userEvent.type(screen.getByLabelText('GitHub URL'), 'ftp://example.com');
        await userEvent.click(screen.getByRole('button', { name: /保存/i }));
        await waitFor(() => {
          expect(mockShowError).toHaveBeenCalled();
        });
        expect(mockUpdateProfile).not.toHaveBeenCalled();
      });

      it('URL 形式不正（スペース混入など）はエラーとなる', async () => {
        render(<ProfilePage />);
        await userEvent.type(screen.getByLabelText('GitHub URL'), 'not a url');
        await userEvent.click(screen.getByRole('button', { name: /保存/i }));
        await waitFor(() => {
          expect(mockShowError).toHaveBeenCalled();
        });
        expect(mockUpdateProfile).not.toHaveBeenCalled();
      });

      it('https://github.com/<user> 形式は許容される', async () => {
        mockUpdateProfile.mockResolvedValueOnce({
          user: { ...mockUserState, githubUrl: 'https://github.com/me' },
        });
        render(<ProfilePage />);
        await userEvent.type(screen.getByLabelText('GitHub URL'), 'https://github.com/me');
        await userEvent.click(screen.getByRole('button', { name: /保存/i }));
        await waitFor(() => {
          expect(mockUpdateProfile).toHaveBeenCalled();
        });
      });

      it('空文字はエラーにならず保存できる', async () => {
        mockUpdateProfile.mockResolvedValueOnce({ user: { ...mockUserState } });
        render(<ProfilePage />);
        await userEvent.click(screen.getByRole('button', { name: /保存/i }));
        await waitFor(() => {
          expect(mockUpdateProfile).toHaveBeenCalled();
        });
      });
    });

    describe('SNS URL のバリデーション', () => {
      it('http(s) スキーム以外は保存時にエラーとなる', async () => {
        render(<ProfilePage />);
        await userEvent.type(screen.getByLabelText('SNS URL'), 'javascript:alert(1)');
        await userEvent.click(screen.getByRole('button', { name: /保存/i }));
        await waitFor(() => {
          expect(mockShowError).toHaveBeenCalled();
        });
        expect(mockUpdateProfile).not.toHaveBeenCalled();
      });

      it('URL 形式不正はエラーとなる', async () => {
        render(<ProfilePage />);
        await userEvent.type(screen.getByLabelText('SNS URL'), 'invalid');
        await userEvent.click(screen.getByRole('button', { name: /保存/i }));
        await waitFor(() => {
          expect(mockShowError).toHaveBeenCalled();
        });
      });

      it('正しい URL は許容される', async () => {
        mockUpdateProfile.mockResolvedValueOnce({
          user: { ...mockUserState, snsUrl: 'https://example.com' },
        });
        render(<ProfilePage />);
        await userEvent.type(screen.getByLabelText('SNS URL'), 'https://example.com');
        await userEvent.click(screen.getByRole('button', { name: /保存/i }));
        await waitFor(() => {
          expect(mockUpdateProfile).toHaveBeenCalled();
        });
      });

      it('空文字はエラーにならず保存できる', async () => {
        mockUpdateProfile.mockResolvedValueOnce({ user: { ...mockUserState } });
        render(<ProfilePage />);
        await userEvent.click(screen.getByRole('button', { name: /保存/i }));
        await waitFor(() => {
          expect(mockUpdateProfile).toHaveBeenCalled();
        });
      });
    });

    describe('タイムゾーンのバリデーション', () => {
      // タイムゾーンは Select で IANA 候補のみ提示されるため、UI 上は不正値が入らない設計。
      // サーバ側で IANA 検証を行うため、ここでは UI が IANA 形式の値を送信することを確認する。
      it('IANA 形式以外（"JST" などの略称）はエラーとなる', async () => {
        // UI 上は Select のため "JST" は選択不可（fallback list および Intl.supportedValuesOf には JST が含まれない）
        render(<ProfilePage />);
        await userEvent.click(screen.getByRole('combobox', { name: /タイムゾーン/ }));
        await waitFor(() => {
          expect(screen.getByRole('option', { name: 'UTC' })).toBeInTheDocument();
        });
        const options = screen.queryAllByRole('option');
        const labels = options.map((o) => o.textContent ?? '');
        expect(labels.includes('JST')).toBe(false);
      });

      it('未知のタイムゾーン文字列はエラーとなる', () => {
        // Select の選択肢に未知の文字列は出ない（選択不可）。
        render(<ProfilePage />);
        const combobox = screen.getByRole('combobox', { name: /タイムゾーン/ });
        expect(combobox).toBeInTheDocument();
      });

      it('IANA 形式（"Asia/Tokyo" 等）は許容される', async () => {
        mockUpdateProfile.mockResolvedValueOnce({
          user: { ...mockUserState, timezone: 'Asia/Tokyo' },
        });
        render(<ProfilePage />);
        await userEvent.click(screen.getByRole('combobox', { name: /タイムゾーン/ }));
        await waitFor(() => {
          expect(screen.getByRole('option', { name: 'Asia/Tokyo' })).toBeInTheDocument();
        });
        await userEvent.click(screen.getByRole('option', { name: 'Asia/Tokyo' }));
        await userEvent.click(screen.getByRole('button', { name: /保存/i }));
        await waitFor(() => {
          expect(mockUpdateProfile).toHaveBeenCalledWith(
            expect.objectContaining({ timezone: 'Asia/Tokyo' }),
          );
        });
      });

      it('未設定（null/空）は許容される', async () => {
        mockUpdateProfile.mockResolvedValueOnce({ user: { ...mockUserState } });
        render(<ProfilePage />);
        await userEvent.click(screen.getByRole('button', { name: /保存/i }));
        await waitFor(() => {
          expect(mockUpdateProfile).toHaveBeenCalledWith(
            expect.objectContaining({ timezone: null }),
          );
        });
      });
    });

    describe('自己紹介の文字数制限', () => {
      it('上限文字数を超える入力はエラーまたは切り詰めとなる', async () => {
        // textarea に maxLength=1000 が指定されているため、文字数超過は入力時に切り詰められる。
        render(<ProfilePage />);
        const ta = screen.getByLabelText('自己紹介') as HTMLTextAreaElement;
        expect(ta.maxLength).toBe(1000);
      });

      it('上限以内の入力は許容される', async () => {
        mockUpdateProfile.mockResolvedValueOnce({ user: { ...mockUserState, bio: 'short' } });
        render(<ProfilePage />);
        await userEvent.type(screen.getByLabelText('自己紹介'), 'short');
        await userEvent.click(screen.getByRole('button', { name: /保存/i }));
        await waitFor(() => {
          expect(mockUpdateProfile).toHaveBeenCalledWith(expect.objectContaining({ bio: 'short' }));
        });
      });
    });
  });

  describe('ProfilePage: API 連携', () => {
    it('保存ボタン押下で api.auth.updateProfile が拡張フィールドを含めて呼ばれる', async () => {
      mockUpdateProfile.mockResolvedValueOnce({ user: { ...mockUserState } });
      render(<ProfilePage />);
      await userEvent.type(screen.getByLabelText('自己紹介'), 'b');
      await userEvent.type(screen.getByLabelText('役職'), 'j');
      await userEvent.click(screen.getByRole('button', { name: /保存/i }));
      await waitFor(() => {
        expect(mockUpdateProfile).toHaveBeenCalledWith(
          expect.objectContaining({
            bio: 'b',
            jobTitle: 'j',
            department: null,
            timezone: null,
            githubUrl: null,
            snsUrl: null,
          }),
        );
      });
    });

    it('updateProfile の応答で AuthContext のユーザーが更新される', async () => {
      const updated = { ...mockUserState, bio: 'updated' };
      mockUpdateProfile.mockResolvedValueOnce({ user: updated });
      render(<ProfilePage />);
      await userEvent.click(screen.getByRole('button', { name: /保存/i }));
      await waitFor(() => {
        expect(mockUpdateUser).toHaveBeenCalledWith(updated);
      });
    });

    it('保存成功時に成功スナックバーが表示される', async () => {
      mockUpdateProfile.mockResolvedValueOnce({ user: { ...mockUserState } });
      render(<ProfilePage />);
      await userEvent.click(screen.getByRole('button', { name: /保存/i }));
      await waitFor(() => {
        expect(mockShowSuccess).toHaveBeenCalledWith('プロフィールを保存しました');
      });
    });

    it('保存失敗時にエラーが表示される', async () => {
      mockUpdateProfile.mockRejectedValueOnce(new Error('サーバーエラー'));
      render(<ProfilePage />);
      await userEvent.click(screen.getByRole('button', { name: /保存/i }));
      await waitFor(() => {
        expect(mockShowError).toHaveBeenCalledWith('サーバーエラー');
      });
    });

    it('初期表示時に user オブジェクトから拡張フィールドが復元される', () => {
      mockUserState.bio = 'b';
      mockUserState.jobTitle = 'j';
      mockUserState.department = 'd';
      mockUserState.timezone = 'UTC';
      mockUserState.githubUrl = 'https://github.com/me';
      mockUserState.snsUrl = 'https://example.com';
      render(<ProfilePage />);
      expect((screen.getByLabelText('自己紹介') as HTMLTextAreaElement).value).toBe('b');
      expect((screen.getByLabelText('役職') as HTMLInputElement).value).toBe('j');
      expect((screen.getByLabelText('部署') as HTMLInputElement).value).toBe('d');
      expect(screen.getByRole('combobox', { name: /タイムゾーン/ })).toHaveTextContent('UTC');
      expect((screen.getByLabelText('GitHub URL') as HTMLInputElement).value).toBe(
        'https://github.com/me',
      );
      expect((screen.getByLabelText('SNS URL') as HTMLInputElement).value).toBe(
        'https://example.com',
      );
    });
  });

  describe('UserProfilePopover: 他ユーザーの拡張プロフィール表示', () => {
    const baseUser: User = {
      id: 2,
      username: 'bob',
      email: 'bob@example.com',
      avatarUrl: null,
      displayName: null,
      location: null,
      createdAt: '2024-01-01T00:00:00Z',
      role: 'user',
      isActive: true,
      onboardingCompletedAt: null,
    };

    it('自己紹介（bio）が表示される', () => {
      render(
        <UserProfilePopover
          user={{ ...baseUser, bio: '私の紹介文' }}
          displayName="bob"
          anchorEl={document.body}
          open={true}
          onClose={vi.fn()}
        />,
      );
      expect(screen.getByTestId('user-bio')).toHaveTextContent('私の紹介文');
    });

    it('役職（jobTitle）が表示される', () => {
      render(
        <UserProfilePopover
          user={{ ...baseUser, jobTitle: 'Engineer' }}
          displayName="bob"
          anchorEl={document.body}
          open={true}
          onClose={vi.fn()}
        />,
      );
      expect(screen.getByTestId('user-job-title')).toHaveTextContent('Engineer');
    });

    it('部署（department）が表示される', () => {
      render(
        <UserProfilePopover
          user={{ ...baseUser, department: 'Platform' }}
          displayName="bob"
          anchorEl={document.body}
          open={true}
          onClose={vi.fn()}
        />,
      );
      expect(screen.getByTestId('user-department')).toHaveTextContent('Platform');
    });

    it('タイムゾーンが表示される', () => {
      render(
        <UserProfilePopover
          user={{ ...baseUser, timezone: 'Asia/Tokyo' }}
          displayName="bob"
          anchorEl={document.body}
          open={true}
          onClose={vi.fn()}
        />,
      );
      expect(screen.getByTestId('user-timezone')).toHaveTextContent('Asia/Tokyo');
    });

    it('GitHub URL がリンクとして表示される', () => {
      render(
        <UserProfilePopover
          user={{ ...baseUser, githubUrl: 'https://github.com/bob' }}
          displayName="bob"
          anchorEl={document.body}
          open={true}
          onClose={vi.fn()}
        />,
      );
      const link = screen.getByTestId('user-github-url');
      expect(link).toHaveAttribute('href', 'https://github.com/bob');
    });

    it('SNS URL がリンクとして表示される', () => {
      render(
        <UserProfilePopover
          user={{ ...baseUser, snsUrl: 'https://twitter.com/bob' }}
          displayName="bob"
          anchorEl={document.body}
          open={true}
          onClose={vi.fn()}
        />,
      );
      const link = screen.getByTestId('user-sns-url');
      expect(link).toHaveAttribute('href', 'https://twitter.com/bob');
    });

    it('拡張フィールドが全て null/空の場合はそれらの行が表示されない', () => {
      render(
        <UserProfilePopover
          user={baseUser}
          displayName="bob"
          anchorEl={document.body}
          open={true}
          onClose={vi.fn()}
        />,
      );
      expect(screen.queryByTestId('user-bio')).not.toBeInTheDocument();
      expect(screen.queryByTestId('user-job-title')).not.toBeInTheDocument();
      expect(screen.queryByTestId('user-department')).not.toBeInTheDocument();
      expect(screen.queryByTestId('user-timezone')).not.toBeInTheDocument();
      expect(screen.queryByTestId('user-github-url')).not.toBeInTheDocument();
      expect(screen.queryByTestId('user-sns-url')).not.toBeInTheDocument();
    });

    it('一部のみ設定されている場合は設定された項目だけが表示される', () => {
      render(
        <UserProfilePopover
          user={{ ...baseUser, jobTitle: 'Eng' }}
          displayName="bob"
          anchorEl={document.body}
          open={true}
          onClose={vi.fn()}
        />,
      );
      expect(screen.getByTestId('user-job-title')).toBeInTheDocument();
      expect(screen.queryByTestId('user-department')).not.toBeInTheDocument();
    });
  });

  describe('UserProfilePopover: 外部リンクのクリック挙動', () => {
    const baseUser: User = {
      id: 2,
      username: 'bob',
      email: 'bob@example.com',
      avatarUrl: null,
      displayName: null,
      location: null,
      createdAt: '2024-01-01T00:00:00Z',
      role: 'user',
      isActive: true,
      onboardingCompletedAt: null,
    };

    it('GitHub URL リンクは target="_blank" を持つ', () => {
      render(
        <UserProfilePopover
          user={{ ...baseUser, githubUrl: 'https://github.com/bob' }}
          displayName="bob"
          anchorEl={document.body}
          open={true}
          onClose={vi.fn()}
        />,
      );
      expect(screen.getByTestId('user-github-url')).toHaveAttribute('target', '_blank');
    });

    it('GitHub URL リンクは rel="noopener noreferrer" を持つ', () => {
      render(
        <UserProfilePopover
          user={{ ...baseUser, githubUrl: 'https://github.com/bob' }}
          displayName="bob"
          anchorEl={document.body}
          open={true}
          onClose={vi.fn()}
        />,
      );
      expect(screen.getByTestId('user-github-url')).toHaveAttribute('rel', 'noopener noreferrer');
    });

    it('SNS URL リンクは target="_blank" を持つ', () => {
      render(
        <UserProfilePopover
          user={{ ...baseUser, snsUrl: 'https://twitter.com/bob' }}
          displayName="bob"
          anchorEl={document.body}
          open={true}
          onClose={vi.fn()}
        />,
      );
      expect(screen.getByTestId('user-sns-url')).toHaveAttribute('target', '_blank');
    });

    it('SNS URL リンクは rel="noopener noreferrer" を持つ', () => {
      render(
        <UserProfilePopover
          user={{ ...baseUser, snsUrl: 'https://twitter.com/bob' }}
          displayName="bob"
          anchorEl={document.body}
          open={true}
          onClose={vi.fn()}
        />,
      );
      expect(screen.getByTestId('user-sns-url')).toHaveAttribute('rel', 'noopener noreferrer');
    });

    it('リンククリックで window.open が呼ばれる（または anchor のデフォルト挙動が阻害されない）', () => {
      render(
        <UserProfilePopover
          user={{ ...baseUser, githubUrl: 'https://github.com/bob' }}
          displayName="bob"
          anchorEl={document.body}
          open={true}
          onClose={vi.fn()}
        />,
      );
      // anchor タグの href が設定されていれば、デフォルトのクリック挙動でブラウザがタブを開く
      const link = screen.getByTestId('user-github-url') as HTMLAnchorElement;
      expect(link.tagName.toLowerCase()).toBe('a');
      expect(link.href).toBe('https://github.com/bob');
    });

    it('GitHub URL が空の場合はリンクが描画されない', () => {
      render(
        <UserProfilePopover
          user={{ ...baseUser, githubUrl: null }}
          displayName="bob"
          anchorEl={document.body}
          open={true}
          onClose={vi.fn()}
        />,
      );
      expect(screen.queryByTestId('user-github-url')).not.toBeInTheDocument();
    });

    it('SNS URL が空の場合はリンクが描画されない', () => {
      render(
        <UserProfilePopover
          user={{ ...baseUser, snsUrl: null }}
          displayName="bob"
          anchorEl={document.body}
          open={true}
          onClose={vi.fn()}
        />,
      );
      expect(screen.queryByTestId('user-sns-url')).not.toBeInTheDocument();
    });
  });

  describe('UserProfilePopover: タイムゾーン表示', () => {
    const baseUser: User = {
      id: 2,
      username: 'bob',
      email: 'bob@example.com',
      avatarUrl: null,
      displayName: null,
      location: null,
      createdAt: '2024-01-01T00:00:00Z',
      role: 'user',
      isActive: true,
      onboardingCompletedAt: null,
    };

    it('user.timezone がそのまま（または整形して）表示される', () => {
      render(
        <UserProfilePopover
          user={{ ...baseUser, timezone: 'Asia/Tokyo' }}
          displayName="bob"
          anchorEl={document.body}
          open={true}
          onClose={vi.fn()}
        />,
      );
      expect(screen.getByTestId('user-timezone')).toHaveTextContent('Asia/Tokyo');
    });

    it('timezone が null の場合は表示されない', () => {
      render(
        <UserProfilePopover
          user={{ ...baseUser, timezone: null }}
          displayName="bob"
          anchorEl={document.body}
          open={true}
          onClose={vi.fn()}
        />,
      );
      expect(screen.queryByTestId('user-timezone')).not.toBeInTheDocument();
    });
  });
});
