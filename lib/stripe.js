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
