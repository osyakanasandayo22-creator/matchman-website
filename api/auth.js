import { body, fail, json, method, sameOrigin, HttpError } from '../lib/http.js';
import { signIn } from '../lib/unity.js';
import { setSession } from '../lib/session.js';
import { accountReady } from '../lib/config.js';

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
    if (typeof password !== 'string' || password.length < 8 || password.length > 30)
      throw new HttpError(400, 'bad_password', 'パスワードは8～30文字で入力してください。');
    if (action === 'signup' && !/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^a-zA-Z\d]).{8,30}/.test(password))
      throw new HttpError(400, 'weak_password', '大文字・小文字・数字・記号をそれぞれ含めてください。');
    const unity = await signIn(username, password, action);
    const account = setSession(req, res, unity);
    return json(res, 200, { ok: true, playerId: account.playerId, csrf: account.csrf });
  } catch (error) { return fail(res, error); }
}
