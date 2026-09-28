import { isPaymentReturnUrl, PAYMENT_RETURN_URL } from "./paymentReturn";

describe("isPaymentReturnUrl", () => {
  it("recognises the way back from Stripe's page, whatever the website adds to it", () => {
    expect(isPaymentReturnUrl(PAYMENT_RETURN_URL)).toBe(true);
    expect(isPaymentReturnUrl(PAYMENT_RETURN_URL + "?etat=paye")).toBe(true);
  });

  it("leaves the app's own links to the router", () => {
    expect(isPaymentReturnUrl("worldhair://pro/payments")).toBe(false);
    expect(isPaymentReturnUrl("worldhair://appointments")).toBe(false);
  });
});
