import { fail, json, method } from '../lib/http.js';
import { accountReady } from '../lib/config.js';

export default function handler(req, res) {
  try {
    method(req, 'GET');
    const ready = accountReady();
    return json(res, 200, {
      accountReady: ready,
      googleClientId: ready ? process.env.GOOGLE_CLIENT_ID || null : null
    });
  } catch (error) { return fail(res, error); }
}
