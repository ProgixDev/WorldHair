export function applyTestEnv(overrides: Record<string, string> = {}): void {
  Object.assign(process.env, {
    NODE_ENV: 'test',
    PORT: '0',
    CORS_ORIGIN: '',
    THROTTLE_TTL: '60000',
    THROTTLE_LIMIT: '1000',
    JWT_ACCESS_SECRET: 'test-access-secret-'.padEnd(40, 'x'),
    JWT_ACCESS_EXPIRES_IN: '15m',
    JWT_REFRESH_SECRET: 'test-refresh-secret-'.padEnd(40, 'y'),
    JWT_REFRESH_EXPIRES_IN: '30d',
    VERIFY_TOKEN_TTL_HOURS: '24',
    RESET_TOKEN_TTL_MINUTES: '60',
    MAIL_TRANSPORT: 'json',
    MAIL_FROM: 'App <no-reply@test.local>',
    ...overrides,
  });
}
