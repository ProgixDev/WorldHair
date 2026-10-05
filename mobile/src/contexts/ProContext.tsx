import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import type {
  Attendance,
  AvailabilityDay,
  GalleryPhoto,
  ProAppointment,
  ProAppointmentStatus,
  ProProfile,
  ProService,
  StaffMember,
  Subscription,
  TimeOff,
  TimeOffConflict,
  PayoutStatus,
} from "../features/pro/types";
import type { Review } from "../features/salons/types";
import * as pro from "../services/pro";

interface ProContextValue {
  profile: ProProfile | null;
  services: ProService[];
  gallery: GalleryPhoto[];
  availability: AvailabilityDay[];
  appointments: ProAppointment[];
  subscription: Subscription | null;
  reviews: Review[];
  /** Upcoming congés and exceptional closures — the salon's, and each person's (`staffId`). */
  timeOff: TimeOff[];
  /** The salon's team, its owner first (TODO.md Phase 3); just him in a salon of one. */
  team: StaffMember[];
  isLoading: boolean;
  /** The first read failed (no network, server down): the pro area offers to try again. */
  loadFailed: boolean;
  /** Reads everything again after a failure; never throws. */
  retry: () => Promise<void>;
  refresh: () => Promise<void>;
  /** Resolves with what's now stored — the server may normalize (uploaded cover URL, phone format). */
  saveProfile: (profile: ProProfile) => Promise<ProProfile>;
  saveService: (service: ProService) => Promise<void>;
  deleteService: (serviceId: string) => Promise<void>;
  addGalleryPhoto: (localUri: string, mimeType?: string | null) => Promise<void>;
  deleteGalleryPhoto: (photo: GalleryPhoto) => Promise<void>;
  saveAvailability: (availability: AvailabilityDay[]) => Promise<void>;
  /** Accepting: `staffId` is who does it (« Qui s'en occupe ? »). */
  setAppointmentStatus: (
    id: string,
    status: ProAppointmentStatus,
    staffId?: string,
  ) => Promise<void>;
  /** Moves an accepted appointment; the client is notified. */
  moveAppointment: (id: string, startsAt: string) => Promise<void>;
  /** Gives a booking to someone else of the team, free at its time. */
  assignAppointment: (id: string, staffId: string) => Promise<void>;
  /** The team again — after someone joined with a code. */
  refreshTeam: () => Promise<void>;
  setTakesBookings: (staffId: string, takesBookings: boolean) => Promise<void>;
  /** `null` gives them back the salon's hours. */
  saveStaffHours: (staffId: string, availability: AvailabilityDay[] | null) => Promise<void>;
  removeStaff: (staffId: string) => Promise<void>;
  setAttendance: (id: string, attendance: Attendance) => Promise<void>;
  /** Resolves with the bookings already inside the new closure — they're kept, for the coiffeur to handle. */
  addTimeOff: (input: {
    startsAt: string;
    endsAt: string;
    label?: string;
    /** One person's congé; absent: the whole salon closes. */
    staffId?: string;
  }) => Promise<TimeOffConflict[]>;
  deleteTimeOff: (id: string) => Promise<void>;
  /** Reads the subscription again — after the coiffeur subscribed or renewed on the website. */
  refreshSubscription: () => Promise<void>;
  /** Where the salon gets paid (Stripe Connect); `null` while unknown. */
  payoutStatus: PayoutStatus | null;
  /** Reads it again — after the coiffeur comes back from Stripe's onboarding. */
  refreshPayoutStatus: () => Promise<void>;
  /** Gives the client money back — everything, or `amount` euros — until the salon has been paid. */
  refundAppointment: (id: string, amount?: number) => Promise<void>;
  saveReply: (reviewId: string, text: string) => Promise<void>;
  deleteReply: (reviewId: string) => Promise<void>;
}

const ProContext = createContext<ProContextValue | undefined>(undefined);

/**
 * One read of the pro workspace shared by every pro screen and the tab bar
 * badge — each tab hitting AsyncStorage on focus would flicker.
 */
export function ProProvider({ children }: { children: React.ReactNode }) {
  const [profile, setProfile] = useState<ProProfile | null>(null);
  const [services, setServices] = useState<ProService[]>([]);
  const [gallery, setGallery] = useState<GalleryPhoto[]>([]);
  const [availability, setAvailability] = useState<AvailabilityDay[]>([]);
  const [appointments, setAppointments] = useState<ProAppointment[]>([]);
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [timeOff, setTimeOff] = useState<TimeOff[]>([]);
  const [team, setTeam] = useState<StaffMember[]>([]);
  const [payoutStatus, setPayoutStatus] = useState<PayoutStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);

  const refresh = useCallback(async () => {
    const [
      nextProfile,
      nextServices,
      nextGallery,
      nextAvailability,
      nextAppointments,
      nextSubscription,
      nextReviews,
      nextTimeOff,
      nextPayoutStatus,
      nextTeam,
    ] = await Promise.all([
      pro.getProProfile(),
      pro.listProServices(),
      pro.listGalleryPhotos(),
      pro.getAvailability(),
      pro.listProAppointments(),
      pro.getSubscription(),
      pro.listProReviews(),
      pro.listTimeOff(),
      // Stripe may be unreachable: the rest of the workspace loads anyway.
      pro.getPayoutStatus().catch(() => null),
      pro.listTeam(),
    ]);

    setProfile(nextProfile);
    setServices(nextServices);
    setGallery(nextGallery);
    setAvailability(nextAvailability);
    setAppointments(nextAppointments);
    setSubscription(nextSubscription);
    setReviews(nextReviews);
    setTimeOff(nextTimeOff);
    setPayoutStatus(nextPayoutStatus);
    setTeam(nextTeam);
    setLoadFailed(false);
    setIsLoading(false);
  }, []);

  const retry = useCallback(async () => {
    try {
      await refresh();
    } catch {
      setLoadFailed(true);
      setIsLoading(false);
    }
  }, [refresh]);

  useEffect(() => {
    void retry();
  }, [retry]);

  const value = useMemo<ProContextValue>(
    () => ({
      profile,
      services,
      gallery,
      availability,
      appointments,
      subscription,
      reviews,
      timeOff,
      team,
      isLoading,
      loadFailed,
      retry,
      refresh,
      saveProfile: async (next) => {
        const saved = await pro.saveProProfile(next);
        setProfile(saved);
        return saved;
      },
      saveService: async (service) =>
        setServices(await pro.saveProService(service)),
      deleteService: async (serviceId) =>
        setServices(await pro.deleteProService(serviceId)),
      addGalleryPhoto: async (localUri, mimeType) =>
        setGallery(await pro.addGalleryPhoto(localUri, mimeType)),
      deleteGalleryPhoto: async (photo) =>
        setGallery(await pro.deleteGalleryPhoto(photo)),
      saveAvailability: async (next) =>
        setAvailability(await pro.saveAvailability(next)),
      setAppointmentStatus: async (id, status, staffId) =>
        setAppointments(await pro.setAppointmentStatus(id, status, staffId)),
      moveAppointment: async (id, startsAt) =>
        setAppointments(await pro.moveAppointment(id, startsAt)),
      assignAppointment: async (id, staffId) =>
        setAppointments(await pro.assignAppointment(id, staffId)),
      refreshTeam: async () => setTeam(await pro.listTeam()),
      setTakesBookings: async (staffId, takesBookings) =>
        setTeam(await pro.setTakesBookings(staffId, takesBookings)),
      saveStaffHours: async (staffId, hours) => setTeam(await pro.saveStaffHours(staffId, hours)),
      removeStaff: async (staffId) => setTeam(await pro.removeStaff(staffId)),
      setAttendance: async (id, attendance) =>
        setAppointments(await pro.setAttendance(id, attendance)),
      addTimeOff: async (input) => {
        const result = await pro.addTimeOff(input);
        setTimeOff(result.timeOff);
        return result.conflicts;
      },
      deleteTimeOff: async (id) => setTimeOff(await pro.deleteTimeOff(id)),
      refreshSubscription: async () => setSubscription(await pro.getSubscription()),
      payoutStatus,
      refreshPayoutStatus: async () => setPayoutStatus(await pro.getPayoutStatus()),
      refundAppointment: async (id, amount) => setAppointments(await pro.refundAppointment(id, amount)),
      saveReply: async (reviewId, text) =>
        setReviews(await pro.saveReply(reviewId, text)),
      deleteReply: async (reviewId) =>
        setReviews(await pro.deleteReply(reviewId)),
    }),
    [
      profile,
      services,
      gallery,
      availability,
      appointments,
      subscription,
      reviews,
      timeOff,
      team,
      payoutStatus,
      isLoading,
      loadFailed,
      retry,
      refresh,
    ],
  );

  return <ProContext.Provider value={value}>{children}</ProContext.Provider>;
}

export function usePro(): ProContextValue {
  const context = useContext(ProContext);
  if (!context) throw new Error("usePro must be used inside a <ProProvider>.");
  return context;
}
