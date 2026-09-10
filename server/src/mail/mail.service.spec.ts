import { ConfigService } from '@nestjs/config';
import { Logger } from '@nestjs/common';
import { EnvironmentVariables } from '../config/env.validation';
import { MailService } from './mail.service';

/**
 * Covers the two HTTPS transports and the guard rails around them. `resend`
 * is the production one — Render blocks outbound SMTP, so a regression here
 * silently stops every account-decision email rather than failing loudly.
 */

type Env = Partial<EnvironmentVariables>;

function configFor(env: Env): ConfigService<EnvironmentVariables, true> {
  const values: Env = {
    MAIL_TRANSPORT: 'json',
    MAIL_FROM: 'WorldHair <no-reply@worldhair.app>',
    MAIL_HOST: '',
    MAIL_RELAY_URL: '',
    MAIL_RELAY_SECRET: '',
    RESEND_API_KEY: '',
    VERIFY_TOKEN_TTL_HOURS: 24,
    RESET_TOKEN_TTL_MINUTES: 60,
    ...env,
  };

  return {
    get: (key: keyof EnvironmentVariables) => values[key],
  } as unknown as ConfigService<EnvironmentVariables, true>;
}

describe('MailService', () => {
  const fetchMock = jest.fn();

  beforeEach(() => {
    fetchMock.mockReset();
    global.fetch = fetchMock as unknown as typeof fetch;
    // send() deliberately swallows failures; keep the expected error logs out
    // of the test output so a real unexpected one still stands out.
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('resend transport', () => {
    const env: Env = { MAIL_TRANSPORT: 'resend', RESEND_API_KEY: 're_test_key' };

    it('refuses to start without an API key', () => {
      expect(() => new MailService(configFor({ MAIL_TRANSPORT: 'resend' }))).toThrow(
        'RESEND_API_KEY is required when MAIL_TRANSPORT=resend',
      );
    });

    it('POSTs to the Resend API with a bearer token and an array recipient', async () => {
      fetchMock.mockResolvedValue({ ok: true, status: 200 });

      const service = new MailService(configFor(env));
      await service.sendCoiffeurApplicationDecidedEmail('sofia@example.com', 'validated');

      expect(fetchMock).toHaveBeenCalledTimes(1);
      const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];

      expect(url).toBe('https://api.resend.com/emails');
      expect(init.method).toBe('POST');
      expect((init.headers as Record<string, string>).Authorization).toBe('Bearer re_test_key');

      const body = JSON.parse(init.body as string) as Record<string, unknown>;
      expect(body.from).toBe('WorldHair <no-reply@worldhair.app>');
      // Resend's schema takes an array even for one recipient.
      expect(body.to).toEqual(['sofia@example.com']);
      expect(body.subject).toBe('Votre compte coiffeur a été validé');
      expect(body).toHaveProperty('html');
      expect(body).toHaveProperty('text');
    });

    it('carries the rejection reason into the sent mail', async () => {
      fetchMock.mockResolvedValue({ ok: true, status: 200 });

      const service = new MailService(configFor(env));
      await service.sendCoiffeurApplicationDecidedEmail(
        'sofia@example.com',
        'rejected',
        'Diplôme illisible.',
      );

      const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
      const body = JSON.parse(init.body as string) as { text: string };
      expect(body.text).toContain('Diplôme illisible.');
    });

    it('never lets a Resend failure escape into the caller', async () => {
      fetchMock.mockResolvedValue({
        ok: false,
        status: 422,
        text: () => Promise.resolve('{"message":"domain is not verified"}'),
      });

      const service = new MailService(configFor(env));

      await expect(
        service.sendCoiffeurApplicationDecidedEmail('sofia@example.com', 'validated'),
      ).resolves.toBeUndefined();
    });

    it('swallows a network error too', async () => {
      fetchMock.mockRejectedValue(new Error('ECONNRESET'));

      const service = new MailService(configFor(env));

      await expect(
        service.sendCoiffeurApplicationDecidedEmail('sofia@example.com', 'validated'),
      ).resolves.toBeUndefined();
    });
  });

  describe('relay transport', () => {
    it('refuses to start without a URL and a secret', () => {
      expect(() => new MailService(configFor({ MAIL_TRANSPORT: 'relay' }))).toThrow(
        'MAIL_RELAY_URL and MAIL_RELAY_SECRET are required when MAIL_TRANSPORT=relay',
      );
    });

    it('POSTs to the relay with the shared secret header', async () => {
      fetchMock.mockResolvedValue({ ok: true, status: 200 });

      const service = new MailService(
        configFor({
          MAIL_TRANSPORT: 'relay',
          MAIL_RELAY_URL: 'https://example.com/api/mail',
          MAIL_RELAY_SECRET: 'shared',
        }),
      );
      await service.sendCoiffeurApplicationDecidedEmail('sofia@example.com', 'validated');

      const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
      expect(url).toBe('https://example.com/api/mail');
      expect((init.headers as Record<string, string>)['x-mail-relay-secret']).toBe('shared');
      // The relay endpoint speaks nodemailer, which takes a plain string.
      expect(JSON.parse(init.body as string)).toMatchObject({ to: 'sofia@example.com' });
    });
  });

  describe('json transport', () => {
    it('sends nothing over the network', async () => {
      const service = new MailService(configFor({ MAIL_TRANSPORT: 'json' }));
      await service.sendCoiffeurApplicationDecidedEmail('sofia@example.com', 'validated');

      expect(fetchMock).not.toHaveBeenCalled();
    });
  });
});
