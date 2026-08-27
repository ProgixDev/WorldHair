import fs from "fs";
import path from "path";

// This script lives in <project>/scripts and can be run from any of mobile/,
// server/, or web/ — the project's real name is the PARENT (repo root)
// directory's name, and renaming touches all three siblings plus the root,
// not just whichever one this happened to run from.
const repoRoot = path.resolve(process.cwd(), "..");
const projectName = path.basename(repoRoot);
const normalizedName = projectName.toLowerCase().replace(/[^a-z0-9]/g, "");
const lowerName = projectName.toLowerCase();

console.log(`Updating project name to: ${projectName}`);
console.log(`Normalized name for identifiers: ${normalizedName}`);

function updatePackageJsonName(pkgPath: string, name: string): void {
  if (!fs.existsSync(pkgPath)) return;
  const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8"));
  pkg.name = name;
  fs.writeFileSync(pkgPath, `${JSON.stringify(pkg, null, 2)}\n`);
  console.log(`Updated ${pkgPath} -> name: "${name}"`);
}

// Root package.json has no dependencies of its own, just the monorepo name
// and the dispatcher scripts.
updatePackageJsonName(path.join(repoRoot, "package.json"), `${lowerName}`);

// Each sibling project gets its own suffixed name.
updatePackageJsonName(path.join(repoRoot, "mobile", "package.json"), `${lowerName}-mobile`);
updatePackageJsonName(path.join(repoRoot, "server", "package.json"), `${lowerName}-server`);
updatePackageJsonName(path.join(repoRoot, "web", "package.json"), `${lowerName}-web`);

// mobile/app.json: name/slug/scheme/bundleIdentifier/android package. Only
// mobile has this file — server and web have no native-app config to rename.
const appJsonPath = path.join(repoRoot, "mobile", "app.json");
if (fs.existsSync(appJsonPath)) {
  const appJson = JSON.parse(fs.readFileSync(appJsonPath, "utf8"));
  appJson.expo.name = lowerName;
  appJson.expo.slug = lowerName;
  appJson.expo.scheme = normalizedName;
  if (appJson.expo.ios?.bundleIdentifier) {
    appJson.expo.ios.bundleIdentifier = `com.anonymous.${normalizedName}`;
  }
  if (appJson.expo.android?.package) {
    appJson.expo.android.package = `com.anonymous.${normalizedName}`;
  }
  fs.writeFileSync(appJsonPath, `${JSON.stringify(appJson, null, 2)}\n`);
  console.log(`Updated ${appJsonPath}`);
}

// Replace every literal "WorldHair" occurrence across the whole repo —
// README copy, leftover references, anything a text search would catch.
// _variants/ is excluded: those are the server's inert setup:mongodb/
// setup:supabase source files, not live code, and none of them reference the
// template's own name.
const SKIP_DIRS = new Set([
  "node_modules",
  ".git",
  ".expo",
  ".next",
  "ios",
  "android",
  "dist",
  "coverage",
  "_variants",
]);
const TEXT_EXTENSIONS = new Set([".json", ".md", ".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs"]);

function updateFiles(dir: string): void {
  for (const item of fs.readdirSync(dir)) {
    if (SKIP_DIRS.has(item)) continue;

    const fullPath = path.join(dir, item);
    const stat = fs.statSync(fullPath);

    if (stat.isDirectory()) {
      updateFiles(fullPath);
    } else if (TEXT_EXTENSIONS.has(path.extname(item))) {
      try {
        let content = fs.readFileSync(fullPath, "utf8");
        if (content.includes("WorldHair")) {
          content = content.replaceAll("WorldHair", projectName);
          fs.writeFileSync(fullPath, content);
          console.log(`Updated: ${fullPath}`);
        }
      } catch {
        // Skip binary files or files that can't be read as UTF-8
      }
    }
  }
}

console.log('Searching for other files containing "WorldHair"...');
updateFiles(repoRoot);

console.log(`Project name updated to "${projectName}" successfully!`);
