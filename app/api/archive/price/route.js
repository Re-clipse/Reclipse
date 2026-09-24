import { archiveDisplayPrice } from '@/lib/stripe';

/** Public — no login required. Lets any page show the real Campus Archive price before checkout. */
export async function GET() {
  const price = await archiveDisplayPrice();
  return Response.json({ price });
}
