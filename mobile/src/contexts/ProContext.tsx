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
  Subscription,
  TimeOff,
  TimeOffConflict,
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
  /** Upcoming congés and exceptional closures. */
  timeOff: TimeOff[];
  isLoading: boolean;
  refresh: () => Promise<void>;
  /** Resolves with what's now stored — the server may normalize (uploaded cover URL, phone format). */
  saveProfile: (profile: ProProfile) => Promise<ProProfile>;
  saveService: (service: ProService) => Promise<void>;
  deleteService: (serviceId: string) => Promise<void>;
  addGalleryPhoto: (localUri: string, mimeType?: string | null) => Promise<void>;
  deleteGalleryPhoto: (photo: GalleryPhoto) => Promise<void>;
  saveAvailability: (availability: AvailabilityDay[]) => Promise<void>;
  setAppointmentStatus: (
    id: string,
    status: ProAppointmentStatus,
  ) => Promise<void>;
  /** Moves an accepted appointment; the client is notified. */
  moveAppointment: (id: string, startsAt: string) => Promise<void>;
  setAttendance: (id: string, attendance: Attendance) => Promise<void>;
  /** Resolves with the bookings already inside the new closure — they're kept, for the coiffeur to handle. */
  addTimeOff: (input: {
    startsAt: string;
    endsAt: string;
    label?: string;
  }) => Promise<TimeOffConflict[]>;
  deleteTimeOff: (id: string) => Promise<void>;
  /** Reads the subscription again — after the coiffeur subscribed or renewed on the website. */
  refreshSubscription: () => Promise<void>;
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
  const [isLoading, setIsLoading] = useState(true);

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
    ] = await Promise.all([
      pro.getProProfile(),
      pro.listProServices(),
      pro.listGalleryPhotos(),
      pro.getAvailability(),
      pro.listProAppointments(),
      pro.getSubscription(),
      pro.listProReviews(),
      pro.listTimeOff(),
    ]);

    setProfile(nextProfile);
    setServices(nextServices);
    setGallery(nextGallery);
    setAvailability(nextAvailability);
    setAppointments(nextAppointments);
    setSubscription(nextSubscription);
    setReviews(nextReviews);
    setTimeOff(nextTimeOff);
    setIsLoading(false);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

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
      isLoading,
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
      setAppointmentStatus: async (id, status) =>
        setAppointments(await pro.setAppointmentStatus(id, status)),
      moveAppointment: async (id, startsAt) =>
        setAppointments(await pro.moveAppointment(id, startsAt)),
      setAttendance: async (id, attendance) =>
        setAppointments(await pro.setAttendance(id, attendance)),
      addTimeOff: async (input) => {
        const result = await pro.addTimeOff(input);
        setTimeOff(result.timeOff);
        return result.conflicts;
      },
      deleteTimeOff: async (id) => setTimeOff(await pro.deleteTimeOff(id)),
      refreshSubscription: async () => setSubscription(await pro.getSubscription()),
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
      isLoading,
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
