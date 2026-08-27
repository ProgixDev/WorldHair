export function applyTestEnv(overrides: Record<string, string> = {}): void {
  Object.assign(process.env, {
    NODE_ENV: 'test',
    PORT: '0',
    CORS_ORIGIN: '',
    THROTTLE_TTL: '60000',
    THROTTLE_LIMIT: '1000',
    // Not real credentials — SupabaseService is always overridden by
    // FakeSupabaseService in tests (see app-harness.ts), so no client
    // actually connects out using these. They only need to satisfy
    // env.validation.ts's "present and non-empty" checks.
    SUPABASE_URL: 'https://test.supabase.co',
    SUPABASE_ANON_KEY: 'test-anon-key',
    SUPABASE_SERVICE_ROLE_KEY: 'test-service-role-key',
    VERIFY_TOKEN_TTL_HOURS: '24',
    RESET_TOKEN_TTL_MINUTES: '60',
    MAIL_TRANSPORT: 'json',
    MAIL_FROM: 'App <no-reply@test.local>',
    ...overrides,
  });
}
