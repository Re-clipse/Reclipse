import Stripe from 'stripe';

// Payments are optional until real keys are configured. Every payment route
// checks this first and returns a clear "not set up yet" message rather than
// crashing or, worse, appearing to take money it can't actually charge.
export function stripeConfigured() {
  return Boolean(process.env.STRIPE_SECRET_KEY && process.env.STRIPE_WEBHOOK_SECRET);
}

export function stripe() {
  if (!process.env.STRIPE_SECRET_KEY) throw new Error('STRIPE_SECRET_KEY is not set');
  return new Stripe(process.env.STRIPE_SECRET_KEY);
}

// The Campus Archive is a monthly subscription. Prefer a Price created in the
// Stripe dashboard (STRIPE_ARCHIVE_PRICE_ID); otherwise fall back to an inline
// monthly price built from ARCHIVE_MONTHLY_PRICE_CENTS. Neither set = disabled.
export function archiveLineItem() {
  if (process.env.STRIPE_ARCHIVE_PRICE_ID) {
    return { price: process.env.STRIPE_ARCHIVE_PRICE_ID, quantity: 1 };
  }
  const cents = parseInt(process.env.ARCHIVE_MONTHLY_PRICE_CENTS || '', 10);
  if (!cents || cents < 50) return null;
  return {
    quantity: 1,
    price_data: {
      currency: 'cad',
      unit_amount: cents,
      recurring: { interval: 'month' },
      product_data: { name: 'Reclipse Campus Archive', description: 'Monthly access to every archived study set.' },
    },
  };
}

// What to actually show a student before they click "Get access" — nothing
// in the UI stated a price at all until this was added. Handles both of
// archiveLineItem()'s configuration paths so the displayed number always
// matches what checkout will actually charge.
export async function archiveDisplayPrice() {
  if (process.env.STRIPE_ARCHIVE_PRICE_ID) {
    if (!stripeConfigured()) return null;
    try {
      const price = await stripe().prices.retrieve(process.env.STRIPE_ARCHIVE_PRICE_ID);
      if (!price.unit_amount) return null;
      return { amountCents: price.unit_amount, currency: price.currency, interval: price.recurring?.interval || 'month' };
    } catch (err) {
      console.error('archiveDisplayPrice: could not fetch Stripe price:', err.message);
      return null;
    }
  }
  const cents = parseInt(process.env.ARCHIVE_MONTHLY_PRICE_CENTS || '', 10);
  if (!cents || cents < 50) return null;
  return { amountCents: cents, currency: 'cad', interval: 'month' };
}

// Reclipse Plus — the new premium subscription. NOT Campus Archive, which is
// shelved; this is a separate product/price entirely. Same dashboard-Price-
// or-inline-cents fallback pattern as archiveLineItem(), extended with a
// monthly/annual interval switch.
export function premiumLineItem(interval) {
  const priceIdVar = interval === 'year' ? 'STRIPE_PREMIUM_ANNUAL_PRICE_ID' : 'STRIPE_PREMIUM_MONTHLY_PRICE_ID';
  if (process.env[priceIdVar]) {
    return { price: process.env[priceIdVar], quantity: 1 };
  }
  const centsVar = interval === 'year' ? 'PREMIUM_ANNUAL_PRICE_CENTS' : 'PREMIUM_MONTHLY_PRICE_CENTS';
  const cents = parseInt(process.env[centsVar] || '', 10);
  if (!cents || cents < 50) return null;
  return {
    quantity: 1,
    price_data: {
      currency: 'cad',
      unit_amount: cents,
      recurring: { interval: interval === 'year' ? 'year' : 'month' },
      product_data: { name: 'Reclipse Plus', description: 'More AI generations, no daily limit, and priority speed.' },
    },
  };
}

export async function premiumDisplayPrice(interval) {
  const priceIdVar = interval === 'year' ? 'STRIPE_PREMIUM_ANNUAL_PRICE_ID' : 'STRIPE_PREMIUM_MONTHLY_PRICE_ID';
  if (process.env[priceIdVar]) {
    if (!stripeConfigured()) return null;
    try {
      const price = await stripe().prices.retrieve(process.env[priceIdVar]);
      if (!price.unit_amount) return null;
      return { amountCents: price.unit_amount, currency: price.currency, interval: price.recurring?.interval || (interval === 'year' ? 'year' : 'month') };
    } catch (err) {
      console.error('premiumDisplayPrice: could not fetch Stripe price:', err.message);
      return null;
    }
  }
  const centsVar = interval === 'year' ? 'PREMIUM_ANNUAL_PRICE_CENTS' : 'PREMIUM_MONTHLY_PRICE_CENTS';
  const cents = parseInt(process.env[centsVar] || '', 10);
  if (!cents || cents < 50) return null;
  return { amountCents: cents, currency: 'cad', interval: interval === 'year' ? 'year' : 'month' };
}

// The referral reward is a Stripe Coupon (percent off, duration "once"),
// created once in the Stripe dashboard and referenced by id here — not
// built or priced in code. Whoever controls the dashboard controls the
// discount amount without a deploy.
export function referralCouponId() {
  return process.env.STRIPE_REFERRAL_COUPON_ID || null;
}
