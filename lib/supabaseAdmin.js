import { createClient } from '@supabase/supabase-js';

// SERVER-ONLY. Uses the service role key, which bypasses RLS entirely.
// Never import this from a 'use client' file — it would ship the key to the
// browser. Only used by routes that need to act across users deliberately
// (joining a collaborative deck by link, sending scheduled reminder emails),
// and each of those routes is responsible for its own narrow authorization
// logic since RLS is no longer doing that job for them.
export function supabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false } }
  );
}
