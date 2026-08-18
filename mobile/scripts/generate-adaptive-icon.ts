/**
 * Generates assets/images/adaptive-icon.png
 *
 * Android adaptive icons require the logo to sit within the inner 66% "safe zone"
 * so it isn't clipped by circular/squircle masks. This script takes Logo.png,
 * centers it on a 1024×1024 transparent canvas with the correct padding, and
 * writes the result to adaptive-icon.png.
 *
 * Usage: bun scripts/generate-adaptive-icon.ts
 */

import sharp from "sharp";
import path from "path";

const ROOT = path.resolve(__dirname, "..");
const INPUT = path.join(ROOT, "assets", "images", "Logo.png");
const OUTPUT = path.join(ROOT, "assets", "images", "adaptive-icon.png");

const CANVAS = 1024;
// Android safe zone = inner 66% of the canvas
const LOGO_SIZE = Math.round(CANVAS * 0.66); // 676px
const OFFSET = Math.round((CANVAS - LOGO_SIZE) / 2); // 174px padding each side

async function main() {
  console.log(`Input:   ${INPUT}`);
  console.log(`Output:  ${OUTPUT}`);
  console.log(`Canvas:  ${CANVAS}×${CANVAS}px`);
  console.log(`Logo:    ${LOGO_SIZE}×${LOGO_SIZE}px (centered, ${OFFSET}px padding)`);

  const resizedLogo = await sharp(INPUT)
    .resize(LOGO_SIZE, LOGO_SIZE, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .toBuffer();

  await sharp({
    create: {
      width: CANVAS,
      height: CANVAS,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .composite([{ input: resizedLogo, left: OFFSET, top: OFFSET }])
    .png()
    .toFile(OUTPUT);

  console.log("Done ✓");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
