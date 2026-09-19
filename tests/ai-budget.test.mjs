import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadRoute } from './route-loader.mjs';

const material = { summary: '- Notes', flashcards: [{ question: 'Why?', answer: 'Because.', type: 'basic' }], quiz: [] };
const text = 'Lecture notes about photosynthesis and how plants convert light into chemical energy.';
async function setup(path, { allowed = true, error = null, valid = true, output, env = {}, authError = null, rpcThrows = false } = {}) {
  const calls = { ai: 0, reservations: [] };
  const legacy = { select() { return this; }, eq() { return this; }, maybeSingle: async () => ({ data: null }), upsert: async () => ({ error: null }) };
  const route = await loadRoute(`app/api/${path}/route.js`, {
    '@anthropic-ai/sdk': { default: class {
      messages = { create: async () => {
        calls.ai++;
        return { content: [{ type: 'text', text: output ?? JSON.stringify(path === 'parse-syllabus' ? { events: [] } : material) }] };
      } };
    } },
    '@/lib/supabaseServer': { supabaseFromRequest: () => ({
      auth: { getUser: async () => ({ data: { user: valid ? { id: 'verified-user' } : null }, error: authError }) },
      from: () => legacy,
    }) },
    '@/lib/supabaseAdmin': { supabaseAdmin: () => ({ rpc: async (name, args) => {
      calls.reservations.push({ name, args });
      if (rpcThrows) throw new Error('Connection interrupted');
      return { data: allowed, error };
    } }) },
  }, env);
  const request = (body = { text }, token = 'Bearer session') => new Request('https://reclipse.test/api/'+path, {
    method: 'POST', headers: { authorization: token, 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  });
  return { route, request, calls };
}
for (const path of ['generate','parse-syllabus']) {
  test(`${path}: budget exhausted blocks AI`, async () => {
    const { route, request, calls } = await setup(path, { allowed: false });
    assert.equal((await route.POST(request())).status, 429);
    assert.equal(calls.ai, 0);
  });
  test(`${path}: database unavailable fails closed`, async () => {
    const { route, request, calls } = await setup(path, { error: { message: 'Database unavailable' } });
    assert.equal((await route.POST(request())).status, 503);
    assert.equal(calls.ai, 0);
  });
  test(`${path}: authenticated identity controls the reservation`, async () => {
    const { route, request, calls } = await setup(path);
    assert.equal((await route.POST(request({ text, user_id: 'attacker-selected', limit: 999999 }))).status, 200);
    assert.equal(calls.ai, 1);
    assert.equal(calls.reservations.length, 1);
    assert.equal(calls.reservations[0].args.p_user_id, 'verified-user');
    assert.equal(calls.reservations[0].args.p_limit, 5);
    assert.equal(calls.reservations[0].args.p_operation, path === 'generate' ? 'generation' : 'syllabus');
  });
  for (const body of [null, { text: 123 }, { text: 'tiny' }]) {
    test(`${path}: invalid input does not consume quota: ${JSON.stringify(body)}`, async () => {
      const { route, request, calls } = await setup(path);
      assert.equal((await route.POST(request(body))).status, 400);
      assert.equal(calls.reservations.length, 0);
      assert.equal(calls.ai, 0);
    });
  }
  test(`${path}: invalid login never reserves usage`, async () => {
    const { route, request, calls } = await setup(path, { valid: false });
    assert.equal((await route.POST(request())).status, 401);
    assert.equal(calls.reservations.length, 0);
  });
  test(`${path}: malformed AI response fails without a second AI call`, async () => {
    const { route, request, calls } = await setup(path, { output: '{invalid JSON' });
    assert.equal((await route.POST(request())).status, 502);
    assert.equal(calls.ai, 1);
    assert.equal(calls.reservations.length, 1);
  });
}
for (const value of ['0','-1','abc','Infinity','1.5']) {
  test(`invalid server quota ${value} fails closed`, async () => {
    const { route, request, calls } = await setup('generate', { env: { DAILY_GENERATION_LIMIT: value } });
    assert.equal((await route.POST(request())).status, 503);
    assert.equal(calls.ai, 0);
    assert.equal(calls.reservations.length, 0);
  });
}

test('syllabus skips impossible dates and malformed entries', async () => {
  const output = JSON.stringify({ events: [null, { title: 'Bad date', date: '2026-02-30' },
    { title: 'Midterm', date: '2026-10-14', type: 'exam' }] });
  const { route, request } = await setup('parse-syllabus', { output });
  const response = await route.POST(request());
  assert.equal(response.status, 200);
  assert.deepEqual((await response.json()).events, [{ title: 'Midterm', date: '2026-10-14', type: 'exam' }]);
});
test('ambiguous quota response never enables an AI call', async () => {
  const { route, request, calls } = await setup('generate', { allowed: null });
  assert.equal((await route.POST(request())).status, 503);
  assert.equal(calls.ai, 0);
});

test('malformed JSON input is rejected before reservation', async () => {
  const { route, calls } = await setup('generate');
  const response = await route.POST(new Request('https://reclipse.test/api/generate', {
    method: 'POST', headers: { authorization: 'Bearer valid' }, body: '{invalid',
  }));
  assert.equal(response.status, 400);
  assert.equal(calls.reservations.length, 0);
});
test('quota transport failures stop generation', async () => {
  const { route, request, calls } = await setup('generate', { rpcThrows: true });
  assert.equal((await route.POST(request())).status, 503);
  assert.equal(calls.ai, 0);
});
test('Auth service failure stops generation without charging', async () => {
  const { route, request, calls } = await setup('generate', { authError: { status: 503 } });
  assert.equal((await route.POST(request())).status, 503);
  assert.equal(calls.reservations.length, 0);
});
test('a configured daily limit is passed only by the server', async () => {
  const { route, request, calls } = await setup('generate', { env: { DAILY_GENERATION_LIMIT: '8' } });
  assert.equal((await route.POST(request())).status, 200);
  assert.equal(calls.reservations[0].args.p_limit, 8);
});
