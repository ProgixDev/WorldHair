import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import type {
  AvailabilityDay,
  PlanId,
  ProAppointment,
  ProAppointmentStatus,
  ProProfile,
  ProService,
  ReviewReply,
  Subscription,
} from "../features/pro/types";
import * as pro from "../services/pro";

interface ProContextValue {
  profile: ProProfile | null;
  services: ProService[];
  availability: AvailabilityDay[];
  appointments: ProAppointment[];
  subscription: Subscription | null;
  replies: ReviewReply[];
  isLoading: boolean;
  refresh: () => Promise<void>;
  saveProfile: (profile: ProProfile) => Promise<void>;
  saveService: (service: ProService) => Promise<void>;
  deleteService: (serviceId: string) => Promise<void>;
  saveAvailability: (availability: AvailabilityDay[]) => Promise<void>;
  setAppointmentStatus: (
    id: string,
    status: ProAppointmentStatus,
  ) => Promise<void>;
  changePlan: (plan: PlanId) => Promise<void>;
  cancelSubscription: () => Promise<void>;
  reactivateSubscription: () => Promise<void>;
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
  const [availability, setAvailability] = useState<AvailabilityDay[]>([]);
  const [appointments, setAppointments] = useState<ProAppointment[]>([]);
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [replies, setReplies] = useState<ReviewReply[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const refresh = useCallback(async () => {
    const [
      nextProfile,
      nextServices,
      nextAvailability,
      nextAppointments,
      nextSubscription,
      nextReplies,
    ] = await Promise.all([
      pro.getProProfile(),
      pro.listProServices(),
      pro.getAvailability(),
      pro.listProAppointments(),
      pro.getSubscription(),
      pro.listReplies(),
    ]);

    setProfile(nextProfile);
    setServices(nextServices);
    setAvailability(nextAvailability);
    setAppointments(nextAppointments);
    setSubscription(nextSubscription);
    setReplies(nextReplies);
    setIsLoading(false);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const value = useMemo<ProContextValue>(
    () => ({
      profile,
      services,
      availability,
      appointments,
      subscription,
      replies,
      isLoading,
      refresh,
      saveProfile: async (next) => setProfile(await pro.saveProProfile(next)),
      saveService: async (service) =>
        setServices(await pro.saveProService(service)),
      deleteService: async (serviceId) =>
        setServices(await pro.deleteProService(serviceId)),
      saveAvailability: async (next) =>
        setAvailability(await pro.saveAvailability(next)),
      setAppointmentStatus: async (id, status) =>
        setAppointments(await pro.setAppointmentStatus(id, status)),
      changePlan: async (plan) => setSubscription(await pro.changePlan(plan)),
      cancelSubscription: async () =>
        setSubscription(await pro.cancelSubscription()),
      reactivateSubscription: async () =>
        setSubscription(await pro.reactivateSubscription()),
      saveReply: async (reviewId, text) =>
        setReplies(await pro.saveReply(reviewId, text)),
      deleteReply: async (reviewId) =>
        setReplies(await pro.deleteReply(reviewId)),
    }),
    [
      profile,
      services,
      availability,
      appointments,
      subscription,
      replies,
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
