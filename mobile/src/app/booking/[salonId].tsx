import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Linking, Pressable, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { BottomSheet } from "../../components/ui/BottomSheet";
import { Button } from "../../components/ui/Button";
import { elevation } from "../../constants/elevation";
import { useResponsive } from "../../constants/responsive";
import { radius, spacing } from "../../constants/spacing";
import { typography } from "../../constants/typography";
import { useTheme } from "../../contexts/ThemeContext";
import { fetchSalonById } from "../../features/salons/api";
import { openDays, slotsForDay, slotToDate } from "../../features/salons/slots";
import type { Salon, Service } from "../../features/salons/types";
import { getAdSlot, type AdSlot } from "../../services/ads";
import {
  bookAppointment,
  listAppointments,
  payForAppointment,
  rescheduleAppointment,
  type Appointment,
  type PaymentReceipt,
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
const STEPS: { id: Step; label: string }[] = [
  { id: "service", label: "Prestation" },
  { id: "slot", label: "Créneau" },
  { id: "payment", label: "Paiement" },
  { id: "confirm", label: "Confirmation" },
];

/**
 * Booking wizard styled as a ticket: a perforated stub for the recap, a day
 * strip and a slot grid. Same three-step idea as the coiffeur signup, a
 * deliberately different skin.
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

  const [step, setStep] = useState<Step>(
    serviceId || isReschedule ? "slot" : "service",
  );
  const [selectedService, setSelectedService] = useState<Service | null>(null);
  const [day, setDay] = useState<Date | null>(null);
  const [slotMinutes, setSlotMinutes] = useState<number | null>(null);
  const [taken, setTaken] = useState<string[]>([]);
  const [confirmationAd, setConfirmationAd] = useState<AdSlot | null>(null);
  const [paying, setPaying] = useState(false);
  const [paid, setPaid] = useState<PaymentReceipt | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [booked, setBooked] = useState<Appointment | null>(null);

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
      if (preselected) setSelectedService(preselected);
    });
    return () => {
      cancelled = true;
    };
  }, [salonId, serviceId]);

  // Existing bookings block their own slots, minus the one being moved.
  useEffect(() => {
    let cancelled = false;
    listAppointments().then((appointments) => {
      if (cancelled) return;
      setTaken(
        appointments
          .filter((a) => a.status === "confirmed" && a.id !== appointmentId)
          .map((a) => a.startsAt),
      );
      if (isReschedule && !selectedService) {
        const current = appointments.find((a) => a.id === appointmentId);
        const service = salon?.services.find(
          (s) => s.id === current?.serviceId,
        );
        if (service) setSelectedService(service);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [appointmentId, isReschedule, salon, selectedService]);

  const days = useMemo(() => (salon ? openDays(salon, 10) : []), [salon]);

  useEffect(() => {
    if (!day && days.length > 0) setDay(days[0]);
  }, [day, days]);

  const slots = useMemo(() => {
    if (!salon || !day || !selectedService) return [];
    return slotsForDay({
      salon,
      day,
      durationMin: selectedService.durationMin,
      taken,
    });
  }, [salon, day, selectedService, taken]);

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

  const startsAt =
    day && slotMinutes !== null ? slotToDate(day, slotMinutes) : null;

  const handlePay = async () => {
    if (!selectedService) return;
    setError(null);
    setPaying(true);
    try {
      const receipt = await payForAppointment(selectedService.price);
      setPaid(receipt);
      setStep("confirm");
    } catch {
      setError("Paiement impossible. Réessayez.");
    } finally {
      setPaying(false);
    }
  };

  const handleConfirm = async () => {
    if (!selectedService || !startsAt) return;
    setError(null);
    setSubmitting(true);
    try {
      const appointment = isReschedule
        ? await rescheduleAppointment(String(appointmentId), startsAt)
        : await bookAppointment({
            salonId: salon.id,
            serviceId: selectedService.id,
            startsAt,
          });
      setBooked(appointment);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Réservation impossible. Réessayez.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  if (booked)
    return (
      <BookingSuccess
        salonName={salon.name}
        service={selectedService}
        startsAt={new Date(booked.startsAt)}
        isReschedule={isReschedule}
        adSlot={confirmationAd}
        onAppointments={() => router.replace("/appointments" as never)}
        onHome={() => router.replace("/discover" as never)}
      />
    );

  const canContinue =
    step === "service"
      ? Boolean(selectedService)
      : step === "slot"
        ? slotMinutes !== null
        : true;

  // A reschedule only moves the time of an already-paid appointment, so it
  // skips the payment step entirely.
  const goNext = () => {
    if (step === "service") return setStep("slot");
    if (step === "slot")
      return isReschedule ? setStep("confirm") : setStep("payment");
    if (step === "payment") return void handlePay();
    void handleConfirm();
  };

  const goBack = () => {
    if (step === "confirm") return setStep(isReschedule ? "slot" : "payment");
    if (step === "payment") return setStep("slot");
    if (step === "slot" && !isReschedule && !serviceId)
      return setStep("service");
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
          {STEPS.map((item, index) => {
            const currentIndex = STEPS.findIndex((s) => s.id === step);
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

                {index < STEPS.length - 1 ? (
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
              Quelle prestation ?
            </Text>
            {salon.services.map((service) => {
              const selected = selectedService?.id === service.id;
              return (
                <Pressable
                  key={service.id}
                  onPress={() => setSelectedService(service)}
                  accessibilityRole="radio"
                  accessibilityState={{ selected }}
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
                    elevation(1, theme.shadow),
                  ]}
                >
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
                  ? candidate.getTime() === day.getTime()
                  : false;
                return (
                  <Pressable
                    key={candidate.toISOString()}
                    onPress={() => {
                      setDay(candidate);
                      setSlotMinutes(null);
                    }}
                    accessibilityRole="button"
                    accessibilityState={{ selected }}
                    accessibilityLabel={fullDate(candidate)}
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
                      {weekdayShort(candidate)}
                    </Text>
                    <Text
                      style={[
                        typography.bodyMedium,
                        {
                          color: selected
                            ? theme.primary.on
                            : theme.foreground.white,
                        },
                      ]}
                    >
                      {candidate.getDate()}
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
                      {dayAndMonth(candidate).split(" ")[1]}
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

              {slots.length === 0 ? (
                <Text
                  style={[
                    typography.bodySmall,
                    { color: theme.foreground.gray },
                  ]}
                >
                  Aucun créneau ce jour-là. Essayez une autre date.
                </Text>
              ) : (
                <View
                  style={{
                    flexDirection: "row",
                    flexWrap: "wrap",
                    gap: spacing.sm,
                  }}
                >
                  {slots.map((slot) => {
                    const selected = slotMinutes === slot.minutes;
                    return (
                      <Pressable
                        key={slot.minutes}
                        onPress={() =>
                          slot.available ? setSlotMinutes(slot.minutes) : null
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
          </View>
        ) : null}

        {step === "payment" && selectedService ? (
          <View style={{ gap: spacing.lg }}>
            <Text style={[typography.h1, { color: theme.foreground.white }]}>
              Réglez pour envoyer la demande.
            </Text>
            <Text
              style={[typography.bodySmall, { color: theme.foreground.gray }]}
            >
              Le montant est prélevé maintenant, avant que le coiffeur ne
              reçoive votre demande.
            </Text>

            <View
              style={[
                {
                  flexDirection: "row",
                  alignItems: "center",
                  gap: spacing.md,
                  padding: spacing.lg,
                  borderRadius: radius.xl,
                  borderWidth: 1.5,
                  borderColor: theme.primary.main,
                  backgroundColor: theme.surface.raised,
                },
                elevation(1, theme.shadow),
              ]}
            >
              <MaterialCommunityIcons
                name="credit-card-outline"
                size={28}
                color={theme.primary.main}
              />
              <View style={{ flex: 1, gap: 2 }}>
                <Text
                  style={[
                    typography.bodyMedium,
                    { color: theme.foreground.white },
                  ]}
                >
                  Carte bancaire
                </Text>
                <Text
                  style={[
                    typography.caption,
                    { color: theme.foreground.gray },
                  ]}
                >
                  •••• •••• •••• 4242
                </Text>
              </View>
            </View>

            <View
              style={{ flexDirection: "row", justifyContent: "space-between" }}
            >
              <Text
                style={[typography.label, { color: theme.foreground.gray }]}
              >
                Montant à régler
              </Text>
              <Text style={[typography.h2, { color: theme.primary.main }]}>
                {formatPrice(selectedService.price)}
              </Text>
            </View>

            {error ? (
              <Text style={[typography.bodySmall, { color: theme.danger }]}>
                {error}
              </Text>
            ) : null}
          </View>
        ) : null}

        {step === "confirm" && selectedService && startsAt ? (
          <View style={{ gap: spacing.lg }}>
            <Text style={[typography.h1, { color: theme.foreground.white }]}>
              On récapitule.
            </Text>

            <TicketCard
              salonName={salon.name}
              stylist={salon.stylist}
              service={selectedService}
              startsAt={startsAt}
              address={
                salon.addressLine + ", " + salon.postalCode + " " + salon.city
              }
            />

            <Text
              style={[typography.caption, { color: theme.foreground.gray }]}
            >
              Annulation gratuite jusqu&apos;à 24 h avant le rendez-vous.
            </Text>

            {paid ? (
              <Text style={[typography.caption, { color: theme.success }]}>
                {"Paiement de " + formatPrice(paid.amount) + " effectué."}
              </Text>
            ) : null}

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
        {selectedService ? (
          <View
            style={{
              flexDirection: "row",
              justifyContent: "space-between",
            }}
          >
            <Text
              style={[typography.caption, { color: theme.foreground.gray }]}
              numberOfLines={1}
            >
              {selectedService.name +
                (startsAt
                  ? " · " + relativeDay(startsAt) + " " + timeOfDay(startsAt)
                  : "")}
            </Text>
            <Text style={[typography.label, { color: theme.foreground.white }]}>
              {formatPrice(selectedService.price)}
            </Text>
          </View>
        ) : null}

        <Button
          label={
            step === "payment"
              ? "Payer " + formatPrice(selectedService?.price ?? 0)
              : step === "confirm"
                ? isReschedule
                  ? "Confirmer le changement"
                  : "Confirmer la réservation"
                : "Continuer"
          }
          onPress={goNext}
          disabled={!canContinue}
          loading={submitting || paying}
        />
      </View>
    </View>
  );
}

/** Perforated recap card — the visual signature of this flow. */
function TicketCard({
  salonName,
  stylist,
  service,
  startsAt,
  address,
}: {
  salonName: string;
  stylist: string;
  service: Service;
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
        <TicketRow label="Prestation" value={service.name} />
        <TicketRow label="Durée" value={formatDuration(service.durationMin)} />
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
            {formatPrice(service.price)}
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
  service,
  startsAt,
  isReschedule,
  adSlot,
  onAppointments,
  onHome,
}: {
  salonName: string;
  service: Service | null;
  startsAt: Date;
  isReschedule: boolean;
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
            {isReschedule ? "Rendez-vous déplacé." : "C'est réservé."}
          </Text>
          <Text
            style={[
              typography.body,
              { color: theme.foreground.gray, textAlign: "center" },
            ]}
          >
            {salonName +
              " · " +
              (service ? service.name + " · " : "") +
              relativeDay(startsAt).toLowerCase() +
              " à " +
              timeOfDay(startsAt)}
          </Text>
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
