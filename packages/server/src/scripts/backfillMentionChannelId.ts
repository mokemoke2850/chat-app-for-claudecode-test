/**
 * バックフィルスクリプト: mentions.channel_id=0 のレガシーデータ修復
 *
 * 背景:
 *   channel_id カラムが追加される前に作成された mentions レコードは
 *   channel_id=0 のままになっており、markChannelAsRead の WHERE 条件に
 *   マッチせず永久に未読状態になる問題が発生する（Issue #242）。
 *
 * 実行方法:
 *   npx tsx src/scripts/backfillMentionChannelId.ts
 *
 * または package.json の scripts に追加後:
 *   npm run backfill:mention-channel-id --workspace=packages/server
 *
 * 冪等性: channel_id=0 のレコードがない場合は何も変更しない。
 *          複数回実行しても安全。
 */

import { execute, queryOne } from '../db/database';

/**
 * mentions.channel_id=0 のレコードを messages.channel_id から復旧する。
 * テストからも呼び出せるようにエクスポートする。
 *
 * @returns 更新件数
 */
export async function backfillMentionChannelId(): Promise<number> {
  // pg-mem の制約でテーブルエイリアスを使わない形式で記述
  const result = await execute(
    `UPDATE mentions
     SET channel_id = messages.channel_id
     FROM messages
     WHERE mentions.message_id = messages.id
       AND mentions.channel_id = 0`,
  );
  return result.rowCount;
}

// スクリプトとして直接実行された場合のみメイン処理を走らせる
// （テストでインポートしても実行されない）
if (require.main === module) {
  void (async () => {
    console.log('mentions.channel_id=0 のバックフィルを開始します...');

    // 実行前の件数を確認
    const before = await queryOne<{ count: string }>(
      'SELECT COUNT(*) AS count FROM mentions WHERE channel_id = 0',
    );
    const beforeCount = Number(before?.count ?? 0);
    console.log(`対象レコード数: ${beforeCount} 件`);

    if (beforeCount === 0) {
      console.log('対象レコードがありません。処理をスキップします。');
      process.exit(0);
    }

    const updatedCount = await backfillMentionChannelId();
    console.log(`更新完了: ${updatedCount} 件を修復しました。`);

    // 実行後の確認
    const after = await queryOne<{ count: string }>(
      'SELECT COUNT(*) AS count FROM mentions WHERE channel_id = 0',
    );
    const afterCount = Number(after?.count ?? 0);
    console.log(`残存 channel_id=0 件数: ${afterCount} 件`);

    if (afterCount > 0) {
      console.warn(
        `警告: ${afterCount} 件が更新されませんでした（メッセージが存在しない孤立レコードの可能性）。`,
      );
    }

    process.exit(0);
  })().catch((err) => {
    console.error('バックフィル中にエラーが発生しました:', err);
    process.exit(1);
  });
}
