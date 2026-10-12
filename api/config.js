import { fail, json, method } from '../lib/http.js';

export default function handler(req, res) {
  try {
    method(req, 'GET');
    return json(res, 200, { googleClientId: process.env.GOOGLE_CLIENT_ID || null });
  } catch (error) { return fail(res, error); }
}
