/**
 * 月次レポート CSV ビルダーのユニットテスト（Issue #273）
 *
 * テスト対象: packages/server/src/services/adminService.ts に追加する
 *           buildMonthlyReportCsv（仮）関数
 * 戦略:
 *   - pg-mem を使い、users / channels / messages / message_attachments を投入し
 *     ユーザー別投稿数・チャンネル別投稿数・ファイル容量の集計と CSV フォーマットを検証する
 *   - CSV は既存の audit log エクスポート（buildAuditLogsCsv）と同じ規約に従う:
 *     - UTF-8 BOM 先頭付与
 *     - 改行は CRLF
 *     - RFC 4180 準拠（カンマ・改行・ダブルクォートをエスケープ）
 *   - 月の境界（指定月の 1 日 00:00 UTC ～ 翌月 1 日 00:00 UTC）が正しいことを確認する
 */

describe('月次レポート CSV ビルダー（buildMonthlyReportCsv）', () => {
  describe('対象月パラメータの解釈', () => {
    it.todo(
      'YYYY-MM 形式の文字列を受け取り、その月の UTC 1日 00:00:00 〜 翌月 1日 00:00:00 を集計範囲とする',
    );
    it.todo('不正な月文字列（例: "2026-13"）を渡すと例外を投げる');
    it.todo('不正な形式（例: "2026/01"）を渡すと例外を投げる');
    it.todo('対象月の境界外（前月末・翌月初）のメッセージは集計に含まれない');
  });

  describe('ユーザー別投稿数の集計', () => {
    it.todo('対象月内のユーザー別投稿数（is_deleted=false のみ）を正しく集計する');
    it.todo('論理削除済みメッセージ（is_deleted=true）は集計対象外');
    it.todo('対象月に投稿のないユーザーは結果に含まれない');
    it.todo('投稿数の多い順（降順）で並ぶ');
  });

  describe('チャンネル別投稿数の集計', () => {
    it.todo('対象月内のチャンネル別投稿数（is_deleted=false のみ）を正しく集計する');
    it.todo('対象月に投稿のないチャンネルは結果に含まれない');
    it.todo('投稿数の多い順（降順）で並ぶ');
  });

  describe('ファイル容量の集計', () => {
    it.todo('対象月内に作成された message_attachments の size 合計（バイト）を計算する');
    it.todo('添付ファイルが0件の月は合計サイズ 0 を返す');
    it.todo('ファイル数（添付件数）も併せて返す');
  });

  describe('CSV 出力フォーマット', () => {
    it.todo('戻り値は Buffer 型である');
    it.todo('UTF-8 BOM（0xEF 0xBB 0xBF）が先頭に付与されている');
    it.todo('改行コードは CRLF（\\r\\n）である');
    it.todo('CSV はセクション見出し（# Users / # Channels / # Files など）で区切られている');
    it.todo('ユーザー別セクションの先頭にヘッダー行（user_id,username,message_count）が含まれる');
    it.todo(
      'チャンネル別セクションの先頭にヘッダー行（channel_id,channel_name,message_count）が含まれる',
    );
    it.todo('ファイル容量セクションにヘッダー行（total_bytes,file_count）が含まれる');
    it.todo('対象月（YYYY-MM）が CSV の冒頭メタ情報に含まれている');
  });

  describe('CSV エスケープ（RFC 4180）', () => {
    it.todo('username にカンマを含む場合はダブルクォートで囲まれる');
    it.todo('channel_name にダブルクォートを含む場合は "" にエスケープされる');
    it.todo('username に改行を含む場合はダブルクォートで囲まれる');
  });

  describe('UTF-8 エンコード', () => {
    it.todo('日本語の username / channel_name が UTF-8 で正しくエンコードされる');
  });
});
