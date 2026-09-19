import { createClient } from '@supabase/supabase-js';

// Creates a Supabase client scoped to whoever's access token is on this
// request, so RLS policies (auth.uid() = user_id) apply correctly and we
// never have to trust a user_id the client claims to be.
export function supabaseFromRequest(request) {
  const authHeader = request.headers.get('authorization') || '';
  const token = authHeader.replace(/^Bearer\s+/i, '');

  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    { global: { headers: { Authorization: `Bearer ${token}` } } }
  );
}
