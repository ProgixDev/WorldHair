import { timingSafeEqual } from "crypto";
import { NextResponse } from "next/server";
import { createTransport } from "nodemailer";

export const runtime = "nodejs";

interface RelayPayload {
  from?: string;
  to?: string;
  subject?: string;
  text?: string;
  html?: string;
}

/**
 * Constant-time comparison against the shared secret, so a mistyped/leaked
 * secret can't be brute-forced by timing how fast a mismatch is rejected.
 */
function isAuthorized(request: Request): boolean {
  const expected = process.env.MAIL_RELAY_SECRET;
  const provided = request.headers.get("x-mail-relay-secret");
  if (!expected || !provided) return false;

  const expectedBuf = Buffer.from(expected);
  const providedBuf = Buffer.from(provided);
  if (expectedBuf.length !== providedBuf.length) return false;

  return timingSafeEqual(expectedBuf, providedBuf);
}

/**
 * Receives a pre-rendered email from another deployment (e.g. the server's
 * `mail.service.ts` when `MAIL_TRANSPORT=relay`) and actually sends it via
 * nodemailer. Exists for hosts whose own outbound SMTP is unreliable — this
 * app relays through whatever host it's deployed on instead.
 */
export async function POST(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json()) as RelayPayload;
  const { to, subject, text, html } = body;
  if (!to || !subject || !text || !html) {
    return NextResponse.json(
      { error: "Missing to, subject, text, or html" },
      { status: 400 },
    );
  }

  const transporter = createTransport({
    host: process.env.MAIL_HOST,
    port: Number(process.env.MAIL_PORT ?? 587),
    secure: process.env.MAIL_SECURE === "true",
    auth: process.env.MAIL_USER
      ? { user: process.env.MAIL_USER, pass: process.env.MAIL_PASSWORD }
      : undefined,
  });

  try {
    await transporter.sendMail({
      from: body.from || process.env.MAIL_FROM,
      to,
      subject,
      text,
      html,
    });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Mail relay send failed", error);
    return NextResponse.json({ error: "Send failed" }, { status: 502 });
  }
}
