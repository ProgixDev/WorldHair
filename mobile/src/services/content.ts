import { apiClient } from "../lib/apiClient";

export interface OnboardingProductsContent {
  heading: string;
  body: string;
  /** Set once an admin uploads a photo through the back-office. */
  imageUri: string | null;
}

interface AppContentApiResponse {
  key: string;
  heading: string;
  body: string;
  imageUrl: string | null;
  updatedAt: string;
}

export async function getOnboardingProductsSlideContent(): Promise<OnboardingProductsContent> {
  const { data } = await apiClient.get<AppContentApiResponse>(
    "/content/onboarding_products_slide",
  );
  return { heading: data.heading, body: data.body, imageUri: data.imageUrl };
}
