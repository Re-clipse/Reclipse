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

export const PLATFORM_FEE_PERCENT = 20; // Reclipse's cut of each archive sale.

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
