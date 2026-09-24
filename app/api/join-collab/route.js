import { supabaseFromRequest } from '@/lib/supabaseServer';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { escapeHtml, sendEmail, SITE_URL } from '@/lib/email';

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
    .from('decks').select('id, title, user_id, collab_enabled').eq('collab_id', collabId).is('deleted_at', null).maybeSingle();

  if (deckError || !deck || !deck.collab_enabled) {
    return Response.json({ error: 'This collaboration link is invalid or has been turned off.' }, { status: 404 });
  }

  // Distinguish a genuinely new join from someone revisiting a link they
  // already joined — the upsert alone can't tell us that, and we only want
  // to notify the owner once per collaborator, not on every repeat visit.
  const { data: existing } = await admin
    .from('deck_collaborators').select('user_id').eq('deck_id', deck.id).eq('user_id', user.id).maybeSingle();
  const isNewJoin = !existing;

  const { error: joinError } = await admin
    .from('deck_collaborators')
    .upsert({ deck_id: deck.id, user_id: user.id }, { onConflict: 'deck_id,user_id' });
  if (joinError) return Response.json({ error: 'Could not join this deck.' }, { status: 500 });

  if (isNewJoin && deck.user_id !== user.id) notifyOwner(admin, deck, user).catch(() => {});

  return Response.json({ deckId: deck.id, title: deck.title });
}

async function notifyOwner(admin, deck, joiner) {
  const { data: profile } = await admin.from('profiles').select('emails_enabled').eq('user_id', deck.user_id).maybeSingle();
  if (profile && profile.emails_enabled === false) return;

  const { data: ownerAuth } = await admin.auth.admin.getUserById(deck.user_id);
  const ownerEmail = ownerAuth?.user?.email;
  if (!ownerEmail) return;

  const { data: joinerProfile } = await admin.from('profiles').select('display_name').eq('user_id', joiner.id).maybeSingle();
  const joinerName = joinerProfile?.display_name || joiner.email || 'Someone';
  await sendEmail(deck.user_id, ownerEmail, {
    subject: `${joinerName} joined your deck "${deck.title}"`,
    html: `
      <p><strong>${escapeHtml(joinerName)}</strong> just joined <strong>${escapeHtml(deck.title)}</strong> using your collaboration link.</p>
      <p><a href="${SITE_URL}/deck/${deck.id}">Open the deck</a></p>
    `,
  });
}
