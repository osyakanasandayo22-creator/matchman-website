import { body, fail, json, method, sameOrigin, HttpError } from '../lib/http.js';
import { signIn } from '../lib/unity.js';
import { setSession } from '../lib/session.js';
import { accountReady } from '../lib/config.js';
import { unityPassword, legacyUnityPassword } from '../lib/password.js';

export default async function handler(req, res) {
  try {
    method(req, 'POST');
    sameOrigin(req);
    if (!accountReady())
      throw new HttpError(503, 'site_not_configured', 'アカウント機能の公開設定がまだ完了していません。');
    const { action, username, password } = body(req);
    if (action !== 'login' && action !== 'signup')
      throw new HttpError(400, 'bad_action', '操作を選択してください。');
    if (typeof username !== 'string' || !/^[a-zA-Z0-9.@_-]{3,20}$/.test(username))
      throw new HttpError(400, 'bad_username', 'ログインIDは3～20文字の英数字と . - @ _ を使用してください。');
    if (typeof password !== 'string' || password.length < 8 || password.length > 64)
      throw new HttpError(400, 'bad_password', 'パスワードは8～64文字で入力してください。');
    if (action === 'signup' && password.length < 12)
      throw new HttpError(400, 'weak_password', '新しいパスワードは12文字以上にしてください。記号は不要です。');
    const providerPassword = unityPassword(username, password);
    let unity;
    if (action === 'signup') {
      unity = await signIn(username, providerPassword, action);
    } else {
      try {
        unity = await signIn(username, providerPassword, action);
      } catch (error) {
        // Existing accounts created in the game used their password directly.
        if (!legacyUnityPassword(password) || (error?.status !== 400 && error?.status !== 401)) throw error;
        unity = await signIn(username, password, action);
      }
    }
    const account = setSession(req, res, unity);
    return json(res, 200, { ok: true, playerId: account.playerId, csrf: account.csrf });
  } catch (error) { return fail(res, error); }
}
