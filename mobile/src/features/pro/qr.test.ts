import qrcode from "qrcode-generator";
import { qrRuns } from "./qr";

describe("qrRuns", () => {
  it("draws every dark module of the QR code, row by row, merging neighbours", () => {
    const text = "https://worldhair.test/rejoindre/ABC234";
    const { size, runs } = qrRuns(text);

    const reference = qrcode(0, "M");
    reference.addData(text);
    reference.make();
    expect(size).toBe(reference.getModuleCount());

    const drawn = new Set<string>();
    for (const run of runs) {
      for (let col = run.col; col < run.col + run.length; col += 1) drawn.add(run.row + ":" + col);
    }
    for (let row = 0; row < size; row += 1) {
      for (let col = 0; col < size; col += 1) {
        expect(drawn.has(row + ":" + col)).toBe(reference.isDark(row, col));
      }
    }
    // Merged: far fewer pieces than dark modules.
    expect(runs.length).toBeLessThan(drawn.size);
  });
});
