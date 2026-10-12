import { createHash, createCipheriv, createDecipheriv, randomBytes, timingSafeEqual } from 'node:crypto';
import { HttpError } from './http.js';
import { refreshSession } from './unity.js';

const COOKIE = 'mm_session';
const CSRF = 'mm_csrf';
const THIRTY_DAYS = 60 * 60 * 24 * 30;

function secretKey() {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 32 || secret.startsWith('replace-with-'))
    throw new HttpError(503, 'site_not_configured', 'サイトの認証設定がまだ完了していません。');
  return createHash('sha256').update(secret).digest();
}

function cookies(req) {
  return Object.fromEntries((req.headers.cookie || '').split(';').map(part => {
    const index = part.indexOf('=');
    return index < 0 ? ['', ''] : [part.slice(0, index).trim(), part.slice(index + 1).trim()];
  }));
}

function encrypt(data) {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', secretKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(JSON.stringify(data)), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), ciphertext]).toString('base64url');
}

function decrypt(value) {
  const data = Buffer.from(value, 'base64url');
  if (data.length < 29) throw new Error('short cookie');
  const decipher = createDecipheriv('aes-256-gcm', secretKey(), data.subarray(0, 12));
  decipher.setAuthTag(data.subarray(12, 28));
  return JSON.parse(Buffer.concat([decipher.update(data.subarray(28)), decipher.final()]).toString());
}

function cookieOptions(req) {
  const secure = process.env.NODE_ENV === 'production' || req.headers['x-forwarded-proto'] === 'https';
  return `Path=/; SameSite=Strict${secure ? '; Secure' : ''}`;
}

export function clearSession(req, res) {
  const opts = cookieOptions(req);
  res.setHeader('Set-Cookie', [
    `${COOKIE}=; ${opts}; HttpOnly; Max-Age=0`,
    `${CSRF}=; ${opts}; Max-Age=0`
  ]);
}

export function setSession(req, res, unity) {
  const playerId = unity.userId || unity.user?.id;
  if (!playerId || !unity.idToken || !unity.sessionToken)
    throw new HttpError(502, 'bad_auth_response', '認証結果を確認できませんでした。');
  const csrf = randomBytes(24).toString('base64url');
  const payload = {
    playerId,
    idToken: unity.idToken,
    sessionToken: unity.sessionToken,
    expiresAt: Date.now() + Math.min(Number(unity.expiresIn || 3600), 3600) * 1000 - 120000
  };
  const opts = cookieOptions(req);
  res.setHeader('Set-Cookie', [
    `${COOKIE}=${encrypt(payload)}; ${opts}; HttpOnly; Max-Age=${THIRTY_DAYS}`,
    `${CSRF}=${csrf}; ${opts}; Max-Age=${THIRTY_DAYS}`
  ]);
  return { playerId, csrf };
}

export async function session(req, res) {
  const value = cookies(req)[COOKIE];
  if (!value) throw new HttpError(401, 'not_signed_in', 'ログインしてください。');
  let data;
  try { data = decrypt(value); }
  catch { throw new HttpError(401, 'invalid_session', 'ログインし直してください。'); }
  if (!data.playerId || !data.sessionToken)
    throw new HttpError(401, 'invalid_session', 'ログインし直してください。');
  if (Date.now() >= data.expiresAt) {
    const fresh = await refreshSession(data.sessionToken);
    if ((fresh.userId || fresh.user?.id) !== data.playerId)
      throw new HttpError(401, 'invalid_session', 'ログインし直してください。');
    const renewed = setSession(req, res, fresh);
    return { playerId: renewed.playerId, token: fresh.idToken, csrf: renewed.csrf };
  }
  return { playerId: data.playerId, token: data.idToken, csrf: cookies(req)[CSRF] };
}

export function verifyCsrf(req) {
  const expected = cookies(req)[CSRF] || '';
  const actual = String(req.headers['x-csrf-token'] || '');
  const a = Buffer.from(expected);
  const b = Buffer.from(actual);
  if (!expected || a.length !== b.length || !timingSafeEqual(a, b))
    throw new HttpError(403, 'csrf', 'ページを再読み込みしてから再試行してください。');
}
