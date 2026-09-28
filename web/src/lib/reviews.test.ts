import { reportReasonLabel, reporterRoleLabel } from "./reviews";

describe("reportReasonLabel", () => {
  it("names each reason the app offers, as the app does", () => {
    expect(reportReasonLabel("offensive")).toBe("Propos injurieux ou haineux");
    expect(reportReasonLabel("fake")).toBe("Faux avis");
    expect(reportReasonLabel("personal_info")).toBe("Informations personnelles");
    expect(reportReasonLabel("spam")).toBe("Publicité ou spam");
    expect(reportReasonLabel("other")).toBe("Autre raison");
  });

  it("reads a reason kept the old way — the code, then the reporter's words", () => {
    expect(reportReasonLabel("fake: Jamais venue")).toBe("Faux avis : Jamais venue");
    expect(reportReasonLabel("Langage inapproprié")).toBe("Langage inapproprié");
  });
});

describe("reporterRoleLabel", () => {
  it("says whether a client or the salon reported", () => {
    expect(reporterRoleLabel("coiffeur")).toBe("le salon");
    expect(reporterRoleLabel("particulier")).toBe("un client");
    expect(reporterRoleLabel("admin")).toBe("un admin");
  });
});
