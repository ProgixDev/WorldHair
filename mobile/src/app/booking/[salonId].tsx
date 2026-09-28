import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { PaymentSheetError, useStripe } from "@stripe/stripe-react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Linking, Pressable, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { BottomSheet } from "../../components/ui/BottomSheet";
import { Button } from "../../components/ui/Button";
import { elevation } from "../../constants/elevation";
import { useResponsive } from "../../constants/responsive";
import { radius, spacing } from "../../constants/spacing";
import { typography } from "../../constants/typography";
import { useTheme } from "../../contexts/ThemeContext";
import { fetchSalonById, fetchSlots } from "../../features/salons/api";
import { bookingRuleLines } from "../../features/salons/rules";
import { bookingDays, dateKey, type DaySlots } from "../../features/salons/slots";
import type { Salon, Service } from "../../features/salons/types";
import { getAdSlot, type AdSlot } from "../../services/ads";
import {
  BookingError,
  bookAppointment,
  confirmPayment,
  listAppointments,
  releaseHold,
  rescheduleAppointment,
  type Appointment,
} from "../../services/booking";
import {
  dayAndMonth,
  formatDuration,
  formatPrice,
  fullDate,
  relativeDay,
  timeOfDay,
  weekdayShort,
} from "../../utils/date";

type Step = "service" | "slot" | "payment" | "confirm";
/** A new booking ends on paying for it (the recap sits on that step); moving one ends on confirming the new time. */
const BOOKING_STEPS: { id: Step; label: string }[] = [
  { id: "service", label: "Prestation" },
  { id: "slot", label: "Créneau" },
  { id: "payment", label: "Paiement" },
];
const RESCHEDULE_STEPS: { id: Step; label: string }[] = [
  { id: "slot", label: "Créneau" },
  { id: "confirm", label: "Confirmation" },
];

/** The slot held while the client pays (server-side, 15 minutes at most), and what Stripe's sheet was set up with. */
interface Hold {
  appointmentId: string;
  startsAt: string;
}

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** Two weeks of the salon's open days in the strip. */
const DAYS_SHOWN = 14;

/** What the recap and footer show, for a new booking or the one being moved. */
interface Line {
  name: string;
  durationMin: number;
  price: number;
}

/**
 * Booking wizard styled as a ticket: a perforated stub for the recap, a day
 * strip and a slot grid. Several prestations can be picked; they run back to
 * back as one appointment. The grid comes from the server, built from the
 * same rules that accept or refuse the booking.
 */
export default function BookingFlow() {
  const { salonId, serviceId, appointmentId } = useLocalSearchParams<{
    salonId: string;
    serviceId?: string;
    appointmentId?: string;
  }>();
  const router = useRouter();
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const { gutter, width, isExpanded } = useResponsive();
  // A tablet should show more columns of slots, not four giant stretched
  // pills — per AGENTS.md, bigger screens earn more content.
  const slotColumns = isExpanded ? 6 : 4;

  const [salon, setSalon] = useState<Salon | null | undefined>(undefined);
  const isReschedule = Boolean(appointmentId);
  const steps = isReschedule ? RESCHEDULE_STEPS : BOOKING_STEPS;
  const { initPaymentSheet, presentPaymentSheet } = useStripe();

  const [step, setStep] = useState<Step>(
    serviceId || isReschedule ? "slot" : "service",
  );
  /** New booking: the prestations picked, in the order they'll happen. */
  const [picked, setPicked] = useState<Service[]>([]);
  /** Reschedule: the appointment being moved (its prestations stay the same). */
  const [moving, setMoving] = useState<Appointment | null>(null);
  const [day, setDay] = useState<Date | null>(null);
  const [daySlots, setDaySlots] = useState<DaySlots | null>(null);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [slotsError, setSlotsError] = useState<string | null>(null);
  /** Bumped to fetch the grid again, e.g. after a slot was taken in the meantime. */
  const [slotsVersion, setSlotsVersion] = useState(0);
  const [slotStart, setSlotStart] = useState<string | null>(null);
  const [confirmationAd, setConfirmationAd] = useState<AdSlot | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [booked, setBooked] = useState<Appointment | null>(null);
  /** Kept in a ref too: leaving the screen releases the hold, whatever render we're on. */
  const hold = useRef<Hold | null>(null);

  // Leaving before paying gives the slot back at once (the server would after 15 minutes).
  useEffect(
    () => () => {
      if (hold.current) void releaseHold(hold.current.appointmentId);
    },
    [],
  );

  useEffect(() => {
    let cancelled = false;
    getAdSlot("booking_confirmation").then((slot) => {
      if (!cancelled) setConfirmationAd(slot);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetchSalonById(String(salonId)).then((found) => {
      if (cancelled) return;
      setSalon(found ?? null);
      const preselected = found?.services.find((service) => service.id === serviceId);
      if (preselected) setPicked([preselected]);
    });
    return () => {
      cancelled = true;
    };
  }, [salonId, serviceId]);

  useEffect(() => {
    if (!appointmentId) return;
    let cancelled = false;
    listAppointments().then((appointments) => {
      if (!cancelled) setMoving(appointments.find((a) => a.id === appointmentId) ?? null);
    });
    return () => {
      cancelled = true;
    };
  }, [appointmentId]);

  const days = useMemo(() => (salon ? bookingDays(salon, DAYS_SHOWN) : []), [salon]);

  useEffect(() => {
    if (!day && days.length > 0) setDay((days.find((d) => !d.closed) ?? days[0]).date);
  }, [day, days]);

  const pickedIds = picked.map((service) => service.id).join(",");
  const ready = isReschedule ? Boolean(appointmentId) : pickedIds.length > 0;

  useEffect(() => {
    if (step !== "slot" || !salon || !day || !ready) return;
    let cancelled = false;
    setSlotsLoading(true);
    setSlotsError(null);
    setSlotStart(null);
    fetchSlots(
      salon.id,
      dateKey(day),
      isReschedule ? { appointmentId: String(appointmentId) } : { serviceIds: pickedIds.split(",") },
    )
      .then((result) => {
        if (!cancelled) setDaySlots(result);
      })
      .catch(() => {
        if (!cancelled) setSlotsError("Impossible de charger les créneaux. Réessayez.");
      })
      .finally(() => {
        if (!cancelled) setSlotsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [step, salon, day, ready, isReschedule, appointmentId, pickedIds, slotsVersion]);

  if (salon === undefined)
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: theme.background.dark,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <ActivityIndicator color={theme.primary.main} />
      </View>
    );

  if (!salon)
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: theme.background.dark,
          alignItems: "center",
          justifyContent: "center",
          gap: spacing.lg,
        }}
      >
        <Text style={[typography.h2, { color: theme.foreground.white }]}>
          Salon introuvable
        </Text>
        <Button label="Retour" onPress={() => router.back()} />
      </View>
    );

  const lines: Line[] = isReschedule
    ? (moving?.services ?? []).map((line) => ({
        name: line.name,
        durationMin: line.durationMin,
        price: line.price,
      }))
    : picked.map((service) => ({
        name: service.name,
        durationMin: service.durationMin,
        price: service.price,
      }));
  const totalDuration = lines.reduce((sum, line) => sum + line.durationMin, 0);
  const totalPrice = lines.reduce((sum, line) => sum + line.price, 0);
  const summary =
    lines.length === 1 ? lines[0].name : lines.length + " prestations";
  const startsAt = slotStart ? new Date(slotStart) : null;
  const [, cancellationRule, confirmationRule] = bookingRuleLines(salon);

  const toggleService = (service: Service) =>
    setPicked((current) =>
      current.some((item) => item.id === service.id)
        ? current.filter((item) => item.id !== service.id)
        : [...current, service],
    );

  const releaseCurrentHold = () => {
    if (hold.current) void releaseHold(hold.current.appointmentId);
    hold.current = null;
  };

  /** After the sheet: the server checks with Stripe and sends the request — a moment for a bank to answer. */
  const confirmUntilSent = async (id: string): Promise<Appointment> => {
    let appointment = await confirmPayment(id);
    for (let tries = 0; appointment.status === "awaiting_payment" && tries < 4; tries += 1) {
      await wait(1500);
      appointment = await confirmPayment(id);
    }
    return appointment;
  };

  /**
   * Holds the slot and charges it with Stripe's payment sheet (card, Google
   * Pay): the salon only gets the request once it's paid. A declined card or
   * a closed sheet keeps the same hold for another try.
   */
  const handlePay = async () => {
    if (!startsAt || !slotStart) return;
    setError(null);
    setSubmitting(true);
    try {
      if (hold.current?.startsAt !== slotStart) {
        releaseCurrentHold();
        const { appointment, payment } = await bookAppointment({
          salonId: salon.id,
          serviceIds: picked.map((service) => service.id),
          startsAt,
        });
        hold.current = { appointmentId: appointment.id, startsAt: slotStart };
        const { error: initError } = await initPaymentSheet({
          merchantDisplayName: "WorldHair",
          paymentIntentClientSecret: payment.clientSecret,
          returnURL: "worldhair://stripe-redirect",
          defaultBillingDetails: { address: { country: "FR" } },
          googlePay: { merchantCountryCode: "FR", currencyCode: "EUR", testEnv: __DEV__ },
        });
        if (initError) {
          releaseCurrentHold();
          setError("Le paiement n'a pas pu s'ouvrir. Réessayez.");
          return;
        }
      }

      const { error: sheetError } = await presentPaymentSheet();
      if (sheetError) {
        if (sheetError.code !== PaymentSheetError.Canceled) setError(sheetError.message);
        return;
      }

      const appointment = await confirmUntilSent(hold.current!.appointmentId);
      hold.current = null;
      setBooked(appointment);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Paiement impossible. Réessayez.");
      // Someone else got there first (or the salon changed something): show
      // the day's grid again, up to date, so another time can be picked.
      if (err instanceof BookingError && err.code === "SLOT_TAKEN") {
        setStep("slot");
        setSlotsVersion((version) => version + 1);
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleConfirm = async () => {
    if (!startsAt) return;
    setError(null);
    setSubmitting(true);
    try {
      setBooked(await rescheduleAppointment(String(appointmentId), startsAt));
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Réservation impossible. Réessayez.",
      );
      // Someone else got there first (or the salon changed something): show
      // the day's grid again, up to date, so another time can be picked.
      if (err instanceof BookingError && err.code === "SLOT_TAKEN") {
        setStep("slot");
        setSlotsVersion((version) => version + 1);
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (booked)
    return (
      <BookingSuccess
        salonName={salon.name}
        serviceLabel={booked.serviceName}
        startsAt={new Date(booked.startsAt)}
        isReschedule={isReschedule}
        pending={booked.status === "pending"}
        awaitingPayment={booked.status === "awaiting_payment"}
        adSlot={confirmationAd}
        onAppointments={() => router.replace("/appointments" as never)}
        onHome={() => router.replace("/discover" as never)}
      />
    );

  const canContinue =
    step === "service"
      ? picked.length > 0
      : step === "slot"
        ? slotStart !== null
        : true;

  const goNext = () => {
    if (step === "service") return setStep("slot");
    if (step === "slot") return setStep(isReschedule ? "confirm" : "payment");
    if (step === "payment") return void handlePay();
    void handleConfirm();
  };

  const goBack = () => {
    setError(null);
    if (step === "confirm") return setStep("slot");
    if (step === "payment") {
      releaseCurrentHold();
      return setStep("slot");
    }
    if (step === "slot" && !isReschedule) return setStep("service");
    router.back();
  };

  return (
    <View style={{ flex: 1, backgroundColor: theme.background.dark }}>
      {/* Ticket header */}
      <View
        style={{
          paddingTop: insets.top + spacing.sm,
          paddingHorizontal: gutter,
          paddingBottom: spacing.lg,
          backgroundColor: theme.surface.base,
          borderBottomWidth: 1,
          borderColor: theme.divider,
          gap: spacing.lg,
        }}
      >
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: spacing.md,
          }}
        >
          <Pressable
            onPress={goBack}
            accessibilityRole="button"
            accessibilityLabel="Retour"
            hitSlop={8}
            style={{ width: 32, height: 32, justifyContent: "center" }}
          >
            <MaterialCommunityIcons
              name="chevron-left"
              size={26}
              color={theme.foreground.white}
            />
          </Pressable>
          <View style={{ flex: 1, gap: 2 }}>
            <Text
              style={[typography.h2, { color: theme.foreground.white }]}
              numberOfLines={1}
            >
              {isReschedule ? "Modifier le RDV" : salon.name}
            </Text>
            <Text
              style={[typography.caption, { color: theme.foreground.gray }]}
            >
              {salon.addressLine + ", " + salon.city}
            </Text>
          </View>
        </View>

        {/* Perforated step rail */}
        <View
          style={{ flexDirection: "row", alignItems: "center" }}
          accessibilityRole="progressbar"
        >
          {steps.map((item, index) => {
            const currentIndex = steps.findIndex((s) => s.id === step);
            const done = index < currentIndex;
            const active = index === currentIndex;
            return (
              <React.Fragment key={item.id}>
                <View style={{ alignItems: "center", gap: 4, width: 78 }}>
                  <View
                    style={{
                      width: 26,
                      height: 26,
                      borderRadius: radius.full,
                      alignItems: "center",
                      justifyContent: "center",
                      backgroundColor:
                        done || active ? theme.primary.main : "transparent",
                      borderWidth: done || active ? 0 : 1,
                      borderColor: theme.border,
                    }}
                  >
                    {done ? (
                      <MaterialCommunityIcons
                        name="check"
                        size={15}
                        color={theme.primary.on}
                      />
                    ) : (
                      <Text
                        style={[
                          typography.caption,
                          {
                            color: active
                              ? theme.primary.on
                              : theme.foreground.gray,
                          },
                        ]}
                      >
                        {index + 1}
                      </Text>
                    )}
                  </View>
                  <Text
                    style={[
                      typography.caption,
                      {
                        color: active
                          ? theme.foreground.white
                          : theme.foreground.gray,
                      },
                    ]}
                    numberOfLines={1}
                  >
                    {item.label}
                  </Text>
                </View>

                {index < steps.length - 1 ? (
                  <View
                    style={{
                      flex: 1,
                      height: 1,
                      marginBottom: 18,
                      borderBottomWidth: 1,
                      borderStyle: "dashed",
                      borderColor: theme.border,
                    }}
                  />
                ) : null}
              </React.Fragment>
            );
          })}
        </View>
      </View>

      <ScrollView
        contentContainerStyle={{
          padding: gutter,
          paddingBottom: insets.bottom + 120,
          gap: spacing.lg,
        }}
        showsVerticalScrollIndicator={false}
      >
        {step === "service" ? (
          <View style={{ gap: spacing.md }}>
            <Text style={[typography.h1, { color: theme.foreground.white }]}>
              Quelles prestations ?
            </Text>
            <Text
              style={[typography.bodySmall, { color: theme.foreground.gray }]}
            >
              Choisissez-en une ou plusieurs : elles s&apos;enchaînent dans le
              même rendez-vous.
            </Text>
            {salon.services.map((service) => {
              const order = picked.findIndex((item) => item.id === service.id);
              const selected = order !== -1;
              return (
                <Pressable
                  key={service.id}
                  onPress={() => toggleService(service)}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: selected }}
                  style={[
                    {
                      flexDirection: "row",
                      alignItems: "center",
                      gap: spacing.md,
                      padding: spacing.lg,
                      borderRadius: radius.xl,
                      borderWidth: selected ? 2 : 1,
                      borderColor: selected
                        ? theme.primary.main
                        : theme.divider,
                      backgroundColor: selected
                        ? theme.primary.soft
                        : theme.surface.raised,
                    },
                    // No shadow under the see-through selected tint: Android would show it through the card.
                    selected ? null : elevation(1, theme.shadow),
                  ]}
                >
                  <View
                    style={{
                      width: 24,
                      height: 24,
                      borderRadius: radius.full,
                      alignItems: "center",
                      justifyContent: "center",
                      borderWidth: selected ? 0 : 1.5,
                      borderColor: theme.border,
                      backgroundColor: selected ? theme.primary.main : "transparent",
                    }}
                  >
                    {selected ? (
                      <Text style={[typography.caption, { color: theme.primary.on }]}>
                        {order + 1}
                      </Text>
                    ) : null}
                  </View>
                  <View style={{ flex: 1, gap: 2 }}>
                    <Text
                      style={[
                        typography.bodyMedium,
                        { color: theme.foreground.white },
                      ]}
                    >
                      {service.name}
                    </Text>
                    <Text
                      style={[
                        typography.caption,
                        { color: theme.foreground.gray },
                      ]}
                    >
                      {formatDuration(service.durationMin)}
                    </Text>
                  </View>
                  <Text style={[typography.h2, { color: theme.primary.main }]}>
                    {formatPrice(service.price)}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        ) : null}

        {step === "slot" ? (
          <View style={{ gap: spacing.xl }}>
            <Text style={[typography.h1, { color: theme.foreground.white }]}>
              Quand ça vous arrange ?
            </Text>

            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ gap: spacing.sm }}
            >
              {days.map((candidate) => {
                const selected = day
                  ? candidate.date.getTime() === day.getTime()
                  : false;
                const foreground = selected
                  ? theme.primary.on
                  : candidate.closed
                    ? theme.foreground.gray
                    : theme.foreground.white;
                return (
                  <Pressable
                    key={candidate.date.toISOString()}
                    onPress={() => setDay(candidate.date)}
                    disabled={candidate.closed}
                    accessibilityRole="button"
                    accessibilityState={{ selected, disabled: candidate.closed }}
                    accessibilityLabel={
                      fullDate(candidate.date) + (candidate.closed ? ", fermé" : "")
                    }
                    style={{
                      width: 68,
                      paddingVertical: spacing.lg,
                      borderRadius: radius.lg,
                      alignItems: "center",
                      gap: 2,
                      backgroundColor: selected
                        ? theme.primary.main
                        : theme.surface.raised,
                      borderWidth: 1.5,
                      borderColor: selected
                        ? theme.primary.main
                        : theme.divider,
                      opacity: candidate.closed ? 0.45 : 1,
                    }}
                  >
                    <Text
                      style={[
                        typography.caption,
                        {
                          color: selected
                            ? theme.primary.on
                            : theme.foreground.gray,
                        },
                      ]}
                    >
                      {weekdayShort(candidate.date)}
                    </Text>
                    <Text style={[typography.bodyMedium, { color: foreground }]}>
                      {candidate.date.getDate()}
                    </Text>
                    <Text
                      style={[
                        typography.caption,
                        {
                          color: selected
                            ? theme.primary.on
                            : theme.foreground.gray,
                          fontSize: 10,
                        },
                      ]}
                    >
                      {candidate.closed
                        ? "Fermé"
                        : dayAndMonth(candidate.date).split(" ")[1]}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>

            <View style={{ gap: spacing.md }}>
              <Text
                style={[typography.overline, { color: theme.foreground.gray }]}
              >
                {day ? relativeDay(day).toUpperCase() : ""}
              </Text>

              {slotsLoading ? (
                <ActivityIndicator color={theme.primary.main} />
              ) : slotsError ? (
                <View style={{ gap: spacing.sm, alignItems: "flex-start" }}>
                  <Text style={[typography.bodySmall, { color: theme.danger }]}>
                    {slotsError}
                  </Text>
                  <Button
                    label="Réessayer"
                    variant="outline"
                    onPress={() => setSlotsVersion((version) => version + 1)}
                  />
                </View>
              ) : !daySlots || daySlots.closed || daySlots.slots.length === 0 ? (
                <Text
                  style={[
                    typography.bodySmall,
                    { color: theme.foreground.gray },
                  ]}
                >
                  {daySlots?.closed
                    ? "Le salon est fermé ce jour-là. Essayez une autre date."
                    : "Aucun créneau ce jour-là. Essayez une autre date."}
                </Text>
              ) : (
                <View
                  style={{
                    flexDirection: "row",
                    flexWrap: "wrap",
                    gap: spacing.sm,
                  }}
                >
                  {daySlots.slots.map((slot) => {
                    const selected = slotStart === slot.startsAt;
                    return (
                      <Pressable
                        key={slot.startsAt}
                        onPress={() =>
                          slot.available ? setSlotStart(slot.startsAt) : null
                        }
                        disabled={!slot.available}
                        accessibilityRole="button"
                        accessibilityState={{
                          selected,
                          disabled: !slot.available,
                        }}
                        style={{
                          width:
                            (width -
                              gutter * 2 -
                              spacing.sm * (slotColumns - 1)) /
                            slotColumns,
                          minHeight: 52,
                          alignItems: "center",
                          justifyContent: "center",
                          borderRadius: radius.lg,
                          borderWidth: 1.5,
                          borderColor: selected
                            ? theme.primary.main
                            : theme.divider,
                          backgroundColor: selected
                            ? theme.primary.main
                            : theme.surface.raised,
                          opacity: slot.available ? 1 : 0.3,
                        }}
                      >
                        <Text
                          style={[
                            typography.label,
                            {
                              color: selected
                                ? theme.primary.on
                                : theme.foreground.white,
                              textDecorationLine: slot.available
                                ? "none"
                                : "line-through",
                            },
                          ]}
                        >
                          {slot.label}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              )}
            </View>

            {error ? (
              <Text style={[typography.bodySmall, { color: theme.danger }]}>
                {error}
              </Text>
            ) : null}
          </View>
        ) : null}

        {step === "payment" && lines.length > 0 && startsAt ? (
          <View style={{ gap: spacing.lg }}>
            <Text style={[typography.h1, { color: theme.foreground.white }]}>
              Réglez pour envoyer la demande.
            </Text>

            <TicketCard
              salonName={salon.name}
              stylist={salon.stylist}
              lines={lines}
              totalDuration={totalDuration}
              totalPrice={totalPrice}
              startsAt={startsAt}
              address={
                salon.addressLine + ", " + salon.postalCode + " " + salon.city
              }
            />

            <View style={{ gap: 2 }}>
              <Text
                style={[typography.caption, { color: theme.foreground.gray }]}
              >
                {"Le montant est prélevé maintenant ; " +
                  confirmationRule.charAt(0).toLowerCase() +
                  confirmationRule.slice(1) +
                  "."}
              </Text>
              <Text
                style={[typography.caption, { color: theme.foreground.gray }]}
              >
                Remboursé intégralement si le salon refuse ou annule, ou si
                vous annulez dans les délais.
              </Text>
              <Text
                style={[typography.caption, { color: theme.foreground.gray }]}
              >
                {cancellationRule + " le rendez-vous."}
              </Text>
            </View>

            <View
              style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}
            >
              <MaterialCommunityIcons
                name="lock-outline"
                size={16}
                color={theme.foreground.gray}
              />
              <Text
                style={[
                  typography.caption,
                  { color: theme.foreground.gray, flex: 1 },
                ]}
              >
                Paiement sécurisé par Stripe : vos données bancaires ne
                transitent jamais par WorldHair.
              </Text>
            </View>

            {error ? (
              <Text style={[typography.bodySmall, { color: theme.danger }]}>
                {error}
              </Text>
            ) : null}
          </View>
        ) : null}

        {step === "confirm" && lines.length > 0 && startsAt ? (
          <View style={{ gap: spacing.lg }}>
            <Text style={[typography.h1, { color: theme.foreground.white }]}>
              On récapitule.
            </Text>

            <TicketCard
              salonName={salon.name}
              stylist={salon.stylist}
              lines={lines}
              totalDuration={totalDuration}
              totalPrice={totalPrice}
              startsAt={startsAt}
              address={
                salon.addressLine + ", " + salon.postalCode + " " + salon.city
              }
            />

            <View style={{ gap: 2 }}>
              <Text
                style={[typography.caption, { color: theme.foreground.gray }]}
              >
                {cancellationRule + " le rendez-vous."}
              </Text>
              {!isReschedule ? (
                <Text
                  style={[typography.caption, { color: theme.foreground.gray }]}
                >
                  {confirmationRule + "."}
                </Text>
              ) : null}
            </View>

            {error ? (
              <Text style={[typography.bodySmall, { color: theme.danger }]}>
                {error}
              </Text>
            ) : null}
          </View>
        ) : null}
      </ScrollView>

      <View
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          bottom: 0,
          paddingHorizontal: gutter,
          paddingTop: spacing.md,
          paddingBottom: Math.max(insets.bottom, spacing.md),
          backgroundColor: theme.surface.raised,
          borderTopWidth: 1,
          borderColor: theme.divider,
          gap: spacing.sm,
          ...elevation(3, theme.shadow),
        }}
      >
        {lines.length > 0 ? (
          <View
            style={{
              flexDirection: "row",
              justifyContent: "space-between",
              gap: spacing.md,
            }}
          >
            <Text
              style={[
                typography.caption,
                { color: theme.foreground.gray, flex: 1 },
              ]}
              numberOfLines={1}
            >
              {summary +
                " · " +
                formatDuration(totalDuration) +
                (startsAt
                  ? " · " + relativeDay(startsAt) + " " + timeOfDay(startsAt)
                  : "")}
            </Text>
            <Text style={[typography.label, { color: theme.foreground.white }]}>
              {formatPrice(totalPrice)}
            </Text>
          </View>
        ) : null}

        <Button
          label={
            step === "payment"
              ? "Payer " + formatPrice(totalPrice)
              : step === "confirm"
                ? isReschedule
                  ? "Confirmer le changement"
                  : "Confirmer la réservation"
                : "Continuer"
          }
          onPress={goNext}
          disabled={!canContinue}
          loading={submitting}
        />
      </View>
    </View>
  );
}

/** Perforated recap card — the visual signature of this flow. */
function TicketCard({
  salonName,
  stylist,
  lines,
  totalDuration,
  totalPrice,
  startsAt,
  address,
}: {
  salonName: string;
  stylist: string;
  lines: Line[];
  totalDuration: number;
  totalPrice: number;
  startsAt: Date;
  address: string;
}) {
  const { theme } = useTheme();

  return (
    <View
      style={[
        {
          borderRadius: radius.xl,
          backgroundColor: theme.surface.raised,
          borderWidth: 1,
          borderColor: theme.divider,
          overflow: "hidden",
        },
        elevation(2, theme.shadow),
      ]}
    >
      <View style={{ padding: spacing.xl, gap: spacing.xs }}>
        <Text style={[typography.overline, { color: theme.accent.warm }]}>
          RENDEZ-VOUS
        </Text>
        <Text style={[typography.h1, { color: theme.foreground.white }]}>
          {salonName}
        </Text>
        <Text style={[typography.bodySmall, { color: theme.foreground.gray }]}>
          {"avec " + stylist}
        </Text>
      </View>

      {/* Perforation */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
        }}
      >
        <View
          style={{
            width: 20,
            height: 20,
            borderRadius: radius.full,
            marginLeft: -10,
            backgroundColor: theme.background.dark,
          }}
        />
        <View
          style={{
            flex: 1,
            borderBottomWidth: 1,
            borderStyle: "dashed",
            borderColor: theme.border,
          }}
        />
        <View
          style={{
            width: 20,
            height: 20,
            borderRadius: radius.full,
            marginRight: -10,
            backgroundColor: theme.background.dark,
          }}
        />
      </View>

      <View style={{ padding: spacing.xl, gap: spacing.md }}>
        {lines.map((line, index) => (
          <TicketRow
            key={index}
            label={
              lines.length === 1 ? "Prestation" : "Prestation " + (index + 1)
            }
            value={line.name + " · " + formatDuration(line.durationMin)}
          />
        ))}
        <TicketRow label="Durée" value={formatDuration(totalDuration)} />
        <TicketRow label="Date" value={fullDate(startsAt)} />
        <TicketRow label="Heure" value={timeOfDay(startsAt)} />
        <TicketRow label="Adresse" value={address} />
        <View
          style={{
            marginTop: spacing.sm,
            paddingTop: spacing.md,
            borderTopWidth: 1,
            borderColor: theme.border,
            flexDirection: "row",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <Text style={[typography.label, { color: theme.foreground.gray }]}>
            Total
          </Text>
          <Text style={[typography.h1, { color: theme.primary.main }]}>
            {formatPrice(totalPrice)}
          </Text>
        </View>
      </View>
    </View>
  );
}

function TicketRow({ label, value }: { label: string; value: string }) {
  const { theme } = useTheme();
  return (
    <View style={{ flexDirection: "row", gap: spacing.md }}>
      <Text
        style={[
          typography.bodySmall,
          { color: theme.foreground.gray, width: 92 },
        ]}
      >
        {label}
      </Text>
      <Text
        style={[
          typography.bodySmall,
          { color: theme.foreground.white, flex: 1 },
        ]}
      >
        {value}
      </Text>
    </View>
  );
}

function BookingSuccess({
  salonName,
  serviceLabel,
  startsAt,
  isReschedule,
  pending,
  awaitingPayment,
  adSlot,
  onAppointments,
  onHome,
}: {
  salonName: string;
  /** Every prestation's name, joined. */
  serviceLabel: string;
  startsAt: Date;
  isReschedule: boolean;
  /** Awaiting the coiffeur's decision — not confirmed yet. */
  pending: boolean;
  /** Paid, but the bank hasn't confirmed yet (rare with cards): the request leaves once it does. */
  awaitingPayment: boolean;
  adSlot: AdSlot | null;
  onAppointments: () => void;
  onHome: () => void;
}) {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const { gutter } = useResponsive();
  const [popupVisible, setPopupVisible] = useState(Boolean(adSlot?.active));

  return (
    <View
      style={{
        flex: 1,
        backgroundColor: theme.background.dark,
        paddingHorizontal: gutter,
        paddingTop: insets.top + spacing.xxl,
        paddingBottom: Math.max(insets.bottom, spacing.lg),
        justifyContent: "space-between",
      }}
    >
      <View
        style={{
          alignItems: "center",
          gap: spacing.xl,
          flex: 1,
          justifyContent: "center",
        }}
      >
        <View
          style={{
            width: 96,
            height: 96,
            borderRadius: radius.full,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: theme.primary.main,
          }}
        >
          <MaterialCommunityIcons
            name="check"
            size={48}
            color={theme.primary.on}
          />
        </View>

        <View style={{ gap: spacing.sm, alignItems: "center" }}>
          <Text
            style={[
              typography.display,
              { color: theme.foreground.white, textAlign: "center" },
            ]}
          >
            {isReschedule
              ? "Rendez-vous déplacé."
              : awaitingPayment
                ? "Paiement en cours."
                : pending
                  ? "Demande envoyée."
                  : "C'est réservé."}
          </Text>
          <Text
            style={[
              typography.body,
              { color: theme.foreground.gray, textAlign: "center" },
            ]}
          >
            {salonName +
              " · " +
              serviceLabel +
              " · " +
              relativeDay(startsAt).toLowerCase() +
              " à " +
              timeOfDay(startsAt)}
          </Text>
          {!isReschedule ? (
            <Text
              style={[
                typography.caption,
                { color: theme.foreground.gray, textAlign: "center" },
              ]}
            >
              {awaitingPayment
                ? "Votre demande partira au salon dès que votre banque aura confirmé le paiement."
                : pending
                  ? "Paiement reçu. Le salon doit encore confirmer votre créneau."
                  : "Paiement reçu. Le salon a confirmé votre rendez-vous."}
            </Text>
          ) : null}
        </View>
      </View>

      <View style={{ gap: spacing.md }}>
        <Button label="Voir mes rendez-vous" onPress={onAppointments} />
        <Button label="Retour à l'accueil" variant="ghost" onPress={onHome} />
      </View>

      {adSlot ? (
        <BottomSheet
          visible={popupVisible}
          title={adSlot.headline}
          onClose={() => setPopupVisible(false)}
          footer={
            <Button
              label="Fermer"
              variant="ghost"
              onPress={() => setPopupVisible(false)}
              style={{ flex: 1 }}
            />
          }
        >
          <View
            style={{ height: 140, borderRadius: radius.lg, overflow: "hidden" }}
          >
            {adSlot.imageUri ? (
              <Image
                source={{ uri: adSlot.imageUri }}
                style={{ flex: 1 }}
                contentFit="cover"
              />
            ) : (
              <View
                style={{
                  flex: 1,
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundColor: theme.accent.warmSoft,
                }}
              >
                <MaterialCommunityIcons
                  name="tag-heart-outline"
                  size={40}
                  color={theme.accent.warm}
                />
              </View>
            )}
          </View>

          {adSlot.linkUrl ? (
            <Pressable
              onPress={() => void Linking.openURL(adSlot.linkUrl!)}
              accessibilityRole="link"
              hitSlop={8}
            >
              <Text style={[typography.label, { color: theme.primary.main }]}>
                En savoir plus
              </Text>
            </Pressable>
          ) : null}
        </BottomSheet>
      ) : null}
    </View>
  );
}
