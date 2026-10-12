export class HttpError extends Error {
  constructor(status, code, message) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export function json(res, status, data) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(data));
}

export function fail(res, error) {
  if (error instanceof HttpError) return json(res, error.status, { error: error.code, message: error.message });
  console.error('[matchman web]', error?.message || 'unexpected error');
  return json(res, 500, { error: 'server_error', message: '処理を完了できませんでした。少し待ってから再試行してください。' });
}

export function method(req, expected) {
  if (req.method !== expected) throw new HttpError(405, 'method_not_allowed', 'この操作は利用できません。');
}

export function sameOrigin(req) {
  const origin = req.headers.origin;
  const host = String(req.headers['x-forwarded-host'] || req.headers.host || '').split(',')[0].trim();
  try {
    if (origin && new URL(origin).host === host) return;
  } catch { /* rejected below */ }
  throw new HttpError(403, 'bad_origin', 'ページを再読み込みしてからお試しください。');
}

export function body(req) {
  let raw;
  try { raw = typeof req.body === 'string' ? JSON.parse(req.body) : req.body; }
  catch { throw new HttpError(400, 'bad_json', '入力内容を確認してください。'); }
  if (!raw || typeof raw !== 'object' || Array.isArray(raw))
    throw new HttpError(400, 'bad_request', '入力内容を確認してください。');
  return raw;
}
