import { execSync } from "child_process";
import fs from "fs";
import path from "path";

// This script lives in <project>/scripts and can be run from any of mobile/,
// server/, or web/ — git hooks are repo-wide, not per-package
// (`core.hooksPath`, what `husky init` sets up, resolves relative to the
// repo's top level regardless of cwd), so husky itself is installed and
// initialized at the root, and the pre-commit hook checks every sibling
// project, not just whichever one this happened to run from.
const rootDir = path.resolve(process.cwd(), "..");
const PROJECTS = ["mobile", "server", "web"];

console.log("Setting up Git hooks with Husky...");

// Install dependencies (at the repo root — the one exception to "root
// package.json has no dependencies of its own", since a git hook can't be
// scoped to one project the way build code can)
console.log("Installing husky...");
execSync("bun add --dev husky", {
  stdio: "inherit",
  cwd: rootDir,
});

// Initialize Husky
console.log("Initializing Husky...");
execSync("bunx husky init", { stdio: "inherit", cwd: rootDir });

// Replace the default pre-commit hook with one that checks every sibling
// project that actually exists. Chained with `&&` throughout (one long line,
// not one command per line) so a failure in an early project actually stops
// the hook and blocks the commit — separate lines in a plain shell script
// keep running regardless of each other's exit code.
console.log("Setting up pre-commit hook to lint (and format-check, where set up) every project...");
const preCommitPath = path.join(rootDir, ".husky", "pre-commit");
const steps: string[] = [];
if (fs.existsSync(path.join(rootDir, "mobile", "package.json"))) {
  steps.push("cd mobile && bun run lint && bun run format:check && cd ..");
}
if (fs.existsSync(path.join(rootDir, "server", "package.json"))) {
  steps.push("cd server && bun run lint && bun run format:check && cd ..");
}
if (fs.existsSync(path.join(rootDir, "web", "package.json"))) {
  // web has no Prettier/format:check set up — lint only.
  steps.push("cd web && bun run lint && cd ..");
}
fs.writeFileSync(preCommitPath, `${steps.join(" && ")}\n`);

console.log("Git hooks setup complete!");
console.log("Pre-commit will now lint (and format-check, where set up) every project.");

// Delete every copy of this script — husky only needs setting up once for the
// whole repo, so leaving copies in the other two projects is just a
// re-run-it-by-mistake footgun (harmless but wasteful: it'd reinstall husky
// and overwrite the pre-commit hook a second time).
for (const project of PROJECTS) {
  const scriptPath = path.join(rootDir, project, "scripts", "setup-git-hooks.ts");
  try {
    if (fs.existsSync(scriptPath)) {
      fs.unlinkSync(scriptPath);
      console.log(`Deleted: ${scriptPath}`);
    }
  } catch (error) {
    console.error(`Failed to delete ${scriptPath}:`, error);
  }
}
