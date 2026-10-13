import { pbkdf2Sync } from 'node:crypto';

// Unity Authentication requires all four character classes. The site accepts
// long passphrases and derives a provider-compatible credential server-side.
// Keep this version stable: changing it would lock out existing accounts.
export function unityPassword(username, password) {
  const salt = `matchman:password:v1:${username.toLowerCase()}`;
  const derived = pbkdf2Sync(password, salt, 210_000, 32, 'sha256').toString('base64url');
  return `Mm9!${derived.slice(0, 26)}`;
}

export function legacyUnityPassword(password) {
  return password.length <= 30 && /[a-z]/.test(password) && /[A-Z]/.test(password) &&
    /\d/.test(password) && /[^A-Za-z0-9]/.test(password);
}
