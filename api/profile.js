import { fail, json, method } from '../lib/http.js';
import { session } from '../lib/session.js';
import { getPlayer, getSaveItem, itemValue } from '../lib/unity.js';
import { findName, syncName } from '../lib/names.js';

const TIERS = ['E', 'D', 'C', 'B', 'A', 'S'];
const FLOORS = [0, 500, 2000, 4500, 7000, 10000];

export default async function handler(req, res) {
  try {
    method(req, 'GET');
    const account = await session(req, res);
    const [row, profileItem, metaItem, player] = await Promise.all([
      findName(account.playerId),
      getSaveItem(account.token, account.playerId, 'mc_profile'),
      getSaveItem(account.token, account.playerId, 'mc_name_meta'),
      getPlayer(account.token, account.playerId).catch(() => null)
    ]);
    let syncPending = Boolean(row?.sync_pending);
    if (syncPending) {
      try { await syncName(row, account.token); syncPending = false; }
      catch (error) { console.warn('[matchman web] pending name sync:', error?.message); }
    }
    const profile = itemValue(profileItem) || {};
    const meta = itemValue(metaItem) || {};
    const tierPoints = Math.max(0, Number(profile.tierPts || 0));
    let tier = 0;
    for (let i = 0; i < FLOORS.length; i++) if (tierPoints >= FLOORS[i]) tier = i;
    const exp = Math.max(0, Number(profile.exp || 0));
    return json(res, 200, {
      playerId: account.playerId,
      displayName: row?.display_name || meta.name || profile.name || null,
      firstSet: Boolean(row),
      nextChangeAt: row?.next_change_at || null,
      changes: row?.changes || 0,
      syncPending,
      nameServiceReady: Boolean(process.env.DATABASE_URL),
      level: 1 + Math.floor(exp / 400),
      tier: TIERS[tier],
      tierPoints,
      diamonds: Math.max(0, Number(profile.dia || 0)),
      googleLinked: player ? Boolean(player.externalIds?.some(id => id.providerId === 'google.com')) : null,
      csrf: account.csrf
    });
  } catch (error) { return fail(res, error); }
}
