import { createHmac, timingSafeEqual } from 'node:crypto';

const MAX_AUTH_AGE_SEC = 60 * 60 * 24; // 24h — reject stale initData replays

export type ParsedTelegramWebAppUser = {
  telegramUserId: number;
  displayName: string;
  authDate: number;
};

function buildDataCheckString(params: URLSearchParams): string {
  const keys = [...params.keys()]
    .filter((k) => k !== 'hash')
    .sort((a, b) => a.localeCompare(b));
  return keys.map((k) => `${k}=${params.get(k) ?? ''}`).join('\n');
}

/**
 * Validates Telegram Mini App `Telegram.WebApp.initData` per
 * https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app
 */
export function verifyTelegramWebAppInitData(
  initData: string,
  botToken: string,
): ParsedTelegramWebAppUser | null {
  const trimmed = initData.trim();
  if (!trimmed || !botToken.trim()) return null;

  let params: URLSearchParams;
  try {
    params = new URLSearchParams(trimmed.startsWith('?') ? trimmed.slice(1) : trimmed);
  } catch {
    return null;
  }

  const hashHex = params.get('hash');
  if (!hashHex || !/^[a-f0-9]{64}$/i.test(hashHex)) return null;

  const authDateRaw = params.get('auth_date');
  const authDate = authDateRaw != null ? parseInt(authDateRaw, 10) : NaN;
  if (!Number.isFinite(authDate)) return null;
  const now = Math.floor(Date.now() / 1000);
  if (now - authDate > MAX_AUTH_AGE_SEC || authDate > now + 120) return null;

  const dataCheckString = buildDataCheckString(params);
  const secretKey = createHmac('sha256', 'WebAppData').update(botToken).digest();
  const computed = createHmac('sha256', secretKey).update(dataCheckString).digest();

  let expected: Buffer;
  try {
    expected = Buffer.from(hashHex, 'hex');
  } catch {
    return null;
  }
  if (expected.length !== computed.length || !timingSafeEqual(expected, computed)) {
    return null;
  }

  const userJson = params.get('user');
  if (!userJson) return null;

  let user: { id?: unknown; first_name?: unknown; last_name?: unknown; username?: unknown };
  try {
    user = JSON.parse(userJson) as typeof user;
  } catch {
    return null;
  }

  const id = typeof user.id === 'number' ? user.id : typeof user.id === 'string' ? parseInt(user.id, 10) : NaN;
  if (!Number.isFinite(id) || id <= 0) return null;

  const fn = typeof user.first_name === 'string' ? user.first_name.trim() : '';
  const ln = typeof user.last_name === 'string' ? user.last_name.trim() : '';
  const un = typeof user.username === 'string' ? user.username.trim() : '';
  const display =
    [fn, ln].filter(Boolean).join(' ').trim() ||
    (un ? `@${un}` : '') ||
    `Player ${id}`;

  return {
    telegramUserId: id,
    displayName: display.slice(0, 120),
    authDate,
  };
}
