import { createHmac } from 'node:crypto';
import { verifyTelegramWebAppInitData } from './telegram-web-app-init-data';

function buildSignedInitData(
  botToken: string,
  fields: { user: string; auth_date: string; query_id?: string },
): string {
  const params = new URLSearchParams(fields);
  const dataCheckString = [...params.keys()]
    .sort((a, b) => a.localeCompare(b))
    .map((k) => `${k}=${params.get(k) ?? ''}`)
    .join('\n');
  const secretKey = createHmac('sha256', 'WebAppData').update(botToken).digest();
  const hash = createHmac('sha256', secretKey).update(dataCheckString).digest('hex');
  params.set('hash', hash);
  return params.toString();
}

describe('verifyTelegramWebAppInitData', () => {
  const botToken = '123456:AA_testtokenfortests_only';
  const userJson = JSON.stringify({
    id: 424242,
    first_name: 'Ada',
    last_name: 'Lovelace',
    username: 'adal',
  });
  const authDate = String(Math.floor(Date.now() / 1000));

  it('accepts correctly signed initData', () => {
    const initData = buildSignedInitData(botToken, {
      user: userJson,
      auth_date: authDate,
      query_id: 'q1',
    });
    const r = verifyTelegramWebAppInitData(initData, botToken);
    expect(r).not.toBeNull();
    expect(r!.telegramUserId).toBe(424242);
    expect(r!.displayName).toContain('Ada');
    expect(r!.telegramPhotoUrl).toBeNull();
  });

  it('parses user photo_url when present', () => {
    const userWithPhoto = JSON.stringify({
      id: 424242,
      first_name: 'Ada',
      photo_url: 'https://cdn.example.com/telegram/avatar.jpg',
    });
    const initData = buildSignedInitData(botToken, {
      user: userWithPhoto,
      auth_date: authDate,
    });
    const r = verifyTelegramWebAppInitData(initData, botToken);
    expect(r).not.toBeNull();
    expect(r!.telegramPhotoUrl).toBe('https://cdn.example.com/telegram/avatar.jpg');
  });

  it('rejects wrong bot token', () => {
    const initData = buildSignedInitData(botToken, { user: userJson, auth_date: authDate });
    expect(verifyTelegramWebAppInitData(initData, 'wrong:token')).toBeNull();
  });

  it('rejects tampered payload', () => {
    const initData = buildSignedInitData(botToken, { user: userJson, auth_date: authDate });
    const tampered = initData.replace('424242', '999999');
    expect(verifyTelegramWebAppInitData(tampered, botToken)).toBeNull();
  });

  it('rejects missing hash', () => {
    const p = new URLSearchParams({ user: userJson, auth_date: authDate });
    expect(verifyTelegramWebAppInitData(p.toString(), botToken)).toBeNull();
  });
});
