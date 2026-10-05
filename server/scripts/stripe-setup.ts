import Stripe from "stripe";
import { subscriptionPageUrl } from "../src/common/utils/web-links";
import { PLAN_LOOKUP_KEYS, PORTAL_CONFIGURATION_APP } from "../src/subscriptions/stripe-catalog";
import { SUBSCRIPTION_TIERS, type SubscriptionTier } from "../src/subscriptions/tiers";

/**
 * Prepares the Stripe account the server's STRIPE_SECRET_KEY points at
 * (TODO.md Phase 4). Safe to run again: it finds what it made before.
 *
 *   bun run stripe:setup
 *   bun run stripe:setup -- --solo-monthly 29.99 --solo-yearly 239.88 --team-monthly 49.99 --team-yearly 479.88
 *   bun run stripe:setup -- --webhook-url https://worldhair-server.onrender.com/webhooks/stripe
 *
 * Creates: the "WorldHair Solo" and "WorldHair Équipe" products (TODO.md
 * Phase 3: one person, or up to five), each with a monthly and a yearly
 * price (found by the server through their lookup keys — a price change
 * makes a new price and moves the key to it, existing subscribers keep
 * theirs until they change plan; a yearly price is twelve months paid at
 * once, so 19,99 € a month yearly is 239,88); the Customer Portal settings
 * (tier or period switch, card, invoices, cancellation at period end); with
 * --webhook-url, the two webhook
 * endpoints — WorldHair's own account, and the salons' connected accounts
 * at <url>/connect — whose signing secrets it prints once, for
 * STRIPE_WEBHOOK_SECRET and STRIPE_CONNECT_WEBHOOK_SECRET.
 */

/** WorldHair's own account: coiffeur subscriptions (Phase 4), client payments and refunds (Phase 5). */
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
  "payment_intent.succeeded",
  "charge.refunded",
];

/** The salons' connected accounts (Phase 5): whether their payouts are set up. */
const CONNECT_EVENTS: Stripe.WebhookEndpointCreateParams.EnabledEvent[] = ["account.updated"];

/** Prices in euros the client chose (TODO.md Phase 3): Solo 29,99 a month or 19,99 a month paid yearly; Équipe 49,99 or 39,99. */
const DEFAULT_EUROS: Record<SubscriptionTier, { monthly: number; yearly: number }> = {
  solo: { monthly: 29.99, yearly: 239.88 },
  team: { monthly: 49.99, yearly: 479.88 },
};

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

const PRODUCTS: Record<SubscriptionTier, { name: string; description: string }> = {
  solo: {
    name: "WorldHair Solo",
    description: "Référencement d'un salon tenu par une seule personne : fiche visible, réservations en ligne, agenda et statistiques.",
  },
  team: {
    name: "WorldHair Équipe",
    description: "Référencement d'un salon jusqu'à cinq personnes : un agenda par coiffeur, fiche visible, réservations en ligne et statistiques.",
  },
};

async function ensureProduct(stripe: Stripe, tier: SubscriptionTier): Promise<Stripe.Product> {
  const products = await stripe.products.list({ active: true, limit: 100 });
  const existing = products.data.find(
    (product) => product.metadata.app === PORTAL_CONFIGURATION_APP && product.metadata.tier === tier,
  );
  if (existing) {
    console.log(`Product      ${existing.id} ${existing.name} (already there)`);
    return existing;
  }
  const product = await stripe.products.create({
    ...PRODUCTS[tier],
    metadata: { app: PORTAL_CONFIGURATION_APP, tier },
  });
  console.log(`Product      ${product.id} ${product.name} (created)`);
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

async function ensurePortal(stripe: Stripe, catalog: { product: Stripe.Product; prices: Stripe.Price[] }[]): Promise<void> {
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
        products: catalog.map(({ product, prices }) => ({ product: product.id, prices: prices.map((price) => price.id) })),
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

async function ensureWebhook(
  stripe: Stripe,
  url: string,
  events: Stripe.WebhookEndpointCreateParams.EnabledEvent[],
  connect: boolean,
): Promise<void> {
  const variable = connect ? "STRIPE_CONNECT_WEBHOOK_SECRET" : "STRIPE_WEBHOOK_SECRET";
  const { data } = await stripe.webhookEndpoints.list({ limit: 100 });
  const existing = data.find((endpoint) => endpoint.url === url);
  if (existing) {
    await stripe.webhookEndpoints.update(existing.id, { enabled_events: events, disabled: false });
    console.log(`Webhook      ${existing.id} (already there, events updated)`);
    console.log("             Its signing secret is on that endpoint's page in Stripe's dashboard.");
    if (existing.api_version !== Stripe.API_VERSION) {
      // An endpoint's API version is fixed at creation; the server reads events in this one.
      console.log(`             Its API version is ${existing.api_version ?? "the account's default"}, not ${Stripe.API_VERSION}:`);
      console.log("             delete it in the dashboard and run this again to recreate it.");
    }
    return;
  }
  const endpoint = await stripe.webhookEndpoints.create({
    url,
    enabled_events: events,
    connect,
    description: connect ? "WorldHair server — salons' payouts" : "WorldHair server — subscriptions and payments",
    // Events shaped like the SDK the server reads them with, whatever the account's default.
    api_version: Stripe.API_VERSION,
  });
  console.log(`Webhook      ${endpoint.id} (created${connect ? ", Connect" : ""})`);
  console.log(`\n${variable}=${endpoint.secret}`);
  console.log("Put it in the server's .env (and on Render). Stripe shows it only once here.\n");
}

async function main(): Promise<void> {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    throw new Error("STRIPE_SECRET_KEY is empty in .env — see .env.example.");
  }
  const stripe = new Stripe(key);
  console.log(`Stripe account in ${key.startsWith("sk_live_") ? "LIVE" : "test"} mode\n`);

  const catalog: { product: Stripe.Product; prices: Stripe.Price[] }[] = [];
  for (const tier of SUBSCRIPTION_TIERS) {
    const product = await ensureProduct(stripe, tier);
    const monthly = await ensurePrice(stripe, product, PLAN_LOOKUP_KEYS[tier].monthly, "month", euros(`${tier}-monthly`, DEFAULT_EUROS[tier].monthly));
    const yearly = await ensurePrice(stripe, product, PLAN_LOOKUP_KEYS[tier].yearly, "year", euros(`${tier}-yearly`, DEFAULT_EUROS[tier].yearly));
    catalog.push({ product, prices: [monthly, yearly] });
  }
  await ensurePortal(stripe, catalog);

  const webhookUrl = argument("webhook-url");
  if (webhookUrl) {
    await ensureWebhook(stripe, webhookUrl, WEBHOOK_EVENTS, false);
    // Connect must be switched on in the dashboard first (Connect → Get started).
    await ensureWebhook(stripe, `${webhookUrl.replace(/\/+$/, "")}/connect`, CONNECT_EVENTS, true);
  } else {
    console.log("\nNo --webhook-url: add the endpoints yourself, or run again with it.");
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
