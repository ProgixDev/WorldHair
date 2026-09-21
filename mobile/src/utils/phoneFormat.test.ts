import { joinPhone, splitPhone } from "./phoneFormat";

describe("splitPhone", () => {
  it("splits a stored E.164 number into national digits + country", () => {
    expect(splitPhone("+33612345678")).toEqual({ phone: "612345678", phoneCountry: "FR" });
  });

  it("defaults to FR with an empty phone for a never-set profile", () => {
    expect(splitPhone("")).toEqual({ phone: "", phoneCountry: "FR" });
  });

  it("parses a legacy French local-format value (pre-PhoneField free text), trunk 0 dropped", () => {
    expect(splitPhone("06 12 34 56 78")).toEqual({ phone: "612345678", phoneCountry: "FR" });
  });

  it("falls back to digits-only + FR for text that isn't a phone number at all", () => {
    expect(splitPhone("not-a-number")).toEqual({ phone: "", phoneCountry: "FR" });
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

  it("round-trips split then join back to the original E.164 number", () => {
    const original = "+14155552671";
    const { phone, phoneCountry } = splitPhone(original);
    expect(joinPhone(phone, phoneCountry)).toBe(original);
  });
});
