import { act, renderHook, waitFor } from "@testing-library/react-native";
import React from "react";

import * as pro from "../services/pro";
import { ProProvider, usePro } from "./ProContext";

jest.mock("../services/pro", () => ({
  getProProfile: jest.fn(),
  listProServices: jest.fn().mockResolvedValue([]),
  listGalleryPhotos: jest.fn().mockResolvedValue([]),
  getAvailability: jest.fn().mockResolvedValue([]),
  listProAppointments: jest.fn().mockResolvedValue([]),
  getSubscription: jest.fn().mockResolvedValue(null),
  listProReviews: jest.fn().mockResolvedValue([]),
  listTimeOff: jest.fn().mockResolvedValue([]),
  getPayoutStatus: jest.fn().mockResolvedValue(null),
  listTeam: jest.fn().mockResolvedValue([]),
}));

const getProProfile = pro.getProProfile as jest.Mock;
const wrapper = ({ children }: { children: React.ReactNode }) => <ProProvider>{children}</ProProvider>;

describe("ProProvider", () => {
  it("stops loading and says so when the workspace can't be read, instead of spinning forever", async () => {
    getProProfile.mockRejectedValueOnce(new Error("Network Error"));
    const { result } = await renderHook(() => usePro(), { wrapper });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.loadFailed).toBe(true);
  });

  it("clears the failure once reading again works", async () => {
    getProProfile.mockRejectedValueOnce(new Error("Network Error"));
    const { result } = await renderHook(() => usePro(), { wrapper });
    await waitFor(() => expect(result.current.loadFailed).toBe(true));

    getProProfile.mockResolvedValueOnce({ salonName: "Racines" });
    await act(() => result.current.retry());

    expect(result.current.loadFailed).toBe(false);
    expect(result.current.profile).toEqual({ salonName: "Racines" });
  });
});
