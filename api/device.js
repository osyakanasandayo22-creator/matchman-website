import { body, fail, json, method, sameOrigin, HttpError } from '../lib/http.js';
import { session, verifyCsrf } from '../lib/session.js';
import { getSignInCodeInfo, confirmSignInCode } from '../lib/unity.js';

export default async function handler(req, res) {
  try {
    method(req, 'POST');
    sameOrigin(req);
    verifyCsrf(req);
    const account = await session(req, res);
    const { action, code } = body(req);
    if (action !== 'info' && action !== 'confirm')
      throw new HttpError(400, 'bad_action', '操作を選択してください。');
    if (typeof code !== 'string' || !/^[A-Za-z0-9-]{4,32}$/.test(code))
      throw new HttpError(400, 'bad_code', 'ゲームに表示されたコードを確認してください。');
    const info = await getSignInCodeInfo(account.token, code);
    if (action === 'info')
      return json(res, 200, { identifier: info.identifier || null, expiration: info.expiration || null });
    await confirmSignInCode(account.token, account.sessionToken, code);
    return json(res, 200, { ok: true });
  } catch (error) { return fail(res, error); }
}
