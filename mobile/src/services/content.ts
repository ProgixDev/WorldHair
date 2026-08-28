/**
 * Mock content service for admin-managed onboarding copy (issue #5). No
 * back-office exists yet, so this returns a fixed fallback; the real API
 * replaces this file wholesale once the admin CMS lands.
 */

const LATENCY_MS = 300;

function delay(ms = LATENCY_MS): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export interface OnboardingProductsContent {
  heading: string;
  body: string;
  /** Set once an admin uploads a photo through the back-office. */
  imageUri: string | null;
}

export async function getOnboardingProductsSlideContent(): Promise<OnboardingProductsContent> {
  await delay();
  return {
    heading: "Des produits de qualité",
    body: "Nos coiffeurs travaillent avec des marques professionnelles, choisies pour prendre soin de chaque type de cheveux.",
    imageUri: null,
  };
}
