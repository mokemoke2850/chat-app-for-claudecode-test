/* global window */
// シードデータ。実際のMUIベースのチャットアプリに統合する前提のサンプル。

const CURRENT_USER = { id: 1, username: 'taro', displayName: '山田太郎', color: '#1976d2' };

const USERS = [
  CURRENT_USER,
  { id: 2, username: 'hanako', displayName: '佐藤花子', color: '#d32f2f' },
  { id: 3, username: 'kenji', displayName: '鈴木健二', color: '#388e3c' },
  { id: 4, username: 'mika', displayName: '田中美香', color: '#f57c00' },
  { id: 5, username: 'ryo', displayName: '高橋亮', color: '#7b1fa2' },
  { id: 6, username: 'aya', displayName: '中村綾', color: '#0097a7' },
  { id: 7, username: 'shun', displayName: '小林俊', color: '#5d4037' },
];

const CHANNELS = [
  { id: 10, name: 'general', color: '#1976d2', unreadCount: 0, mentionCount: 0 },
  { id: 11, name: 'design', color: '#d81b60', unreadCount: 3, mentionCount: 1 },
  { id: 12, name: 'engineering', color: '#388e3c', unreadCount: 0, mentionCount: 0 },
  { id: 13, name: 'random', color: '#f57c00', unreadCount: 12, mentionCount: 0 },
  { id: 14, name: 'product', color: '#7b1fa2', unreadCount: 0, mentionCount: 0 },
  { id: 15, name: 'sales', color: '#0097a7', unreadCount: 2, mentionCount: 0 },
];

const CATEGORIES = [
  { id: 1, name: 'プロジェクト', channelIds: [10, 11, 12, 14] },
  { id: 2, name: 'その他', channelIds: [13, 15] },
];

// 基準日を固定（モックとしてデモしやすくする）
// 現在日：2026-04-20（月曜）とする
const TODAY = new Date(2026, 3, 20); // 月は0-indexed

function addDays(d, n) {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

function setHM(d, h, m) {
  const r = new Date(d);
  r.setHours(h, m || 0, 0, 0);
  return r;
}

// チャンネルに紐づくイベント群
const EVENTS = [
  {
    id: 101,
    channelId: 11, // design
    title: 'デザインレビュー：カレンダー機能',
    start: setHM(TODAY, 14, 0),
    end: setHM(TODAY, 15, 0),
    organizerId: 2,
    location: 'Google Meet',
    description:
      'カレンダー/予定調整機能の初回デザインレビューです。月表示・週表示・イベント詳細について議論します。',
    attendees: [
      { userId: 1, status: 'accepted' },
      { userId: 2, status: 'accepted' },
      { userId: 4, status: 'accepted' },
      { userId: 5, status: 'maybe' },
      { userId: 6, status: 'pending' },
    ],
    color: '#d81b60',
  },
  {
    id: 102,
    channelId: 12,
    title: 'スプリントプランニング',
    start: setHM(addDays(TODAY, 1), 10, 0),
    end: setHM(addDays(TODAY, 1), 11, 30),
    organizerId: 3,
    location: '会議室A',
    description: '次スプリントのタスク割り当てと見積もり。',
    attendees: [
      { userId: 1, status: 'accepted' },
      { userId: 3, status: 'accepted' },
      { userId: 5, status: 'accepted' },
      { userId: 7, status: 'pending' },
    ],
    color: '#388e3c',
  },
  {
    id: 103,
    channelId: 10,
    title: '全社定例',
    start: setHM(addDays(TODAY, 2), 16, 0),
    end: setHM(addDays(TODAY, 2), 17, 0),
    organizerId: 2,
    location: 'Zoom',
    description: '月次の全社定例ミーティング。',
    attendees: USERS.map((u) => ({ userId: u.id, status: 'accepted' })),
    color: '#1976d2',
  },
  {
    id: 104,
    channelId: 14,
    title: 'プロダクトロードマップ議論',
    start: setHM(addDays(TODAY, 3), 13, 0),
    end: setHM(addDays(TODAY, 3), 14, 30),
    organizerId: 5,
    location: '会議室B',
    description: 'Q3-Q4ロードマップの優先順位について。',
    attendees: [
      { userId: 1, status: 'accepted' },
      { userId: 5, status: 'accepted' },
      { userId: 4, status: 'maybe' },
    ],
    color: '#7b1fa2',
  },
  {
    id: 105,
    channelId: 11,
    title: '1on1：山田 × 佐藤',
    start: setHM(addDays(TODAY, -2), 11, 0),
    end: setHM(addDays(TODAY, -2), 11, 30),
    organizerId: 2,
    location: 'Google Meet',
    description: '隔週1on1。',
    attendees: [
      { userId: 1, status: 'accepted' },
      { userId: 2, status: 'accepted' },
    ],
    color: '#d81b60',
  },
  {
    id: 106,
    channelId: 15,
    title: '顧客A様 商談',
    start: setHM(addDays(TODAY, 4), 15, 0),
    end: setHM(addDays(TODAY, 4), 16, 0),
    organizerId: 6,
    location: 'オンライン',
    description: '四半期レビュー商談。',
    attendees: [
      { userId: 1, status: 'accepted' },
      { userId: 6, status: 'accepted' },
    ],
    color: '#0097a7',
  },
  {
    id: 107,
    channelId: 12,
    title: 'コードレビュー会',
    start: setHM(addDays(TODAY, 0), 17, 30),
    end: setHM(addDays(TODAY, 0), 18, 0),
    organizerId: 3,
    location: 'Slack Huddle',
    description: '今週のコードレビュー共有。',
    attendees: [
      { userId: 1, status: 'accepted' },
      { userId: 3, status: 'accepted' },
      { userId: 5, status: 'maybe' },
      { userId: 7, status: 'accepted' },
    ],
    color: '#388e3c',
  },
  {
    id: 108,
    channelId: 13,
    title: 'ランチ会',
    start: setHM(addDays(TODAY, 5), 12, 0),
    end: setHM(addDays(TODAY, 5), 13, 0),
    organizerId: 4,
    location: '社食',
    description: '有志のランチ会。',
    attendees: [
      { userId: 1, status: 'maybe' },
      { userId: 4, status: 'accepted' },
      { userId: 6, status: 'accepted' },
    ],
    color: '#f57c00',
  },
  {
    id: 109,
    channelId: 11,
    title: 'デザインシステム棚卸し',
    start: setHM(addDays(TODAY, 7), 10, 0),
    end: setHM(addDays(TODAY, 7), 12, 0),
    organizerId: 2,
    location: 'Figma + Meet',
    description: '共通コンポーネントの棚卸しとリファクタリング計画。',
    attendees: [
      { userId: 1, status: 'pending' },
      { userId: 2, status: 'accepted' },
      { userId: 4, status: 'accepted' },
    ],
    color: '#d81b60',
  },
  {
    id: 110,
    channelId: 10,
    title: '新入社員歓迎会',
    start: setHM(addDays(TODAY, 9), 19, 0),
    end: setHM(addDays(TODAY, 9), 21, 0),
    organizerId: 2,
    location: '会議室C / オンライン',
    description: '4月新入社員の歓迎会。リモート参加も可。',
    attendees: [
      { userId: 1, status: 'accepted' },
      { userId: 2, status: 'accepted' },
      { userId: 3, status: 'maybe' },
      { userId: 4, status: 'accepted' },
      { userId: 5, status: 'accepted' },
      { userId: 6, status: 'pending' },
      { userId: 7, status: 'accepted' },
    ],
    color: '#1976d2',
  },
];

// 日程投票（Poll）— 候補日時帯の塗りつぶし型
const POLLS = [
  {
    id: 201,
    channelId: 11,
    title: '次回デザインレビューの日程',
    organizerId: 2,
    deadline: addDays(TODAY, 2),
    // 候補日時帯：各候補は start/end の時間範囲
    candidates: [
      { id: 'c1', start: setHM(addDays(TODAY, 3), 10, 0), end: setHM(addDays(TODAY, 3), 11, 0) },
      { id: 'c2', start: setHM(addDays(TODAY, 3), 14, 0), end: setHM(addDays(TODAY, 3), 15, 0) },
      { id: 'c3', start: setHM(addDays(TODAY, 4), 11, 0), end: setHM(addDays(TODAY, 4), 12, 0) },
      { id: 'c4', start: setHM(addDays(TODAY, 4), 15, 0), end: setHM(addDays(TODAY, 4), 16, 0) },
      { id: 'c5', start: setHM(addDays(TODAY, 7), 10, 0), end: setHM(addDays(TODAY, 7), 11, 0) },
    ],
    // votes[userId][candidateId] = 'yes' | 'maybe' | 'no'
    votes: {
      1: { c1: 'yes', c2: 'yes', c3: 'maybe', c4: 'no', c5: 'yes' },
      2: { c1: 'yes', c2: 'maybe', c3: 'yes', c4: 'yes', c5: 'yes' },
      4: { c1: 'no', c2: 'yes', c3: 'yes', c4: 'maybe', c5: 'maybe' },
      5: { c1: 'maybe', c2: 'yes', c3: 'no', c4: 'yes', c5: 'yes' },
      6: { c1: 'yes', c2: 'yes', c3: 'yes', c4: 'no', c5: 'no' },
    },
  },
];

window.__MOCK_DATA__ = {
  CURRENT_USER,
  USERS,
  CHANNELS,
  CATEGORIES,
  EVENTS,
  POLLS,
  TODAY,
};
