import crypto from 'crypto';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

// Called on a schedule (see vercel.json) — permanently deletes decks that
// have sat in Trash for 30+ days. Uses the admin client deliberately: a
// cron job isn't "someone", so RLS can't be the authorization boundary —
// the deleted_at cutoff below is.
export async function GET(request) {
  // Fail closed: an unset CRON_SECRET must block every request, not skip
  // the check — same reasoning as /api/send-reminders.
  if (!process.env.CRON_SECRET) {
    return Response.json({ error: 'CRON_SECRET is not configured' }, { status: 503 });
  }
  const given = Buffer.from(request.headers.get('authorization') || '');
  const expected = Buffer.from(`Bearer ${process.env.CRON_SECRET}`);
  if (given.length !== expected.length || !crypto.timingSafeEqual(given, expected)) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const admin = supabaseAdmin();
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 30);

  const { data, error } = await admin
    .from('decks')
    .delete()
    .lt('deleted_at', cutoff.toISOString())
    .select('id');

  if (error) {
    console.error('purge-trash error:', error);
    return Response.json({ error: 'Purge failed' }, { status: 500 });
  }

  return Response.json({ purged: data?.length || 0 });
}
