export function accountReady() {
  const secret = process.env.SESSION_SECRET || '';
  const databaseUrl = process.env.DATABASE_URL || '';
  return secret.length >= 32 && !secret.startsWith('replace-with-') &&
    /^postgres(?:ql)?:\/\//.test(databaseUrl);
}
