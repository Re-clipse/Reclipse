import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { verifyUnsubscribeToken } from '@/lib/emailToken';

// Opened directly from an email client, never called by the app itself, so
// it renders a small HTML page rather than returning JSON. No login required
// — the signed token in the link is what proves who's unsubscribing.
function page({ title, message }) {
  return `<!doctype html><html><head><meta charset="utf-8"><title>${title}</title>
<meta name="viewport" content="width=device-width, initial-scale=1">
<style>
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background:#F7F5FF; color:#1A1523;
         display:flex; align-items:center; justify-content:center; min-height:100vh; margin:0; padding:24px; }
  .card { background:#fff; border-radius:16px; padding:32px; max-width:420px; text-align:center; box-shadow:0 12px 32px rgba(124,58,237,.12); }
  h1 { font-size:1.25rem; margin:0 0 8px; }
  p { color:#5B5570; line-height:1.5; }
  a { color:#7C3AED; font-weight:600; text-decoration:none; }
</style></head>
<body><div class="card"><h1>${title}</h1><p>${message}</p><p><a href="/settings">Manage email preferences</a></p></div></body></html>`;
}

export async function GET(request) {
  const token = new URL(request.url).searchParams.get('token');
  const userId = verifyUnsubscribeToken(token);

  if (!userId) {
    return new Response(
      page({
        title: 'Link expired',
        message: "This unsubscribe link isn't valid. If you're still getting emails you don't want, sign in and turn them off from Settings.",
      }),
      { status: 400, headers: { 'Content-Type': 'text/html' } }
    );
  }

  await supabaseAdmin().from('profiles').upsert(
    { user_id: userId, emails_enabled: false },
    { onConflict: 'user_id' }
  );

  return new Response(
    page({
      title: "You're unsubscribed",
      message: "We won't send you any more reminder emails. You can turn them back on anytime from Settings.",
    }),
    { headers: { 'Content-Type': 'text/html' } }
  );
}
