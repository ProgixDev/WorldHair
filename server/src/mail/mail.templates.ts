export interface RenderedMail {
  subject: string;
  text: string;
  html: string;
}

function codeLayout(title: string, body: string, code: string): string {
  return `<!doctype html>
<html><body style="font-family:system-ui,sans-serif;line-height:1.5;color:#111">
  <h1 style="font-size:20px">${title}</h1>
  ${body}
  <p style="font-size:32px;font-weight:bold;letter-spacing:4px;text-align:center;padding:16px;background:#f1f3f5;border-radius:8px">${code}</p>
</body></html>`;
}

export function verificationMail(code: string, ttlHours: number): RenderedMail {
  return {
    subject: 'Verify your email address',
    text: `Welcome! Your verification code is ${code}. Enter it in the app within ${ttlHours} hours.`,
    html: codeLayout(
      'Welcome',
      `<p>Enter this code in the app to confirm your email address. It expires in ${ttlHours} hours.</p>`,
      code,
    ),
  };
}

export function passwordResetMail(code: string, ttlMinutes: number): RenderedMail {
  return {
    subject: 'Reset your password',
    text: `Your password reset code is ${code}. Enter it in the app within ${ttlMinutes} minutes. If you did not request this, ignore this email.`,
    html: codeLayout(
      'Reset your password',
      `<p>Enter this code in the app to choose a new password. It expires in ${ttlMinutes} minutes. If you did not request a reset, you can ignore this email.</p>`,
      code,
    ),
  };
}

function layout(title: string, body: string): string {
  return `<!doctype html>
<html><body style="font-family:system-ui,sans-serif;line-height:1.5;color:#111">
  <h1 style="font-size:20px">${title}</h1>
  ${body}
</body></html>`;
}

function linkLayout(title: string, body: string, url: string, buttonLabel: string): string {
  return `<!doctype html>
<html><body style="font-family:system-ui,sans-serif;line-height:1.5;color:#111">
  <h1 style="font-size:20px">${title}</h1>
  ${body}
  <p><a href="${url}" style="display:inline-block;padding:12px 20px;background:#111;color:#fff;border-radius:8px;text-decoration:none">${buttonLabel}</a></p>
  <p style="font-size:12px;color:#666">If the button doesn't work, copy this link: ${url}</p>
</body></html>`;
}

/**
 * Confirms an email-address change — used by the web admin panel
 * (`web/src/services/adminAuth.ts`'s `updateAdminEmail`), which has no
 * code-entry UI, only "check your inbox". `url` is built by
 * `EmailHookService` from Supabase's own `/auth/v1/verify` endpoint (see its
 * doc comment) — clicking it confirms the change directly with Supabase, no
 * app screen involved.
 */
export function emailChangeMail(url: string): RenderedMail {
  return {
    subject: 'Confirm your new email address',
    text: `Confirm this email address change by opening: ${url}`,
    html: linkLayout(
      'Confirm your email change',
      '<p>Click below to confirm this address for your account.</p>',
      url,
      'Confirm email change',
    ),
  };
}

/**
 * Sign-in link — not a flow this app currently offers (no
 * `signInWithOtp()` call site), kept so the Send Email Hook doesn't silently
 * drop the mail if this is ever wired up.
 */
export function magicLinkMail(url: string): RenderedMail {
  return {
    subject: 'Your WorldHair sign-in link',
    text: `Sign in by opening: ${url}`,
    html: linkLayout('Sign in to WorldHair', '<p>Click below to sign in.</p>', url, 'Sign in'),
  };
}

/**
 * Password-reset link — not a flow this app currently offers (no
 * `resetPasswordForEmail()` call site, no "forgot password" screen anywhere).
 * Link-based rather than the existing code-based `passwordResetMail` above,
 * since there's no screen to type a code into; if a real reset screen gets
 * built later using `email_data.token`, switch EmailHookService's 'recovery'
 * case to `passwordResetMail` instead and delete this one.
 */
export function passwordResetLinkMail(url: string): RenderedMail {
  return {
    subject: 'Reset your password',
    text: `Reset your password by opening: ${url}. If you did not request this, ignore this email.`,
    html: linkLayout(
      'Reset your password',
      "<p>Click below to choose a new password. If you didn't request this, ignore this email.</p>",
      url,
      'Reset password',
    ),
  };
}

/** "Validation/refus compte coiffeur" (TODO.md → Notifications) — the one notification type that also goes by email, alongside push, since it's an account-lifecycle decision. */
export function coiffeurApplicationDecidedMail(
  status: 'validated' | 'rejected',
  reviewMessage?: string | null,
): RenderedMail {
  if (status === 'validated') {
    return {
      subject: 'Votre compte coiffeur a été validé',
      text: 'Bonne nouvelle : votre dossier coiffeur a été validé. Vous pouvez maintenant compléter votre fiche boutique dans l\'application.',
      html: layout(
        'Compte validé',
        '<p>Bonne nouvelle : votre dossier coiffeur a été validé. Vous pouvez maintenant compléter votre fiche boutique dans l\'application.</p>',
      ),
    };
  }
  const reasonText = reviewMessage ? ` Motif : ${reviewMessage}` : '';
  return {
    subject: 'Votre dossier coiffeur a été refusé',
    text: `Votre dossier coiffeur n'a pas été validé.${reasonText} Vous pouvez le corriger et le soumettre à nouveau depuis l'application.`,
    html: layout(
      'Dossier refusé',
      `<p>Votre dossier coiffeur n'a pas été validé.${reviewMessage ? ` Motif : ${reviewMessage}` : ''}</p><p>Vous pouvez le corriger et le soumettre à nouveau depuis l'application.</p>`,
    ),
  };
}
