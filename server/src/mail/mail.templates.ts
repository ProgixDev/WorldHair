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
