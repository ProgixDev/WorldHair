export interface MailTransportEnv {
  MAIL_TRANSPORT: 'json' | 'smtp';
  MAIL_HOST?: string;
  MAIL_PORT?: number;
  MAIL_SECURE?: boolean;
  MAIL_USER?: string;
  MAIL_PASSWORD?: string;
}

export type MailTransportOptions =
  | { jsonTransport: true }
  | {
      host: string;
      port: number;
      secure: boolean;
      auth?: { user: string; pass: string };
    };

export function buildMailTransport(env: MailTransportEnv): MailTransportOptions {
  if (env.MAIL_TRANSPORT === 'json') {
    // Renders the message to JSON instead of sending it — dev and test default.
    return { jsonTransport: true };
  }

  if (!env.MAIL_HOST) {
    throw new Error('MAIL_HOST is required when MAIL_TRANSPORT=smtp');
  }

  const base = {
    host: env.MAIL_HOST,
    port: env.MAIL_PORT ?? 587,
    secure: env.MAIL_SECURE ?? false,
  };

  return env.MAIL_USER
    ? { ...base, auth: { user: env.MAIL_USER, pass: env.MAIL_PASSWORD ?? '' } }
    : base;
}
