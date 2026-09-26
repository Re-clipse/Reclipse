// TEMPORARY diagnostic route — no secrets returned, just presence/length, so
// this can be checked directly (curl) without going through a browser and a
// human relay. DELETE this file once the ANTHROPIC_API_KEY runtime issue is
// confirmed resolved.
export async function GET() {
  const key = process.env.ANTHROPIC_API_KEY || '';
  return Response.json({
    hasKey: Boolean(key),
    keyLength: key.length,
    keyPrefix: key.slice(0, 12),
    keySuffix: key.slice(-6),
    nodeEnv: process.env.NODE_ENV,
    vercelEnv: process.env.VERCEL_ENV,
  });
}
