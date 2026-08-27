/**
 * Generates src/app/icon.png, src/app/apple-icon.png, and
 * src/app/opengraph-image.png from public/Logo.png.
 *
 * Next's App Router picks these up by filename convention alone — no code
 * needed, it wires the favicon <link> tags and the og:image/twitter:image
 * meta tags automatically.
 *
 * Unlike mobile's generate-adaptive-icon.ts, there's no platform "safe zone"
 * constraint to respect here (that one's an Android adaptive-icon rule), so
 * this just centers the logo with sharp's `gravity` option instead of
 * computing manual offsets.
 *
 * Usage: bun scripts/generate-favicon.ts
 */

import sharp from "sharp";
import path from "path";

const ROOT = path.resolve(__dirname, "..");
const INPUT = path.join(ROOT, "public", "Logo.png");
const APP_DIR = path.join(ROOT, "src", "app");

const ICON_SIZE = 512;
const APPLE_ICON_SIZE = 180;
const OG_WIDTH = 1200;
const OG_HEIGHT = 630;
const OG_LOGO_SIZE = 240;

// Matches the app's default dark theme background (constants/themes.ts,
// and the same value app.json's splash screen config uses on mobile).
const BRAND_BACKGROUND = { r: 0x0b, g: 0x0d, b: 0x0e, alpha: 1 };
const TRANSPARENT = { r: 0, g: 0, b: 0, alpha: 0 };

async function squareIcon(size: number, outputPath: string, opaque: boolean): Promise<void> {
  const logo = await sharp(INPUT)
    .resize(Math.round(size * 0.7), Math.round(size * 0.7), {
      fit: "contain",
      background: TRANSPARENT,
    })
    .toBuffer();

  await sharp({
    create: {
      width: size,
      height: size,
      channels: 4,
      background: opaque ? BRAND_BACKGROUND : TRANSPARENT,
    },
  })
    .composite([{ input: logo, gravity: "center" }])
    .png()
    .toFile(outputPath);
}

async function ogImage(outputPath: string): Promise<void> {
  const logo = await sharp(INPUT)
    .resize(OG_LOGO_SIZE, OG_LOGO_SIZE, { fit: "contain", background: TRANSPARENT })
    .toBuffer();

  await sharp({
    create: { width: OG_WIDTH, height: OG_HEIGHT, channels: 4, background: BRAND_BACKGROUND },
  })
    .composite([{ input: logo, gravity: "center" }])
    .png()
    .toFile(outputPath);
}

async function main(): Promise<void> {
  console.log(`Input: ${INPUT}`);

  const iconPath = path.join(APP_DIR, "icon.png");
  // Transparent — a browser tab can be any color, so the icon shouldn't force one.
  await squareIcon(ICON_SIZE, iconPath, false);
  console.log(`Wrote ${iconPath}`);

  const appleIconPath = path.join(APP_DIR, "apple-icon.png");
  // Opaque — iOS fills transparent areas of a home-screen icon with black.
  await squareIcon(APPLE_ICON_SIZE, appleIconPath, true);
  console.log(`Wrote ${appleIconPath}`);

  const ogPath = path.join(APP_DIR, "opengraph-image.png");
  await ogImage(ogPath);
  console.log(`Wrote ${ogPath}`);

  console.log("Done ✓");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
