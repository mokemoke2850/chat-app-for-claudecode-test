/**
 * ログイン/登録後のリダイレクト先を管理するユーティリティ。
 *
 * InviteRedeemPage などが sessionStorage に 'redirect_after_login' を保存し、
 * LoginPage / RegisterPage がログイン成功後にこの関数を呼んでリダイレクト先を決定する。
 */
export function consumeRedirectAfterLogin(): string {
  const path = sessionStorage.getItem('redirect_after_login');
  if (path) {
    sessionStorage.removeItem('redirect_after_login');
    return path;
  }
  return '/';
}
