import { notificationDestination } from "./destination";

describe("notificationDestination", () => {
  it("opens the agenda for a coiffeur and the appointments for a client", () => {
    expect(notificationDestination("coiffeur", { appointmentId: "a1" })).toBe("/pro/agenda");
    expect(notificationDestination("particulier", { appointmentId: "a1" })).toBe("/appointments");
    expect(notificationDestination(undefined, undefined)).toBe("/appointments");
  });

  it("opens a staff member's own agenda, whatever the push is about", () => {
    expect(notificationDestination("staff", { appointmentId: "a1" })).toBe("/staff");
    expect(notificationDestination("staff", { screen: "subscription" })).toBe("/staff");
  });

  it("opens the coiffeur's subscription for news about it", () => {
    expect(notificationDestination("coiffeur", { screen: "subscription" })).toBe("/pro/account");
  });
});
