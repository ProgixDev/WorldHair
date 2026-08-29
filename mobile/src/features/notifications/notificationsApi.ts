import { apiClient } from "../../lib/apiClient";

export type PushPlatform = "ios" | "android";

/** Thin wrapper over server/src/notifications/'s push-token endpoints. */
export const notificationsApi = {
  register(params: { token: string; platform: PushPlatform; timezone?: string }): Promise<void> {
    return apiClient.post("/notifications/push-tokens", params).then(() => undefined);
  },

  unregister(token: string): Promise<void> {
    return apiClient.delete(`/notifications/push-tokens/${encodeURIComponent(token)}`).then(() => undefined);
  },
};
