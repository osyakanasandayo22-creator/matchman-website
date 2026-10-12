import { body, fail, json, method, sameOrigin, HttpError } from '../lib/http.js';
import { verifyGoogleCredential } from '../lib/google.js';
import { session, setSession, verifyCsrf } from '../lib/session.js';
import { linkGoogle, signInGoogle } from '../lib/unity.js';

export default async function handler(req, res) {
  try {
    method(req, 'POST');
    sameOrigin(req);
    const { mode, credential } = body(req);
    if (mode !== 'signin' && mode !== 'link')
      throw new HttpError(400, 'bad_action', '操作を選択してください。');
    const account = mode === 'link' ? (verifyCsrf(req), await session(req, res)) : null;
    await verifyGoogleCredential(credential);
    if (mode === 'link') {
      const result = await linkGoogle(account.token, credential);
      if (result?.userId && result.userId !== account.playerId)
        throw new HttpError(502, 'wrong_player', '連携先のアカウントを確認できませんでした。');
      return json(res, 200, { ok: true, playerId: account.playerId });
    }
    const unity = await signInGoogle(credential);
    const signedIn = setSession(req, res, unity);
    return json(res, 200, { ok: true, playerId: signedIn.playerId });
  } catch (error) { return fail(res, error); }
}
