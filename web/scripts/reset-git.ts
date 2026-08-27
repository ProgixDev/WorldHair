import fs from "fs";
import path from "path";
import { execSync } from "child_process";

// This script lives in <project>/scripts and can be run from any of mobile/,
// server/, or web/ — `.git` lives at the repo root one level up from all
// three, so the relative path is identical regardless of which copy runs.
const rootDir = path.resolve(process.cwd(), "..");
const PROJECTS = ["mobile", "server", "web"];

console.log("Resetting Git repository...");

// Remove existing .git directory
const gitDir = path.join(rootDir, ".git");
if (fs.existsSync(gitDir)) {
  console.log("Removing existing .git directory...");
  fs.rmSync(gitDir, { recursive: true, force: true });
  console.log(".git directory removed.");
} else {
  console.log("No .git directory found.");
}

// Initialize new Git repository
console.log("Initializing new Git repository...");
execSync("git init", { stdio: "inherit", cwd: rootDir });

// Add all files
console.log("Adding all files...");
execSync("git add .", { stdio: "inherit", cwd: rootDir });

// Make initial commit
console.log("Creating initial commit...");
execSync('git commit -m "Initial commit"', { stdio: "inherit", cwd: rootDir });

console.log("Git repository reset complete!");

// Delete every copy of this script — a repo only makes sense to reset once,
// at the very start, and leaving any copy runnable afterward is a loaded
// footgun (a second run wipes the history the first run, and everything
// since, just created).
for (const project of PROJECTS) {
  const scriptPath = path.join(rootDir, project, "scripts", "reset-git.ts");
  try {
    if (fs.existsSync(scriptPath)) {
      fs.unlinkSync(scriptPath);
      console.log(`Deleted: ${scriptPath}`);
    }
  } catch (error) {
    console.error(`Failed to delete ${scriptPath}:`, error);
  }
}
