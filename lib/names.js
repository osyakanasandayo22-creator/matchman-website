import { neon } from '@neondatabase/serverless';
import { HttpError } from './http.js';
import { setSaveItem } from './unity.js';

const COOLDOWN_DAYS = 14;

function database() {
  if (!process.env.DATABASE_URL)
    throw new HttpError(503, 'database_not_configured', '名前変更サービスの設定がまだ完了していません。');
  return neon(process.env.DATABASE_URL);
}

export function validateName(input) {
  if (typeof input !== 'string') throw new HttpError(400, 'invalid_name', '名前を入力してください。');
  const name = input.normalize('NFKC').trim();
  const length = Array.from(name).length;
  const edge = '[A-Za-z0-9\\p{Script=Han}\\p{Script=Hiragana}\\p{Script=Katakana}ー]';
  const body = '[A-Za-z0-9_\\p{Script=Han}\\p{Script=Hiragana}\\p{Script=Katakana}ー]';
  if (length < 3 || length > 16 || !(new RegExp(`^${edge}${body}*${edge}$`, 'u')).test(name))
    throw new HttpError(400, 'invalid_name', '3～16文字の日本語・英字・数字・アンダースコアを使用してください。');
  if (/^(admin|administrator|moderator|matchman|official|support|運営|公式|管理者)$/iu.test(name))
    throw new HttpError(400, 'reserved_name', 'この名前は使用できません。');
  return { name, key: name.toLowerCase() };
}

export async function findName(playerId) {
  if (!process.env.DATABASE_URL) return null;
  const sql = database();
  const rows = await sql`SELECT player_id, display_name, name_key, first_set_at, last_changed_at,
      next_change_at, changes, sync_pending FROM player_names WHERE player_id = ${playerId}`;
  return rows[0] || null;
}

export async function claimName(playerId, input) {
  const { name, key } = validateName(input);
  const sql = database();
  const prior = await findName(playerId);
  if (prior?.name_key === key) return prior;
  let rows;
  try {
    rows = await sql`INSERT INTO player_names
      (player_id, display_name, name_key, first_set_at, next_change_at, changes, sync_pending)
      VALUES (${playerId}, ${name}, ${key}, now(), now() + interval '14 days', 0, true)
      ON CONFLICT (player_id) DO UPDATE SET
        display_name = EXCLUDED.display_name,
        name_key = EXCLUDED.name_key,
        last_changed_at = now(),
        next_change_at = now() + interval '14 days',
        changes = player_names.changes + 1,
        sync_pending = true
      WHERE player_names.next_change_at <= now()
        AND player_names.name_key <> EXCLUDED.name_key
      RETURNING player_id, display_name, name_key, first_set_at, last_changed_at,
        next_change_at, changes, sync_pending`;
  } catch (error) {
    if (error?.code === '23505')
      throw new HttpError(409, 'name_taken', 'その名前は既に使用されています。');
    throw error;
  }
  if (rows.length) return rows[0];
  const current = await findName(playerId);
  if (current?.name_key === key) return current;
  throw new HttpError(429, 'name_cooldown', '14日後に再変更できます。');
}

export async function syncName(row, token) {
  if (!row) return false;
  const name = row.display_name;
  const meta = {
    name,
    firstSetAt: row.first_set_at,
    lastChangedAt: row.last_changed_at,
    nextChangeAt: row.next_change_at,
    changes: row.changes
  };
  await setSaveItem(token, row.player_id, 'mc_name_meta', JSON.stringify(meta));
  await setSaveItem(token, row.player_id, 'mc_public_name', name, 'public');
  const sql = database();
  await sql`UPDATE player_names SET sync_pending = false
    WHERE player_id = ${row.player_id} AND name_key = ${row.name_key}`;
  return true;
}

export { COOLDOWN_DAYS };
