import fs from "fs";
import path from "path";

/**
 * Materializes the MongoDB/Mongoose variant into src/ and test/, removing
 * the Supabase variant's exclusive files/dependencies/env vars first. See
 * `_variants/mongodb/manifest.json` and server/README.md.
 *
 * Deliberately not shared with setup-supabase.ts: two scripts each doing
 * their own thing, so running the wrong one is a copy-paste-obvious mistake
 * to read, not a call into shared logic that silently does the wrong thing
 * for whichever name got passed in.
 */

const THIS_VARIANT = "mongodb";
const OTHER_VARIANT = "supabase";

interface VariantManifest {
  files: string[];
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  envBlock: string;
}

const repoRoot = process.cwd();
const variantsDir = path.join(repoRoot, "_variants");
const srcDir = path.join(repoRoot, "src");
const testDir = path.join(repoRoot, "test");
const packageJsonPath = path.join(repoRoot, "package.json");
const envExamplePath = path.join(repoRoot, ".env.example");

const TEST_PREFIX = "test/";

function readManifest(variantName: string): VariantManifest {
  const manifestPath = path.join(variantsDir, variantName, "manifest.json");
  return JSON.parse(fs.readFileSync(manifestPath, "utf8")) as VariantManifest;
}

/** Where a manifest entry lands once materialized: under test/ for a test/-prefixed entry, src/ otherwise. */
function targetPathFor(relPath: string): string {
  if (relPath.startsWith(TEST_PREFIX)) {
    return path.join(testDir, relPath.slice(TEST_PREFIX.length));
  }
  return path.join(srcDir, relPath);
}

/** Removes every empty directory under dir, deepest first. Best-effort tidiness — never fatal. */
function pruneEmptyDirs(dir: string): void {
  if (!fs.existsSync(dir)) {
    return;
  }
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      pruneEmptyDirs(path.join(dir, entry.name));
    }
  }
  try {
    if (fs.readdirSync(dir).length === 0) {
      fs.rmdirSync(dir);
    }
  } catch {
    // Not a big deal either way — this is just tidiness.
  }
}

/** Deletes every file the OTHER variant owns exclusively (i.e. this variant doesn't also claim it) from src/ and test/. */
function removeExclusiveFiles(thisManifest: VariantManifest, otherManifest: VariantManifest): void {
  const keep = new Set(thisManifest.files);
  let removed = 0;

  for (const relPath of otherManifest.files) {
    if (keep.has(relPath)) {
      continue; // Shared path — this variant will overwrite it below, not delete it.
    }
    const target = targetPathFor(relPath);
    if (fs.existsSync(target)) {
      fs.rmSync(target, { force: true });
      console.log(`  removed ${path.relative(repoRoot, target)}`);
      removed++;
    }
  }

  pruneEmptyDirs(srcDir);
  pruneEmptyDirs(testDir);

  if (removed === 0) {
    console.log("  (nothing to remove — the other variant's files were not present)");
  }
}

/** Copies every file this variant owns from _variants/<name>/ into src/ or test/, overwriting. */
function copyVariantFiles(variantName: string, manifest: VariantManifest): void {
  const variantRoot = path.join(variantsDir, variantName);

  for (const relPath of manifest.files) {
    const source = path.join(variantRoot, relPath);
    const target = targetPathFor(relPath);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.copyFileSync(source, target);
    console.log(`  wrote ${path.relative(repoRoot, target)}`);
  }
}

function removeKeys(from: Record<string, string> | undefined, target: Record<string, string>): void {
  if (!from) {
    return;
  }
  for (const key of Object.keys(from)) {
    delete target[key];
  }
}

function sortKeys(obj: Record<string, string>): Record<string, string> {
  const sorted: Record<string, string> = {};
  for (const key of Object.keys(obj).sort()) {
    sorted[key] = obj[key];
  }
  return sorted;
}

/**
 * Removes every dependency/devDependency key that appears in EITHER
 * variant's manifest, then adds back only this variant's — so the other
 * variant's packages never linger, and any dependency that belongs to
 * neither variant (everything shared/permanent) is left completely alone.
 */
function mergePackageJson(thisManifest: VariantManifest, otherManifest: VariantManifest): void {
  const pkg = JSON.parse(fs.readFileSync(packageJsonPath, "utf8")) as {
    dependencies?: Record<string, string>;
    devDependencies?: Record<string, string>;
    [key: string]: unknown;
  };
  pkg.dependencies ??= {};
  pkg.devDependencies ??= {};

  removeKeys(thisManifest.dependencies, pkg.dependencies);
  removeKeys(thisManifest.devDependencies, pkg.devDependencies);
  removeKeys(otherManifest.dependencies, pkg.dependencies);
  removeKeys(otherManifest.devDependencies, pkg.devDependencies);

  Object.assign(pkg.dependencies, thisManifest.dependencies ?? {});
  Object.assign(pkg.devDependencies, thisManifest.devDependencies ?? {});

  pkg.dependencies = sortKeys(pkg.dependencies);
  pkg.devDependencies = sortKeys(pkg.devDependencies);

  fs.writeFileSync(packageJsonPath, `${JSON.stringify(pkg, null, 2)}\n`);
  console.log("  updated package.json dependencies/devDependencies");
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

const ENV_BLOCK_START = "# --- database:start ---";
const ENV_BLOCK_END = "# --- database:end ---";

/** Replaces the content between the database:start/database:end markers in .env.example with this variant's block. */
function replaceEnvBlock(manifest: VariantManifest): void {
  const contents = fs.readFileSync(envExamplePath, "utf8");
  const pattern = new RegExp(`${escapeRegExp(ENV_BLOCK_START)}[\\s\\S]*?${escapeRegExp(ENV_BLOCK_END)}`);

  if (!pattern.test(contents)) {
    throw new Error(
      `Could not find "${ENV_BLOCK_START}" / "${ENV_BLOCK_END}" markers in ${envExamplePath}. ` +
        "Has .env.example been edited to remove them?",
    );
  }

  const replacement = [ENV_BLOCK_START, manifest.envBlock.trimEnd(), ENV_BLOCK_END].join("\n");
  fs.writeFileSync(envExamplePath, contents.replace(pattern, replacement));
  console.log("  updated the database block in .env.example");
}

function printSchemaSqlNoticeIfPresent(variantName: string): void {
  const schemaPath = path.join(variantsDir, variantName, "schema.sql");
  if (fs.existsSync(schemaPath)) {
    console.log("\nThis variant ships a SQL schema that is NOT applied automatically:");
    console.log(`  ${schemaPath}`);
    console.log("Run it against your Supabase project (SQL Editor, or the Supabase CLI) before starting the server.");
  }
}

console.log(`Setting up the "${THIS_VARIANT}" server variant...\n`);

const thisManifest = readManifest(THIS_VARIANT);
const otherManifest = readManifest(OTHER_VARIANT);

console.log(`Removing files exclusive to "${OTHER_VARIANT}"...`);
removeExclusiveFiles(thisManifest, otherManifest);

console.log(`\nCopying "${THIS_VARIANT}" files into src/ and test/...`);
copyVariantFiles(THIS_VARIANT, thisManifest);

console.log("\nUpdating package.json...");
mergePackageJson(thisManifest, otherManifest);

console.log("\nUpdating .env.example...");
replaceEnvBlock(thisManifest);

printSchemaSqlNoticeIfPresent(THIS_VARIANT);

console.log(`\nDone — the "${THIS_VARIANT}" variant is now live in src/.`);
console.log("\nNext steps:");
console.log("  1. Copy .env.example to .env (or update your existing .env) and fill in the new values.");
console.log("  2. bun install");
console.log("  3. bun run dev");
