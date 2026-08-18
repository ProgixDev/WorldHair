import fs from "fs";
import path from "path";
import { execSync } from "child_process";

console.log("Resetting Git repository...");

// Remove existing .git directory
const gitDir = path.join(".", ".git");
if (fs.existsSync(gitDir)) {
  console.log("Removing existing .git directory...");
  fs.rmSync(gitDir, { recursive: true, force: true });
  console.log(".git directory removed.");
} else {
  console.log("No .git directory found.");
}

// Initialize new Git repository
console.log("Initializing new Git repository...");
execSync("git init", { stdio: "inherit" });

// Add all files
console.log("Adding all files...");
execSync("git add .", { stdio: "inherit" });

// Make initial commit
console.log("Creating initial commit...");
execSync('git commit -m "Initial commit"', { stdio: "inherit" });

console.log("Git repository reset complete!");

// Delete this script file itself
try {
  fs.unlinkSync(__filename);
  console.log("Script file deleted successfully.");
} catch (error) {
  console.error("Failed to delete script file:", error);
}
