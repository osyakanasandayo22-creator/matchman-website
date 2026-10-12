import { body, fail, json, method, sameOrigin } from '../lib/http.js';
import { session, verifyCsrf } from '../lib/session.js';
import { claimName, syncName } from '../lib/names.js';

export default async function handler(req, res) {
  try {
    method(req, 'POST');
    sameOrigin(req);
    verifyCsrf(req);
    const account = await session(req, res);
    const row = await claimName(account.playerId, body(req).name);
    let syncPending = Boolean(row.sync_pending);
    if (syncPending) {
      try { await syncName(row, account.token); syncPending = false; }
      catch (error) { console.warn('[matchman web] name sync retry needed:', error?.message); }
    }
    return json(res, syncPending ? 202 : 200, {
      name: row.display_name,
      firstSetAt: row.first_set_at,
      nextChangeAt: row.next_change_at,
      changes: row.changes,
      syncPending,
      message: syncPending ? '名前を確保しました。ゲームへの反映を再試行しています。' : '名前を更新しました。'
    });
  } catch (error) { return fail(res, error); }
}
