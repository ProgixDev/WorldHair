import { execSync } from "child_process";
import crypto from "crypto";
import fs from "fs";
import path from "path";

/**
 * Generates the two Android signing keystores this template's
 * plugins/withDebugSigning.js and plugins/withReleaseSigning.js point at, and
 * writes the release credentials into .env.
 *
 * Both plugins read keystores from ./keystores (relative to the repo root,
 * i.e. ../../keystores from android/app/ once `expo prebuild` generates
 * android/) rather than the android/ folder itself, because `expo prebuild
 * --clean` deletes android/ wholesale on every run. A keystore living inside
 * it would be silently replaced by a brand new one — with a brand new random
 * key — the next time that runs.
 *
 * Safe to re-run: an existing keystore is never overwritten, so running this
 * again after `expo prebuild --clean` is a no-op.
 */

const repoRoot = process.cwd();
const keystoresDir = path.join(repoRoot, "keystores");
const debugKeystorePath = path.join(keystoresDir, "debug.keystore");
const releaseKeystorePath = path.join(keystoresDir, "release.jks");
const envPath = path.join(repoRoot, ".env");
const envExamplePath = path.join(repoRoot, ".env.example");

function assertKeytoolAvailable(): void {
  try {
    execSync("keytool -help", { stdio: "ignore" });
  } catch {
    console.error(
      "keytool not found on PATH. It ships with any JDK, including the one bundled with Android Studio " +
        "(look under Android Studio's own jbr/bin, or install a JDK and add it to PATH).",
    );
    process.exit(1);
  }
}

/**
 * Reads one line of input with each keystroke echoed as `*` instead of the
 * real character, using raw mode directly rather than `readline.question` —
 * `readline` always echoes what was typed, and there is no built-in masked
 * variant.
 *
 * Returns "" (rather than hanging) when stdin isn't a real TTY — piping input
 * in, or running under CI — since `setRawMode` doesn't exist on a non-TTY
 * stream. The caller treats an empty result as "no password typed".
 */
function promptHidden(query: string): Promise<string> {
  return new Promise((resolve) => {
    const stdin = process.stdin;
    if (!stdin.isTTY) {
      resolve("");
      return;
    }

    process.stdout.write(query);
    stdin.resume();
    stdin.setRawMode(true);
    stdin.setEncoding("utf8");

    let input = "";
    const cleanup = () => {
      stdin.setRawMode(false);
      stdin.pause();
      stdin.removeListener("data", onData);
    };
    const onData = (char: string) => {
      switch (char) {
        case "\n":
        case "\r":
        case "": // Ctrl-D
          cleanup();
          process.stdout.write("\n");
          resolve(input);
          break;
        case "": // Ctrl-C
          cleanup();
          process.stdout.write("\n");
          process.exit(1);
          break;
        case "": // backspace
        case "\b":
          if (input.length > 0) {
            input = input.slice(0, -1);
            process.stdout.write("\b \b");
          }
          break;
        default:
          input += char;
          process.stdout.write("*");
          break;
      }
    };
    stdin.on("data", onData);
  });
}

/**
 * Asks for the release keystore password twice (typo-catching, same as any
 * password-creation form) and returns it, or `null` to fall back to a random
 * one — either because stdin isn't interactive, or because the user pressed
 * Enter with nothing typed.
 */
// keytool itself rejects anything shorter for either the store or key
// password — enforced here too so a short password fails before the
// (identical-looking) confirm prompt, rather than after, from a keytool
// stack trace.
const MIN_PASSWORD_LENGTH = 6;

async function promptReleasePassword(): Promise<string | null> {
  if (!process.stdin.isTTY) {
    console.log("No interactive terminal detected — generating a random release keystore password.");
    return null;
  }

  console.log("\nSet the release keystore password (used for both the store and the key).");
  console.log("Press Enter with nothing typed to generate a random one instead.\n");

  for (;;) {
    const first = await promptHidden("Password: ");
    if (first.length === 0) {
      return null;
    }
    if (first.length < MIN_PASSWORD_LENGTH) {
      console.log(`Password must be at least ${MIN_PASSWORD_LENGTH} characters — try again.\n`);
      continue;
    }
    const second = await promptHidden("Confirm password: ");
    if (first === second) {
      return first;
    }
    console.log("Passwords did not match — try again.\n");
  }
}

function readAppName(): string {
  try {
    const appJson = JSON.parse(fs.readFileSync(path.join(repoRoot, "app.json"), "utf8"));
    return appJson.expo?.name ?? "App";
  } catch {
    return "App";
  }
}

function ensureDebugKeystore(): void {
  if (fs.existsSync(debugKeystorePath)) {
    console.log(`Debug keystore already exists at ${debugKeystorePath} — skipping.`);
    return;
  }

  console.log("Generating debug keystore (standard androiddebugkey/android credentials)...");
  execSync(
    `keytool -genkeypair -v ` +
      `-keystore "${debugKeystorePath}" ` +
      `-storepass android -keypass android -alias androiddebugkey ` +
      `-keyalg RSA -keysize 2048 -validity 10000 ` +
      `-dname "CN=Android Debug,O=Android,C=US"`,
    { stdio: "inherit" },
  );
  console.log(
    "Debug keystore created. Commit it — see the !/keystores/debug.keystore " +
      "exception in .gitignore — so its SHA-1 stays stable across clones and `prebuild --clean`.",
  );
}

interface ReleaseCredentials {
  storeFile: string;
  storePassword: string;
  keyAlias: string;
  keyPassword: string;
}

async function ensureReleaseKeystore(): Promise<ReleaseCredentials | null> {
  if (fs.existsSync(releaseKeystorePath)) {
    console.log(`Release keystore already exists at ${releaseKeystorePath} — skipping generation.`);
    console.log("(.env is left untouched: this script does not know that keystore's existing password.)");
    return null;
  }

  const appName = readAppName();
  // One password for both store and key, deliberately: keytool defaults to a
  // PKCS12 keystore (the default since JDK 9), and PKCS12 does not support a
  // key password distinct from the store password — keytool silently IGNORES
  // a separately supplied `-keypass` rather than erroring, so a typed-in key
  // password different from the store password would write a
  // `RELEASE_KEY_PASSWORD` to .env that does not match the key actually
  // protected by that value, and Gradle would fail to open it on the first
  // real release build.
  const typed = await promptReleasePassword();
  const password = typed ?? crypto.randomBytes(24).toString("hex");
  if (!typed) {
    console.log("Generated a random release keystore password.");
  }
  const keyAlias = "release";

  console.log("Generating release keystore...");
  execSync(
    `keytool -genkeypair -v ` +
      `-keystore "${releaseKeystorePath}" ` +
      `-storepass "${password}" -keypass "${password}" -alias "${keyAlias}" ` +
      `-keyalg RSA -keysize 2048 -validity 10000 ` +
      `-dname "CN=${appName},OU=Engineering,O=${appName},C=US"`,
    { stdio: "inherit" },
  );

  return {
    // Relative to android/app/, where the Gradle build reads it from — see
    // plugins/withReleaseSigning.js.
    storeFile: "../../keystores/release.jks",
    storePassword: password,
    keyAlias,
    keyPassword: password,
  };
}

function upsertEnvVars(values: Record<string, string>): void {
  let contents = "";
  if (fs.existsSync(envPath)) {
    contents = fs.readFileSync(envPath, "utf8");
  } else if (fs.existsSync(envExamplePath)) {
    contents = fs.readFileSync(envExamplePath, "utf8");
  }

  for (const [key, value] of Object.entries(values)) {
    const line = `${key}=${value}`;
    const pattern = new RegExp(`^${key}=.*$`, "m");
    if (pattern.test(contents)) {
      contents = contents.replace(pattern, line);
    } else {
      contents = contents.length > 0 && !contents.endsWith("\n") ? `${contents}\n${line}\n` : `${contents}${line}\n`;
    }
  }

  fs.writeFileSync(envPath, contents);
  console.log(`Wrote release signing credentials to ${envPath}.`);
}

async function main(): Promise<void> {
  assertKeytoolAvailable();
  fs.mkdirSync(keystoresDir, { recursive: true });

  ensureDebugKeystore();

  const releaseCredentials = await ensureReleaseKeystore();
  if (releaseCredentials) {
    upsertEnvVars({
      RELEASE_STORE_FILE: releaseCredentials.storeFile,
      RELEASE_STORE_PASSWORD: releaseCredentials.storePassword,
      RELEASE_KEY_ALIAS: releaseCredentials.keyAlias,
      RELEASE_KEY_PASSWORD: releaseCredentials.keyPassword,
    });
    console.log(
      "\nDone. Keep keystores/release.jks and .env out of git (both are already gitignored) — " +
        "losing the release keystore means you can never publish an update to an app already on the Play Store " +
        "under the same signing key.",
    );
  } else {
    console.log("\nDone.");
  }
}

main();
