import { supabaseFromRequest } from '@/lib/supabaseServer';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

// 7 chars from an unambiguous alphabet (no 0/O/1/I/L) — short enough to read
// out loud, long enough that guessing one is not practical.
const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
function randomCode() {
  let s = '';
  for (let i = 0; i < 7; i++) s += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
  return s;
}

/** Returns the caller's referral code, generating and saving one the first time. */
export async function GET(request) {
  const supabase = supabaseFromRequest(request);
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) return Response.json({ error: 'Please log in first.' }, { status: 401 });

  const admin = supabaseAdmin();
  const { data: existing } = await admin.from('profiles')
    .select('referral_code').eq('user_id', user.id).maybeSingle();
  if (existing?.referral_code) return Response.json({ code: existing.referral_code });

  // referral_code is UNIQUE — collisions are astronomically unlikely at this
  // app's scale (32^7 codes), but retry a few times rather than assume.
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = randomCode();
    const { error } = await admin.from('profiles')
      .upsert({ user_id: user.id, referral_code: code }, { onConflict: 'user_id' });
    if (!error) return Response.json({ code });
    if (error.code !== '23505') {
      console.error('referral code generation failed:', error);
      return Response.json({ error: 'Could not create a referral link.' }, { status: 500 });
    }
    // 23505 = unique violation on referral_code itself — try another code.
  }
  return Response.json({ error: 'Could not create a referral link. Please try again.' }, { status: 500 });
}
