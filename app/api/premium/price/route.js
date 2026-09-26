import { premiumDisplayPrice } from '@/lib/stripe';

/** Public — no login required. Lets any page show the real Reclipse Plus price before checkout. */
export async function GET(request) {
  const interval = new URL(request.url).searchParams.get('interval') === 'year' ? 'year' : 'month';
  const price = await premiumDisplayPrice(interval);
  return Response.json({ price });
}
