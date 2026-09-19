import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateStudyDraft, persistStudyDraft } from '../lib/studySetFlow.mjs';

const session = { access_token: 'session-token', user: { id: 'alice' } };
const material = { summary: '- Energy', flashcards: [{ question: 'Q?', answer: 'A', type: 'basic' }], quiz: [] };
test('retrying a failed save reuses the generated data and request ID', async () => {
  let generated = 0;
  const draft = await generateStudyDraft({ session, text: 'x'.repeat(25000), title: 'Biology', courseId: '' }, async (_, request) => {
    generated++;
    assert.equal(request.headers.Authorization, 'Bearer session-token');
    assert.equal(JSON.parse(request.body).text.length, 24000);
    return Response.json(material);
  });
  const calls = [];
  const supabase = { rpc: async (name, args) => {
    calls.push({ name, args });
    return calls.length === 1 ? { error: { message: 'Temporary network error' } } : { data: 'saved-deck', error: null };
  } };
  await assert.rejects(persistStudyDraft(supabase, draft, session));
  assert.equal(await persistStudyDraft(supabase, draft, session), 'saved-deck');
  assert.equal(generated, 1);
  assert.equal(calls[0].name, 'save_study_set');
  assert.deepEqual(calls[0].args, calls[1].args);
  assert.equal(calls[0].args.p_course_id, null);
  assert.equal(calls[0].args.p_source_text.length, 24000);
});
test('switching accounts cannot save a previous student’s draft', async () => {
  const draft = { userId: 'alice' };
  await assert.rejects(persistStudyDraft({ rpc() { assert.fail('must not call RPC'); } }, draft,
    { access_token: 'bob-token', user: { id: 'bob' } }), /original account/i);
});
test('expired session cannot save a draft', async () => {
  await assert.rejects(persistStudyDraft({}, { userId: 'alice' }, null), /log in/i);
});
test('API failures are surfaced before any draft is saved', async () => {
  await assert.rejects(generateStudyDraft({ session, text: 'notes', title: 'test' }, async () =>
    Response.json({ error: 'Daily limit reached.' }, { status: 429 })), /Daily limit reached/);
});
