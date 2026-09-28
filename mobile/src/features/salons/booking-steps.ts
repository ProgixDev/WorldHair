/**
 * The booking wizard's way around its payment step. Nothing is paid twice: a
 * reschedule moves a booking that's already paid, and a client sent back to
 * the grid (their slot was taken meanwhile) has already paid this total.
 */
interface StepContext {
  isReschedule: boolean;
  /** What the client already paid in this wizard, if anything. */
  paidAmount: number | null;
  /** The picked prestations' total. */
  total: number;
}

function paymentDone({ isReschedule, paidAmount, total }: StepContext): boolean {
  return isReschedule || paidAmount === total;
}

/** "Continuer" on the slot step. */
export function stepAfterSlot(context: StepContext): "payment" | "confirm" {
  return paymentDone(context) ? "confirm" : "payment";
}

/** "Retour" on the recap. */
export function stepBeforeConfirm(context: StepContext): "payment" | "slot" {
  return paymentDone(context) ? "slot" : "payment";
}
