export interface SentMail {
  to: string;
  kind: 'verification' | 'password-reset';
  token: string;
}

/**
 * Replaces MailService in e2e tests. Tokens are only ever delivered by email,
 * so tests read them from here rather than from the database.
 */
export class FakeMailService {
  readonly sent: SentMail[] = [];

  sendVerificationEmail(to: string, token: string): Promise<void> {
    this.sent.push({ to, kind: 'verification', token });
    return Promise.resolve();
  }

  sendPasswordResetEmail(to: string, token: string): Promise<void> {
    this.sent.push({ to, kind: 'password-reset', token });
    return Promise.resolve();
  }

  lastToken(kind: SentMail['kind']): string {
    const match = [...this.sent].reverse().find((mail) => mail.kind === kind);

    if (!match) {
      throw new Error(`No ${kind} email was sent`);
    }
    return match.token;
  }

  reset(): void {
    this.sent.length = 0;
  }
}
