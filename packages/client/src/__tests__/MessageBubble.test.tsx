/**
 * components/Chat/MessageBubble.tsx のユニットテスト
 *
 * テスト対象: メッセージ本文エリアの描画
 *   - Quill Delta コンテンツの HTML 変換
 *   - 引用元メッセージプレビュー
 *   - 添付ファイル（画像・非画像）の表示
 *   - リアクションバッジリストの表示
 *   - 返信件数バッジの表示
 */

import { describe, it } from 'vitest';

describe('MessageBubble', () => {
  describe('本文レンダリング', () => {
    it('Quill Delta の ops を HTML として正しく描画する（bold, italic など）', () => {
      // TODO: implement
    });

    it('@メンションを含む ops をハイライト表示する', () => {
      // TODO: implement
    });

    it('content が不正な JSON のとき raw テキストとしてフォールバック表示する', () => {
      // TODO: implement
    });

    it('画像 op（insert.image）を img タグとして描画する', () => {
      // TODO: implement
    });

    it('color 属性を持つテキストをインラインスタイルの color で描画する', () => {
      // TODO: implement
    });

    it('background 属性を持つテキストをインラインスタイルの backgroundColor で描画する', () => {
      // TODO: implement
    });
  });

  describe('引用メッセージプレビュー', () => {
    it('quotedMessage が存在するとき引用プレビューエリアを表示する', () => {
      // TODO: implement
    });

    it('引用元のユーザー名と本文プレビューを表示する', () => {
      // TODO: implement
    });

    it('quotedMessage.content が Quill Delta JSON のとき ops をプレーンテキストに変換して表示する', () => {
      // TODO: implement
    });

    it('quotedMessage.content が不正な JSON のとき raw テキストとしてフォールバック表示する', () => {
      // TODO: implement
    });

    it('quotedMessage が null のとき引用プレビューエリアを表示しない', () => {
      // TODO: implement
    });
  });

  describe('添付ファイル', () => {
    it('attachments が空のとき添付エリアを表示しない', () => {
      // TODO: implement
    });

    it('mimeType が image/* の添付ファイルを img タグとして表示する', () => {
      // TODO: implement
    });

    it('非画像の添付ファイルをファイルアイコン付きリンクとして表示する', () => {
      // TODO: implement
    });

    it('画像添付ファイルのリンクは download 属性付きで originalName をファイル名として設定する', () => {
      // TODO: implement
    });

    it('複数の添付ファイルをすべて表示する', () => {
      // TODO: implement
    });
  });

  describe('リアクションバッジ', () => {
    it('reactions が空のときリアクションエリアを表示しない', () => {
      // TODO: implement
    });

    it('reactions の各絵文字に対して ReactionBadge を描画する', () => {
      // TODO: implement
    });

    it('リアクションバッジをクリックすると onReactionClick が対応する emoji を引数に呼ばれる', () => {
      // TODO: implement
    });
  });

  describe('返信件数バッジ', () => {
    it('replyCount が 0 のとき返信バッジを表示しない', () => {
      // TODO: implement
    });

    it('replyCount > 0 のとき "{N}件の返信" バッジを表示する', () => {
      // TODO: implement
    });

    it('返信バッジをクリックすると onOpenThread が message.id を引数に呼ばれる', () => {
      // TODO: implement
    });
  });

  describe('メッセージのスタイル', () => {
    it('自分のメッセージ（isOwn=true）のとき右寄せ配色（#dbeafe）で表示する', () => {
      // TODO: implement
    });

    it('他人のメッセージ（isOwn=false）のとき左寄せ配色（grey.100）で表示する', () => {
      // TODO: implement
    });
  });
});
