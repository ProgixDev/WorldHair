/**
 * @jest-environment node
 *
 * This route handler doesn't touch the DOM — it needs Node's native
 * Request/Response globals, which jsdom (the project-wide default
 * environment, for React component tests) doesn't reliably provide.
 */
import { POST } from "./route";

const VALID_PAYLOAD = {
  to: "someone@example.com",
  subject: "Test",
  text: "hello",
  html: "<p>hello</p>",
};

function makeRequest(body: unknown, headers: Record<string, string> = {}): Request {
  return new Request("http://localhost/api/mail", {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: JSON.stringify(body),
  });
}

describe("POST /api/mail", () => {
  const ORIGINAL_ENV = process.env;

  beforeEach(() => {
    process.env = { ...ORIGINAL_ENV, MAIL_RELAY_SECRET: "test-secret" };
  });

  afterEach(() => {
    process.env = ORIGINAL_ENV;
  });

  it("rejects a request with no secret header", async () => {
    const res = await POST(makeRequest(VALID_PAYLOAD));
    expect(res.status).toBe(401);
  });

  it("rejects a request with the wrong secret", async () => {
    const res = await POST(makeRequest(VALID_PAYLOAD, { "x-mail-relay-secret": "wrong" }));
    expect(res.status).toBe(401);
  });

  it("rejects a request missing required fields, even with the right secret", async () => {
    const res = await POST(
      makeRequest({ to: VALID_PAYLOAD.to }, { "x-mail-relay-secret": "test-secret" }),
    );
    expect(res.status).toBe(400);
  });

  // No MAIL_HOST is configured for this test run, so a fully valid,
  // correctly-authorized request still can't actually send — it should fail
  // at the transporter step, not the auth/validation steps this suite
  // otherwise covers.
  it("gets past auth and validation, then fails to send with no SMTP configured", async () => {
    const res = await POST(makeRequest(VALID_PAYLOAD, { "x-mail-relay-secret": "test-secret" }));
    expect(res.status).toBe(502);
  });
});
