import { OAuth2Client } from 'google-auth-library';
import { HttpError } from './http.js';

const verifier = new OAuth2Client();

export async function verifyGoogleCredential(credential) {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  if (!clientId) throw new HttpError(503, 'google_not_configured', 'Googleログインの設定がまだ完了していません。');
  if (typeof credential !== 'string' || credential.length > 8192 || !/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(credential))
    throw new HttpError(400, 'bad_google_credential', 'Google認証をやり直してください。');
  try {
    const ticket = await verifier.verifyIdToken({ idToken: credential, audience: clientId });
    if (!ticket.getPayload()?.sub) throw new Error('missing Google subject');
  } catch {
    throw new HttpError(401, 'invalid_google_credential', 'Google認証をやり直してください。');
  }
}
