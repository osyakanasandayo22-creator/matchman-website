import { HttpError } from './http.js';

export const projectId = process.env.UNITY_PROJECT_ID || '759b1c47-af76-43ce-9833-1071e350fd6a';
const environment = process.env.UNITY_ENVIRONMENT || 'production';
const authRoot = 'https://player-auth.services.api.unity.com/v1';
const saveRoot = `https://cloud-save.services.api.unity.com/v1/data/projects/${projectId}`;

async function request(url, { token, method = 'GET', data, allowNotFound = false } = {}) {
  let response;
  try {
    response = await fetch(url, {
      method,
      headers: {
        'ProjectId': projectId,
        'UnityEnvironment': environment,
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(data ? { 'Content-Type': 'application/json' } : {})
      },
      body: data ? JSON.stringify(data) : undefined,
      signal: AbortSignal.timeout(10000)
    });
  } catch {
    throw new HttpError(503, 'unity_unavailable', 'Unityのサービスに接続できませんでした。');
  }
  if (response.status === 404 && allowNotFound) return null;
  if (!response.ok) {
    if (response.status === 429) throw new HttpError(429, 'rate_limited', 'アクセスが集中しています。少し待ってから再試行してください。');
    if (response.status === 401 || response.status === 403)
      throw new HttpError(401, 'invalid_session', '認証に失敗しました。ログインし直してください。');
    if (response.status === 400) throw new HttpError(400, 'unity_rejected', '入力内容を確認してください。');
    if (response.status === 404) throw new HttpError(404, 'unity_not_found', 'アカウントが見つかりませんでした。');
    throw new HttpError(502, 'unity_error', 'Unityのサービスで処理できませんでした。');
  }
  const text = await response.text();
  return text ? JSON.parse(text) : {};
}

export async function signIn(username, password, action) {
  const path = action === 'signup' ? 'sign-up' : 'sign-in';
  return request(`${authRoot}/authentication/usernamepassword/${path}`,
    { method: 'POST', data: { username, password } });
}

export async function refreshSession(sessionToken) {
  return request(`${authRoot}/authentication/session-token`,
    { method: 'POST', data: { sessionToken } });
}

export async function signInGoogle(googleIdToken) {
  // A new Google identity creates a Unity player; linked identities return
  // their existing player instead.
  return request(`${authRoot}/authentication/external-token/google.com`,
    { method: 'POST', data: { token: googleIdToken, signInOnly: false } });
}

export async function getSignInCodeInfo(unityIdToken, code) {
  return request(`${authRoot}/authentication/code-link/info`,
    { token: unityIdToken, method: 'POST', data: { signInCode: code } });
}

export async function confirmSignInCode(unityIdToken, sessionToken, code) {
  return request(`${authRoot}/authentication/code-link/confirm`,
    { token: unityIdToken, method: 'POST', data: { signInCode: code, sessionToken } });
}

export async function linkGoogle(unityIdToken, googleIdToken) {
  return request(`${authRoot}/authentication/link/google.com`,
    { token: unityIdToken, method: 'POST', data: { token: googleIdToken, forceLink: false } });
}

export async function getPlayer(unityIdToken, playerId) {
  return request(`${authRoot}/users/${encodeURIComponent(playerId)}`, { token: unityIdToken });
}

function saveUrl(playerId, key, access = 'default') {
  const type = access === 'public' ? '/public' : '';
  return `${saveRoot}/players/${encodeURIComponent(playerId)}${type}/items${key ? `/${encodeURIComponent(key)}` : ''}`;
}

export async function getSaveItem(token, playerId, key, access) {
  return request(saveUrl(playerId, key, access), { token, allowNotFound: true });
}

export async function setSaveItem(token, playerId, key, value, access) {
  return request(saveUrl(playerId, '', access), { token, method: 'POST', data: { key, value } });
}

export function itemValue(item) {
  if (!item) return null;
  let value = item.value;
  if (typeof value === 'string') {
    try { value = JSON.parse(value); } catch { return value; }
  }
  return value ?? null;
}
