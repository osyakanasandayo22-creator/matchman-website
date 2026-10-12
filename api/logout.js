import { fail, json, method, sameOrigin } from '../lib/http.js';
import { clearSession, verifyCsrf } from '../lib/session.js';

export default async function handler(req, res) {
  try {
    method(req, 'POST');
    sameOrigin(req);
    verifyCsrf(req);
    clearSession(req, res);
    return json(res, 200, { ok: true });
  } catch (error) { return fail(res, error); }
}
