"use client";

import { AdminTopBar } from "@/components/admin/AdminTopBar";
import {
  APPOINTMENT_STATUS_STYLES,
  appointmentStatusLabel,
  canCancel,
  cancelErrorMessage,
  refundOwed,
} from "@/lib/appointments";
import { PAYMENT_STATE_STYLES, paymentState, refundErrorMessage } from "@/lib/payments";
import { cn } from "@/lib/utils";
import {
  type AdminAppointmentDetail,
  cancelAdminAppointment,
  getAdminAppointment,
  refundPayment,
} from "@/services/adminApi";
import { isAxiosError } from "axios";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

const euros = new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" });
const longDate = new Intl.DateTimeFormat("fr-FR", {
  weekday: "long",
  day: "numeric",
  month: "long",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Europe/Paris",
});
const shortDate = new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium", timeStyle: "short", timeZone: "Europe/Paris" });

const MAX_REASON = 500;

/** The server's answer to a refused request: its status and its (English) message. */
function refusal(err: unknown): { status: number | undefined; message: string } {
  if (!isAxiosError(err)) return { status: undefined, message: "" };
  const body = err.response?.data as { message?: string | string[] } | undefined;
  const message = Array.isArray(body?.message) ? body.message.join(" ") : (body?.message ?? "");
  return { status: err.response?.status, message };
}

/**
 * One booking in full (TODO.md Phase 7): both sides and how to reach them,
 * the prestations, where its money is — and, for a dispute, its
 * cancellation with a reason both sides are sent, which refunds the client.
 */
export default function AdminRendezVousDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [appointment, setAppointment] = useState<AdminAppointmentDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [cancelling, setCancelling] = useState(false);
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(() => {
    getAdminAppointment(id)
      .then((data) => {
        setAppointment(data);
        setError(null);
      })
      .catch((err: unknown) =>
        setError(
          isAxiosError(err) && (err.response?.status === 404 || err.response?.status === 400)
            ? "Ce rendez-vous n'existe pas."
            : "Impossible de charger ce rendez-vous.",
        ),
      )
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  const back = () => {
    if (window.history.length > 1) router.back();
    else router.push("/admin/rendez-vous");
  };

  const cancel = async (booking: AdminAppointmentDetail) => {
    const why = reason.trim();
    if (why.length < 3) {
      setActionError("Indiquez un motif d'au moins 3 caractères.");
      return;
    }
    const paid = booking.payment?.status === "succeeded" && booking.payment.refundedAmount < booking.payment.amount;
    const warning = paid
      ? "Le client et le salon recevront le motif, et le client sera remboursé de ce qui reste. Annuler ?"
      : "Le client et le salon recevront le motif. Annuler ?";
    if (!window.confirm(warning)) return;
    setSaving(true);
    setActionError(null);
    setNotice(null);
    try {
      const { refunded, refundFailed } = await cancelAdminAppointment(booking.id, why);
      setNotice(
        refundFailed
          ? "Rendez-vous annulé, mais le client n'a pas pu être remboursé pour l'instant : réessayez dans quelques minutes avec « Rembourser le reste »."
          : refunded > 0
            ? `Rendez-vous annulé, ${euros.format(refunded)} remboursés au client.`
            : "Rendez-vous annulé.",
      );
      setCancelling(false);
      setReason("");
      load();
    } catch (err) {
      const { status, message } = refusal(err);
      setActionError(cancelErrorMessage(status, message));
      // Cancelled meanwhile (by its client, its salon, another admin): show where it stands now.
      if (status === 400) load();
    } finally {
      setSaving(false);
    }
  };

  const refundRest = async (booking: AdminAppointmentDetail) => {
    if (!window.confirm(`Rembourser ${euros.format(refundOwed(booking))} à ${booking.client.name} ?`)) return;
    setSaving(true);
    setActionError(null);
    setNotice(null);
    try {
      const refunded = await refundPayment(booking.id);
      setNotice(`${euros.format(refunded)} remboursés au client.`);
      load();
    } catch (err) {
      const { status, message } = refusal(err);
      setActionError(refundErrorMessage(status, message));
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <AdminTopBar title="Rendez-vous" />

      <div className="min-w-0 flex-1 px-4 pt-4 pb-8 sm:px-8">
        <button
          type="button"
          onClick={back}
          className="inline-flex items-center gap-1.5 text-xs text-[#93a6bc] transition-colors hover:text-white"
        >
          <ArrowLeft className="size-3.5" aria-hidden="true" />
          Retour
        </button>

        <div className="mt-4 rounded-3xl bg-[#080f1a] p-4 sm:p-6">
          {loading && <p className="py-8 text-center text-sm text-[#93a6bc]">Chargement…</p>}
          {error && <p className="py-8 text-center text-sm text-[#ff7a70]">{error}</p>}

          {!loading && !error && appointment && (
            <AppointmentView
              appointment={appointment}
              cancelling={cancelling}
              reason={reason}
              saving={saving}
              actionError={actionError}
              notice={notice}
              onReasonChange={setReason}
              onStartCancel={() => {
                setCancelling(true);
                setActionError(null);
                setNotice(null);
              }}
              onStopCancel={() => {
                setCancelling(false);
                setReason("");
                setActionError(null);
              }}
              onCancel={() => void cancel(appointment)}
              onRefundRest={() => void refundRest(appointment)}
            />
          )}
        </div>
      </div>
    </>
  );
}

function AppointmentView({
  appointment,
  cancelling,
  reason,
  saving,
  actionError,
  notice,
  onReasonChange,
  onStartCancel,
  onStopCancel,
  onCancel,
  onRefundRest,
}: {
  appointment: AdminAppointmentDetail;
  cancelling: boolean;
  reason: string;
  saving: boolean;
  actionError: string | null;
  notice: string | null;
  onReasonChange: (value: string) => void;
  onStartCancel: () => void;
  onStopCancel: () => void;
  onCancel: () => void;
  onRefundRest: () => void;
}) {
  const { payment } = appointment;
  const owed = refundOwed(appointment);
  const state = payment ? paymentState(payment) : null;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 rounded-2xl bg-[#111c2e] p-4 sm:flex-row sm:items-center sm:gap-4 sm:p-5">
        <div className="min-w-0 flex-1">
          <p className="text-base font-medium text-[#f2f6fb] first-letter:uppercase">
            {longDate.format(new Date(appointment.startsAt))}
          </p>
          <p className="text-xs text-[#93a6bc]">
            {appointment.serviceName} · {appointment.durationMin} min · réservé le{" "}
            {shortDate.format(new Date(appointment.createdAt))}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-base font-medium text-[#f2f6fb]">{euros.format(appointment.price)}</span>
          <span className={cn("rounded-full px-3 py-1 text-xs font-medium", APPOINTMENT_STATUS_STYLES[appointment.status])}>
            {appointmentStatusLabel(appointment)}
          </span>
        </div>
      </div>

      {appointment.status === "cancelled" && appointment.cancellationReason && (
        <div className="rounded-2xl border border-[#ff7a70]/30 bg-[#ff7a70]/5 p-4">
          <p className="text-xs text-[#ff7a70]">Motif envoyé au client et au salon</p>
          <p className="mt-1 text-sm whitespace-pre-line text-[#f2f6fb]">{appointment.cancellationReason}</p>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Card title="Client">
          <Link href={`/admin/comptes/${appointment.client.id}`} className="text-sm font-medium text-[#f2f6fb] hover:text-[#2a93d5]">
            {appointment.client.name}
          </Link>
          {appointment.client.email ? (
            <a href={`mailto:${appointment.client.email}`} className="block truncate text-xs text-[#2a93d5] hover:text-white">
              {appointment.client.email}
            </a>
          ) : (
            <p className="text-xs text-[#5b7186]">E-mail indisponible</p>
          )}
        </Card>

        <Card title="Salon">
          <Link href={`/admin/comptes/${appointment.salon.id}`} className="text-sm font-medium text-[#f2f6fb] hover:text-[#2a93d5]">
            {appointment.salon.name}
          </Link>
          <p className="text-xs text-[#93a6bc]">
            {[appointment.salon.city, appointment.salon.phone].filter(Boolean).join(" · ") || "—"}
          </p>
          {appointment.salon.email && (
            <a href={`mailto:${appointment.salon.email}`} className="block truncate text-xs text-[#2a93d5] hover:text-white">
              {appointment.salon.email}
            </a>
          )}
        </Card>
      </div>

      <Card title="Prestations">
        <ul className="flex flex-col gap-1.5">
          {appointment.services.map((line, index) => (
            <li key={`${line.name}-${index}`} className="flex justify-between gap-3 text-sm text-[#f2f6fb]">
              <span className="min-w-0 truncate">
                {line.name} <span className="text-xs text-[#93a6bc]">· {line.durationMin} min</span>
              </span>
              <span className="shrink-0">{euros.format(line.price)}</span>
            </li>
          ))}
        </ul>
        {appointment.note && (
          <p className="mt-3 rounded-xl bg-white/5 p-3 text-xs whitespace-pre-line text-[#93a6bc]">
            Note du client : {appointment.note}
          </p>
        )}
      </Card>

      <Card title="Paiement">
        {payment && state ? (
          <div className="flex flex-col gap-2">
            <span className={cn("w-fit rounded-full px-3 py-1 text-xs font-medium", PAYMENT_STATE_STYLES[state])}>
              {state}
            </span>
            <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs sm:grid-cols-4">
              <Amount label="Payé" value={payment.amount} />
              <Amount label="Remboursé" value={payment.refundedAmount} />
              <Amount label="Commission" value={payment.transferAmount !== null ? payment.commissionAmount : null} />
              <Amount label="Versé au salon" value={payment.transferAmount} />
            </dl>
            <p className="text-xs text-[#5b7186]">
              {payment.transferredAt
                ? `Versé au salon le ${shortDate.format(new Date(payment.transferredAt))}.`
                : appointment.status === "cancelled" || appointment.status === "refused" || payment.refundedAmount >= payment.amount
                  ? "Non versé au salon."
                  : "Pas encore versé au salon (24 h après le rendez-vous)."}
              {payment.paymentIntentId ? (
                <>
                  {" "}Référence Stripe : <span className="font-mono select-all">{payment.paymentIntentId}</span>
                </>
              ) : null}
            </p>
          </div>
        ) : (
          <p className="text-sm text-[#93a6bc]">
            Réservé avant les paiements en ligne : rien n&apos;a été payé dans l&apos;application.
          </p>
        )}
      </Card>

      {(notice || actionError) && (
        <p className={cn("text-sm", actionError ? "text-[#ff7a70]" : "text-[#1f9d55]")}>{actionError ?? notice}</p>
      )}

      {owed > 0 && (
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            disabled={saving}
            onClick={onRefundRest}
            className="rounded-full bg-[#ff7a70] px-4 py-2 text-xs font-medium text-white hover:bg-[#ff7a70]/90 disabled:opacity-50"
          >
            Rembourser le reste ({euros.format(owed)})
          </button>
          <p className="text-xs text-[#93a6bc]">
            {appointment.status === "refused" ? "Ce rendez-vous refusé" : "Ce rendez-vous annulé"} doit encore être remboursé
            au client.
          </p>
        </div>
      )}

      {canCancel(appointment) &&
        (cancelling ? (
          <div className="flex flex-col gap-3 rounded-2xl bg-[#111c2e] p-4">
            <label className="flex flex-col gap-2">
              <span className="text-sm font-medium text-[#f2f6fb]">Motif de l&apos;annulation</span>
              <span className="text-xs text-[#93a6bc]">
                Envoyé tel quel au client et au salon.{" "}
                {payment?.status === "succeeded"
                  ? payment.transferAmount !== null
                    ? "Le client est remboursé de ce qui reste ; le salon, déjà payé, rend sa part."
                    : "Le client est remboursé de ce qui reste ; le salon ne sera pas payé."
                  : ""}
              </span>
              <textarea
                value={reason}
                onChange={(event) => onReasonChange(event.target.value)}
                maxLength={MAX_REASON}
                rows={3}
                placeholder="Ex. : le salon était fermé à l'heure du rendez-vous."
                className="rounded-xl bg-[#080f1a] p-3 text-sm text-[#f2f6fb] placeholder:text-[#5b7186] focus:outline-2 focus:outline-[#2a93d5]"
              />
              <span className="self-end text-[11px] text-[#5b7186]">
                {reason.length}/{MAX_REASON}
              </span>
            </label>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                disabled={saving}
                onClick={onCancel}
                className="rounded-full bg-[#b3261e] px-4 py-2 text-xs font-medium text-white transition-colors hover:bg-[#921f18] disabled:opacity-50"
              >
                {saving ? "Annulation…" : "Confirmer l'annulation"}
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={onStopCancel}
                className="rounded-full bg-white/10 px-4 py-2 text-xs text-[#93a6bc] hover:text-white disabled:opacity-50"
              >
                Garder le rendez-vous
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={onStartCancel}
            className="w-fit rounded-full border border-[#ff7a70]/40 px-4 py-2 text-xs text-[#ff7a70] hover:bg-[#ff7a70]/10"
          >
            Annuler le rendez-vous (litige)
          </button>
        ))}
    </div>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-1 rounded-2xl bg-[#111c2e] p-4">
      <p className="mb-1 text-xs text-[#93a6bc]">{title}</p>
      {children}
    </div>
  );
}

function Amount({ label, value }: { label: string; value: number | null }) {
  return (
    <div>
      <dt className="text-[#93a6bc]">{label}</dt>
      <dd className="text-sm text-[#f2f6fb]">{value === null ? "—" : euros.format(value)}</dd>
    </div>
  );
}
