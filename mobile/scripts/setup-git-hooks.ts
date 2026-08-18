const { execSync } = require("child_process");
const fs = require("fs");

console.log("Setting up Git hooks with Husky...");

// Install dependencies
console.log("Installing husky...");
execSync("bun add --dev husky", {
  stdio: "inherit",
});

// Initialize Husky
console.log("Initializing Husky...");
execSync("bunx husky init", { stdio: "inherit" });

// Update pre-commit hook
console.log("Setting up pre-commit hook to run lint and format check...");
const preCommitPath = ".husky/pre-commit";
let preCommitContent = fs.readFileSync(preCommitPath, "utf8");
preCommitContent = preCommitContent.replace(/bun test/, "bun run lint\nbun run format:check");
fs.writeFileSync(preCommitPath, preCommitContent);

console.log("Git hooks setup complete!");
console.log("Pre-commit will now run linting and format checking.");

// Delete this script file itself
try {
  fs.unlinkSync(__filename);
  console.log("Script file deleted successfully.");
} catch (error) {
  console.error("Failed to delete script file:", error);
}
