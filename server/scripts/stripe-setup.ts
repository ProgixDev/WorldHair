import Stripe from "stripe";
import { subscriptionPageUrl } from "../src/common/utils/web-links";
import { PLAN_LOOKUP_KEYS, PORTAL_CONFIGURATION_APP } from "../src/subscriptions/stripe-catalog";

/**
 * Prepares the Stripe account the server's STRIPE_SECRET_KEY points at
 * (TODO.md Phase 4). Safe to run again: it finds what it made before.
 *
 *   bun run stripe:setup
 *   bun run stripe:setup -- --monthly 19 --yearly 182
 *   bun run stripe:setup -- --webhook-url https://worldhair-server.onrender.com/webhooks/stripe
 *
 * Creates: the "WorldHair Pro" product; a monthly and a yearly price (found
 * by the server through their lookup keys — a price change makes a new
 * price and moves the key to it, existing subscribers keep theirs until they
 * change plan); the Customer Portal settings (plan switch, card, invoices,
 * cancellation at period end); with --webhook-url, the webhook endpoint,
 * whose signing secret it prints once for STRIPE_WEBHOOK_SECRET.
 */

const WEBHOOK_EVENTS: Stripe.WebhookEndpointCreateParams.EnabledEvent[] = [
  "checkout.session.completed",
  "customer.subscription.created",
  "customer.subscription.updated",
  "customer.subscription.deleted",
  "customer.subscription.paused",
  "customer.subscription.resumed",
  "customer.subscription.trial_will_end",
  "invoice.paid",
  "invoice.payment_failed",
];

function argument(name: string): string | undefined {
  const index = process.argv.indexOf(`--${name}`);
  return index === -1 ? undefined : process.argv[index + 1];
}

function euros(name: string, fallback: number): number {
  const raw = argument(name);
  const value = raw === undefined ? fallback : Number(raw);
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error(`--${name} must be a price in euros, e.g. --${name} ${fallback}`);
  }
  return value;
}

async function ensureProduct(stripe: Stripe): Promise<Stripe.Product> {
  const products = await stripe.products.list({ active: true, limit: 100 });
  const existing = products.data.find((product) => product.metadata.app === PORTAL_CONFIGURATION_APP);
  if (existing) {
    console.log(`Product      ${existing.id} (already there)`);
    return existing;
  }
  const product = await stripe.products.create({
    name: "WorldHair Pro",
    description: "Référencement du salon sur WorldHair : fiche visible, réservations en ligne, agenda et statistiques.",
    metadata: { app: PORTAL_CONFIGURATION_APP },
  });
  console.log(`Product      ${product.id} (created)`);
  return product;
}

async function ensurePrice(
  stripe: Stripe,
  product: Stripe.Product,
  lookupKey: string,
  interval: "month" | "year",
  amountEuros: number,
): Promise<Stripe.Price> {
  const unitAmount = Math.round(amountEuros * 100);
  const { data } = await stripe.prices.list({ lookup_keys: [lookupKey], active: true });
  const existing = data[0];
  if (existing && existing.unit_amount === unitAmount && existing.recurring?.interval === interval) {
    console.log(`Price        ${existing.id} ${amountEuros} €/${interval} (already there)`);
    return existing;
  }
  const price = await stripe.prices.create({
    product: product.id,
    currency: "eur",
    unit_amount: unitAmount,
    tax_behavior: "inclusive",
    recurring: { interval },
    lookup_key: lookupKey,
    // A new amount takes the key over from the old price.
    transfer_lookup_key: true,
  });
  console.log(`Price        ${price.id} ${amountEuros} €/${interval} (created${existing ? ", replaces " + existing.id : ""})`);
  return price;
}

async function ensurePortal(stripe: Stripe, product: Stripe.Product, prices: Stripe.Price[]): Promise<void> {
  const returnUrl = subscriptionPageUrl(process.env.WEB_APP_URL);
  const settings: Stripe.BillingPortal.ConfigurationCreateParams = {
    business_profile: { headline: "WorldHair — votre abonnement professionnel" },
    ...(returnUrl ? { default_return_url: returnUrl } : {}),
    features: {
      invoice_history: { enabled: true },
      payment_method_update: { enabled: true },
      customer_update: { enabled: true, allowed_updates: ["email", "name", "address", "tax_id"] },
      subscription_cancel: {
        enabled: true,
        mode: "at_period_end",
        cancellation_reason: { enabled: true, options: ["too_expensive", "unused", "switched_service", "other"] },
      },
      subscription_update: {
        enabled: true,
        default_allowed_updates: ["price"],
        proration_behavior: "create_prorations",
        products: [{ product: product.id, prices: prices.map((price) => price.id) }],
      },
    },
    metadata: { app: PORTAL_CONFIGURATION_APP },
  };

  const { data } = await stripe.billingPortal.configurations.list({ active: true, limit: 100 });
  const existing = data.find((configuration) => configuration.metadata?.app === PORTAL_CONFIGURATION_APP);
  if (existing) {
    const { metadata: _metadata, ...update } = settings;
    await stripe.billingPortal.configurations.update(existing.id, update);
    console.log(`Portal       ${existing.id} (updated)`);
    return;
  }
  const configuration = await stripe.billingPortal.configurations.create(settings);
  console.log(`Portal       ${configuration.id} (created)`);
}

async function ensureWebhook(stripe: Stripe, url: string): Promise<void> {
  const { data } = await stripe.webhookEndpoints.list({ limit: 100 });
  const existing = data.find((endpoint) => endpoint.url === url);
  if (existing) {
    await stripe.webhookEndpoints.update(existing.id, { enabled_events: WEBHOOK_EVENTS, disabled: false });
    console.log(`Webhook      ${existing.id} (already there, events updated)`);
    console.log("             Its signing secret is on that endpoint's page in Stripe's dashboard.");
    return;
  }
  const endpoint = await stripe.webhookEndpoints.create({
    url,
    enabled_events: WEBHOOK_EVENTS,
    description: "WorldHair server — coiffeur subscriptions",
  });
  console.log(`Webhook      ${endpoint.id} (created)`);
  console.log(`\nSTRIPE_WEBHOOK_SECRET=${endpoint.secret}`);
  console.log("Put it in the server's .env (and on Render). Stripe shows it only once here.");
}

async function main(): Promise<void> {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    throw new Error("STRIPE_SECRET_KEY is empty in .env — see .env.example.");
  }
  const stripe = new Stripe(key);
  console.log(`Stripe account in ${key.startsWith("sk_live_") ? "LIVE" : "test"} mode\n`);

  const product = await ensureProduct(stripe);
  const monthly = await ensurePrice(stripe, product, PLAN_LOOKUP_KEYS.monthly, "month", euros("monthly", 19));
  const yearly = await ensurePrice(stripe, product, PLAN_LOOKUP_KEYS.yearly, "year", euros("yearly", 182));
  await ensurePortal(stripe, product, [monthly, yearly]);

  const webhookUrl = argument("webhook-url");
  if (webhookUrl) {
    await ensureWebhook(stripe, webhookUrl);
  } else {
    console.log("\nNo --webhook-url: add the endpoint yourself, or run again with it.");
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
