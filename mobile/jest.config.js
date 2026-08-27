// Pinned regardless of host machine timezone: a bare `Intl`/`Date` call in
// app code or a test renders differently depending on the runner's local
// zone, which makes date-related bugs invisible on some machines/CI runners
// and not others. Fixing it here means a test that passes locally passes
// everywhere.
process.env.TZ = "America/New_York";

module.exports = {
  preset: "jest-expo",
  setupFilesAfterEnv: ["<rootDir>/test/setup.ts"],
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/$1",
  },
  testPathIgnorePatterns: ["/node_modules/", "/dist/"],
};
