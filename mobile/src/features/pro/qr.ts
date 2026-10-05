import qrcode from "qrcode-generator";

/** One horizontal stretch of dark modules: drawn as a single view. */
export interface QrRun {
  row: number;
  col: number;
  length: number;
}

/**
 * The QR code of `text` as stretches of dark modules, row by row — what
 * components/ui/QrCode.tsx draws with plain views, so no native module (and
 * no new app build) is needed. Error correction M: still reads on a
 * scratched or dimmed screen.
 */
export function qrRuns(text: string): { size: number; runs: QrRun[] } {
  const code = qrcode(0, "M");
  code.addData(text);
  code.make();
  const size = code.getModuleCount();
  const runs: QrRun[] = [];
  for (let row = 0; row < size; row += 1) {
    let start = -1;
    for (let col = 0; col <= size; col += 1) {
      const dark = col < size && code.isDark(row, col);
      if (dark && start < 0) start = col;
      if (!dark && start >= 0) {
        runs.push({ row, col: start, length: col - start });
        start = -1;
      }
    }
  }
  return { size, runs };
}
