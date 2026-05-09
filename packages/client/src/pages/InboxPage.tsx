import { use, useEffect, useMemo, useState, Suspense } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Box,
  CircularProgress,
  FormControlLabel,
  Switch,
  Tab,
  Tabs,
  Typography,
} from '@mui/material';
import AppLayout from '../components/Layout/AppLayout';
import ChannelList from '../components/Channel/ChannelList';
import SidebarDmList from '../components/Layout/SidebarDmList';
import SummaryCards, { type SummaryData } from '../components/Inbox/SummaryCards';
import RemindersList from '../components/Inbox/RemindersList';
import DraftsList from '../components/Inbox/DraftsList';
import MentionsList from '../components/Inbox/MentionsList';
import ThreadsList from '../components/Inbox/ThreadsList';
import type { DraftResumeTarget } from '../components/Inbox/DraftsList';
import { api } from '../api/client';
import { useAuth } from '../contexts/AuthContext';
import type { Draft, MessageSearchResult, Reminder, ThreadSummary } from '@chat-app/shared';

type TabKey = 'mentions' | 'threads' | 'reminders' | 'drafts' | 'all';

const VALID_TABS: TabKey[] = ['mentions', 'threads', 'reminders', 'drafts', 'all'];

function isValidTab(v: string | null): v is TabKey {
  return v !== null && (VALID_TABS as string[]).includes(v);
}

function SummarySection({ promise }: { promise: Promise<SummaryData> }) {
  const data = use(promise);
  return <SummaryCards data={data} />;
}

function RemindersSection({
  promise,
  onComplete,
  unreadOnly,
}: {
  promise: Promise<{ reminders: Reminder[] }>;
  onComplete?: (id: number) => void;
  unreadOnly?: boolean;
}) {
  const { reminders } = use(promise);
  return <RemindersList reminders={reminders} onComplete={onComplete} unreadOnly={unreadOnly} />;
}

function DraftsSection({
  promise,
  onResume,
  unreadOnly,
}: {
  promise: Promise<{ drafts: Draft[] }>;
  onResume?: (target: DraftResumeTarget) => void;
  unreadOnly?: boolean;
}) {
  const { drafts } = use(promise);
  return <DraftsList drafts={drafts} onResume={onResume} unreadOnly={unreadOnly} />;
}

function MentionsSection({
  promise,
  unreadOnly,
}: {
  promise: Promise<{ messages: MessageSearchResult[] }>;
  unreadOnly?: boolean;
}) {
  const { messages } = use(promise);
  return <MentionsList messages={messages} unreadOnly={unreadOnly} />;
}

function ThreadsSection({
  promise,
  unreadOnly,
}: {
  promise: Promise<{ threads: ThreadSummary[] }>;
  unreadOnly?: boolean;
}) {
  const { threads } = use(promise);
  return <ThreadsList threads={threads} unreadOnly={unreadOnly} />;
}

function AllSection({
  mentionsPromise,
  remindersPromise,
  draftsPromise,
  unreadOnly,
}: {
  mentionsPromise: Promise<{ messages: MessageSearchResult[] }>;
  remindersPromise: Promise<{ reminders: Reminder[] }>;
  draftsPromise: Promise<{ drafts: Draft[] }>;
  unreadOnly?: boolean;
}) {
  const { messages } = use(mentionsPromise);
  const { reminders } = use(remindersPromise);
  const { drafts } = use(draftsPromise);
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <MentionsList messages={messages} unreadOnly={unreadOnly} />
      <RemindersList reminders={reminders} unreadOnly={unreadOnly} />
      <DraftsList drafts={drafts} unreadOnly={unreadOnly} />
    </Box>
  );
}

const UNREAD_ONLY_KEY = 'inbox:unreadOnly';

/**
 * Focus Inbox 画面 (ルート `/`)。
 * サマリーカード 3 連 + 5 タブ (メンション / スレッド / リマインダー / 下書き / すべて) を表示。
 *
 * 後方互換: `/?channel=X` でアクセスされた場合は `/chat?channel=X` にリダイレクトし、
 * 既存のチャンネル復元動線を維持する。
 *
 * テスト容易性のため、表示用の純粋コンポーネント (SummaryCards / RemindersList / DraftsList) を
 * 別ファイルに切り出し、本ファイルでは `use(promise)` で Promise を解決して配列を渡すだけにする。
 */
export default function InboxPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  // 後方互換: ?channel= クエリがある場合は ChatPage に逃がす
  const channelParam = searchParams.get('channel');
  useEffect(() => {
    if (channelParam) {
      navigate(`/chat?channel=${channelParam}`, { replace: true });
    }
  }, [channelParam, navigate]);

  const rawTab = searchParams.get('tab');
  const tab: TabKey = isValidTab(rawTab) ? rawTab : 'mentions';

  // 未読フィルタ: localStorage から初期値を読み込む（デフォルト true）
  const [unreadOnly, setUnreadOnly] = useState<boolean>(() => {
    const stored = localStorage.getItem(UNREAD_ONLY_KEY);
    return stored === null ? true : stored === 'true';
  });

  const handleUnreadOnlyChange = (_: React.ChangeEvent<HTMLInputElement>, checked: boolean) => {
    setUnreadOnly(checked);
    localStorage.setItem(UNREAD_ONLY_KEY, String(checked));
  };

  // React 19 Concurrent モード対策: promise の安定化には useState の初期化関数（1 度だけ評価）を使う。
  // 3 つの API を Promise.all で 1 本にまとめて Suspense 解決を 1 サイクルで完了させる。
  const [summaryPromise] = useState<Promise<SummaryData>>(() => {
    const now = new Date();
    const from = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
    const to = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1).toISOString();
    return Promise.all([
      api.channels.list(),
      api.calendar.events.list({ from, to }),
      user ? api.tasks.list({ assigneeId: user.id }) : Promise.resolve({ tasks: [] }),
    ]);
  });

  const mentionsPromise = useMemo(
    () =>
      tab === 'mentions' || tab === 'all'
        ? api.messages.search('', { mentionedToMe: true, unreadOnly })
        : null,

    [tab, unreadOnly],
  );
  const threadsPromise = useMemo(
    () => (tab === 'threads' ? api.threads.listSubscribed() : null),
    [tab],
  );
  // 「完了」ボタン押下後に再フェッチするためのキー。インクリメントで promise 再生成。
  const [remindersKey, setRemindersKey] = useState(0);
  const remindersPromise = useMemo(
    () => (tab === 'reminders' || tab === 'all' ? api.reminders.list() : null),
    // remindersKey も deps に含めて再フェッチをトリガー (関数 body では未使用の意図的依存)
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [tab, remindersKey],
  );
  const draftsPromise = useMemo(
    () => (tab === 'drafts' || tab === 'all' ? api.drafts.getAll() : null),
    [tab],
  );

  // リダイレクト中はコンテンツを描画しない
  if (channelParam) return null;

  const handleTabChange = (_: React.SyntheticEvent, newTab: TabKey) => {
    setSearchParams({ tab: newTab });
  };

  // クイックアクション (Reminder の完了 / Draft の再開)
  const handleReminderComplete = async (id: number) => {
    try {
      await api.reminders.delete(id);
      setRemindersKey((k) => k + 1);
    } catch {
      // 失敗時は state を変えない（次回タブ切替で再取得される）
    }
  };
  const handleDraftResume = (target: DraftResumeTarget) => {
    if (target.kind === 'channel') {
      navigate(`/chat?channel=${target.channelId}`);
    } else {
      navigate(`/dm?conversation=${target.dmConversationId}`);
    }
  };

  return (
    <AppLayout
      defaultSidebarOpen={false}
      sidebar={
        <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>
          <Box sx={{ flex: 1, overflow: 'auto', minHeight: 0 }}>
            <ChannelList
              activeChannelId={null}
              onSelect={(id) => navigate(`/chat?channel=${id}`)}
            />
          </Box>
          <SidebarDmList />
        </Box>
      }
    >
      <Box sx={{ p: 3, overflow: 'auto', height: '100%' }}>
        <Typography variant="h5" fontWeight={600} sx={{ mb: 2 }}>
          受信箱
        </Typography>

        <Suspense
          fallback={
            <Box sx={{ display: 'flex', justifyContent: 'center', p: 2 }}>
              <CircularProgress size={24} />
            </Box>
          }
        >
          <SummarySection promise={summaryPromise} />
        </Suspense>

        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            mt: 3,
            borderBottom: 1,
            borderColor: 'divider',
          }}
        >
          <Tabs value={tab} onChange={handleTabChange} sx={{ flex: 1 }}>
            <Tab value="mentions" label="メンション" />
            <Tab value="threads" label="スレッド" />
            <Tab value="reminders" label="リマインダー" />
            <Tab value="drafts" label="下書き" />
            <Tab value="all" label="すべて" />
          </Tabs>
          <FormControlLabel
            control={
              <Switch
                checked={unreadOnly}
                onChange={handleUnreadOnlyChange}
                size="small"
                inputProps={{ 'aria-label': '未読のみ' }}
              />
            }
            label="未読のみ"
            sx={{ ml: 2, mr: 1, whiteSpace: 'nowrap' }}
          />
        </Box>

        <Box sx={{ mt: 2 }}>
          {tab === 'mentions' && mentionsPromise && (
            <Suspense
              fallback={
                <Box sx={{ display: 'flex', justifyContent: 'center', p: 2 }}>
                  <CircularProgress size={20} />
                </Box>
              }
            >
              <MentionsSection promise={mentionsPromise} unreadOnly={unreadOnly} />
            </Suspense>
          )}
          {tab === 'threads' && threadsPromise && (
            <Suspense
              fallback={
                <Box sx={{ display: 'flex', justifyContent: 'center', p: 2 }}>
                  <CircularProgress size={20} />
                </Box>
              }
            >
              <ThreadsSection promise={threadsPromise} unreadOnly={unreadOnly} />
            </Suspense>
          )}
          {tab === 'reminders' && remindersPromise && (
            <Suspense
              fallback={
                <Box sx={{ display: 'flex', justifyContent: 'center', p: 2 }}>
                  <CircularProgress size={20} />
                </Box>
              }
            >
              <RemindersSection
                promise={remindersPromise}
                onComplete={handleReminderComplete}
                unreadOnly={unreadOnly}
              />
            </Suspense>
          )}
          {tab === 'drafts' && draftsPromise && (
            <Suspense
              fallback={
                <Box sx={{ display: 'flex', justifyContent: 'center', p: 2 }}>
                  <CircularProgress size={20} />
                </Box>
              }
            >
              <DraftsSection
                promise={draftsPromise}
                onResume={handleDraftResume}
                unreadOnly={unreadOnly}
              />
            </Suspense>
          )}
          {tab === 'all' && mentionsPromise && remindersPromise && draftsPromise && (
            <Suspense
              fallback={
                <Box sx={{ display: 'flex', justifyContent: 'center', p: 2 }}>
                  <CircularProgress size={20} />
                </Box>
              }
            >
              <AllSection
                mentionsPromise={mentionsPromise}
                remindersPromise={remindersPromise}
                draftsPromise={draftsPromise}
                unreadOnly={unreadOnly}
              />
            </Suspense>
          )}
        </Box>
      </Box>
    </AppLayout>
  );
}
