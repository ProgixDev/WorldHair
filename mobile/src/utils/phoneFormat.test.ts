import { joinPhone, splitPhone } from "./phoneFormat";

// +1 555 is an unassigned area code: the phone library reports every +1
// country (~25) as equally possible for it, so it can't pick one on its own.
const UNASSIGNED_NANP = "+15550001234";

describe("splitPhone", () => {
  it("splits a stored E.164 number into national digits + country", () => {
    expect(splitPhone("+33612345678")).toEqual({ phone: "612345678", phoneCountry: "FR" });
  });

  it("defaults to FR with an empty phone for a never-set profile", () => {
    expect(splitPhone("")).toEqual({ phone: "", phoneCountry: "FR" });
  });

  it("keeps the stored country for an empty phone", () => {
    expect(splitPhone("", "CA")).toEqual({ phone: "", phoneCountry: "CA" });
  });

  it("parses a legacy French local-format value (pre-PhoneField free text), trunk 0 dropped", () => {
    expect(splitPhone("06 12 34 56 78")).toEqual({ phone: "612345678", phoneCountry: "FR" });
  });

  it("falls back to digits-only + FR for text that isn't a phone number at all", () => {
    expect(splitPhone("not-a-number")).toEqual({ phone: "", phoneCountry: "FR" });
  });

  it("keeps the picked country when the library can't narrow a shared calling code down", () => {
    expect(splitPhone(UNASSIGNED_NANP, "CA")).toEqual({ phone: "5550001234", phoneCountry: "CA" });
  });

  it("without a stored country, uses the calling code's main country — never another calling code", () => {
    expect(splitPhone(UNASSIGNED_NANP)).toEqual({ phone: "5550001234", phoneCountry: "US" });
  });

  it("ignores a stored country that doesn't match the number's calling code", () => {
    expect(splitPhone("+33612345678", "CA")).toEqual({ phone: "612345678", phoneCountry: "FR" });
  });

  it("ignores a stored country the library doesn't know", () => {
    expect(splitPhone("+33612345678", "ZZ")).toEqual({ phone: "612345678", phoneCountry: "FR" });
  });
});

describe("joinPhone", () => {
  it("reassembles national digits + country back into E.164", () => {
    expect(joinPhone("612345678", "FR")).toBe("+33612345678");
  });

  it("returns an empty string for a blank phone, not a malformed value", () => {
    expect(joinPhone("", "FR")).toBe("");
    expect(joinPhone("   ", "FR")).toBe("");
  });

  it("self-heals a legacy French local-format number on the next save", () => {
    expect(joinPhone("0612345678", "FR")).toBe("+33612345678");
  });
});

describe("split/join round trip", () => {
  it("is lossless for an assigned number", () => {
    const original = "+14155552671";
    const { phone, phoneCountry } = splitPhone(original);
    expect(joinPhone(phone, phoneCountry)).toBe(original);
  });

  // The bug this guards: saving an unassigned +1 number with Canada picked
  // came back as FR + "15550001234", so the form never matched what was
  // saved, and saving again would have rewritten it into a +33 number.
  it("is lossless for an unassigned number with its picked country", () => {
    const saved = joinPhone("5550001234", "CA");
    expect(saved).toBe(UNASSIGNED_NANP);
    expect(splitPhone(saved, "CA")).toEqual({ phone: "5550001234", phoneCountry: "CA" });
  });
});
