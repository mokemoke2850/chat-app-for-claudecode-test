import { initializeSchema } from '../db/database';

jest.mock('../db/database', () => {
  const DB = require('better-sqlite3') as typeof import('better-sqlite3');
  const db = new DB(':memory:');
  db.pragma('foreign_keys = ON');
  const { initializeSchema: init } =
    jest.requireActual<typeof import('../db/database')>('../db/database');
  init(db);
  return {
    getDatabase: () => db,
    initializeSchema: init,
    closeDatabase: jest.fn(),
  };
});

void initializeSchema;

describe('getChannelsForUser - mentionCount', () => {
  describe('メンションカウントの初期状態', () => {
    it('メンションがない場合 mentionCount は 0 になる', () => {});
  });

  describe('未読メンションのカウント', () => {
    it('未読メッセージに自分へのメンションがある場合 mentionCount が正しくカウントされる', () => {});
    it('@here メンションがある場合 mentionCount に含まれる', () => {});
    it('@channel メンションがある場合 mentionCount に含まれる', () => {});
    it('複数メッセージにまたがるメンションが正しく合算される', () => {});
  });

  describe('既読処理とメンションカウントのリセット', () => {
    it('markChannelAsRead を呼び出すと mentionCount が 0 にリセットされる', () => {});
    it('部分的に既読にした場合、既読以降のメンションのみカウントされる', () => {});
  });

  describe('他ユーザーへのメンション', () => {
    it('自分以外へのメンションは mentionCount にカウントされない', () => {});
  });
});

describe('Socket handler - mention_updated イベント', () => {
  describe('メッセージ送信時のメンション通知', () => {
    it('send_message で mentionedUserIds を指定するとメンション先ユーザーに mention_updated が emit される', () => {});
    it('メンション送信者自身には mention_updated が emit されない', () => {});
    it('mentionedUserIds が空の場合 mention_updated は emit されない', () => {});
  });

  describe('メッセージ編集時のメンション通知', () => {
    it('edit_message で新たに追加されたメンション対象ユーザーに mention_updated が emit される', () => {});
  });
});
