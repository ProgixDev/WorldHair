import {
  appointmentQuery,
  appointmentStatusLabel,
  canCancel,
  cancelErrorMessage,
  filtersFromSearch,
  filtersToSearch,
  refundOwed,
} from "./appointments";
import type { AdminAppointment, AdminAppointmentPayment } from "@/services/adminApi";

function appointment(overrides: Partial<AdminAppointment>): AdminAppointment {
  return {
    id: "apt-1",
    startsAt: "2026-10-01T08:00:00.000Z",
    durationMin: 60,
    serviceName: "Coupe & brushing",
    price: 40,
    status: "confirmed",
    attendance: null,
    cancelledBy: null,
    salon: { id: "salon-1", name: "Studio W" },
    client: { id: "client-1", name: "Camille Durand" },
    payment: null,
    createdAt: "2026-09-28T10:00:00.000Z",
    ...overrides,
  };
}

function paid(overrides: Partial<AdminAppointmentPayment> = {}): AdminAppointmentPayment {
  return {
    status: "succeeded",
    amount: 40,
    refundedAmount: 0,
    commissionAmount: 4,
    transferAmount: null,
    transferredAt: null,
    ...overrides,
  };
}

describe("appointmentQuery", () => {
  it("sends the filters filled in, trimmed, and the page as limit/offset", () => {
    expect(
      appointmentQuery({ status: "upcoming", salon: "  studio  ", client: "", from: "2026-10-01", to: "" }, 3, 20),
    ).toEqual({ status: "upcoming", salon: "studio", from: "2026-10-01", limit: 20, offset: 40 });
    expect(appointmentQuery({}, 1, 20)).toEqual({ limit: 20, offset: 0 });
  });

  it("leaves out a day the server would refuse — outside 2000–2099, or not a real one", () => {
    expect(appointmentQuery({ from: "1999-12-31", to: "9999-12-31" }, 1, 20)).toEqual({ limit: 20, offset: 0 });
    expect(appointmentQuery({ from: "2026-02-30" }, 1, 20)).toEqual({ limit: 20, offset: 0 });
  });
});

describe("filters in the address", () => {
  it("round-trips through the page's query string, unknown statuses left out", () => {
    const filters = { status: "cancelled" as const, salon: "Studio", client: "Camille", from: "2026-10-01", to: "2026-10-31" };
    expect(filtersFromSearch(new URLSearchParams(filtersToSearch(filters)))).toEqual(filters);
    expect(filtersToSearch({ salon: "  ", status: undefined })).toBe("");
    expect(filtersFromSearch(new URLSearchParams("status=soon&from=demain&to=2026-13-01"))).toEqual({});
  });
});

describe("appointmentStatusLabel", () => {
  it("names each status, and who cancelled", () => {
    expect(appointmentStatusLabel(appointment({ status: "pending" }))).toBe("Demande en attente");
    expect(appointmentStatusLabel(appointment({ status: "confirmed" }))).toBe("Confirmé");
    expect(appointmentStatusLabel(appointment({ status: "done" }))).toBe("Terminé");
    expect(appointmentStatusLabel(appointment({ status: "done", attendance: "no_show" }))).toBe("Client absent");
    expect(appointmentStatusLabel(appointment({ status: "refused" }))).toBe("Refusé par le salon");
    expect(appointmentStatusLabel(appointment({ status: "cancelled", cancelledBy: "client" }))).toBe("Annulé par le client");
    expect(appointmentStatusLabel(appointment({ status: "cancelled", cancelledBy: "salon" }))).toBe("Annulé par le salon");
    expect(appointmentStatusLabel(appointment({ status: "cancelled", cancelledBy: "admin" }))).toBe("Annulé par WorldHair");
    expect(appointmentStatusLabel(appointment({ status: "cancelled", cancelledBy: "system" }))).toBe("Expiré sans réponse");
    expect(appointmentStatusLabel(appointment({ status: "cancelled" }))).toBe("Annulé");
  });
});

describe("canCancel", () => {
  it("lets WorldHair cancel a request or an accepted booking, even over — never twice", () => {
    expect(canCancel(appointment({ status: "pending" }))).toBe(true);
    expect(canCancel(appointment({ status: "confirmed" }))).toBe(true);
    expect(canCancel(appointment({ status: "done" }))).toBe(true);
    expect(canCancel(appointment({ status: "cancelled" }))).toBe(false);
    expect(canCancel(appointment({ status: "refused" }))).toBe(false);
  });
});

describe("refundOwed", () => {
  it("is what a cancelled or refused booking still owes its client", () => {
    expect(refundOwed(appointment({ status: "cancelled", payment: paid({ refundedAmount: 10.5 }) }))).toBe(29.5);
    expect(refundOwed(appointment({ status: "refused", payment: paid() }))).toBe(40);
    expect(refundOwed(appointment({ status: "cancelled", payment: paid({ refundedAmount: 40 }) }))).toBe(0);
    expect(refundOwed(appointment({ status: "cancelled", payment: paid({ status: "canceled" }) }))).toBe(0);
    expect(refundOwed(appointment({ status: "cancelled", payment: null }))).toBe(0);
    // Still on: a partial refund is the payments page's to make.
    expect(refundOwed(appointment({ status: "confirmed", payment: paid() }))).toBe(0);
  });
});

describe("cancelErrorMessage", () => {
  it("explains a refusal in French", () => {
    expect(cancelErrorMessage(400, "Only a request or an accepted booking can be cancelled")).toBe(
      "Ce rendez-vous est déjà annulé ou refusé.",
    );
    expect(cancelErrorMessage(400, "reason must be longer than or equal to 3 characters")).toBe(
      "Indiquez un motif d'au moins 3 caractères.",
    );
    expect(cancelErrorMessage(404, "Appointment not found")).toBe("Ce rendez-vous n'existe plus.");
    expect(cancelErrorMessage(undefined, "")).toBe("Annulation impossible. Réessayez.");
  });
});
