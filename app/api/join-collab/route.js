import { supabaseFromRequest } from '@/lib/supabaseServer';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

/**
 * Join a collaborative deck by its link token. Done server-side with the
 * admin client on purpose: it avoids ever needing a broad RLS policy like
 * "anyone can read collab-enabled decks", which would leak deck titles to
 * every logged-in user, not just people holding the specific link.
 */
export async function POST(request) {
  const supabase = supabaseFromRequest(request);
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) return Response.json({ error: 'Please log in first.' }, { status: 401 });

  const { collabId } = await request.json().catch(() => ({}));
  if (!collabId) return Response.json({ error: 'Missing link.' }, { status: 400 });

  const admin = supabaseAdmin();
  const { data: deck, error: deckError } = await admin
    .from('decks').select('id, title, collab_enabled').eq('collab_id', collabId).maybeSingle();

  if (deckError || !deck || !deck.collab_enabled) {
    return Response.json({ error: 'This collaboration link is invalid or has been turned off.' }, { status: 404 });
  }

  const { error: joinError } = await admin
    .from('deck_collaborators')
    .upsert({ deck_id: deck.id, user_id: user.id }, { onConflict: 'deck_id,user_id' });
  if (joinError) return Response.json({ error: 'Could not join this deck.' }, { status: 500 });

  return Response.json({ deckId: deck.id, title: deck.title });
}
