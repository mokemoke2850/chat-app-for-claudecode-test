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

import { describe, it } from 'vitest';

describe('拡張プロフィール項目（#305）', () => {
  describe('ProfilePage: プロフィール編集フォーム', () => {
    describe('自己紹介フィールド', () => {
      it.todo('自己紹介テキストエリアが表示される');
      it.todo('user.bio の値が初期表示される');
      it.todo('自己紹介を入力して保存できる');
      it.todo('複数行の入力（改行）を保持できる');
      it.todo('空文字のまま保存しても成功する（任意項目）');
    });

    describe('役職フィールド', () => {
      it.todo('役職入力欄が表示される');
      it.todo('user.jobTitle の値が初期表示される');
      it.todo('役職を入力して保存できる');
      it.todo('空のまま保存しても成功する（任意項目）');
    });

    describe('部署フィールド', () => {
      it.todo('部署入力欄が表示される');
      it.todo('user.department の値が初期表示される');
      it.todo('部署を入力して保存できる');
      it.todo('空のまま保存しても成功する（任意項目）');
    });

    describe('タイムゾーン選択 UI', () => {
      it.todo('タイムゾーン選択プルダウンが表示される');
      it.todo(
        'IANA 形式のタイムゾーン候補（Asia/Tokyo, UTC, America/Los_Angeles 等）が選択肢に並ぶ',
      );
      it.todo('user.timezone の値で初期選択される');
      it.todo('プルダウンから別のタイムゾーンを選択して保存できる');
      it.todo('未設定時はデフォルト（未選択）の状態で表示される');
    });

    describe('GitHub URL フィールド', () => {
      it.todo('GitHub URL 入力欄が表示される');
      it.todo('user.githubUrl の値が初期表示される');
      it.todo('https://github.com/... の URL を入力して保存できる');
      it.todo('空のまま保存しても成功する（任意項目）');
    });

    describe('SNS URL フィールド', () => {
      it.todo('SNS URL 入力欄が表示される');
      it.todo('user.snsUrl の値が初期表示される');
      it.todo('SNS URL を入力して保存できる');
      it.todo('空のまま保存しても成功する（任意項目）');
    });
  });

  describe('ProfilePage: バリデーション', () => {
    describe('GitHub URL のバリデーション', () => {
      it.todo('http(s) スキーム以外は保存時にエラーとなる');
      it.todo('URL 形式不正（スペース混入など）はエラーとなる');
      it.todo('https://github.com/<user> 形式は許容される');
      it.todo('空文字はエラーにならず保存できる');
    });

    describe('SNS URL のバリデーション', () => {
      it.todo('http(s) スキーム以外は保存時にエラーとなる');
      it.todo('URL 形式不正はエラーとなる');
      it.todo('正しい URL は許容される');
      it.todo('空文字はエラーにならず保存できる');
    });

    describe('タイムゾーンのバリデーション', () => {
      it.todo('IANA 形式以外（"JST" などの略称）はエラーとなる');
      it.todo('未知のタイムゾーン文字列はエラーとなる');
      it.todo('IANA 形式（"Asia/Tokyo" 等）は許容される');
      it.todo('未設定（null/空）は許容される');
    });

    describe('自己紹介の文字数制限', () => {
      it.todo('上限文字数を超える入力はエラーまたは切り詰めとなる');
      it.todo('上限以内の入力は許容される');
    });
  });

  describe('ProfilePage: API 連携', () => {
    it.todo('保存ボタン押下で api.auth.updateProfile が拡張フィールドを含めて呼ばれる');
    it.todo('updateProfile の応答で AuthContext のユーザーが更新される');
    it.todo('保存成功時に成功スナックバーが表示される');
    it.todo('保存失敗時にエラーが表示される');
    it.todo('初期表示時に user オブジェクトから拡張フィールドが復元される');
  });

  describe('UserProfilePopover: 他ユーザーの拡張プロフィール表示', () => {
    it.todo('自己紹介（bio）が表示される');
    it.todo('役職（jobTitle）が表示される');
    it.todo('部署（department）が表示される');
    it.todo('タイムゾーンが表示される');
    it.todo('GitHub URL がリンクとして表示される');
    it.todo('SNS URL がリンクとして表示される');
    it.todo('拡張フィールドが全て null/空の場合はそれらの行が表示されない');
    it.todo('一部のみ設定されている場合は設定された項目だけが表示される');
  });

  describe('UserProfilePopover: 外部リンクのクリック挙動', () => {
    it.todo('GitHub URL リンクは target="_blank" を持つ');
    it.todo('GitHub URL リンクは rel="noopener noreferrer" を持つ');
    it.todo('SNS URL リンクは target="_blank" を持つ');
    it.todo('SNS URL リンクは rel="noopener noreferrer" を持つ');
    it.todo(
      'リンククリックで window.open が呼ばれる（または anchor のデフォルト挙動が阻害されない）',
    );
    it.todo('GitHub URL が空の場合はリンクが描画されない');
    it.todo('SNS URL が空の場合はリンクが描画されない');
  });

  describe('UserProfilePopover: タイムゾーン表示', () => {
    it.todo('user.timezone がそのまま（または整形して）表示される');
    it.todo('timezone が null の場合は表示されない');
  });
});
