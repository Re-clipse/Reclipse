import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

// Runs at import time in nearly every page, so a missing env var used to
// surface as a bare "Error: supabaseUrl is required." — accurate but
// useless for pointing someone at the actual fix.
if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY must be set — see .env.example.'
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
