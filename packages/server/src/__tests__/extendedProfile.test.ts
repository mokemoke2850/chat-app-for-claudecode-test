/**
 * テスト対象: 拡張プロフィール項目（#305）サーバサイド
 *
 * 戦略:
 *   - users テーブルに追加されるカラム（bio / job_title / department / timezone /
 *     github_url / sns_url）が正しく永続化・取得されることを検証する
 *   - PATCH /api/auth/profile が拡張フィールドの更新を受け付けることを検証する
 *   - GET /api/auth/me および GET /api/auth/users が拡張フィールドを含めて返却することを検証する
 *   - 各フィールドのバリデーション（URL 形式・タイムゾーン形式・任意項目）を検証する
 *   - authService.toUser がスネークケース DB カラムをキャメルケース User 型に変換することを検証する
 *   - 任意項目のため null / 未送信を許容することを検証する
 */

import { describe, it } from '@jest/globals';

describe('拡張プロフィール項目 サーバサイド（#305）', () => {
  describe('DB スキーマ', () => {
    it.todo('users.bio カラムが nullable な text として存在する');
    it.todo('users.job_title カラムが nullable な text として存在する');
    it.todo('users.department カラムが nullable な text として存在する');
    it.todo('users.timezone カラムが nullable な text として存在する');
    it.todo('users.github_url カラムが nullable な text として存在する');
    it.todo('users.sns_url カラムが nullable な text として存在する');
    it.todo('既存ユーザーは追加カラムが NULL のまま動作する（後方互換）');
  });

  describe('authService.toUser: User 型変換', () => {
    it.todo('row.bio が user.bio にキャメルケースで変換される');
    it.todo('row.job_title が user.jobTitle に変換される');
    it.todo('row.department が user.department に変換される');
    it.todo('row.timezone が user.timezone に変換される');
    it.todo('row.github_url が user.githubUrl に変換される');
    it.todo('row.sns_url が user.snsUrl に変換される');
    it.todo('全ての拡張フィールドが null の場合も User オブジェクトを返す');
  });

  describe('authService.updateProfile', () => {
    it.todo('bio を更新できる');
    it.todo('jobTitle を更新できる');
    it.todo('department を更新できる');
    it.todo('timezone を更新できる');
    it.todo('githubUrl を更新できる');
    it.todo('snsUrl を更新できる');
    it.todo('複数フィールドを同時に更新できる');
    it.todo('null を渡すと既存値をクリアできる');
    it.todo('該当キーを送信しない場合は既存値が保持される（部分更新）');
    it.todo('updated_at が更新される');
  });

  describe('PATCH /api/auth/profile', () => {
    it.todo('認証済みユーザーが拡張フィールドを更新できる');
    it.todo('レスポンスに拡張フィールドを含む user オブジェクトが返る');
    it.todo('拡張フィールドを送信しない場合は既存値が保持される');
    it.todo('未認証では 401 を返す');
    it.todo('空文字は null として扱われる（または空文字のまま保存される）');
  });

  describe('PATCH /api/auth/profile: バリデーション', () => {
    describe('githubUrl', () => {
      it.todo('http/https 以外のスキームは 400 を返す');
      it.todo('URL 形式不正は 400 を返す');
      it.todo('正しい https URL は 200 で受理される');
      it.todo('null は受理される（クリア）');
      it.todo('未送信は受理される（部分更新）');
    });

    describe('snsUrl', () => {
      it.todo('http/https 以外のスキームは 400 を返す');
      it.todo('URL 形式不正は 400 を返す');
      it.todo('正しい URL は 200 で受理される');
      it.todo('null は受理される（クリア）');
    });

    describe('timezone', () => {
      it.todo('IANA 形式以外（"JST" などの略称）は 400 を返す');
      it.todo('未知のタイムゾーン名は 400 を返す');
      it.todo('IANA 形式（"Asia/Tokyo" / "UTC" / "America/Los_Angeles"）は 200 で受理される');
      it.todo('null は受理される（クリア）');
    });

    describe('bio', () => {
      it.todo('上限文字数を超える bio は 400 を返す');
      it.todo('上限以内の bio は 200 で受理される');
      it.todo('null / 空文字 は受理される');
    });

    describe('jobTitle / department', () => {
      it.todo('上限文字数を超える場合は 400 を返す');
      it.todo('上限以内は 200 で受理される');
      it.todo('null / 空文字 は受理される');
    });
  });

  describe('GET /api/auth/me', () => {
    it.todo(
      'レスポンスに拡張フィールド（bio/jobTitle/department/timezone/githubUrl/snsUrl）が含まれる',
    );
    it.todo('未設定のフィールドは null として返る');
    it.todo('登録直後（拡張フィールド未設定）でも 200 を返す');
  });

  describe('GET /api/auth/users', () => {
    it.todo('全ユーザーのレスポンスに拡張フィールドが含まれる');
    it.todo('チャネルメンバー絞り込み時も拡張フィールドが含まれる');
    it.todo('他ユーザーのプロフィールカード表示用に github_url / sns_url が返る');
  });

  describe('Swagger / OpenAPI 定義', () => {
    it.todo(
      'User スキーマに bio / jobTitle / department / timezone / githubUrl / snsUrl が記載される',
    );
    it.todo('PATCH /profile のリクエストボディに拡張フィールドが定義される');
  });
});
