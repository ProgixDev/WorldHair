const nextJest = require("next/jest");

// next/jest wires up Next's own SWC compiler (so JSX/TS/next.config.ts stuff
// like React Compiler work the same as they do at build time) and loads
// .env files the same way `next dev`/`next build` do — hand-rolling a
// ts-jest config would drift from Next's actual compiler behavior over time.
const createJestConfig = nextJest({ dir: "./" });

const customJestConfig = {
  setupFilesAfterEnv: ["<rootDir>/jest.setup.ts"],
  testEnvironment: "jest-environment-jsdom",
  roots: ["<rootDir>/src"],
};

module.exports = createJestConfig(customJestConfig);
