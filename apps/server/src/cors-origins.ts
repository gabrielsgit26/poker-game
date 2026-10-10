const DEFAULT_ORIGINS = ['http://localhost:3000', 'https://web.telegram.org'];

/**
 * Allowed browser origins for REST + Socket.IO, from comma-separated CORS_ORIGIN
 * (e.g. "https://poker-game-web.vercel.app,http://localhost:3000").
 * Entries are trimmed and trailing slashes dropped — an origin never has one, and
 * "https://x.app/" would silently fail to match.
 */
export function corsOrigins(): string[] {
  const list = (process.env.CORS_ORIGIN ?? '')
    .split(',')
    .map((o) => o.trim().replace(/\/+$/, ''))
    .filter(Boolean);
  return list.length > 0 ? list : DEFAULT_ORIGINS;
}
