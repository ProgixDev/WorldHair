import { isStripeReturnUrl, STRIPE_RETURN_URL } from "./stripeReturn";

describe("isStripeReturnUrl", () => {
  it("recognises Stripe's way back, whatever it adds to it", () => {
    expect(isStripeReturnUrl(STRIPE_RETURN_URL)).toBe(true);
    expect(isStripeReturnUrl(STRIPE_RETURN_URL + "?payment_intent=pi_1&redirect_status=succeeded")).toBe(true);
  });

  it("leaves the app's own links to the router", () => {
    expect(isStripeReturnUrl("worldhair://pro/payments")).toBe(false);
    expect(isStripeReturnUrl("worldhair://appointments")).toBe(false);
  });
});
