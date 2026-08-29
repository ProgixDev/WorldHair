import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactCompiler: true,
  // `next dev`/`next build` otherwise auto-writes AGENTS.md/CLAUDE.md on
  // every run — not wanted in this repo.
  agentRules: false,
};

export default nextConfig;
