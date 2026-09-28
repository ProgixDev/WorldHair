/** Who cancelled a booking — server/src/appointments/appointments.service.ts's CancelledBy. */
export type CancelledBy = "client" | "salon" | "admin" | "system";

/**
 * « Annulé » with who did it, as each side reads it — the job's
 * cancellation of a request the salon never answered included.
 */
export function cancelledLabel(cancelledBy: CancelledBy | null | undefined, reader: "client" | "salon"): string {
  switch (cancelledBy) {
    case "admin":
      return "Annulé par WorldHair";
    case "system":
      return reader === "client" ? "Sans réponse du salon" : "Expiré sans réponse";
    case "client":
      return reader === "client" ? "Annulé par vous" : "Annulé par le client";
    case "salon":
      return reader === "salon" ? "Annulé par vous" : "Annulé par le salon";
    default:
      return "Annulé";
  }
}

/** WorldHair's reason for cancelling (a dispute), shown under the booking — also sent by push, which may never arrive. */
export function cancellationNote(appointment: {
  cancelledBy?: CancelledBy | null;
  cancellationReason?: string | null;
}): string | null {
  const reason = appointment.cancellationReason?.trim();
  return appointment.cancelledBy === "admin" && reason ? "Motif : " + reason : null;
}
