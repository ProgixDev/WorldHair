import { spawnSync } from "child_process";
import fs from "fs";
import path from "path";

/**
 * Copies the variables an iOS build needs from .env into the EAS
 * "production" environment, which eas.json's production profile reads.
 *
 * EAS never sees .env itself: .easignore keeps it (and the Android signing
 * passwords in it) on this machine. So the app's public config (every
 * EXPO_PUBLIC_*) and the Mapbox download token that `pod install` needs
 * have to live on EAS instead. Re-run after changing any of them in .env.
 *
 *   bun scripts/push-eas-env.ts
 *
 * Needs `eas login` (WorldHair's Expo account) and `eas init` first.
 */

const ENVIRONMENT = "production";
/** The Mapbox download token is a secret; EXPO_PUBLIC_* ship inside the app anyway. */
const SECRETS = new Set(["RNMAPBOX_MAPS_DOWNLOAD_TOKEN"]);
const wanted = (name: string) => name.startsWith("EXPO_PUBLIC_") || SECRETS.has(name);

const envPath = path.join(process.cwd(), ".env");
if (!fs.existsSync(envPath)) {
  console.error("No .env here: run this from mobile/.");
  process.exit(1);
}

const variables = fs
  .readFileSync(envPath, "utf8")
  .split(/\r?\n/)
  .map((line) => line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/))
  .filter((match): match is RegExpMatchArray => match !== null && wanted(match[1]))
  .map(([, name, raw]) => ({ name, value: raw.replace(/^(['"])(.*)\1$/, "$2") }))
  .filter(({ value }) => value !== "");

for (const { name, value } of variables) {
  // On Windows `eas` is a .cmd, which Node only runs through a shell: quote
  // every argument, and refuse a value the quoting can't carry.
  if (/["%]/.test(value)) {
    console.error(`${name}: contains " or %, set it by hand with eas env:set.`);
    process.exit(1);
  }
  const args = [
    "env:set",
    ENVIRONMENT,
    "--name",
    name,
    "--value",
    value,
    "--visibility",
    SECRETS.has(name) ? "secret" : "plaintext",
    "--non-interactive",
  ];
  const windows = process.platform === "win32";
  const result = spawnSync("eas", windows ? args.map((arg) => `"${arg}"`) : args, {
    stdio: ["ignore", "ignore", "inherit"],
    shell: windows,
  });
  if (result.status !== 0) {
    console.error(`${name}: eas env:set failed.`);
    process.exit(1);
  }
  console.log(`${name} ✓`);
}
console.log(`${variables.length} variable(s) set in the EAS "${ENVIRONMENT}" environment.`);
