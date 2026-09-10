import { ConfigService } from '@nestjs/config';
import { UnauthorizedException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { Webhook } from 'standardwebhooks';
import { EnvironmentVariables, NodeEnv } from '../config/env.validation';
import { MailService } from '../mail/mail.service';
import { DevOtpStore } from './dev-otp.store';
import { EmailHookService } from './email-hook.service';
import { EmailHookPayload } from './email-hook.types';

/**
 * `standardwebhooks` handles the crypto — these tests exercise this app's
 * side of it: which secret(s) get tried, which template fires per
 * `email_action_type`, and above all the email-change pairing rule Supabase's
 * own docs call out as easy to get backwards (see resolveEmailChangeRecipients).
 */

const SECRET = 'v1,whsec_MfKQ9r8GKYqrTwjUPD8ILPZIo2LaLaSw';
const OLD_SECRET = 'v1,whsec_9zX5s1QeqLJtHnV2yq0ZbF3wQmC7dR1p';
const SUPABASE_URL = 'https://project-ref.supabase.co';

function sign(secret: string, payload: string): { headers: Record<string, string>; body: Buffer } {
  const key = secret.replace(/^v1,/, '');
  const wh = new Webhook(key);
  const msgId = `msg_${randomUUID()}`;
  const timestamp = new Date();
  return {
    headers: {
      'webhook-id': msgId,
      'webhook-timestamp': String(Math.floor(timestamp.getTime() / 1000)),
      'webhook-signature': wh.sign(msgId, timestamp, payload),
    },
    body: Buffer.from(payload),
  };
}

function baseUser(overrides: Partial<EmailHookPayload['user']> = {}): EmailHookPayload['user'] {
  return { id: 'user-1', email: 'sofia@example.com', ...overrides };
}

function baseData(overrides: Partial<EmailHookPayload['email_data']> = {}): EmailHookPayload['email_data'] {
  return {
    token: '305805',
    token_hash: 'hash-primary',
    redirect_to: 'https://worldhair.app/',
    email_action_type: 'signup',
    site_url: 'https://worldhair.app',
    token_new: '',
    token_hash_new: '',
    ...overrides,
  };
}

describe('EmailHookService', () => {
  let mail: { sendVerificationEmail: jest.Mock; sendRendered: jest.Mock };
  let devOtp: DevOtpStore;
  let service: EmailHookService;

  function configFor(
    secretEnv: string,
    nodeEnv: NodeEnv = NodeEnv.Development,
  ): ConfigService<EnvironmentVariables, true> {
    const values: Record<string, unknown> = {
      SEND_EMAIL_HOOK_SECRET: secretEnv,
      SUPABASE_URL,
      NODE_ENV: nodeEnv,
    };
    return { get: (key: string) => values[key] } as unknown as ConfigService<EnvironmentVariables, true>;
  }

  beforeEach(() => {
    mail = { sendVerificationEmail: jest.fn(), sendRendered: jest.fn() };
    devOtp = new DevOtpStore(configFor(SECRET));
    service = new EmailHookService(configFor(SECRET), mail as unknown as MailService, devOtp);
  });

  describe('verifyAndParse', () => {
    it('accepts a validly-signed payload and returns the parsed body', () => {
      const payload: EmailHookPayload = { user: baseUser(), email_data: baseData() };
      const { headers, body } = sign(SECRET, JSON.stringify(payload));

      const result = service.verifyAndParse(body, headers as never);

      expect(result).toEqual(payload);
    });

    it('rejects a payload signed with the wrong secret', () => {
      const payload: EmailHookPayload = { user: baseUser(), email_data: baseData() };
      const { headers, body } = sign('v1,whsec_wrongwrongwrongwrongwrongwrong', JSON.stringify(payload));

      expect(() => service.verifyAndParse(body, headers as never)).toThrow(UnauthorizedException);
    });

    it('rejects a tampered body even with valid headers', () => {
      const payload: EmailHookPayload = { user: baseUser(), email_data: baseData() };
      const { headers } = sign(SECRET, JSON.stringify(payload));
      const tampered = Buffer.from(JSON.stringify({ ...payload, user: baseUser({ email: 'attacker@evil.com' }) }));

      expect(() => service.verifyAndParse(tampered, headers as never)).toThrow(UnauthorizedException);
    });

    it('refuses to run with no secret configured', () => {
      const unconfigured = new EmailHookService(configFor(''), mail as unknown as MailService, devOtp);
      const payload: EmailHookPayload = { user: baseUser(), email_data: baseData() };
      const { headers, body } = sign(SECRET, JSON.stringify(payload));

      expect(() => unconfigured.verifyAndParse(body, headers as never)).toThrow(UnauthorizedException);
    });

    it('accepts the old secret during rotation (new|old)', () => {
      const rotating = new EmailHookService(
        configFor(`${SECRET}|${OLD_SECRET}`),
        mail as unknown as MailService,
        devOtp,
      );
      const payload: EmailHookPayload = { user: baseUser(), email_data: baseData() };
      const { headers, body } = sign(OLD_SECRET, JSON.stringify(payload));

      expect(() => rotating.verifyAndParse(body, headers as never)).not.toThrow();
    });
  });

  describe('dispatch', () => {
    it('signup: sends the OTP code via the existing verification-email method', async () => {
      await service.dispatch({
        user: baseUser({ email: 'camille@example.com' }),
        email_data: baseData({ email_action_type: 'signup', token: '112233' }),
      });

      expect(mail.sendVerificationEmail).toHaveBeenCalledWith('camille@example.com', '112233');
      expect(mail.sendRendered).not.toHaveBeenCalled();
    });

    it('signup: also stashes the code in DevOtpStore for local testing', async () => {
      await service.dispatch({
        user: baseUser({ email: 'camille@example.com' }),
        email_data: baseData({ email_action_type: 'signup', token: '112233' }),
      });

      expect(devOtp.take('camille@example.com')).toBe('112233');
    });

    it('signup: does NOT stash the code when NODE_ENV=production', async () => {
      const prodDevOtp = new DevOtpStore(configFor(SECRET, NodeEnv.Production));
      const prodService = new EmailHookService(configFor(SECRET, NodeEnv.Production), mail as unknown as MailService, prodDevOtp);

      await prodService.dispatch({
        user: baseUser({ email: 'camille@example.com' }),
        email_data: baseData({ email_action_type: 'signup', token: '112233' }),
      });

      expect(prodDevOtp.take('camille@example.com')).toBeNull();
      // The actual email still goes out in production — only the dev shortcut is disabled.
      expect(mail.sendVerificationEmail).toHaveBeenCalledWith('camille@example.com', '112233');
    });

    it('magiclink: sends a link built from Supabase\'s own verify endpoint', async () => {
      await service.dispatch({
        user: baseUser(),
        email_data: baseData({
          email_action_type: 'magiclink',
          token_hash: 'the-hash',
          redirect_to: 'https://worldhair.app/discover',
        }),
      });

      expect(mail.sendRendered).toHaveBeenCalledTimes(1);
      const [to, mailContent] = mail.sendRendered.mock.calls[0] as [string, { html: string }];
      expect(to).toBe('sofia@example.com');
      expect(mailContent.html).toContain(
        `${SUPABASE_URL}/auth/v1/verify?token=the-hash&type=magiclink&redirect_to=https%3A%2F%2Fworldhair.app%2Fdiscover`,
      );
    });

    it('recovery: sends a password-reset link', async () => {
      await service.dispatch({
        user: baseUser(),
        email_data: baseData({ email_action_type: 'recovery', token_hash: 'reset-hash' }),
      });

      const [, mailContent] = mail.sendRendered.mock.calls[0] as [string, { subject: string }];
      expect(mailContent.subject).toBe('Reset your password');
    });

    it('an unhandled action type (e.g. invite) sends nothing and does not throw', async () => {
      await expect(
        service.dispatch({ user: baseUser(), email_data: baseData({ email_action_type: 'invite' }) }),
      ).resolves.toBeUndefined();

      expect(mail.sendVerificationEmail).not.toHaveBeenCalled();
      expect(mail.sendRendered).not.toHaveBeenCalled();
    });

    describe('email_change', () => {
      it('secure mode (both pairs present): emails BOTH addresses with the pairing Supabase documents', async () => {
        await service.dispatch({
          user: baseUser({ email: 'old@example.com', new_email: 'new@example.com' }),
          email_data: baseData({
            email_action_type: 'email_change',
            token: 'code-for-old',
            token_hash: 'hash-for-new-address',
            token_new: 'code-for-new',
            token_hash_new: 'hash-for-old-address',
          }),
        });

        expect(mail.sendRendered).toHaveBeenCalledTimes(2);
        const calls = mail.sendRendered.mock.calls as [string, { html: string }][];

        // Current address confirms with token_hash_new — NOT token_hash,
        // despite the "_new" suffix. This is the exact trap Supabase's docs
        // warn about; getting this backwards sends the wrong link to the
        // wrong inbox.
        const toOld = calls.find(([to]) => to === 'old@example.com');
        expect(toOld?.[1].html).toContain('token=hash-for-old-address');

        const toNew = calls.find(([to]) => to === 'new@example.com');
        expect(toNew?.[1].html).toContain('token=hash-for-new-address');
      });

      it('non-secure mode (one pair present): emails only the new address', async () => {
        await service.dispatch({
          user: baseUser({ email: 'old@example.com', new_email: 'new@example.com' }),
          email_data: baseData({
            email_action_type: 'email_change',
            token_hash: 'only-hash',
            token_new: '',
            token_hash_new: '',
          }),
        });

        expect(mail.sendRendered).toHaveBeenCalledTimes(1);
        const [to, mailContent] = mail.sendRendered.mock.calls[0] as [string, { html: string }];
        expect(to).toBe('new@example.com');
        expect(mailContent.html).toContain('token=only-hash');
      });
    });
  });
});
