/**
 * テスト対象: DM（ダイレクトメッセージ）API・Socket.IO ハンドラ
 * 戦略:
 *   - DB は better-sqlite3 のインメモリ DB を使用（jest.mock('../db/database')）
 *   - REST API は supertest で検証し、Socket.IO イベントはサービス層を直接検証する
 *   - 正常系・境界条件・エラーケースを網羅する
 */

import request from 'supertest';
import { createApp } from '../app';

// インメモリ DB モック
jest.mock('../db/database', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
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

const app = createApp();

// テスト用ユーザーID
let userAId: number;
let userBId: number;
let userCId: number;
let tokenA: string;
let tokenB: string;

describe('DM API', () => {
  describe('POST /api/dm/conversations', () => {
    it('存在するユーザーとのDM会話を新規作成できる', () => {
      // TODO
    });

    it('既存のDM会話がある場合は既存のものを返す（冪等性）', () => {
      // TODO
    });

    it('自分自身とのDMは作成できない', () => {
      // TODO
    });

    it('存在しないユーザーIDを指定するとエラーになる', () => {
      // TODO
    });

    it('未認証リクエストは401を返す', () => {
      // TODO
    });
  });

  describe('GET /api/dm/conversations', () => {
    it('自分が参加しているDM会話一覧を取得できる', () => {
      // TODO
    });

    it('未読メッセージ数が含まれる', () => {
      // TODO
    });

    it('最新メッセージの情報が含まれる', () => {
      // TODO
    });

    it('DM会話がない場合は空配列を返す', () => {
      // TODO
    });

    it('未認証リクエストは401を返す', () => {
      // TODO
    });
  });

  describe('GET /api/dm/conversations/:conversationId/messages', () => {
    it('DM会話のメッセージ一覧を取得できる', () => {
      // TODO
    });

    it('自分が参加していない会話のメッセージは取得できない（403）', () => {
      // TODO
    });

    it('存在しない会話IDを指定すると404を返す', () => {
      // TODO
    });

    it('cursor ベースのページネーションが機能する', () => {
      // TODO
    });

    it('未認証リクエストは401を返す', () => {
      // TODO
    });
  });

  describe('POST /api/dm/conversations/:conversationId/messages', () => {
    it('DM会話にメッセージを送信できる', () => {
      // TODO
    });

    it('自分が参加していない会話には送信できない（403）', () => {
      // TODO
    });

    it('空のメッセージは送信できない', () => {
      // TODO
    });

    it('未認証リクエストは401を返す', () => {
      // TODO
    });
  });

  describe('PUT /api/dm/conversations/:conversationId/read', () => {
    it('指定した会話の未読を既読に更新できる', () => {
      // TODO
    });

    it('自分が参加していない会話は更新できない（403）', () => {
      // TODO
    });

    it('未認証リクエストは401を返す', () => {
      // TODO
    });
  });
});

describe('Socket.IO DM イベント', () => {
  describe('send_dm イベント', () => {
    it('メッセージ送信時に送信者と受信者の両方に new_dm_message が emit される', () => {
      // TODO
    });

    it('受信者がオフライン時はメッセージがDBに保存される', () => {
      // TODO
    });

    it('参加していない会話への送信はエラーになる', () => {
      // TODO
    });
  });

  describe('dm_typing_start / dm_typing_stop イベント', () => {
    it('typing_start で相手に dm_user_typing が emit される', () => {
      // TODO
    });

    it('typing_stop で相手に dm_user_stopped_typing が emit される', () => {
      // TODO
    });
  });

  describe('新着DM通知', () => {
    it('新着DM受信時に受信者の user:id ルームに dm_notification が emit される', () => {
      // TODO
    });
  });
});
