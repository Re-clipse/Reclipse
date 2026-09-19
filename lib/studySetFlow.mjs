import { normalizeStudyMaterial } from './studyMaterial.mjs';

export async function generateStudyDraft({ session, text, title, courseId }, fetcher = fetch) {
  if (!session?.access_token || !session.user?.id) throw new Error('Please log in again.');
  const source = text.slice(0, 24000);
  const response = await fetcher('/api/generate', {
    method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
    body: JSON.stringify({ text: source }),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Could not generate a study set.');
  return {
    requestId: crypto.randomUUID(), userId: session.user.id,
    title: title.trim().slice(0, 200) || 'Untitled deck', source,
    courseId: courseId || null, material: normalizeStudyMaterial(data),
  };
}

export async function persistStudyDraft(supabase, draft, session) {
  if (!session?.access_token || !session.user?.id) throw new Error('Please log in again, then retry saving.');
  if (session.user.id !== draft.userId) throw new Error('Please return to the original account to save this study set.');
  const { data, error } = await supabase.rpc('save_study_set', {
    p_request_id: draft.requestId, p_title: draft.title, p_source_text: draft.source,
    p_course_id: draft.courseId, p_material: draft.material,
  });
  if (error || typeof data !== 'string' || !data) {
    throw new Error('Your study set is ready, but saving failed. Keep this page open and retry saving.');
  }
  return data;
}
